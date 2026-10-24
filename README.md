# ShopShield — the violations & account-health defense agent for TikTok Shop

A product in the making: a marketing landing plus a real, paid SaaS console for TikTok Shop sellers and agencies. Phase 1 (foundation) lives in this repo's `src/`; the original static demo lives in `demo/` and still serves on GitHub Pages.

## The real app (Phase 1+)

Stack: Next.js (App Router) + TypeScript · Postgres via Drizzle · Clerk auth · S3-compatible evidence storage. Console states (loading / empty / error / full) are real UI states driven by real queries — not URL toggles.

```powershell
npm install
Copy-Item .env.example .env.local   # then fill in values (see below)
npx drizzle-kit generate            # regenerate SQL if you change src/db/schema.ts
npm run db:migrate                  # apply migrations to DATABASE_URL
npm run dev                         # http://localhost:3000/console
```

Env vars (see `.env.example`): `DATABASE_URL`, `ENCRYPTION_KEY` (32 random bytes, base64), Clerk keys, S3 keys. Without Clerk keys the console shows an honest "sign-in not configured" state; nothing person-specific renders without auth.

Tests & seed:

```powershell
npm test                            # unit tests (encryption); integration tests need TEST_DATABASE_URL
npm run seed                        # SYNTHETIC demo rows, clearly labeled
```

Data rules baked in (docs/api-findings.md is the source of truth): violations ingest by email forwarding / upload / manual entry — no Seller Center scraping, no invented APIs; every draft approval is explicit and audited; org isolation is enforced in every query and covered by tests.

## What ships (the demo)

- `demo/index.html` — the landing: last-night's-watch panel, questions as rows (one opened to the appeal letter), pricing with monthly/annual switch, connection rows
- `demo/app.html` — the console demo: a month of nights, the queue table, the case file with Approve / Edit / Reject, and four demo states (`?s=loading`, `?s=empty`, `?s=error`, full by default)
- `demo/site.css` / `demo/app.css` + `demo/tokens.css` / `demo/base.css` — the Dusk theme tokens and page styles (the same tokens drive the real app via `src/styles/`)
- `photos/` — the hero hour photograph
- `docs/api-findings.md` — Phase 0 verification of TikTok Shop data paths

## Running the demo

Open `demo/index.html` in a browser, or serve the folder:

```
python -m http.server 8000 --directory demo
```

## Demo data

Everything shown in `demo/app.html` (the queue, the tally, the letter) is demo data, marked in the top bar. No metrics, quotes or logos are invented anywhere on the pages; sample values read as samples.

## Credits

- Photograph: [Thomas Bresson](https://commons.wikimedia.org/wiki/File:Vallee-brouillard.jpg), CC BY 3.0, Wikimedia Commons
- Fonts: Wix Madefor Display / Text via Google Fonts
- Design process: built with the [Hallmark](https://github.com/nutlope/hallmark) skill (Dusk theme, draw `d4bd9c`)

**ShopShield is not affiliated with TikTok or ByteDance.**
