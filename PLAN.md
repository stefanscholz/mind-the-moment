# Mind the Moment — Location Facts App (Proof of Concept)

A plan for a web app (PoC for a later mobile app) that shows the user
interesting, real facts about their **current location and time** — designed to
replace doom scrolling with something that redirects attention back to the
physical world around them.

Origin of the idea: standing at Ludwigsburg train station and wondering what
the surrounding buildings were previously used for.

---

## 1. Product idea

### The problem
When people are bored (waiting at a train station, standing in line), they
reach for their phone and fall into infinite feeds. The content is disconnected
from where they are and what's around them — it pulls attention *away* from
reality.

### The idea
Open the app → it detects where you are → it shows one interesting, true fact
that is anchored to your surroundings ("The building across the street was a
tobacco factory until 1967") or to the current moment ("On this day in 1846,
the first train arrived at this station"). Facts change constantly because your
location and the time change constantly.

### Why this beats a feed
The fact points *outward*: the natural next action after reading it is to look
up from the phone at the actual building, street, or square. That is the core
design bet, and every design decision below serves it.

### Anti-doomscroll design principles
These are product constraints, not features — the PoC must respect them:

1. **One fact at a time.** A single card fills the screen. No infinite list.
2. **No swipe-feed mechanics.** A deliberate "Next fact" action, not a flick.
   Small friction is intentional.
3. **Look-up prompts.** Each fact includes a physical anchor when possible:
   direction and distance ("120 m north-east — the yellow building").
4. **Session cap.** After ~5 facts, the app suggests: "Walk 200 m and new
   facts unlock." Movement refreshes the pool; sitting still exhausts it.
5. **No notifications in the PoC.** The app is a *better destination* for an
   idle moment, not another interruption source.

---

## 2. Target user & core scenario (PoC scope)

- **User:** anyone with a smartphone browser, standing/waiting somewhere with
  a few idle minutes. First test users: ourselves, in German cities.
- **Scenario:** at a train station / city square, opens the web app, grants
  location permission, reads 2–5 facts, looks around, closes the app.
- **Success feeling:** "I never knew that — and it's *right there*."

Out of scope for the PoC: accounts, offline mode, push notifications, native
apps, gamification, social features.

---

## 3. Where the facts come from (data sources)

This is the make-or-break question. The PoC uses free, open, CORS-friendly
APIs so it can run entirely in the browser without our own backend.

### Tier 1 — PoC must-have
| Source | What it provides | API |
|---|---|---|
| **Wikipedia GeoSearch** | Articles with coordinates near a lat/lon (buildings, monuments, events, people) | `action=query&list=geosearch` + `prop=extracts` for summaries; supports `origin=*` (CORS), no key needed |
| **Wikidata** | Structured facts about nearby entities: inception year, architect, previous use, named-after, heritage status | SPARQL endpoint with radius query (`wikibase:around`), CORS-enabled, no key |

Wikipedia GeoSearch alone already answers the Ludwigsburg question: articles
like "Bahnhof Ludwigsburg" or nearby heritage buildings carry exactly the
"what was this before" history in their extracts.

### Tier 2 — enrichment (stretch goals within the PoC)
| Source | What it provides |
|---|---|
| **OpenStreetMap / Overpass API** | Buildings with `historic=*`, `start_date`, `old_name`, former-use tags — catches unnamed buildings Wikipedia misses |
| **Wikipedia "On this day"** (`api.wikimedia.org/feed/v1/.../onthisday`) | Time anchor: events on today's date, filterable/rankable by proximity to the user's region |
| **Sun & moon computation** (client-side, e.g. suncalc) | "Sunset here in 34 minutes — look west" — a zero-API time-and-place fact |

### Tier 3 — later, beyond PoC
- **LLM narration (Claude API):** turn dry extracts into one crisp, delightful
  two-sentence fact in the user's language; verify the fact stays grounded in
  the source text. Needs a small backend (API key must not ship to browser).
- Municipal open-data portals, state heritage lists (Denkmallisten),
  historical photo archives (e.g. Bildindex), local news archives.

### Fact quality rules
- Every fact links to its source (Wikipedia article, Wikidata item).
- Prefer facts with a *physical anchor* (coordinates → direction + distance).
- Prefer "surprising past use / origin / event" facts over plain descriptions.
- Never invent facts. In the PoC, facts are extracted text, not generated text.

---

## 4. UX / screens (PoC)

Three screens, mobile-first, installable as a PWA later:

1. **Start / permission screen**
   - One sentence of promise ("Discover what's around you"), one button.
   - Asks for geolocation; graceful fallback: type a place name (geocode via
     Nominatim) — also our dev/testing mode ("pretend I'm in Ludwigsburg").

2. **Fact card** (the heart of the app)
   - Big readable text: the fact (2–4 sentences max).
   - Anchor line: "→ 120 m north-east: Altes Rathaus" with a compass-style
     direction hint (device orientation API where available, else "N/E/S/W of
     you").
   - Source link, small.
   - One primary action: "Next fact". Secondary: "Show on map" (static
     OSM embed, no full map UI in PoC).

3. **Out-of-facts screen**
   - Appears after the session cap or when the pool is exhausted:
     "You've seen what's here. Walk a bit — new facts in ~200 m." 

Visual direction: calm, editorial, almost like a museum label. No badges, no
streaks, no red dots.

---

## 5. Architecture (PoC)

**Static single-page web app, no backend.**

```
Browser
 ├─ Geolocation API ──────────────► lat/lon (watchPosition for movement)
 ├─ Wikipedia GeoSearch (CORS) ───► nearby articles + extracts
 ├─ Wikidata SPARQL (CORS) ───────► structured facts for those entities
 ├─ Fact engine (client JS)
 │    ├─ merge + dedupe candidates
 │    ├─ score: distance, "surprise" heuristics, has-anchor, freshness
 │    ├─ format into fact cards (template per fact type)
 │    └─ session state: seen facts, session cap, movement tracking
 └─ UI (fact card, rotation, direction hints)
```

- **Stack:** Vite + vanilla TypeScript (or Preact if components get hairy).
  Deliberately minimal — the PoC's risk is data quality, not framework choice.
- **Fact engine as a pure module** with typed `FactCandidate` / `Fact` types
  and its own unit tests, so the scoring/templating logic survives the jump to
  a native app or a backend later.
- **Caching:** localStorage cache of API responses keyed by rounded
  coordinates (~100 m grid) to stay polite to the APIs and feel instant.
- **Privacy:** location never leaves the device except as API query
  parameters to Wikipedia/Wikidata; no tracking, no analytics in the PoC.
  State only in localStorage.
- **Deployment:** GitHub Pages (static). HTTPS is required for geolocation —
  Pages provides it.

### Fact scoring (first heuristic, to be tuned by field testing)
```
score = w1 · proximity            (closer is better, <500 m strongly preferred)
      + w2 · surprise keywords    ("former", "ehemalig", "destroyed", "founded",
                                   "originally", "renamed", "prison", "factory"…)
      + w3 · has physical anchor  (coordinates → direction/distance line)
      + w4 · time relevance       (anniversary today, sunset soon, …)
      − w5 · already seen         (this session / recent sessions)
```

---

## 6. Milestones

Each milestone is independently demoable.

- **M1 — Walking skeleton (½ day):** Vite app deployed to GitHub Pages;
  geolocation permission flow + manual place fallback; shows raw lat/lon.
- **M2 — First real fact (1 day):** Wikipedia GeoSearch + extracts wired in;
  shows the nearest article's summary as a crude fact card. *Field test at
  Ludwigsburg station — does it answer the original question?*
- **M3 — Fact engine + card UX (1–2 days):** candidate scoring, fact
  templates, direction/distance anchors, "Next fact" rotation, session cap,
  out-of-facts screen, response caching.
- **M4 — Wikidata + time anchors (1–2 days):** SPARQL enrichment (inception,
  architect, former use, heritage status), "on this day" near you, sunset
  facts. Facts get noticeably more specific and more surprising.
- **M5 — Polish & PWA (1 day):** museum-label visual design, install prompt,
  device-orientation compass hint, German/English fact templates.

**Total: roughly one focused week.** After M2 we already know whether the
core bet works; M3–M5 make it feel like a product.

### Evaluation after the PoC
Field-test in 3+ locations (big city, small town, train station). Questions:
- Fact hit rate: does at least 1 genuinely interesting fact appear per spot?
- Did the fact make you look up / walk over? (the real success metric)
- Where does data run dry? → tells us whether Tier-3 sources / LLM narration
  are needed before a mobile app is worth building.

---

## 7. Risks & open questions

| Risk | Assessment | Mitigation |
|---|---|---|
| **Sparse data in small towns** | Highest risk. Wikipedia density varies wildly. | Overpass fallback (M4); widen radius with honest labeling ("2 km away"); evaluate explicitly in field tests |
| Facts are dry/encyclopedic rather than delightful | Likely with raw extracts | Surprise-keyword scoring first; LLM narration (Tier 3) is the known fix, deliberately deferred |
| Geolocation denied / inaccurate | Common indoors | Manual place entry as first-class fallback |
| API rate limits / etiquette | Low for a PoC | Client cache, rounded-coordinate keying, proper `User-Agent`/origin params |
| The app itself becomes a scroll substitute | Design risk | Session cap + movement unlock are non-negotiable PoC features, not polish |
| German-language content | Wikipedia DE often richer for German locations | Query `de.wikipedia.org` when the locale/region is Germany; language toggle later |

Open questions to answer during the PoC, not before:
- Is "distance + direction" enough of an anchor, or is a mini-map needed?
- How large must the radius be before facts feel disconnected from "here"?
- Does time-anchoring (anniversaries, sunset) actually add delight or noise?

---

## 8. Path beyond the PoC (sketch)

1. **Small backend** (single serverless function): LLM fact narration with
   grounding checks, server-side caching per coordinate grid cell, API keys.
2. **Native wrapper** (Capacitor) once the web PoC proves the concept —
   geolocation UX and offline caching get better; the fact engine is reused.
3. **More sources:** heritage lists, historical photos ("this same view,
   1912"), municipal open data.
4. **Only then** consider retention features — and only ones aligned with the
   mission (e.g. "places you've learned about" journal), never streaks/feeds.
