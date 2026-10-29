// Sample data from the prototype. All names, meals, events, tasks and channels are placeholders.
import type { Recipe } from './adapter';

const fajitas: Recipe = {
  id: 'sheet-pan-chicken-fajitas',
  name: 'Sheet-pan chicken fajitas',
  mins: 35,
  tags: ['Weeknight'],
  servings: 4,
  image: null,
  ingredients: [
    { id: 'chicken', qty: '1½ lb', name: 'chicken breast, thinly sliced' },
    { id: 'peppers', qty: '3', name: 'bell peppers, sliced' },
    { id: 'onion', qty: '1', name: 'red onion, sliced' },
    { id: 'oil', qty: '3 tbsp', name: 'olive oil' },
    { id: 'chili', qty: '2 tsp', name: 'chili powder' },
    { id: 'cumin', qty: '1 tsp', name: 'ground cumin' },
    { id: 'paprika', qty: '1 tsp', name: 'smoked paprika' },
    { id: 'garlic', qty: '1 tsp', name: 'garlic powder' },
    { id: 'salt', qty: '1 tsp', name: 'kosher salt' },
    { id: 'lime', qty: '1', name: 'lime' },
    { id: 'tortillas', qty: '8', name: 'flour tortillas' },
    { id: 'toppings', qty: '', name: 'Sour cream, salsa, avocado' },
  ],
  steps: [
    { text: 'Heat the oven to 425°F. Line a large sheet pan with foil or parchment.', uses: [] },
    { text: 'Stir the chili powder, cumin, smoked paprika, garlic powder and salt together in a small bowl.', uses: ['chili', 'cumin', 'paprika', 'garlic', 'salt'] },
    { text: 'Toss the chicken, peppers and onion with the olive oil and spice mix right on the pan. Spread into one even layer.', uses: ['chicken', 'peppers', 'onion', 'oil'] },
    { text: 'Roast for 20 minutes, stirring once halfway through, until the chicken is cooked through.', uses: [], title: 'Roast' },
    { text: 'Wrap the tortillas in foil and warm them in the oven for the last 5 minutes.', uses: ['tortillas'], title: 'Warm tortillas' },
    { text: 'Squeeze the lime over the pan and toss everything together.', uses: ['lime'] },
    { text: 'Fill the tortillas at the table and top with sour cream, salsa and avocado.', uses: ['toppings'] },
  ],
};

const pool: [string, number, string[]][] = [
  ['Spaghetti & meatballs', 40, ['Kids']],
  ['Grilled salmon & rice', 30, ['Grill']],
  ['Turkey tacos', 25, ['Weeknight', 'Kids']],
  ['Chicken stir-fry', 25, ['Weeknight']],
  ['Burgers & sweet potato fries', 40, ['Grill', 'Kids']],
  ['Slow cooker pot roast', 480, ['Slow cooker']],
  ['Homemade pizza night', 45, ['Kids']],
  ['Lemon herb chicken thighs', 35, ['Weeknight']],
  ['Steak & roasted veggies', 35, ['Grill']],
  ['Chili & cornbread', 60, ['Slow cooker']],
  ['Breakfast for dinner', 20, ['Weeknight', 'Kids']],
  ['Shrimp fried rice', 25, ['Weeknight']],
  ['Pulled pork sandwiches', 480, ['Slow cooker']],
];

export function slug(name: string): string {
  return name.toLowerCase().replace(/&/g, 'and').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

/** Placeholder recipe: just enough to walk through Cook mode until the real one is in Mealie. */
export function placeholderRecipe(name: string, mins: number, tags: string[], id = slug(name)): Recipe {
  const cookMins = mins >= 120 ? Math.round(mins / 60) + ' hours' : Math.max(5, mins - 10) + ' minutes';
  return {
    id, name, mins, tags, servings: 4, image: null, placeholder: true,
    ingredients: [],
    steps: [
      { text: 'This is a placeholder recipe. Add the real one in Mealie and its steps will show up here.' },
      { text: 'Get everything prepped and ready to go.' },
      { text: 'Cook for ' + cookMins + '.' },
      { text: 'Serve and enjoy.' },
    ],
  };
}

export const MOCK_RECIPES: Recipe[] = [fajitas, ...pool.map(([n, m, t]) => placeholderRecipe(n, m, t))];

/** This week's dinners, Monday first, by recipe name. */
export const MOCK_WEEK = [
  'Turkey tacos', 'Sheet-pan chicken fajitas', 'Chicken stir-fry', 'Breakfast for dinner',
  'Homemade pizza night', 'Grilled salmon & rice', 'Slow cooker pot roast',
].map(slug);

export const MOCK_LAST_WEEK = [
  'Shrimp fried rice', 'Lemon herb chicken thighs', 'Turkey tacos', 'Spaghetti & meatballs',
  'Homemade pizza night', 'Steak & roasted veggies', 'Chili & cornbread',
].map(slug);

/** This week's events, Monday first: [hour, minute, title, person]. */
export const MOCK_EVENTS: [number, number, string, string][][] = [
  [[17, 30, 'Flag football practice', 'Kids']],
  [[7, 30, 'School drop-off', 'Alex'], [17, 30, 'Flag football practice', 'Kids'], [19, 0, 'Book club', 'Sam']],
  [[16, 0, 'Grocery pickup', 'Sam']],
  [[17, 30, 'Flag football practice', 'Kids']],
  [[19, 0, 'Pizza & movie night', 'Family']],
  [[9, 0, 'Flag football game', 'Kids'], [18, 0, 'Dinner with friends', 'Family']],
  [[10, 0, 'Yard work', 'Alex']],
];

export const MOCK_REMINDERS = [
  { uid: 'trash', summary: 'Trash & recycling to the curb', due: 'Tonight' },
  { uid: 'hvac', summary: 'Change HVAC filter', due: 'Saturday' },
];

export const MOCK_KID_TASKS: Record<string, { section: 'morning' | 'after_school' | 'evening'; tasks: string[]; done: number[] }[]> = {
  Max: [
    { section: 'morning', tasks: ['Make your bed', 'Brush teeth', 'Get dressed'], done: [0, 1] },
    { section: 'after_school', tasks: ['Unpack backpack', 'Read for 20 minutes', 'Pick up your room'], done: [] },
  ],
  Lily: [
    { section: 'morning', tasks: ['Brush teeth', 'Get dressed', 'Shoes by the door'], done: [0] },
    { section: 'evening', tasks: ['Clear your plate', 'Pick up toys', 'Bath & pajamas'], done: [] },
  ],
};
