# Cakeita: notes for coding agents

Budget-first custom cake quotes with a 3D cake for Filipino home bakers. Hackathon prototype (Build-Off 2026, exhibition Nov 10).

## Non-negotiable rules
- AI only reads requests and picks IDs from the menu. **All prices come from `src/domain/pricing.ts`.** Never add a price field to AI output.
- The baker approves every quote before the customer sees a final price.
- No payments, no payment look-alikes (no fake GCash screens).
- The 3D/2D cake draws only parts that are priced (`src/domain/visual.ts`). Keep it that way.
- Trademarked characters become generic themes plus a "licensed topper" note.
- Sample data uses fictional names and is labeled as sample. Unverified numbers are labeled as estimates.
- Free tier only. The app must work with no API keys and no network after load.

## Layout
- `src/domain/` pure logic with tests; no React or I/O here.
- `src/ai/` optional Gemini (server helper, merge, browser client). `api/parse.ts` is the Vercel function.
- `src/cake/` 3D (three.js, lazy) and 2D fallback.
- `src/data/` localStorage repo, customer draft, demo seed, `directory.ts` (fictional sample bakeries for the map). `src/lib/` link codec, sharing, prefs.
- `src/domain/matching.ts` + `geo.ts` price the customer's cake at each listed baker (pure code). The map UI is `src/pages/NearBakers.tsx` (Leaflet, lazy).
- `src/domain/showcase.ts` featured designs: known inspo photos recognized on the phone by fingerprint (`photoPrint.ts`, only hashes stored, never the photo) and rebuilt from priced parts; 3D parts in `src/cake/BlockScene.tsx`.
- UI text is bilingual inline: `tx('English', 'Taglish')`.

## Commands
- `npm run check` typecheck + lint + unit tests + build.
- `npm run build && npm run e2e` Playwright walkthrough (customer, baker, elder, tester) + axe.
- Developer panel: `?dev=1` or tap the logo 5 times.

## Releases
- Add an entry to `src/changelog.ts` (shown on About) and bump `version` in package.json. A test checks they match.

## Before you push
Run `npm run check` and `npm run e2e`. Keep 375 px mobile layout, labels on inputs, and AA contrast.
