# Demo script (3 minutes) and backup plan

## Before you go on stage

- Laptop: open `https://<app>/#/baker`, tap **Use the demo bakery**, then `?dev=1` → **+ Demo board** so Orders and Insights have data.
- Phone (baker): same, or keep the laptop as the baker.
- Judge phone: print the QR from **My link** (`/#/b/sample`).
- Turn on a phone hotspot. The demo also works offline after the first load.
- Have the e2e screenshots in `docs/img/` and a 60-second screen recording ready as a last resort.

## Script

1. **Problem (20 s).** "Home bakers quote every custom cake by hand in Messenger. The customer sends a ₱5,000 inspo with a ₱2,000 budget, the baker guesses a price, and either loses the sale or loses money when butter goes up."
2. **Customer (60 s).** Judge scans the QR. Everything is one page: tap a sample message ("7th birthday, 2 tiers") and the 3 designs, the 3D cake and the price appear as you type. Turn the cake, open **I-customize**, add sprinkles and watch the sticky price move. Tap **Compare bakers near me**: the same cake priced by 12 nearby (sample) bakers, green = fits budget. Go back and **Send to baker**.
3. **Baker (60 s).** On the laptop, open the request. Point at the breakdown: ingredients, labor, margin. Type ₱500 to show "Lugi ka rito". Approve, send the quote link.
4. **Close the loop (20 s).** Judge taps "Ito ang gusto ko". The order is on the board with a shopping list.
5. **Why it wins (20 s).** "AI only reads, code prices, the baker decides. The picture comes from the same parts as the price, so it never over-promises. Zero server cost, works on weak signal, big text for Lola."

## If something breaks

| Problem | Do this |
| --- | --- |
| No internet | Keep going: the offline reader and 3D need no network once loaded |
| Phone has no WebGL | It shows the 2D cake automatically. Or use the laptop |
| Judge can't scan | Open `/#/b/sample` on your own phone and hand it over |
| Link won't send | On the same device, the request lands in Requests automatically. Use the laptop for both roles |
| Data is messy | Developer panel → **Reset all** → **Load demo bakery** → **+ Demo board** |
