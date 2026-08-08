import { dedupeByTitle, rankFacts } from './facts/engine';
import { Session, UNLOCK_DISTANCE_M } from './facts/session';
import { formatDistance } from './geo';
import { etymologyCandidates } from './sources/etymology';
import { geocodePlace } from './sources/geocode';
import { overpassCandidates } from './sources/overpass';
import { sunCandidates } from './sources/sun';
import { transportCandidates } from './sources/transport';
import { weatherCandidates } from './sources/weather';
import { wikidataCandidates } from './sources/wikidata';
import { wikipediaCandidates, wikipediaLang } from './sources/wikipedia';
import type { Coords, Fact, FactCandidate } from './types';

const app = document.getElementById('app')!;

const session = new Session();
let userCoords: Coords | null = null;
let placeLabel = '';
let queue: Fact[] = [];
let watchId: number | null = null;

// ---------- rendering helpers ----------

function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  className?: string,
  text?: string,
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function masthead(): HTMLElement {
  const h = el('p', 'wordmark');
  h.innerHTML = 'Mind <span class="dot">·</span> the <span class="dot">·</span> Moment';
  return h;
}

function screen(...children: (HTMLElement | null)[]): void {
  app.replaceChildren(masthead(), ...children.filter((c): c is HTMLElement => c !== null));
}

// ---------- screens ----------

function renderStart(status?: string, isError = false): void {
  const box = el('div', 'screen');
  box.append(el('h1', undefined, 'Look up. You’re somewhere interesting.'));
  box.append(
    el(
      'p',
      'lede',
      'True facts about the buildings, streets and moments around you — instead of another feed.',
    ),
  );

  const locateBtn = el('button', undefined, 'Use my location');
  locateBtn.addEventListener('click', () => locate());
  box.append(locateBtn);

  box.append(el('div', 'divider', 'or'));

  const form = el('form', 'place-form') as HTMLFormElement;
  const input = el('input') as HTMLInputElement;
  input.placeholder = 'Type a place, e.g. Ludwigsburg';
  input.name = 'place';
  input.autocomplete = 'off';
  const go = el('button', 'ghost', 'Go');
  form.append(input, go);
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const query = input.value.trim();
    if (!query) return;
    renderStatus(`Finding “${query}”…`);
    try {
      const hit = await geocodePlace(query);
      if (!hit) {
        renderStart(`No place found for “${query}”. Try another name.`, true);
        return;
      }
      placeLabel = hit.displayName;
      await startSession(hit.coords);
    } catch {
      renderStart('Could not reach the geocoding service. Try again.', true);
    }
  });
  box.append(form);

  if (status) box.append(el('p', isError ? 'hint error' : 'hint', status));
  screen(box);
}

function renderStatus(message: string): void {
  const box = el('div', 'screen');
  box.append(el('p', 'status', message));
  screen(box);
}

function renderFact(fact: Fact): void {
  const box = el('div', 'screen');

  if (placeLabel) box.append(el('p', 'locality', placeLabel));

  const card = el('article', 'fact-card');
  card.append(el('h2', undefined, fact.title));

  if (fact.distanceM !== undefined && fact.direction) {
    card.append(
      el(
        'p',
        'anchor-line',
        fact.distanceM < 30
          ? '→ right here'
          : `→ ${formatDistance(fact.distanceM)} ${fact.direction} of you`,
      ),
    );
  }

  card.append(el('p', 'fact-text', fact.text));

  const meta = el('div', 'meta');
  if (fact.sourceUrl) {
    const link = el('a', undefined, `Source: ${fact.sourceName}`) as HTMLAnchorElement;
    link.href = fact.sourceUrl;
    link.target = '_blank';
    link.rel = 'noopener';
    meta.append(link);
  } else {
    meta.append(el('span', undefined, fact.sourceName));
  }
  if (fact.coords) {
    const map = el('a', undefined, 'Show on map') as HTMLAnchorElement;
    map.href = `https://www.openstreetmap.org/?mlat=${fact.coords.lat}&mlon=${fact.coords.lon}#map=18/${fact.coords.lat}/${fact.coords.lon}`;
    map.target = '_blank';
    map.rel = 'noopener';
    meta.append(map);
  }
  card.append(meta);
  box.append(card);

  const actions = el('div', 'actions');
  const next = el('button', undefined, 'Next fact');
  next.addEventListener('click', () => showNext());
  actions.append(next);
  box.append(actions);

  const left = session.factsLeft;
  box.append(
    el(
      'p',
      'hint',
      left > 0
        ? `${left} more fact${left === 1 ? '' : 's'} here — then it’s time to look around.`
        : 'Last one for this spot.',
    ),
  );

  screen(box);
}

