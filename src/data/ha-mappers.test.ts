import { describe, expect, it } from 'vitest';
import type { HassEntity } from 'home-assistant-js-websocket';
import { channelMatches, toFlights, toForecast, toGame, mealieMinutes, splitQuantity, stepTitle, toLockState, toTvState, toMealPlan, toPackages, toRecipe, toRecipeSummary, toThermostat } from './ha-mappers';

// Trimmed from the real climate.main_floor state on 2026-10-23.
function ecobee(state: string, attrs: Record<string, unknown>): HassEntity {
  return {
    entity_id: 'climate.main_floor',
    state,
    attributes: {
      current_humidity: 49, current_temperature: 69.6, fan_mode: 'auto', hvac_action: 'idle',
      max_temp: 95, min_temp: 44.6, preset_mode: 'temp', target_temp_high: 74, target_temp_low: 65, temperature: null,
      ...attrs,
    },
    last_changed: '', last_updated: '', context: { id: '', user_id: null, parent_id: null },
  };
}

describe('toThermostat', () => {
  it('maps an ecobee in heat_cool with a manual hold', () => {
    const t = toThermostat('Main Floor', 'climate.main_floor', ecobee('heat_cool', {}));
    expect(t).toMatchObject({
      available: true, mode: 'heat_cool', action: 'idle', current: 69.6, humidity: 49,
      low: 65, high: 74, target: null, minTemp: 44.6, maxTemp: 95, fan: 'auto', preset: null,
    });
  });

  it('keeps a real preset and a cooling action', () => {
    const t = toThermostat('Main Floor', 'climate.main_floor', ecobee('cool', { preset_mode: 'home', hvac_action: 'cooling', temperature: 72 }));
    expect(t).toMatchObject({ mode: 'cool', action: 'cooling', target: 72, preset: 'home' });
  });

  it('reports off and unavailable', () => {
    expect(toThermostat('Main Floor', 'climate.main_floor', ecobee('off', { hvac_action: 'idle' })).action).toBe('off');
    expect(toThermostat('Main Floor', 'climate.main_floor', ecobee('unavailable', {})).available).toBe(false);
    expect(toThermostat('Main Floor', 'climate.main_floor', null).available).toBe(false);
  });
});


// Trimmed from the real "Creamy Garlic Chicken" import on 2026-10-23.
const garlicChicken = {
  recipe_id: '13b499f6-1d34-4335-bab8-894ab4b277bc',
  slug: 'creamy-garlic-chicken',
  name: 'Creamy Garlic Chicken',
  tags: [{ name: 'One Pan Creamy Garlic Chicken' }, { name: 'Creamy Garlic Chicken Recipe' }, { name: 'weeknight' }],
  total_time: '20 minutes', prep_time: '5 minutes', perform_time: '15 minutes',
  recipe_servings: 4, image: 'i7Po',
  ingredients: [
    { display: '2 boneless, skinless chicken breasts, cut in half horizontally to make thinner steaks', reference_id: 'a' },
    { display: '1 tsp salt', reference_id: 'b' },
    { display: '¼ tsp freshly cracked black pepper', reference_id: 'c' },
    { display: '35 g plain (all-purpose) flour', reference_id: 'd' },
    { display: '125 ml chicken stock', reference_id: 'e' },
    { display: 'Lemon wedges', reference_id: 'f' },
    { display: '', note: '', reference_id: 'g' },
  ],
  instructions: [
    { text: 'Coat the chicken – Sprinkle the chicken with salt, pepper, sweet paprika, onion powder and thyme.', title: null, ingredient_references: [] },
    { text: 'Cook the chicken – Heat the olive oil and 1 tablespoon of butter. Add the chicken and cook for 5–6 minutes.', title: null },
    { text: 'Add the chicken stock and cook for 1–2 minutes until it has evaporated by at least half.', title: null, ingredient_references: [{ reference_id: 'e' }] },
    { text: '   ', title: null },
  ],
};
const TAGS = ['Weeknight', 'Kids', 'Grill', 'Slow cooker'];

