# Architecture

## Layers

```
src/
  domain/      Pure TypeScript. No React, no I/O. Fully unit-tested.
    pricing.ts        cost, price contributions, ₱50 rounding, margin, public menu
    requestReader.ts  offline Taglish reader (budget, servings, dates, colors, parts, trademarks)
    designs.ts        Simple / Classic / Showstopper builder, selection validator
    visual.ts         parts → CakeVisual (what the 3D/2D cake draws)
    orders.ts         request → order, approve, quote payload, confirm
    priceUpdate.ts    "butter 520 per kilo" → per-gram cost
    shopping.ts       per-order and weekly shopping lists
    insights.ts       metrics, week buckets, dates
    schemas.ts        zod schemas for links, saved data and AI output
    starterMenus.ts   3 starter menus + the sample bakery
  ai/          gemini.ts (server helper), merge.ts (AI + rules), client.ts (browser), rateLimit.ts
  cake/        Cake3D.tsx (three.js / react-three-fiber), Cake2D.tsx (SVG), CakeView.tsx (chooser)
  data/        store.ts (local repo), draft.ts (customer progress), seed.ts, demoScenarios.ts
  lib/         codec.ts (links), links.ts (share), prefs.ts (language, big text, dev), image.ts
  pages/       screens (customer, quote, baker/*)
api/parse.ts   optional Vercel function for Gemini
e2e/run.mjs    Playwright walkthrough + axe
```

Rule: `domain/` never imports from UI, data or network. Screens call domain functions; the store only persists.

## Key decisions

### ADR-1 3D parametric cake instead of AI image generation
- **Why:** free, instant, offline, and the picture is built from the same parts that are priced, so it can't drift from the quote. No trademark or quality risk.
- **Trade-off:** looks like a model, not a photo. We label every view "concept only".

### ADR-2 Local-first + links instead of a cloud database
- **Why:** ₱0 to run, no accounts, nothing personal on our servers, works with Messenger habits.
- **How:** payloads are JSON → deflate-raw → base64url in the URL hash (never sent to a server). Typical request link ≈ 600 characters; a full bakery menu ≈ 3–4k.
- **Trade-off:** no live sync between devices; data is per device (backup/restore provided).
- **Update v1.3:** optional Firebase accounts (free Spark plan) add a cloud inbox and live quotes on top. Links still work for anyone without an account, and the app still runs with no network.

### ADR-3 Rules first, AI optional
- **Why:** the offline reader is instant, free and predictable; AI helps with messy text and photos.
- **Guardrails:** the AI schema has **no price field**; unknown or wrong-category IDs are dropped; numbers the customer typed (budget, servings) come from the rule reader; trademark names are genericized; 12 s timeout, one retry, then fallback. Rate limit 10/hour/IP.

### ADR-4 Price contributions
Each item's price contribution is `round2(cost / (1 − margin))`, scaled by cake size for scaling parts. The total is rounded up to ₱50 and floored at the minimum order. The customer's public menu only contains these contributions (never ingredient costs, labor rate or margin), so the estimate equals the baker's suggested price exactly. Tested across every cake size and starter menu.

### ADR-5 HashRouter static SPA
Works on any static host, including GitHub Pages, with no rewrite rules. Link payloads live after `#`, so they are not sent to the host's logs.

## Threat model (short)

| Risk | Mitigation |
| --- | --- |
| Customer edits a request link to lower the price | Baker re-prices from their own data on approval; customer estimate is informational |
| Someone forges a confirmation | Must match an order on the baker's phone and the exact approved price; otherwise rejected |
| Malformed or huge links | Length caps, decompressed-size cap, zod validation, friendly errors |
| XSS via names/notes | React escapes all text; no `dangerouslySetInnerHTML` |
| API key leak | Key only on the server (`GEMINI_API_KEY`), never `VITE_`-prefixed |
| Payment scams | No payments in the app; quote page warns "Cakeita never asks for payment" |
| Photo privacy | Resized in the browser, kept in memory only, never stored |

## Performance

- First load ≈ 128 KB gzipped (React chunk + app). The three.js chunk (≈ 243 KB gz) loads only when a cake is shown.
- Lists use the 2D SVG cake; only one WebGL canvas is on screen at a time.
- The 3D canvas auto-turns for 10 s, then renders only on interaction (`frameloop="demand"`), to save battery.
