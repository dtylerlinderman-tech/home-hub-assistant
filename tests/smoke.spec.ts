// Smoke test: every screen renders in mock mode at 1280×800 without errors,
// and its key controls work. Screenshots land in tests/__screenshots__/ for
// side-by-side comparison with the references in screens/.
import { expect, test, type Page } from '@playwright/test';

const TUE_0832 = '2026-10-20T08:32:00';
const TUE_1300 = '2026-10-20T13:00:00';
const TUE_1745 = '2026-10-20T17:45:00';

async function open(page: Page, hash: string, now = TUE_1745) {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  await page.goto(`/?mock=1&nodev=1&now=${now}#${hash}`);
  await page.evaluate(() => document.fonts.ready);
  return errors;
}

async function shot(page: Page, name: string) {
  await page.screenshot({ path: `tests/__screenshots__/${name}.png` });
}

const SCREENS: [string, string, string, string?][] = [
  ['01-home-dropoff', '/', 'School run', TUE_0832],
  ['01-home-pickup', '/', 'School run', TUE_1300],
  ['01-home-dinner', '/', "Tonight's dinner", TUE_1745],
  ['04-meals', '/meals', 'Meal plan'],
  ['05-recipes', '/recipes', 'Filter by category'],
  ['06-calendar', '/calendar', 'Tue 20'],
  ['07-climate', '/climate', 'Downstairs thermostat'],
  ['08-tasks', '/tasks', "Max's tasks"],
  ['09-tv', '/tv', 'Now playing'],
  ['13-weather', '/weather', 'Next 48 hours'],
  ['14-groceries', '/groceries', 'Grocery list'],
];

for (const [name, hash, label, now] of SCREENS) {
  test(`renders ${name}`, async ({ page }) => {
    const errors = await open(page, hash, now);
    await expect(page.getByLabel(label, { exact: true }).first()).toBeVisible();
    await shot(page, name);
    expect(errors).toEqual([]);
  });
}

test('renders 03-cook at step 4 with a timer', async ({ page }) => {
  const errors = await open(page, '/cook/sheet-pan-chicken-fajitas?step=4');
  await expect(page.getByText('Step 4 of 7')).toBeVisible();
  await expect(page.getByText('20:00')).toBeVisible();
  await shot(page, '03-cook');
  expect(errors).toEqual([]);
});

test('door: wrong PIN, right PIN, relock countdown, lock now', async ({ page }) => {
  const errors = await open(page, '/door?ring=1');
  await expect(page.getByText('Someone’s at the front door')).toBeVisible();
  await shot(page, '02-door-locked');
  for (const d of '1111') await page.getByLabel('Digit ' + d).click();
  await expect(page.getByText('Wrong PIN, try again')).toBeVisible();
  for (const d of '1234') await page.getByLabel('Digit ' + d).click();
  await expect(page.getByText(/Relocks automatically in \d+s/)).toBeVisible();
  await shot(page, '02-door-unlocked');
  await page.getByRole('button', { name: 'Lock now' }).click();
  await expect(page.getByText('Enter PIN to unlock')).toBeVisible();
  expect(errors).toEqual([]);
});

test('door: three wrong PINs lock the pad', async ({ page }) => {
  await open(page, '/door');
  for (let i = 0; i < 3; i++) {
    for (const d of '9999') await page.getByLabel('Digit ' + d).click();
    await page.waitForTimeout(300);
  }
  await expect(page.getByText(/Too many tries/)).toBeVisible();
  await expect(page.getByLabel('Digit 1')).toBeDisabled();
});

test('doorbell ring takes over from any screen and Dismiss returns', async ({ page }) => {
  await page.goto(`/?mock=1&now=${TUE_1745}#/tasks`);
  await page.getByRole('button', { name: 'Open mock controls' }).click();
  await page.getByRole('button', { name: 'Ring the doorbell' }).click();
  await expect(page.getByText('Someone’s at the front door')).toBeVisible();
  await page.getByRole('button', { name: 'Dismiss' }).click();
  await expect(page.getByLabel("Max's tasks")).toBeVisible();
});

test('rail navigates between screens', async ({ page }) => {
  await open(page, '/');
  for (const [label, check] of [['Calendar', 'Tue 20'], ['Meals', 'Meal plan'], ['Recipes', 'Filter by category'], ['Tasks', "Max's tasks"], ['Climate', 'Upstairs thermostat'], ['Weather', 'Next 48 hours'], ['TV', 'Now playing']]) {
    await page.getByRole('navigation').getByRole('link', { name: label, exact: true }).click();
    await expect(page.getByLabel(check, { exact: true }).first()).toBeVisible();
  }
});

