import { describe, expect, it } from 'vitest';
import { toPublicMenu } from './pricing';
import {
  genericizeText,
  pastel,
  readAge,
  readBudget,
  readDate,
  readRequest,
  readServings,
  readSize,
  readTextOnCake,
  readTiers,
} from './requestReader';
import { createBakeryFromStarter, createSampleBakery } from './starterMenus';

const TODAY = new Date(2026, 10, 6); // Nov 6, 2026 (Friday)
const menu = toPublicMenu(createSampleBakery(TODAY), TODAY);

describe('readBudget', () => {
  it.each([
    ['budget ko 2k lang po', 2000],
    ['budget 1,500', 1500],
    ['₱1950 max', 1950],
    ['php 2500', 2500],
    ['around 2.5k', 2500],
    ['hanggang 3000 lang', 3000],
    ['mga 1800 pesos', 1800],
    ['P1200 budget', 1200],
    ['up to 4k', 4000],
    ['budget: 2000', 2000],
  ])('%s -> %d', (text, expected) => expect(readBudget(text)).toBe(expected));

  it.each([
    ['good for 30 pax'],
    ['8 inch cake'],
    ['7th birthday'],
    ['2 tier cake for 50 people'],
    ['turning 18 years old'],
    ['no budget given'],
  ])('ignores non-money numbers: %s', (text) => expect(readBudget(text)).toBeNull());

  it('prefers the number next to "budget" over other money', () => {
    expect(readBudget('last time ₱3000, pero budget ko ngayon 2k')).toBe(2000);
  });
});

describe('readServings', () => {
  it.each([
    ['good for 30 pax', 30],
    ['for 20 people', 20],
    ['mga 15 katao', 15],
    ['pang 25', 25],
    ['20-25 guests', 25],
    ['12 na tao', 12],
    ['serves 40', 40],
  ])('%s -> %d', (t, n) => expect(readServings(t)).toBe(n));
  it('null when missing', () => expect(readServings('pink cake please')).toBeNull());
});

describe('readTiers, readSize, readAge', () => {
  it.each([
    ['2 tier', 2],
    ['2-tier', 2],
    ['dalawang tier', 2],
    ['three tiers', 3],
    ['single tier', 1],
    ['tiered cake', 2],
  ])('tiers: %s -> %d', (t, n) => expect(readTiers(t)).toBe(n));
  it('sizes', () => {
    expect(readSize('8 inch')).toBe(8);
    expect(readSize('6" round')).toBe(6);
    expect(readSize('bento cake po')).toBe(4);
    expect(readSize('99 inches')).toBeNull();
  });
  it('ages', () => {
    expect(readAge("my daughter's 7th birthday")).toBe(7);
    expect(readAge('turning 60')).toBe(60);
    expect(readAge('5 years old')).toBe(5);
    expect(readAge('no age')).toBeNull();
  });
});

describe('readDate', () => {
  it.each([
    ['Dec 12', '2026-12-12'],
    ['on December 12, 2026', '2026-12-12'],
    ['sa 20 Nobyembre', '2026-11-20'],
    ['Disyembre 1', '2026-12-01'],
    ['2026-11-28', '2026-11-28'],
    ['11/30', '2026-11-30'],
    ['bukas', '2026-11-07'],
    ['this Saturday', '2026-11-07'],
    ['sa Lunes', '2026-11-09'],
  ])('%s -> %s', (t, d) => expect(readDate(t, TODAY)).toBe(d));
  it('a past month-day rolls to next year', () => expect(readDate('Jan 5', TODAY)).toBe('2027-01-05'));
  it('rejects impossible dates', () => expect(readDate('Feb 31', TODAY)).toBeNull());
});

describe('readTextOnCake', () => {
  it('reads quoted text', () => expect(readTextOnCake('write "Happy 7th Mia" please')).toBe('Happy 7th Mia'));
  it('reads labeled text', () => expect(readTextOnCake('nakasulat: Congrats Ate Joy')).toBe('Congrats Ate Joy'));
  it('reads a happy-birthday phrase with a name', () => expect(readTextOnCake('happy birthday Lola po sana')).toBe('happy birthday Lola'));
  it('empty when none', () => expect(readTextOnCake('pink cake')).toBe(''));
});