describe('Mealie mapping', () => {
  it('parses times', () => {
    expect(mealieMinutes('20 minutes')).toBe(20);
    expect(mealieMinutes('1 hour 15 minutes')).toBe(75);
    expect(mealieMinutes('PT1H30M')).toBe(90);
    expect(mealieMinutes(null, '', '45 min')).toBe(45);
    expect(mealieMinutes(null)).toBeNull();
  });

  it('keeps only household meal tags and builds the image URL', () => {
    const s = toRecipeSummary(garlicChicken, TAGS, 'http://homeassistant.local:9090/');
    expect(s).toMatchObject({ id: 'creamy-garlic-chicken', mins: 20, servings: 4, tags: ['weeknight'] });
    expect(s.image).toBe('http://homeassistant.local:9090/api/media/recipes/13b499f6-1d34-4335-bab8-894ab4b277bc/images/min-original.webp');
    expect(toRecipeSummary(garlicChicken, TAGS).image).toBeNull();
  });

  it('splits quantities from ingredient lines', () => {
    expect(splitQuantity('1 tsp salt')).toEqual({ qty: '1 tsp', name: 'salt' });
    expect(splitQuantity('¼ tsp freshly cracked black pepper')).toEqual({ qty: '¼ tsp', name: 'freshly cracked black pepper' });
    expect(splitQuantity('35 g plain (all-purpose) flour')).toEqual({ qty: '35 g', name: 'plain (all-purpose) flour' });
    expect(splitQuantity('1½ lb chicken')).toEqual({ qty: '1½ lb', name: 'chicken' });
    expect(splitQuantity('2 boneless chicken breasts')).toEqual({ qty: '2', name: 'boneless chicken breasts' });
    expect(splitQuantity('Lemon wedges')).toEqual({ qty: '', name: 'Lemon wedges' });
  });

  it('takes step titles from "Title – text"', () => {
    expect(stepTitle('Coat the chicken – Sprinkle the chicken with salt')).toBe('Coat the chicken');
    expect(stepTitle('Add the chicken stock and cook for 1–2 minutes')).toBeUndefined();
  });

  it('maps a full recipe', () => {
    const r = toRecipe(garlicChicken, TAGS);
    expect(r.ingredients).toHaveLength(6); // the blank line is dropped
    expect(r.steps).toHaveLength(3); // the whitespace-only step is dropped
    expect(r.steps[1]).toMatchObject({ title: 'Cook the chicken' });
    expect(r.steps[0].uses).toBeUndefined(); // no links → Cook matches names in the text
    expect(r.steps[2].uses).toEqual(['e']);
  });

  it('carries Mealie section headings and reads "Title: text" step titles', () => {
    // From the real "Orzo al Limone with Crispy Parmesan Chicken" import.
    const r = toRecipe({ ...garlicChicken, instructions: [
      { text: 'Prep the breading stations: In one shallow bowl, combine the flour.', title: 'Crispy Parmesan Chicken' },
      { text: 'Fry the chicken: Heat the olive oil, about 4 minutes per side.', title: null },
      { text: 'Start the orzo: Heat the olive oil and butter.', title: 'Orzo' },
    ] }, TAGS);
    expect(r.steps.map((x) => [x.title, x.section])).toEqual([
      ['Prep the breading stations', 'Crispy Parmesan Chicken'],
      ['Fry the chicken', 'Crispy Parmesan Chicken'],
      ['Start the orzo', 'Orzo'],
    ]);
  });

  it('drops the sample flour and markdown step Mealie puts in a new recipe', () => {
    const sampleStep = { text: 'Recipe steps as well as other fields in the recipe page support markdown syntax.\n\n**Add a link**\n\n[My Link](https://demo.mealie.io)\n', title: null };
    const r = toRecipe({ ...garlicChicken, ingredients: [{ reference_id: 'x', display: '1 Cup Flour', note: '' }], instructions: [sampleStep] }, TAGS);
    expect(r.ingredients).toEqual([]);
    expect(r.steps).toEqual([]);
    // Real flour in a real recipe stays.
    const real = toRecipe({ ...garlicChicken, ingredients: [{ reference_id: 'y', display: '1 Cup Flour', note: '' }] }, TAGS);
    expect(real.ingredients.map((i) => i.name)).toEqual(['Flour']);
  });

  it('keeps one dinner per day from the meal plan', () => {
    const plan = toMealPlan([
      { mealplan_date: '2026-10-24', entry_type: 'dinner', recipe: garlicChicken },
      { mealplan_date: '2026-10-23', entry_type: 'lunch', title: 'Sandwiches' },
      { mealplan_date: '2026-10-23', entry_type: 'dinner', title: 'Leftovers night', recipe: null },
      { mealplan_date: '2026-10-24', entry_type: 'dinner', title: 'Second entry' },
    ]);
    expect(plan).toEqual([
      { date: '2026-10-23', recipeId: null, title: 'Leftovers night' },
      { date: '2026-10-24', recipeId: 'creamy-garlic-chicken', title: 'Creamy Garlic Chicken' },
    ]);
  });
});

