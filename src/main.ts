import { dedupeByTitle, rankFacts } from './facts/engine';
import { journalAdd, journalEntries } from './facts/journal';
import { Session, UNLOCK_DISTANCE_M } from './facts/session';
import { bearingDeg, compassName, distanceM, formatDistance } from './geo';
import { radarLayout } from './radar/layout';
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
let lastShownFact: Fact | null = null;

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

function renderFact(fact: Fact, revisit = false): void {
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
  if (revisit) {
    const back = el('button', undefined, 'Back to radar');
    back.addEventListener('click', () => renderRadar());
    actions.append(back);
  } else {
    const next = el('button', undefined, 'Next fact');
    next.addEventListener('click', () => showNext());
    actions.append(next);
    if (journalEntries().length > 1) {
      const radar = el('button', 'ghost', 'Radar');
      radar.addEventListener('click', () => renderRadar());
      actions.append(radar);
    }
  }
  box.append(actions);

  if (!revisit) {
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
  }

  screen(box);
}

const SVG_NS = 'http://www.w3.org/2000/svg';

function svgEl<K extends keyof SVGElementTagNameMap>(
  tag: K,
  attrs: Record<string, string>,
): SVGElementTagNameMap[K] {
  const node = document.createElementNS(SVG_NS, tag);
  for (const [k, v] of Object.entries(attrs)) node.setAttribute(k, v);
  return node;
}

/**
 * The radar: everything you've seen, plotted around you by true direction
 * and distance, north up, zoomed so the farthest item still fits.
 */
function renderRadar(selectedId?: string): void {
  const center = userCoords;
  const entries = journalEntries();
  const box = el('div', 'screen radar-screen');
  box.append(el('h1', undefined, 'Seen around you'));

  if (!center) {
    box.append(el('p', 'lede', 'The radar needs a position first.'));
    screen(box);
    return;
  }

  const anchored = entries.filter((e) => e.fact.coords);
  const RADIUS = 160;
  const { points, rings } = radarLayout(
    anchored.map((e) => ({ item: e.fact, coords: e.fact.coords! })),
    center,
    RADIUS,
  );

  if (points.length === 0) {
    box.append(el('p', 'lede', 'Nothing with a location in your journal yet.'));
  } else {
    const svg = svgEl('svg', {
      viewBox: `${-RADIUS} ${-RADIUS} ${RADIUS * 2} ${RADIUS * 2}`,
      class: 'radar',
      role: 'img',
      'aria-label': 'Radar of seen facts around you',
    });

    for (const ring of rings) {
      svg.append(
        svgEl('circle', {
          cx: '0',
          cy: '0',
          r: String(ring.radiusPx),
          class: 'radar-ring',
        }),
      );
      const label = svgEl('text', {
        x: '4',
        y: String(-ring.radiusPx + 11),
        class: 'radar-ring-label',
      });
      label.textContent = ring.label;
      svg.append(label);
    }

    const north = svgEl('text', {
      x: '0',
      y: String(-RADIUS + 10),
      class: 'radar-north',
      'text-anchor': 'middle',
    });
    north.textContent = 'N';
    svg.append(north);

    // You, in the middle.
    svg.append(svgEl('circle', { cx: '0', cy: '0', r: '4', class: 'radar-you' }));

    for (const p of points) {
      const fact = p.item as Fact;
      const isSelected = fact.id === selectedId;
      const dot = svgEl('circle', {
        cx: p.x.toFixed(1),
        cy: p.y.toFixed(1),
        r: isSelected ? '9' : '6',
        class: isSelected ? 'radar-dot selected' : 'radar-dot',
        role: 'button',
        tabindex: '0',
        'aria-label': fact.title,
      });
      const open = () => renderRadar(fact.id);
      dot.addEventListener('click', open);
      dot.addEventListener('keydown', (ev) => {
        if ((ev as KeyboardEvent).key === 'Enter') open();
      });
      svg.append(dot);
    }
    box.append(svg);

    const selected = anchored.find((e) => e.fact.id === selectedId)?.fact;
    if (selected) {
      const detail = el('div', 'radar-detail');
      detail.append(el('h2', undefined, selected.title));
      const d = distanceM(center, selected.coords!);
      const dir = compassName(bearingDeg(center, selected.coords!));
      detail.append(
        el(
          'p',
          'anchor-line',
          d < 30 ? '→ right here' : `→ ${formatDistance(d)} ${dir} of you`,
        ),
      );
      const read = el('button', 'ghost', 'Read again');
      read.addEventListener('click', () =>
        renderFact({ ...selected, distanceM: d, direction: dir }, true),
      );
      detail.append(read);
      box.append(detail);
    } else {
      box.append(el('p', 'hint', 'Tap a dot to see what it was.'));
    }

    const unanchored = entries.length - anchored.length;
    if (unanchored > 0) {
      box.append(
        el(
          'p',
          'hint',
          `${unanchored} fact${unanchored === 1 ? '' : 's'} without a place (weather, sunset) aren’t shown.`,
        ),
      );
    }
  }

  const actions = el('div', 'actions');
  const back = el('button', undefined, 'Back to facts');
  back.addEventListener('click', () => resumeSession());
  actions.append(back);
  box.append(actions);
  screen(box);
}

/** Return from the radar to wherever the session actually stands. */
function resumeSession(): void {
  if (lastShownFact && !session.capReached) renderFact(lastShownFact);
  else if (session.capReached) renderOutOfFacts('cap');
  else if (userCoords) startSession(userCoords);
  else renderStart();
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

  const actions = el('div', 'actions');
  if (journalEntries().length > 0) {
    const radar = el('button', undefined, 'Radar');
    radar.addEventListener('click', () => renderRadar());
    actions.append(radar);
  }
  const retry = el('button', 'ghost', 'Check again');
  retry.addEventListener('click', () => {
    if (userCoords) startSession(userCoords);
  });
  const elsewhere = el('button', 'ghost', 'Somewhere else');
  elsewhere.addEventListener('click', () => {
    placeLabel = '';
    renderStart();
  });
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
  lastShownFact = fact;
  journalAdd(fact);
  renderFact(fact);
}

renderStart();
