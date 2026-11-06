/**
 * Update history shown on the About page. Newest first.
 * When you ship a change: add an entry here AND bump "version" in package.json
 * (a unit test checks they match).
 */
export interface Release {
  version: string;
  /** YYYY-MM-DD */
  date: string;
  en: string[];
  tl: string[];
}

export const CHANGELOG: Release[] = [
  {
    version: '1.0.1',
    date: '2026-11-06',
    en: [
      'Fixed: your English/Taglish choice now stays when you open Cakeita in another tab or come back from Messenger.',
      'Fixed: the optional AI reading route now builds and runs on Vercel.',
      'New: this update history on the About page.',
    ],
    tl: [
      'Ayos na: nananatili na ang piniling English/Taglish kahit magbukas ng ibang tab o bumalik galing Messenger.',
      'Ayos na: gumagana na sa Vercel ang optional na AI reading.',
      'Bago: itong listahan ng mga update sa About page.',
    ],
  },
  {
    version: '1.0.0',
    date: '2026-11-06',
    en: [
      'First release for Build-Off 2026.',
      'Customers: budget-first Simple, Classic and Showstopper designs with a 3D cake you can turn (2D on older phones).',
      'Bakers: quick setup with starter menus, request inbox, cost breakdown and approval, order board, shopping list, lugi alerts and insights.',
      'Requests, quotes and confirmations travel as links in Messenger. No accounts, no payments.',
      'Big-text mode, English/Taglish, offline reader, and a developer panel for testing.',
    ],
    tl: [
      'Unang release para sa Build-Off 2026.',
      'Customer: Simple, Classic at Showstopper na design ayon sa budget, may 3D cake na naiikot (2D sa lumang phone).',
      'Baker: mabilis na setup gamit ang starter menu, inbox ng request, breakdown ng gastos at approval, order board, shopping list, lugi alert at insights.',
      'Ang request, quote at kumpirmasyon ay mga link sa Messenger. Walang account, walang bayad.',
      'Big-text mode, English/Taglish, offline reader, at developer panel para sa testing.',
    ],
  },
];

export const APP_VERSION = CHANGELOG[0]?.version ?? '0.0.0';