describe('toLockState', () => {
  // From the real lock.front_door / sensor.front_door_last_action on 2026-10-23.
  const lock = (state: string, attrs: Record<string, unknown> = {}): HassEntity => ({
    entity_id: 'lock.front_door', state, attributes: { battery_level: 78, bolt_moving: false, where_label: 'Entryway', ...attrs },
    last_changed: '2026-10-23T18:45:38.856334+00:00', last_updated: '', context: { id: '', user_id: null, parent_id: null },
  });
  const action = (state: string): HassEntity => ({ ...lock('x'), entity_id: 'sensor.front_door_last_action', state, attributes: {} });

  it('maps the Nest x Yale lock', () => {
    expect(toLockState(lock('locked'), action('Physical'), false)).toEqual({
      state: 'locked', lastMethod: 'By hand', lastChanged: Date.parse('2026-10-23T18:45:38.856334+00:00'),
      battery: 78, relockAt: null, pinLockoutUntil: null, pinUnlock: false,
    });
    expect(toLockState(lock('unlocked'), action('Keypad'), true)?.lastMethod).toBe('Keypad');
  });

  it('reads the relock and lockout countdowns from the package timers', () => {
    const timer = (state: string, finishes_at?: string): HassEntity => ({ ...lock('x'), entity_id: 'timer.t', state, attributes: finishes_at ? { finishes_at } : {} });
    const end = '2026-10-23T20:00:30+00:00';
    const unlocked = toLockState(lock('unlocked'), null, true, timer('active', end), timer('idle'));
    expect(unlocked).toMatchObject({ relockAt: Date.parse(end), pinLockoutUntil: null, pinUnlock: true });
    // A relock timer means nothing once the door is locked again; a lockout applies either way.
    const locked = toLockState(lock('locked'), null, true, timer('active', end), timer('active', end));
    expect(locked).toMatchObject({ relockAt: null, pinLockoutUntil: Date.parse(end) });
  });

  it('shows a moving bolt and unknown states', () => {
    expect(toLockState(lock('locked', { bolt_moving: true }), null, false)?.state).toBe('unlocking');
    expect(toLockState(lock('unavailable'), null, false)?.state).toBe('unavailable');
    expect(toLockState(lock('locked'), action('unknown'), false)?.lastMethod).toBeNull();
    expect(toLockState(null, null, false)).toBeNull();
  });
});

// Trimmed from the living room TV on 2026-10-25: Android TV Remote player + Cast player.
function ent(entity_id: string, state: string, attributes: Record<string, unknown>): HassEntity {
  return { entity_id, state, attributes, last_changed: '', last_updated: '', context: { id: '', user_id: null, parent_id: null } };
}
const atv = (state: string, app = 'com.google.android.youtube.tvunplugged') =>
  ent('media_player.master_bedroom_tv_2', state, { app_id: app, app_name: app, assumed_state: true, device_class: 'tv' });
const cast = (state: string) => ent('media_player.master_bedroom_tv', state, {
  app_name: 'YouTube TV', media_artist: 'FOX 5', media_title: 'San Francisco 49ers at Atlanta Falcons',
  media_content_type: 'video', is_volume_muted: false, volume_level: 1, entity_picture: '/api/media_player_proxy/x?token=t',
});

describe('toTvState', () => {
  it('maps live YouTube TV from both players', () => {
    expect(toTvState('Living room', atv('on'), cast('playing'), 'http://ha')).toMatchObject({
      available: true, on: true, app: 'YouTube TV', title: 'San Francisco 49ers at Atlanta Falcons', channel: 'FOX 5',
      artwork: 'http://ha/api/media_player_proxy/x?token=t', paused: false, live: true, volume: null, muted: false,
    });
  });

  it('is on with only the app name when nothing is casting', () => {
    const t = toTvState('Living room', atv('on', 'com.netflix.ninja'), cast('off'));
    expect(t).toMatchObject({ on: true, app: 'Netflix', title: null, channel: null, artwork: null, live: false });
  });

  it('reports paused, off and not connected', () => {
    expect(toTvState('Living room', atv('on'), cast('paused')).paused).toBe(true);
    expect(toTvState('Living room', atv('off'), cast('off'))).toMatchObject({ available: true, on: false, app: null });
    expect(toTvState('Living room', null, null).available).toBe(false);
  });
});

describe('channelMatches', () => {
  it('matches local affiliates but not lookalikes', () => {
    expect(channelMatches('FOX 5', 'FOX')).toBe(true);
    expect(channelMatches('ESPN', 'ESPN')).toBe(true);
    expect(channelMatches('ESPN2', 'ESPN')).toBe(false);
    expect(channelMatches(null, 'ESPN')).toBe(false);
  });
});

