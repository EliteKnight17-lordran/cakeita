# Requirements

_Cakeita v1.3.0 · updated 2026-11-09_

## 1. Problem (start with the problem)

Filipino home bakers sell custom cakes through Facebook pages and Messenger. Quoting is manual:

1. A customer sends an inspo photo, often a cake far above their budget.
2. The baker asks questions over several messages (date, people, flavor, budget).
3. The baker prices from memory or a fixed menu that was set before ingredient prices went up.
4. The customer hears the price, says "ay, mahal pala", and leaves, or the baker discounts and loses money.

**Hypotheses to validate** (see [VALIDATION.md](VALIDATION.md)):
- H1. Bakers spend a lot of time per custom quote, mostly on back-and-forth.
- H2. Many custom requests are above the customer's budget, and some never convert.
- H3. Many bakers don't recompute prices when ingredient costs change, so some menu items earn below their own target.
- H4. Customers prefer choosing from 3 budget-fit designs over a single quote.

## 2. Users

| Persona | Context | Needs |
| --- | --- | --- |
| **Customer** (e.g. a parent ordering a 7th birthday cake) | Phone, Messenger, mixed Taglish, a budget in mind | See what fits the budget, fast, without many messages |
| **Baker** (home-based, 1 person) | Phone in the kitchen, often busy, weak signal | Quote fast, never price at a loss, stay in control |
| **Elder** (Lola ordering for a grandchild, or a senior baker) | Small text is hard to read | Big text, simple steps, plain words |
| **Tester / judge** | Short time, wants to see everything | One-tap demo data, no setup |

## 3. User stories and acceptance criteria

### Customer
- **C1** As a customer I can paste my message and have the form filled in.
  *AC:* budget like "2.5k", "₱1,950", "budget ko 2k" is read; servings "30 pax", "mga 15 katao"; tiers; date "Dec 12" / "sa Sabado"; quoted text; colors; flavors; decorations. Unknown things are listed, never guessed.
- **C2** I fill in everything on one page (message, basics, design, contact). Designs and the price update as I type, and my answers survive a refresh.
- **C3** I see up to 3 designs (Simple, Classic, Showstopper) that feed everyone; Simple and Classic fit my budget when possible; Showstopper may go over and says "Lampas sa budget".
  *AC:* if even Simple is over budget, I am told politely and shown the lowest price.
