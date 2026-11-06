/**
 * Ready-made customer messages for demos, tests and the developer panel.
 * All names are fictional.
 */
export interface Scenario {
  key: string;
  title: string;
  message: string;
  occasion: string;
  servings: number | null;
  budget: number | null;
  /** Days from today. */
  inDays: number;
  customer: { name: string; contact: string };
}

export const SCENARIOS: Scenario[] = [
  {
    key: 'bday',
    title: '7th birthday, 2 tiers, ₱2.5k',
    message: 'Hi po! Pa-quote ng 2 tier pink cake with chocolate drip and fresh flowers for my daughter\'s 7th birthday, good for 30 pax, budget 2.5k. "Happy 7th Mia"',
    occasion: 'Birthday', servings: 30, budget: 2500, inDays: 9,
    customer: { name: 'Ana Reyes (sample)', contact: '0917 000 0001' },
  },
  {
    key: 'low',
    title: 'Tight budget, ₱600',
    message: 'Simple chocolate cake lang po for 12 people, budget 600 lang. Salamat!',
    occasion: 'Birthday', servings: 12, budget: 600, inDays: 5,
    customer: { name: 'Ben Cruz (sample)', contact: '0917 000 0002' },
  },
  {
    key: 'hero',
    title: 'Superhero theme, ₱1.8k',
    message: "Spiderman theme cake for my son's 5th bday, 20 pax, 1.8k budget, may candles po",
    occasion: 'Birthday', servings: 20, budget: 1800, inDays: 12,
    customer: { name: 'Carla Santos (sample)', contact: '0917 000 0003' },
  },
  {
    key: 'lola',
    title: "Lola's 80th, ube, Tagalog",
    message: 'Ube cake para kay Lola, 80th birthday, mga 15 katao, kulay lila at puti, may totoong bulaklak. "Happy 80th Lola"',
    occasion: 'Birthday', servings: 15, budget: null, inDays: 7,
    customer: { name: 'Dan Villanueva (sample)', contact: '0917 000 0004' },
  },
  {
    key: 'wedding',
    title: "Things the baker can't do",
    message: 'Wedding cake 3 tiers white fondant with sugar flowers and gold leaf, 45 pax, budget 8k',
    occasion: 'Wedding', servings: 45, budget: 8000, inDays: 30,
    customer: { name: 'Ella & Fred (sample)', contact: '0917 000 0005' },
  },
];
