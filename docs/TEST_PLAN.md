# Test plan

## Levels

| Level | Tool | Where | Runs in CI |
| --- | --- | --- | --- |
| Unit (domain, AI guardrails, API route) | Vitest | `src/**/*.test.ts`, `api/*.test.ts` | Yes |
| Type safety | `tsc -b` (strict, `noUncheckedIndexedAccess`) | all | Yes |
| Lint | ESLint + react-hooks | all | Yes |
| End-to-end, 4 phones | Playwright (Chromium, 375×812) | `e2e/run.mjs` | Yes |
| Accessibility | axe-core (WCAG 2.0/2.1 A + AA), fail on serious/critical | inside e2e | Yes |
| Real devices | Manual checklist below | Android + iPhone | Manual, before demo |

Run everything: `npm run check && npm run e2e`.

## What the unit tests prove

- **Pricing:** cost = ingredients + labor + extras; ₱50 round-up (with float-noise guard); minimum order; margin clamp (no divide by zero); missing ingredient prices reported; hand-typed price below target / below cost flagged; exact-target margin is not "below".
- **Customer estimate = baker price** for every cake size × part combination in all 3 starter menus.
- **Public menu hides** costs, margin, labor rate and recipes.
- **Reader:** 10 budget formats, 6 non-money traps, servings, tiers, sizes, ages, 11 date formats (incl. Tagalog months, "bukas", weekdays, impossible dates), quoted/labeled/"happy birthday" text, flavor vs drip vs color conflicts ("chocolate drip", "red velvet"), trademarks → generic theme, unavailable techniques, junk input.
- **Designs:** rising prices, feeds everyone, budget respected, too-low budget message, max tiers, can't-make parts never offered, cannot-do list, servings short, exactly one flavor and one frosting, no duplicates, house frosting default.
- **Validator:** unknown IDs rejected and reported, one flavor kept, missing covering added, unknown size replaced.
- **Orders (review gate):** nothing to send before approval; approval stores code-computed cost/margin; quote link has no cost data; confirmation needs a quoted order at the same price; no double confirm; expiry; no words promised without a lettering part.
- **AI guardrails:** schema has no price; wrong types rejected; fenced JSON extracted; retry once on bad JSON; no retry on 4xx; timeout; unknown IDs dropped; typed numbers beat AI numbers; characters seen in photos are genericized; rate limiter; API route returns 503 without key, 400 on bad body, 429 after 10/hour.
- **Ops:** price-update units (kg, each, pack, tray, ₱ and thousands separators, missing unit warning, big jump warning, spoken "tapos"), shopping lists scale and combine, insights maths, week buckets.
- **Links:** round-trip, size budget, tampered/junk/oversized links rejected without throwing.

## End-to-end walkthrough (e2e/run.mjs)

Each persona has its own browser context (separate storage), and links are passed between them like Messenger.

1. **Customer:** home 3D → sample bakery → occasion → date → 30 people → ₱2,500 → description → designs (budget labels, "what we understood") → customize (live re-price) → contact validation → send → request link.
2. **Baker:** set up demo bakery → open request link → breakdown → type ₱500 → "Lugi ka rito" → approve → quote link.
3. **Customer:** open quote → payment safety note → "Ito ang gusto ko" → confirm link.
4. **Baker:** open confirm link → order ticket → mark paid → board shows order → paste a Spiderman DM → licensed-topper warning → price update by text → lugi "Itaas sa ₱…" → insights.
5. **Elder:** big text = 20 px root, reduced motion.
6. **Tester:** `?dev=1` → developer panel → force 2D → fill + jump → designs render as SVG; tampered quote link → friendly error.
7. **All phones:** no JavaScript errors.

axe runs on 12 screens.

## Manual checklist for real phones (do before Nov 10)

| # | Check | Android Chrome | iPhone Safari | Old/low-end phone |
| --- | --- | --- | --- | --- |
| 1 | 3D cake turns smoothly by finger; ↺ ↻ work | | | |
| 2 | Share button opens the share sheet with Messenger | | | |
| 3 | Request link opened on another phone lands in Requests | | | |
| 4 | Quote link opens on the customer phone; confirm link back works | | | |
| 5 | Inspo photo from gallery attaches (try a HEIC photo on iPhone) | | | |
| 6 | Big-text mode: nothing overlaps at 375 px | | | |
| 7 | Voice price update (🎤) understands "butter five hundred twenty per kilo" | | | |
| 8 | Airplane mode after loading: customer flow still works | | | |
| 9 | Save picture downloads a PNG | | | |
| 10 | Screen reader (TalkBack / VoiceOver) reads questions and the cake description | | | |

## Persona walkthrough prompts

- **Customer:** "Can I get a cake for 30 people for ₱2,500?" Do I understand why one design is "Lampas sa budget"? Is anything confusing in Taglish?
- **Baker:** "Would I trust this price?" Can I see where every peso comes from? Can I change it? Can I say no politely?
- **Elder:** Can I read every word with big text on? Are buttons easy to hit? Do I ever get lost?
- **Tester:** Can I break it with weird input, wrong links, no internet, no WebGL, a refresh in the middle?