test('cook timer runs, survives a step change, and raises the alert', async ({ page }) => {
  await page.goto(`/?mock=1&now=${TUE_1745}#/cook/sheet-pan-chicken-fajitas?step=4`);
  await page.getByRole('button', { name: 'Start' }).click();
  await expect(page.getByText('Roast · running')).toBeVisible();
  await page.getByRole('button', { name: /Next step/ }).click();
  await expect(page.getByRole('button', { name: /Roast/ })).toBeVisible(); // running-timer chip
  await page.getByRole('button', { name: 'Open mock controls' }).click();
  await page.getByRole('button', { name: /Finish running timers/ }).click();
  await expect(page.getByRole('alertdialog')).toBeVisible({ timeout: 6000 });
  await expect(page.getByText('Roast is done')).toBeVisible();
  await page.getByRole('button', { name: 'Stop alarm' }).click();
  await expect(page.getByRole('alertdialog')).toHaveCount(0);
});

test('tasks toggle and show the all-done banner', async ({ page }) => {
  await open(page, '/tasks');
  const max = page.getByLabel("Max's tasks");
  for (const name of ['Get dressed', 'Unpack backpack', 'Read for 20 minutes', 'Pick up your room']) {
    await max.getByRole('button', { name }).click();
  }
  await expect(page.getByText('All done today, Max!')).toBeVisible();
});

test('climate stepper debounces and updates the set point', async ({ page }) => {
  await open(page, '/climate');
  const zone = page.getByLabel('Downstairs thermostat');
  await zone.getByLabel('Raise Downstairs temperature').click();
  await zone.getByLabel('Raise Downstairs temperature').click();
  await expect(zone.getByText('74°', { exact: true })).toBeVisible();
  await zone.getByRole('group', { name: 'Downstairs mode' }).getByRole('button', { name: 'Auto' }).click();
  await expect(zone.getByText(/\d+–\d+°/)).toBeVisible();
  await page.getByRole('button', { name: 'Away' }).click();
  await expect(page.getByRole('button', { name: 'Away' })).toHaveAttribute('aria-pressed', 'true');
});

test('meals: week arrows, and Sunday opens on next week', async ({ page }) => {
  await open(page, '/meals');
  await expect(page.getByText('This week', { exact: true })).toBeVisible();
  await page.getByLabel('Next week').click();
  await expect(page.getByText('Next week', { exact: true })).toBeVisible();
  await expect(page.getByText(/October 26 – November 1/)).toBeVisible();
  await page.getByRole('button', { name: 'This week' }).click();
  await expect(page.getByText(/October 19 – 25/)).toBeVisible();

  await open(page, '/meals', '2026-10-25T16:00:00');
  await expect(page.getByText('Next week', { exact: true })).toBeVisible();
  await expect(page.getByText(/October 26 – November 1/)).toBeVisible();
});

test('meals: pick a meal, mark eating out, and Suggest keeps both', async ({ page }) => {
  await open(page, '/meals');
  await page.getByLabel('Next week').click();
  await page.getByRole('button', { name: /^Choose Tue 27 dinner/ }).click();
  await page.getByPlaceholder('Search meals').fill('chili');
  await page.locator('.meals-picker-item').first().click();
  await expect(page.getByRole('button', { name: /^Choose Tue 27 dinner: .*chili/i })).toBeVisible();

  await page.getByRole('button', { name: /^Choose Thu 29 dinner/ }).click();
  await page.getByRole('button', { name: /^Eating out/ }).click();
  await expect(page.getByRole('button', { name: 'Choose Thu 29 dinner: Eating out' })).toBeVisible();
  await expect(page.getByLabel('Swap Thu meal')).toBeDisabled();

  await page.getByRole('button', { name: 'Suggest open nights' }).click();
  await expect(page.getByRole('button', { name: 'Choose Thu 29 dinner: Eating out' })).toBeVisible();
  await expect(page.getByRole('button', { name: /^Choose Tue 27 dinner: .*chili/i })).toBeVisible();
  await expect(page.getByText('Nothing planned')).toHaveCount(0);
});

test('meals: suggest a week, swap a day, add the ingredients', async ({ page }) => {
  await open(page, '/meals');
  await page.getByLabel('Next week').click();
  await page.getByRole('switch', { name: /Leftovers Wednesday/ }).click();
  await page.getByRole('button', { name: 'Suggest open nights' }).click();
  await expect(page.getByText('Leftovers night')).toBeVisible();
  await page.getByLabel('Swap Mon meal').click();
  await page.getByRole('button', { name: 'Add ingredients' }).click();
  // The suggested week is random, so it may bring no new ingredients.
  await expect(page.getByText(/Added \d+ ingredients? to Groceries|Nothing new to add to Groceries/)).toBeVisible();
});