describe('readRequest (whole messages)', () => {
  it('reads a typical Taglish DM', () => {
    const r = readRequest(
      'Hi po! Pa-quote ng 2 tier pink cake with chocolate drip and fresh flowers for my daughter\'s 7th birthday, good for 30 pax, budget 2.5k, Dec 12. "Happy 7th Mia"',
      menu,
      TODAY,
    );
    expect(r.occasion).toBe('Birthday');
    expect(r.tiers).toBe(2);
    expect(r.servings).toBe(30);
    expect(r.budget).toBe(2500);
    expect(r.eventDate).toBe('2026-12-12');
    expect(r.age).toBe(7);
    expect(r.textOnCake).toBe('Happy 7th Mia');
    expect(r.componentIds).toEqual(expect.arrayContaining(['dc-drip', 'dc-flowers']));
    expect(r.flavorId).toBeNull(); // "chocolate drip" is a drip, not a chocolate cake
    expect(r.colors[0]?.name).toBe('pink');
    expect(r.confidence).toBeGreaterThan(0.6);
  });

  it('chocolate cake WITH chocolate drip finds both', () => {
    const r = readRequest('chocolate cake with chocolate drip', menu, TODAY);
    expect(r.flavorId).toBe('fl-choco');
    expect(r.componentIds).toContain('dc-drip');
  });

  it('red velvet is a flavor, not the color red', () => {
    const r = readRequest('red velvet with white buttercream', menu, TODAY);
    expect(r.flavorId).toBe('fl-redvelvet');
    expect(r.coveringId).toBe('cv-buttercream');
    expect(r.colors.map((c) => c.name)).toEqual(['white']);
  });

  it('swaps trademarked characters for a generic theme and adds a licensed-topper note', () => {
    const r = readRequest('Spiderman theme cake for my son', menu, TODAY);
    expect(r.theme).toBe('red and blue superhero');
    expect(r.licensedNote).toMatch(/licensed topper/i);
    expect(r.colors.map((c) => c.name)).toEqual(['red', 'blue']);
    expect(genericizeText('Hello Kitty and Frozen')).not.toMatch(/hello kitty|frozen/i);
  });

  it('reports things the baker does not make instead of dropping them', () => {
    const home = toPublicMenu(createBakeryFromStarter('home', { name: 'Home' }), TODAY);
    const r = readRequest('white fondant cake with sugar flowers and a gold drip', home, TODAY);
    expect(r.unavailable).toEqual(expect.arrayContaining(['Fondant', 'sugar flowers']));
    expect(r.coveringId).toBeNull();
    expect(r.componentIds).toContain('dc-drip');
    expect(r.componentIds).not.toContain('dc-flowers'); // "sugar flowers" must not become fresh flowers
  });

  it('handles ube and Tagalog words', () => {
    const r = readRequest('Ube cake na may totoong bulaklak at kandila, pang 12 tao, kulay lila', menu, TODAY);
    expect(r.flavorId).toBe('fl-ube');
    expect(r.componentIds).toEqual(expect.arrayContaining(['dc-flowers', 'tp-candles']));
    expect(r.servings).toBe(12);
    expect(r.colors[0]?.name).toBe('purple');
  });

  it('pastel makes colors lighter', () => {
    const r = readRequest('pastel blue minimalist cake', menu, TODAY);
    expect(r.colors[0]?.name).toBe('pastel blue');
    expect(r.theme).toBe('minimalist');
    expect(pastel('#000000')).toBe('#737373');
  });

  it('empty or junk input never throws and finds nothing', () => {
    for (const t of ['', '???', '1234567890', 'asdf qwer'.repeat(300)]) {
      const r = readRequest(t, menu, TODAY);
      expect(r.componentIds).toEqual([]);
      expect(r.confidence).toBeLessThan(0.5);
    }
  });
});
