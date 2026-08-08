# Mind the Moment

**Look up. You're somewhere interesting.**

A proof-of-concept web app that shows true, constantly changing facts about
your current location and time — a deliberate alternative to doom scrolling.
Instead of a feed that pulls attention away from reality, every fact points
outward: at the building across the street, the square you're standing on, the
sunset in 34 minutes.

Born from a moment at Ludwigsburg train station: *what were the buildings
around me previously used for?*

## Anti-doomscroll by design

- **One fact at a time** — a single card, no infinite list.
- **No swipe feed** — a deliberate "Next fact" button. Friction is intentional.
- **Physical anchors** — "→ 120 m north-east of you", with a source link.
- **Session cap** — 5 facts per spot. Then: walk ~150 m and new facts unlock.
- **No accounts, no tracking, no notifications.** Location never leaves the
  device except as query parameters to the public data APIs.

## How it works

Static single-page app, no backend:

- **Wikipedia GeoSearch + extracts** (CORS, no key) find documented places
  within ~1.2 km and their history. Uses your language's Wikipedia with an
  English fallback when local coverage is thin.
- **OpenStreetMap via Overpass** finds the hyper-local layer within ~180 m:
  historic buildings, memorial plaques (with inscriptions), former names and
  former uses, construction dates.
- **Wikidata around-queries** surface listed heritage buildings, fountains and
  artworks that have no Wikipedia article — with inception year, architect,
  and namesake.
- **Street etymology**: the street you're standing on (OSM
  `name:etymology:wikidata`) plus Wikidata tells you who it's named after.
- **Live layers**: next departures from the nearest stop (transport.rest) and
  a rain nowcast for your exact spot (Open-Meteo).
- **Sun calculation** (client-side, no API) adds time anchors like
  "sunset here in 34 minutes — look west."
- A small **fact engine** scores candidates by proximity, "surprising past"
  keywords (former, ehemalig, destroyed, founded…), physical anchor, and time
  relevance; seen facts sink for a week.
- Responses are cached in localStorage per ~100 m grid cell.
- Facts are extracted text with source links — never generated, never invented.

## Develop

```bash
npm install
npm run dev      # local dev server
npm test         # unit tests (fact engine, geo, sun)
npm run build    # type-check + production build to dist/
```

Geolocation requires HTTPS (or localhost). The "type a place" fallback doubles
as a dev mode — try "Ludwigsburg".

## Deploy

The build in `dist/` is fully static, with relative paths — it works on GitHub
Pages or any static host.
