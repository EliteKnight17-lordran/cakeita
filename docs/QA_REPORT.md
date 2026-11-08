# QA report

**Build:** v1.2.0 · **Date:** 2026-11-08 · **Environment:** Node 22, Chromium (Playwright 1.63) at 375×812, SwiftShader WebGL

## Results

| Suite | Result |
| --- | --- |
| Unit tests (Vitest) | **144 / 144 passed** |
| Typecheck (strict) | Pass |
| Lint | Pass |
| End-to-end checks (4 phones) | **51 / 51 passed** |
| Accessibility (axe, 12 screens) | **0 serious or critical issues** |
| JavaScript errors during e2e | 0 on all phones |
| `npm audit` | 0 known vulnerabilities |
| First load (gzip) | ≈ 128 KB; 3D engine ≈ 243 KB loaded on demand |

## Bugs found during QA and fixed

| # | Found by | Problem | Fix | Guarded by |
| --- | --- | --- | --- | --- |
| 1 | Customer walkthrough | Simple design used semi-naked (cheapest) frosting, so a "pink" request showed no pink | Use the baker's house frosting first; cheapest only if needed for the budget | unit test |
| 2 | Customer walkthrough | Quote page listed "words on cake" even when no lettering part was priced | Words only appear when a piped message or topper is in the priced parts; customizer warns | unit test |
| 3 | Visual check | Piped text hidden under chocolate drip and low contrast | Raised the text layer, cream letters on dark drip | screenshot |
| 4 | Performance check | The 3D engine was preloaded on the first page (≈ 370 KB gz) | Split chunks so three.js loads only with a cake | build output |
| 5 | axe | Progress bar had no accessible name | Added label | e2e a11y |
| 6 | Elder/tester walkthrough | Broken-link errors were English only | Bilingual error texts | e2e |
| 7 | Unit test | "fondant ₱1,200/kg" split at the comma | Normalize thousands before splitting | unit test |
| 8 | Unit test | "budget ko ngayon 2k" not read | Allow filler words after "budget" | unit test |
| 9 | Visual check | Camera too close; cake top cropped | Fit camera to cake size | screenshot |

## Open items (not yet verified)

- **Real devices:** only emulated Chromium so far. Run the manual checklist in [TEST_PLAN.md](TEST_PLAN.md) on an Android phone and an iPhone before the exhibition.
- **Vercel AI route:** unit-tested, not yet deployed. The app falls back to the offline reader if it fails.
- **Voice price update:** depends on the browser's speech recognition; not tested with real speech.
- **HEIC photos:** may not open on some browsers; the app shows a friendly message and asks for a screenshot.
- **Only 2 designs** appear when Simple and Classic would be identical (budget exactly fits Simple). This is intentional; consider a short note explaining it.
- **Sample prices** are unverified estimates; replace with real supplier prices from interviewed bakers.

## v1.0.1 regression (2026-11-06)

| Bug | Found by | Fix | Guard |
| --- | --- | --- | --- |
| English/Taglish choice reverted when a second tab (e.g. a Messenger link) was open | User on the live Vercel build | Prefs now sync across tabs (`storage` event, re-read on tab focus) and merge over the saved value before writing | e2e: "language picked in another tab reaches this tab", "language stays after reload…" (fails on v1.0.0, passes on v1.0.1) |
| Vercel build showed TS2835 for `api/parse.ts`; the function would fail to import in Node ESM | Vercel build log | `.js` extensions on the server import chain; test moved out of `api/`; Node pinned to 22.x | Unit test checks every relative import in the chain ends in `.js`; compiled with `tsc --module nodenext` and ran GET/POST in plain Node |

## v1.2.0 (2026-11-08)

| Change | How it was checked |
| --- | --- |
| One-page order form (live designs, sticky price) | e2e: no Next button, designs before typing, live reading, sprinkles re-price, send blocks empty name |
| Nearby bakers map | Unit: distance, translation to each baker's menu, map estimate = baker's own approval price for every sample shop, no costs leak in listings, sorting. e2e: price pins, list, filters, axe scan, same price after "Request from" |
| Realistic 3D cake | Visual check of drip, fondant, buttercream, semi-naked, fruits, candles. Auto lowers resolution and turns off shadows when a phone can't keep up |
| Map tiles offline | e2e serves blank tiles; the page and list still work. Real tiles could not be loaded from the build sandbox, so **check the map pictures on the live Vercel link** |
