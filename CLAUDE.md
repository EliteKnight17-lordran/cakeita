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
- `src/data/` localStorage repo, customer draft, demo seed. `src/lib/` link codec, sharing, prefs.
- UI text is bilingual inline: `tx('English', 'Taglish')`.

## Commands
- `npm run check` typecheck + lint + unit tests + build.
- `npm run build && npm run e2e` Playwright walkthrough (customer, baker, elder, tester) + axe.
- Developer panel: `?dev=1` or tap the logo 5 times.

## Before you push
Run `npm run check` and `npm run e2e`. Keep 375 px mobile layout, labels on inputs, and AA contrast.