test('recipes: search, filter and import from a link', async ({ page }) => {
  await open(page, '/recipes');
  await page.getByPlaceholder('Search recipes').fill('zzz');
  await expect(page.getByText('No recipes match that search.')).toBeVisible();
  await page.getByPlaceholder('Search recipes').fill('');
  await page.getByRole('button', { name: 'Grill', exact: true }).click();
  await expect(page.getByText('Steak & roasted veggies')).toBeVisible();
  await page.getByRole('button', { name: 'Add from a link' }).click();
  await page.getByPlaceholder('https://').fill('https://www.example.com/best-chili');
  await page.getByRole('button', { name: 'Import', exact: true }).click();
  await expect(page.locator('.cook-title')).toHaveText('Recipe from example.com', { timeout: 5000 });
});

test('tv: shows what is on, pause and play', async ({ page }) => {
  await open(page, '/tv');
  await expect(page.locator('.tv-status')).toHaveText('Live');
  await page.getByRole('button', { name: 'Pause' }).click();
  await expect(page.locator('.tv-status')).toHaveText('Paused');
  await page.getByRole('button', { name: 'Play' }).click();
  await expect(page.locator('.tv-status')).toHaveText('Live');
});

test('weather: hourly tap shows details, rain shows tomorrow, Home links here', async ({ page }) => {
  await open(page, '/');
  await page.getByRole('link', { name: /Open the forecast/ }).click();
  await expect(page.getByText('Forecast from met.no')).toBeVisible();
  await expect(page.locator('.wx-day')).toHaveCount(6);
  await expect(page.locator('.wx-rain-bar')).toHaveCount(5);
  await page.getByRole('button', { name: /^3 PM:/ }).first().click();
  await expect(page.locator('.wx-hourly-detail')).toContainText('3 PM');
});

test('games: live game first with its score, next game with kickoff and channel', async ({ page }) => {
  await open(page, '/');
  const rows = page.locator('.home-game');
  await expect(rows).toHaveCount(2);
  await expect(rows.nth(0)).toContainText('Falcons vs 49ers');
  await expect(rows.nth(0)).toContainText('4:12 - 3rd');
  await expect(rows.nth(0).locator('.home-game-score')).toHaveText('17–14');
  await expect(rows.nth(1)).toContainText('Georgia Tech at Pitt');
  await expect(rows.nth(1)).toContainText('ESPN2');
});

test('lock: expired Google sign-in says so on Home and the Door screen', async ({ page }) => {
  await page.goto(`/?mock=1&nodev=1&lockexpired=1&now=${TUE_1745}#/`);
  await expect(page.locator('.home-lock-label')).toHaveText('Sign in again');
  await expect(page.locator('.home-lock-sub')).toHaveText('Google sign-in expired · redo it in Home Assistant');
  await page.goto(`/?mock=1&nodev=1&lockexpired=1&now=${TUE_1745}#/door`);
  await expect(page.getByText('The lock’s Google sign-in expired.', { exact: false })).toBeVisible();
});

test('home: this week lists only days with events, and a two-day trip shows on both days', async ({ page }) => {
  await open(page, '/');
  const week = page.locator('.home-agenda');
  await expect(week.locator('.home-agenda-name').first()).toHaveText('Today');
  await expect(week.locator('.home-agenda-name').nth(1)).toHaveText('Tomorrow');
  const trip = week.locator('.home-ev', { hasText: 'Chicago trip' });
  await expect(trip).toHaveCount(2);
  await expect(trip.nth(0)).toContainText('6:00 AM');
  await expect(trip.nth(0)).toContainText('Day 1 of 2');
  await expect(trip.nth(1)).toContainText('Until 4:00 PM');
  await expect(trip.nth(1)).toContainText('Day 2 of 2');
});

test('calendar: a two-day trip shows on both days', async ({ page }) => {
  await open(page, '/calendar');
  await expect(page.getByRole('region', { name: 'Wed 21' })).toContainText('Chicago trip');
  await expect(page.getByRole('region', { name: 'Thu 22' })).toContainText('Until 4:00 PM');
});

test('flights: a tracked flight in the air shows its route, landing time and progress', async ({ page }) => {
  await open(page, '/');
  const card = page.getByRole('region', { name: 'Flights' });
  await expect(card).toContainText('Atlanta → Chicago');
  await expect(card).toContainText('DL2290');
  await expect(card).toContainText('In the air · lands');
  await expect(card.getByRole('meter', { name: 'Flight progress' })).toBeVisible();
  await expect(card).toContainText('36,000 ft');
});

test('calendar: week navigation and Today', async ({ page }) => {
  await open(page, '/calendar');
  await page.getByLabel('Next week').click();
  await expect(page.getByText('October 26 – November 1')).toBeVisible();
  await page.getByRole('button', { name: 'Today' }).click();
  await expect(page.getByText('October 19 – 25')).toBeVisible();
});