- **C4** I can turn the cake in 3D (drag or buttons) and save a picture. If my phone has no WebGL, I see a 2D drawing instead.
- **C5** I can change size, flavor, frosting, colors, decorations, words and candles, and see the estimate change live.
- **C6** I send the request to the baker through Messenger (share sheet, copy, or QR).
- **C7** I open the baker's quote, see the price, parts and validity, and tap "Ito ang gusto ko" to confirm.
- **C8** I am never asked for payment inside Cakeita.
- **C9** I can compare nearby bakers on a map. Each shows its own estimate for the same cake (from that baker's costs), distance, notice needed and delivery, and I can send my request to the one I pick.
  *AC:* the map estimate equals the price that baker's own app would suggest; sample shops are labeled "(sample)"; the list still works if map pictures can't load.
- **C11** After designing, I choose a baker from a ranked list (best match first: can make all of it, fits my budget, free on my date, then nearest) and send my cake to them in one tap, with no retyping.
  *AC:* ranking is plain code; each baker's price comes from their own menu; bakers I already asked for this date show their answer instead of a second send.
- **C12** The baker's answer comes back to me in Cakeita: accepted at the app price, their counter-offer, or "sorry, we can't" with a reason. I can take it, offer a lower price once, or choose another baker.
  *AC:* only one offer per quote (also enforced by the database rules); an offer must be lower than the quote; after the baker's answer, I can only confirm or pick someone else. Messenger links work for all of it when there is no cloud.
- **C13** For the demo, the "(sample)" shops answer by themselves within a few seconds using plain rules (decline if the date is too soon or booked; counter an over-budget request but never below their minimum margin). Real bakers always answer by hand.
- **C10** While customizing I can still see my cake: a small floating cake on phones (tap to enlarge or jump back to 3D) and the cake pinned beside the form on laptops.

### Baker
- **B1** I set up in 3 steps from a starter menu and edit only ~5 key prices.
- **B2** I can paste a customer DM and get a priced draft.
- **B3** For each request I see the 3D design, the customer's words, things I don't make (amber), character warnings, and a full breakdown: ingredients, labor, extras, cost, suggested price, margin.
- **B4** I can edit parts and the price; a red warning shows when the price is below my target margin or below cost.
- **B5** Nothing goes to the customer until I tap Approve. The button says whether I'm accepting at the price the customer saw or sending a counter-offer.
- **B11** I can decline with a reason (quick picks: fully booked, too soon, don't make this, budget too low), and the customer sees it so they can choose another baker.
- **B12** If the customer offers a lower price, I see it with my margin at that price and tap Accept or Keep my price. Either answer is final.
- **B6** Confirmed orders appear on a board (this week, next week, later) with paid toggle and status; I get per-order and weekly shopping lists.
- **B7** I can update prices by typing or speaking ("butter 520 per kilo") and confirm before saving; units are converted by code.
- **B8** I see which menu prices are now below target ("Itaas sa ₱1,450?").
- **B9** I can back up and restore my data.
- **B10** I see insights: requests, conversion, time to quote, average order value, % below target, design mix.

### Pilot (survey and feedback)
- **P1** A baker or customer finishes part 1 of the survey (the problem today) in about a minute, mostly by tapping, without giving a name.
- **P2** After part 1 they get a one-tap way to try Cakeita (and a QR for another phone), plus a reminder to come back for part 2.
- **P3** Answers and feedback are sent to the cloud, or wait on the phone when offline. Only team admins can read them (results page with counts, CSV and booth QR codes).
- **P4** Every page has "Feedback and help" in the footer.

### Elder / accessibility
- **E1** A big-text toggle on every screen enlarges all text and tap targets.
- **E2** All inputs have labels, all images have text alternatives, contrast meets WCAG AA, everything works with a keyboard and screen reader, reduced-motion is respected.

### Tester
- **T1** A developer panel can fill scenarios, jump to any step, load demo orders, approve/confirm all, reset, and simulate no-WebGL or AI-off.

## 4. Non-functional requirements

| Area | Requirement | How we meet it |
| --- | --- | --- |
| Cost (sustainability) | ₱0 to run for a small baker | Static hosting, Firebase free (Spark) plan for accounts, AI optional on a free tier |
| Offline / weak signal | Core flow works without AI | Rule-based Taglish reader; 3D has no network assets |
| Performance | First screen fast on mobile data | 3D engine lazy-loaded (≈243 KB gz) only when a cake is shown; first load ≈128 KB gz; 3D sleeps when idle |
| Privacy (Data Privacy Act mindset) | Collect the minimum | Accounts optional; data on device unless the baker signs in; map pins rounded to ≈100 m; photos never stored; consent before sending |
| Security | Links can be edited by anyone | Every link is schema-validated; customers can't set the baker's price; confirmations must match the approved price |
| Trust | No surprise promises | 3D only shows priced parts; "concept only" label; text on cake only if a lettering part is priced |
| Accessibility | WCAG 2.1 AA | axe scans in e2e (0 serious/critical), big-text mode |
| Maintainability | Easy to change safely | Pure domain layer with unit tests; UI separate; CI on every push |

## 5. Out of scope

Payments of any kind (and payment look-alikes), delivery booking, multi-branch, AI image generation. (Accounts, cloud sync and self-serve map listings were added in v1.3.)

## 6. Alignment with the Ganap notes

| Note | In Cakeita |
| --- | --- |
| Start with the problem | Quoting back-and-forth and hidden losses, stated as testable hypotheses |
| Automate the predictable | Reading requests, building designs, the price math, shopping lists |
| Keep human judgment | The baker approves every quote and can override anything |
| Sustainability | ₱0 running cost, no lock-in (backup file), battery-friendly 3D |
| Practicality | Works inside Messenger habits; paste-a-DM; starter menus |
| Feasibility | Built with free tools, demo-safe offline |
| Understand reach | Any baker with a phone and a Messenger page |
| Talk to customers | Validation kit with interview script and tier test |
| Value-based pricing | Margin target + Showstopper shows the upsell; lugi alerts protect value |
| Collaboration | Baker and customer co-design the cake on the same parts list |

## 7. Judging criteria map

- **Business impact & problem fit (30%)**: faster quotes, fewer lost sales, margin protection; validation plan.
- **Technical execution (30%)**: tested pricing engine, offline reader, parametric 3D, schema-validated links, optional AI with fallback, CI.
- **Solution quality & innovation (25%)**: picture and price from one parts list; budget-first; zero-server link exchange.
- **UX (15%)**: Taglish, one-page order with live price, cake always in view, refined look, big-text mode, accessible, 375px-first.