function renderOutOfFacts(reason: 'cap' | 'empty'): void {
  const box = el('div', 'screen');
  box.append(
    el(
      'h1',
      undefined,
      reason === 'cap' ? 'You’ve seen what’s here.' : 'This spot is quiet.',
    ),
  );
  box.append(
    el(
      'p',
      'lede',
      reason === 'cap'
        ? `Walk a bit — about ${UNLOCK_DISTANCE_M} m — and new facts unlock. The world refreshes faster than any feed.`
        : 'No documented places found nearby. Walk a few hundred meters and try again, or try a bigger town.',
    ),
  );

  const retry = el('button', 'ghost', 'Check again');
  retry.addEventListener('click', () => {
    if (userCoords) startSession(userCoords);
  });
  const elsewhere = el('button', 'ghost', 'Somewhere else');
  elsewhere.addEventListener('click', () => {
    placeLabel = '';
    renderStart();
  });
  const actions = el('div', 'actions');
  actions.append(retry, elsewhere);
  box.append(actions);
  screen(box);
}

// ---------- flow ----------

function locate(): void {
  if (!('geolocation' in navigator)) {
    renderStart('Your browser has no geolocation — type a place instead.', true);
    return;
  }
  renderStatus('Finding where you are…');
  navigator.geolocation.getCurrentPosition(
    (pos) => {
      placeLabel = '';
      startSession({ lat: pos.coords.latitude, lon: pos.coords.longitude });
      watchMovement();
    },
    () => {
      renderStart(
        'Location was denied or unavailable — type a place instead.',
        true,
      );
    },
    { enableHighAccuracy: true, timeout: 12000, maximumAge: 60000 },
  );
}

/** Movement is the unlock: walking ~150 m resets the session cap. */
function watchMovement(): void {
  if (watchId !== null || !('geolocation' in navigator)) return;
  watchId = navigator.geolocation.watchPosition(
    (pos) => {
      const here = { lat: pos.coords.latitude, lon: pos.coords.longitude };
      userCoords = here;
      if (session.maybeUnlock(here)) {
        startSession(here);
      }
    },
    () => {
      // Lost the position stream; the session simply won't auto-unlock.
    },
    { enableHighAccuracy: false, maximumAge: 30000 },
  );
}

async function wikipediaWithFallback(coords: Coords): Promise<FactCandidate[]> {
  const lang = wikipediaLang();
  let candidates = await wikipediaCandidates(coords, lang);
  // Thin local-language coverage? Merge in English as a fallback.
  if (candidates.length < 3 && lang !== 'en') {
    const english = await wikipediaCandidates(coords, 'en');
    const known = new Set(candidates.map((c) => c.title));
    candidates = candidates.concat(english.filter((c) => !known.has(c.title)));
  }
  return candidates;
}

async function startSession(coords: Coords): Promise<void> {
  userCoords = coords;
  renderStatus('Reading the neighborhood…');

  // All sources in parallel; any one may fail without sinking the session.
  // Order encodes dedupe priority: richer text first.
  const results = await Promise.allSettled([
    wikipediaWithFallback(coords),
    overpassCandidates(coords),
    wikidataCandidates(coords),
    etymologyCandidates(coords),
    transportCandidates(coords),
    weatherCandidates(coords),
  ]);
  for (const r of results) {
    if (r.status === 'rejected') console.warn('source failed:', r.reason);
  }

  const fetched = results.flatMap((r) => (r.status === 'fulfilled' ? r.value : []));
  if (fetched.length === 0 && results.every((r) => r.status === 'rejected')) {
    renderStart('Could not load facts (network hiccup?). Try again.', true);
    return;
  }

  const candidates = dedupeByTitle(fetched.concat(sunCandidates(coords)));
  queue = rankFacts(candidates, coords, session.seenIds);
  if (queue.length === 0) {
    renderOutOfFacts('empty');
    return;
  }
  showNext();
}

function showNext(): void {
  if (session.capReached) {
    renderOutOfFacts('cap');
    return;
  }
  const fact = queue.shift();
  if (!fact || !userCoords) {
    renderOutOfFacts('empty');
    return;
  }
  session.markShown(fact.id, userCoords);
  renderFact(fact);
}

renderStart();