test('not-connected states render without crashing', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto(`/?mock=1&now=${TUE_1745}#/`);
  await page.getByRole('button', { name: 'Open mock controls' }).click();
  await page.getByRole('button', { name: /Not connected/ }).click();
  for (const hash of ['/', '/calendar', '/meals', '/recipes', '/tasks', '/climate', '/tv', '/door']) {
    await page.evaluate((h) => { location.hash = h; }, hash);
    await page.waitForTimeout(150);
  }
  await page.evaluate(() => { location.hash = '/'; });
  await expect(page.getByText('Lock not connected')).toBeVisible();
  await page.getByRole('button', { name: 'Close' }).click();
  await shot(page, '10-home-not-connected');
  expect(errors).toEqual([]);
});

test('vacuum: screen renders with rooms and history', async ({ page }) => {
  const errors = await open(page, '/vacuum');
  await expect(page.getByLabel('Rooms', { exact: true })).toBeVisible();
  await expect(page.getByLabel('Recent cleans')).toBeVisible();
  await expect(page.getByText('Cleaned today', { exact: false }).first()).toBeVisible();
  await shot(page, '11-vacuum');
  expect(errors).toEqual([]);
});

test('vacuum: clean picked rooms, pause, resume, send home', async ({ page }) => {
  await open(page, '/vacuum');
  const rooms = page.getByLabel('Rooms', { exact: true });
  await rooms.getByRole('button', { name: /^Office/ }).click();
  await rooms.getByRole('button', { name: /^Entry/ }).click();
  await page.getByRole('button', { name: 'Clean 2 rooms' }).click();
  await expect(page.getByText('Cleaning the entry')).toBeVisible();
  await shot(page, '11-vacuum-cleaning');
  await page.getByRole('button', { name: 'Pause' }).click();
  await expect(page.getByRole('button', { name: 'Resume' })).toBeVisible();
  await page.getByRole('button', { name: 'Resume' }).click();
  await page.getByRole('button', { name: 'Send home' }).click();
  await expect(page.getByText('Stopped early').first()).toBeVisible();
});

test('vacuum: history row shows that run on the map', async ({ page }) => {
  await open(page, '/vacuum');
  const hist = page.getByLabel('Recent cleans');
  await hist.getByRole('button').nth(3).click();
  await expect(hist.getByRole('button').nth(3)).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByRole('button', { name: 'Show latest' })).toBeVisible();
});

test('vacuum: Home card appears when stuck and links to the screen', async ({ page }) => {
  await page.goto(`/?mock=1&now=${TUE_1745}#/`);
  await expect(page.getByLabel(/^Vacuum:/)).toHaveCount(0);
  await page.getByRole('button', { name: 'Open mock controls' }).click();
  await page.getByRole('button', { name: 'Get stuck' }).click();
  await page.getByRole('button', { name: 'Close' }).click();
  await expect(page.getByLabel(/^Vacuum:/)).toBeVisible();
  await shot(page, '12-home-vacuum-stuck');
  await page.getByLabel(/^Vacuum:/).click();
  await expect(page.getByRole('alert')).toContainText('Stuck near');
});

test('groceries: add, quick add, check off, send, clear', async ({ page }) => {
  const errors = await open(page, '/groceries');
  await page.getByPlaceholder('Add an item').fill('Avocados');
  await page.getByRole('button', { name: 'Add', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Avocados' })).toBeVisible();
  await page.getByRole('group', { name: 'Quick add' }).getByRole('button', { name: 'Bread' }).click();
  await expect(page.getByLabel('Grocery list').getByRole('button', { name: 'Bread', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Milk' }).click();
  await expect(page.getByRole('button', { name: 'Milk' })).toHaveAttribute('aria-pressed', 'true');
  await page.getByRole('button', { name: 'Send to Sam' }).click();
  await expect(page.getByText(/Emailed \d+ items to Sam/)).toBeVisible();
  await page.getByRole('button', { name: 'Clear checked' }).click();
  await expect(page.getByLabel('Grocery list').getByRole('button', { name: 'Milk' })).toHaveCount(0);
  expect(errors).toEqual([]);
});

test('meals: add ingredients fills the grocery list once', async ({ page }) => {
  const errors = await open(page, '/meals');
  await page.getByRole('button', { name: 'Add ingredients' }).click();
  await expect(page.getByText(/Added \d+ ingredients to Groceries/)).toBeVisible();
  await page.getByRole('button', { name: 'Add ingredients' }).click();
  await expect(page.getByText('Nothing new to add to Groceries')).toBeVisible();
  expect(errors).toEqual([]);
});