describe('toForecast', () => {
  it('maps met.no hourly entries (no rain chance) and skips broken ones', () => {
    const out = toForecast([
      { datetime: '2026-10-26T13:00:00+00:00', condition: 'sunny', temperature: 58, precipitation: 0, humidity: 74, uv_index: 0.5, wind_speed: 6.71 },
      { datetime: 'not a date', temperature: 60 },
      { datetime: '2026-10-26T14:00:00+00:00', condition: 'rainy' },
    ]);
    expect(out).toEqual([{
      time: Date.parse('2026-10-26T13:00:00Z'), condition: 'sunny', temp: 58, low: null,
      precip: 0, precipChance: null, wind: 6.71, humidity: 74, uv: 0.5,
    }]);
  });

  it('keeps the daily low and a rain chance when the source has one', () => {
    const [d] = toForecast([{ datetime: '2026-10-27T16:00:00+00:00', condition: 'rainy', temperature: 70, templow: 52, precipitation_probability: 60 }]);
    expect(d).toMatchObject({ temp: 70, low: 52, precipChance: 60 });
  });
});

describe('toGame', () => {
  // Trimmed from sensor.atlanta_falcons the morning after the game, 2026-10-26.
  const falcons = ent('sensor.atlanta_falcons', 'POST', {
    league: 'NFL', date: '2026-10-25T17:00Z', clock: 'Final', tv_network: 'Fox', team_homeaway: 'home',
    team_name: 'Falcons', team_abbr: 'ATL', team_logo: 'https://a.espncdn.com/atl.png', team_score: '29', team_record: '3-4', team_rank: null, team_winner: true,
    opponent_name: '49ers', opponent_abbr: 'SF', opponent_logo: 'https://a.espncdn.com/sf.png', opponent_score: '20', opponent_record: '6-1', opponent_winner: false,
  });

  it('maps a final with string scores', () => {
    expect(toGame(falcons)).toMatchObject({
      id: 'sensor.atlanta_falcons', league: 'NFL', state: 'post', start: Date.parse('2026-10-25T17:00Z'), home: true, tv: 'Fox', clock: 'Final',
      team: { name: 'Falcons', score: 29, record: '3-4', winner: true, rank: null },
      opponent: { name: '49ers', score: 20, winner: false },
    });
  });

  it('is null between seasons or when unavailable', () => {
    expect(toGame(ent('sensor.x', 'NOT_FOUND', { date: null }))).toBeNull();
    expect(toGame(null)).toBeNull();
  });
});

describe('toFlights', () => {
  // Field names from the Flightradar24 integration's README (times are Unix seconds).
  it('maps a tracked flight', () => {
    const sensor = ent('sensor.flightradar24_additional_tracked', '1', { flights: [{
      id: '3a1f', flight_number: 'DL2290', callsign: 'DAL2290', airline_short: 'Delta',
      airport_origin_code_iata: 'ATL', airport_origin_city: 'Atlanta', airport_destination_code_iata: 'ORD', airport_destination_city: 'Chicago',
      time_scheduled_departure: 1793178600, time_estimated_departure: null, time_real_departure: 1793178720,
      time_scheduled_arrival: 1793184900, time_estimated_arrival: 1793185020, time_real_arrival: null,
      on_ground: 0, altitude: 36000, ground_speed: 452, aircraft_photo_small: 'https://cdn.example/p.jpg',
    }, { id: 'nameless' }] });
    expect(toFlights(sensor)).toEqual([{
      id: '3a1f', number: 'DL2290', airline: 'Delta',
      from: { code: 'ATL', city: 'Atlanta' }, to: { code: 'ORD', city: 'Chicago' },
      schedDeparture: 1793178600000, estDeparture: null, departed: 1793178720000,
      schedArrival: 1793184900000, estArrival: 1793185020000, arrived: null,
      onGround: false, altitude: 36000, speed: 452, photo: 'https://cdn.example/p.jpg',
    }]);
  });

  it('is empty without the sensor or its list', () => {
    expect(toFlights(null)).toEqual([]);
    expect(toFlights(ent('sensor.flightradar24_additional_tracked', '0', {}))).toEqual([]);
  });
});

describe('toPackages', () => {
  const states: Record<string, string> = {
    'sensor.a_mail_amazon_packages_delivering': '2', 'sensor.a_mail_ups_delivering': '1', 'sensor.a_mail_usps_delivered': '1',
    'sensor.a_mail_packages_in_transit': '4', 'sensor.b_mail_amazon_packages_delivering': '1', 'sensor.b_mail_fedex_delivered': 'unknown',
  };
  const get = (id: string) => (id in states ? ({ entity_id: id, state: states[id], attributes: {} } as unknown as HassEntity) : null);

  it('sums every inbox and breaks arrivals down by carrier', () => {
    expect(toPackages(get, ['sensor.a_mail_', 'sensor.b_mail_'])).toEqual({
      arriving: 4, delivered: 1, inTransit: 4,
      arrivingBy: [{ carrier: 'Amazon', n: 3 }, { carrier: 'UPS', n: 1 }],
      deliveredBy: [{ carrier: 'USPS', n: 1 }],
    });
  });

  it('is null when the integration isn’t there', () => {
    expect(toPackages(get, ['sensor.nobody_mail_'])).toBeNull();
  });
});
