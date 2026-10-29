// Pure functions that turn Home Assistant entity states into Kitchen Hub types.
// Kept separate from HaAdapter so they can be unit-tested with real state samples.
import type { HassEntity } from 'home-assistant-js-websocket';
import type {
  FanMode, Flight, ForecastPoint, Game, GameSide, HvacAction, HvacMode, Ingredient, LockState, MealPlanDay, MissionResult, Recipe, RecipeStep, RecipeSummary,
  Thermostat, TvState, Vacuum, VacuumMission, VacuumStatus,
} from './adapter';
import { parseDuration } from '../logic/timers';

const HVAC_MODES: HvacMode[] = ['heat', 'cool', 'heat_cool', 'off'];

function num(v: unknown): number | null {
  const n = typeof v === 'number' ? v : typeof v === 'string' && v !== '' ? Number(v) : NaN;
  return Number.isFinite(n) ? n : null;
}

/**
 * ecobee climate entity → Thermostat. `preset_mode: "temp"` means a manual hold,
 * so it maps to no preset (none of the Home / Away / Sleep buttons is lit).
 */
export function toThermostat(name: string, entityId: string, e: HassEntity | null): Thermostat {
  const unavailable: Thermostat = {
    name, entity: entityId, available: false, current: 0, humidity: null, mode: 'off', action: 'off',
    target: null, low: null, high: null, minTemp: 45, maxTemp: 95, fan: 'auto', preset: null,
  };
  if (!e || e.state === 'unavailable' || e.state === 'unknown') return unavailable;
  const a = e.attributes;
  const mode: HvacMode = (HVAC_MODES as string[]).includes(e.state) ? (e.state as HvacMode) : 'off';
  const rawAction = String(a.hvac_action ?? '');
  const action: HvacAction = mode === 'off' ? 'off' : rawAction === 'heating' || rawAction === 'cooling' ? rawAction : 'idle';
  const preset = typeof a.preset_mode === 'string' && a.preset_mode !== 'temp' ? a.preset_mode : null;
  return {
    name,
    entity: entityId,
    available: true,
    current: num(a.current_temperature) ?? 0,
    humidity: num(a.current_humidity),
    mode,
    action,
    target: num(a.temperature),
    low: num(a.target_temp_low),
    high: num(a.target_temp_high),
    minTemp: num(a.min_temp) ?? 45,
    maxTemp: num(a.max_temp) ?? 95,
    fan: (a.fan_mode === 'on' ? 'on' : 'auto') as FanMode,
    preset,
  };
}

// ---- Mealie (shapes as returned by HA's mealie.* actions, checked against Mealie v3.28 on 2026-10-23) ----

export interface MealieTag { name: string }
export interface MealieRecipeSummary {
  recipe_id: string;
  slug: string;
  name: string;
  tags?: MealieTag[];
  total_time?: string | null;
  prep_time?: string | null;
  perform_time?: string | null;
  recipe_servings?: number | null;
  image?: string | null;
}
export interface MealieIngredient { display?: string | null; note?: string | null; title?: string | null; reference_id: string }
export interface MealieInstruction { text?: string | null; title?: string | null; ingredient_references?: { reference_id: string }[] }
export interface MealieRecipe extends MealieRecipeSummary { ingredients?: MealieIngredient[]; instructions?: MealieInstruction[] }
export interface MealieMealplan {
  mealplan_id?: string | number;
  mealplan_date: string;
  entry_type: string;
  title?: string | null;
  recipe?: MealieRecipeSummary | null;
}

/** "20 minutes", "1 hour 15 minutes", "PT1H15M" → minutes. */
export function mealieMinutes(...values: (string | null | undefined)[]): number | null {
  for (const v of values) {
    if (!v) continue;
    const iso = /^P(?:T)?(?:(\d+)H)?(?:(\d+)M)?$/i.exec(v.trim());
    if (iso && (iso[1] || iso[2])) return Number(iso[1] ?? 0) * 60 + Number(iso[2] ?? 0);
    const secs = parseDuration(v);
    if (secs) return Math.round(secs / 60);
  }
  return null;
}

/** Image URL when Mealie's own address is configured (the browser loads it straight from Mealie). */
export function mealieImageUrl(r: MealieRecipeSummary, mealieUrl: string | undefined): string | null {
  if (!mealieUrl || !r.image) return null;
  return mealieUrl.replace(/\/$/, '') + '/api/media/recipes/' + r.recipe_id + '/images/min-original.webp';
}

export function toRecipeSummary(r: MealieRecipeSummary, mealTags: string[], mealieUrl?: string): RecipeSummary {
  const total = mealieMinutes(r.total_time);
  const parts = (mealieMinutes(r.prep_time) ?? 0) + (mealieMinutes(r.perform_time) ?? 0);
  return {
    id: r.slug,
    name: r.name,
    mins: total ?? (parts || null),
    // Only the household's meal tags; sites add SEO tags like "Creamy Garlic Chicken Recipe".
    tags: (r.tags ?? []).map((t) => t.name).filter((n) => mealTags.some((m) => m.toLowerCase() === n.toLowerCase())),
    servings: r.recipe_servings || null,
    image: mealieImageUrl(r, mealieUrl),
  };
}

const QTY = /^((?:\d+(?:[.,/]\d+)?|[¼½¾⅓⅔⅛⅜⅝⅞])(?:\s*(?:-|–|to)\s*(?:\d+(?:[.,/]\d+)?|[¼½¾⅓⅔⅛]))?(?:\s*[¼½¾⅓⅔⅛])?(?:\s*(?:tsp|tbsp|teaspoons?|tablespoons?|cups?|c|g|kg|grams?|ml|l|litres?|liters?|oz|ounces?|lbs?|pounds?|cloves?|cans?|pinch|dash|sticks?|slices?)\.?)?)\s+(.+)$/i;

/** "1 tsp salt" → { qty: "1 tsp", name: "salt" }; "Lemon wedges" → { qty: "", name: "Lemon wedges" } */
export function splitQuantity(line: string): { qty: string; name: string } {
  const m = QTY.exec(line.trim());
  return m ? { qty: m[1], name: m[2] } : { qty: '', name: line.trim() };
}

/**
 * Step title from the text, for timer labels: "Cook the chicken – Heat the oil…" or
 * "Fry the chicken: Heat the oil…" → "Cook the chicken" / "Fry the chicken".
 */
export function stepTitle(text: string): string | undefined {
  const m = /^(.{3,40}?)(?:\s+[–—-]\s+|:\s+)\S/.exec(text);
  return m ? m[1] : undefined;
}

export function toRecipe(r: MealieRecipe, mealTags: string[], mealieUrl?: string): Recipe {
  const ingredients: Ingredient[] = (r.ingredients ?? [])
    .map((i) => ({ id: i.reference_id, ...splitQuantity(i.display || i.note || '') }))
    .filter((i) => i.name);
  // Mealie step titles are section headings ("Orzo") that apply until the next one.
  let section: string | undefined;
  const steps: RecipeStep[] = (r.instructions ?? [])
    .filter((s) => s.text?.trim())
    .map((s) => {
      if (s.title?.trim()) section = s.title.trim();
      const refs = (s.ingredient_references ?? []).map((x) => x.reference_id);
      return {
        text: s.text!.trim(),
        title: stepTitle(s.text!.trim()),
        ...(section ? { section } : {}),
        ...(refs.length ? { uses: refs } : {}),
      };
    });
  return { ...toRecipeSummary(r, mealTags, mealieUrl), ingredients, steps };
}

/** Dinner entries only, one per date (the first if there are several). */
export function toMealPlan(entries: MealieMealplan[]): MealPlanDay[] {
  const out = new Map<string, MealPlanDay>();
  for (const e of entries) {
    if (e.entry_type !== 'dinner' || out.has(e.mealplan_date)) continue;
    out.set(e.mealplan_date, {
      date: e.mealplan_date,
      recipeId: e.recipe?.slug ?? null,
      title: e.recipe?.name ?? e.title ?? 'Dinner',
    });
  }
  return [...out.values()].sort((a, b) => a.date.localeCompare(b.date));
}

// ---- Nest x Yale lock (krozgrov/ha-nest-yale-integration) ----

const LOCK_STATES = ['locked', 'unlocked', 'locking', 'unlocking', 'jammed'] as const;
const METHOD_LABEL: Record<string, string> = { physical: 'By hand', keypad: 'Keypad', remote: 'App', manual: 'By hand', auto: 'Auto-lock' };

/** An active HA timer's end time (epoch ms), or null. */
export function timerEnd(t: HassEntity | null): number | null {
  if (!t || t.state !== 'active') return null;
  const end = Date.parse(String(t.attributes.finishes_at ?? ''));
  return Number.isFinite(end) ? end : null;
}

/**
 * Lock entity + optional "Last Action" sensor → LockState. Battery comes from the lock's battery_level.
 * relock / lockout are the package's timers (timer.kitchen_door_relock / timer.kitchen_door_lockout).
 */
export function toLockState(
  lock: HassEntity | null, lastAction: HassEntity | null, pinUnlock: boolean,
  relock: HassEntity | null = null, lockout: HassEntity | null = null,
): LockState | null {
  if (!lock) return null;
  const raw = lock.state;
  let state: LockState['state'] = (LOCK_STATES as readonly string[]).includes(raw) ? (raw as LockState['state']) : 'unavailable';
  // bolt_moving while locked/unlocked means it's on its way to the other state.
  if (lock.attributes.bolt_moving === true && (state === 'locked' || state === 'unlocked')) state = state === 'locked' ? 'unlocking' : 'locking';
  const method = lastAction && !['unknown', 'unavailable'].includes(lastAction.state) ? lastAction.state : null;
  const changed = Date.parse(lock.last_changed);
  return {
    state,
    lastMethod: method ? METHOD_LABEL[method.toLowerCase()] ?? method : null,
    lastChanged: Number.isFinite(changed) ? changed : null,
    battery: num(lock.attributes.battery_level),
    relockAt: state === 'unlocked' ? timerEnd(relock) : null,
    pinLockoutUntil: timerEnd(lockout),
    pinUnlock,
  };
}

// ---- Flightradar24 (AlexandrErohin/home-assistant-flightradar24): sensor.*_additional_tracked ----

/** FR24 gives times as Unix seconds; accept ms or ISO strings too. */
function frTime(v: unknown): number | null {
  if (typeof v === 'number' && v > 0) return v < 1e12 ? v * 1000 : v;
  if (typeof v === 'string' && v) { const t = Date.parse(v); return Number.isFinite(t) ? t : null; }
  return null;
}

/** The tracked-flights sensor → Flights. Entries without a flight number or callsign are skipped. */
export function toFlights(e: HassEntity | null): Flight[] {
  const list = e?.attributes.flights;
  if (!Array.isArray(list)) return [];
  return list.flatMap((f: Record<string, unknown>) => {
    const number = String(f.flight_number || f.callsign || '');
    if (!number) return [];
    const str = (v: unknown) => (typeof v === 'string' && v ? v : null);
    return [{
      id: String(f.id ?? number),
      number,
      airline: str(f.airline_short) ?? str(f.airline),
      from: { code: str(f.airport_origin_code_iata) ?? '?', city: str(f.airport_origin_city) },
      to: { code: str(f.airport_destination_code_iata) ?? '?', city: str(f.airport_destination_city) },
      schedDeparture: frTime(f.time_scheduled_departure),
      estDeparture: frTime(f.time_estimated_departure),
      departed: frTime(f.time_real_departure),
      schedArrival: frTime(f.time_scheduled_arrival),
      estArrival: frTime(f.time_estimated_arrival),
      arrived: frTime(f.time_real_arrival),
      onGround: f.on_ground === true || f.on_ground === 1,
      altitude: num(f.altitude),
      speed: num(f.ground_speed),
      photo: str(f.aircraft_photo_small),
    }];
  });
}

// ---- Team Tracker (vasqued2/ha-teamtracker), checked against NFL, MLB, NCAAF and NCAAM sensors on 2026-10-26 ----

const GAME_STATES: Record<string, Game['state']> = { PRE: 'pre', IN: 'in', POST: 'post' };

/** Team Tracker sensor → Game. Null when unavailable, between seasons (NOT_FOUND) or missing a date. */
export function toGame(e: HassEntity | null): Game | null {
  const state = e ? GAME_STATES[e.state] : undefined;
  const a = e?.attributes;
  const start = Date.parse(String(a?.date ?? ''));
  if (!e || !a || !state || !Number.isFinite(start)) return null;
  const side = (p: 'team' | 'opponent'): GameSide => ({
    name: String(a[p + '_name'] ?? a[p + '_abbr'] ?? ''),
    abbr: String(a[p + '_abbr'] ?? ''),
    logo: typeof a[p + '_logo'] === 'string' ? a[p + '_logo'] : null,
    score: num(a[p + '_score']),
    record: typeof a[p + '_record'] === 'string' ? a[p + '_record'] : null,
    rank: num(a[p + '_rank']),
    winner: typeof a[p + '_winner'] === 'boolean' ? a[p + '_winner'] : null,
  });
  return {
    id: e.entity_id, league: String(a.league ?? ''), state, start,
    home: a.team_homeaway === 'home',
    team: side('team'), opponent: side('opponent'),
    clock: typeof a.clock === 'string' ? a.clock : null,
    tv: typeof a.tv_network === 'string' ? a.tv_network : null,
  };
}

// ---- Weather forecasts (weather.get_forecasts), checked against met.no on 2026-10-26 ----

export interface HaForecast {
  datetime: string; condition?: string; temperature?: number; templow?: number;
  precipitation?: number | null; precipitation_probability?: number | null;
  wind_speed?: number | null; humidity?: number | null; uv_index?: number | null;
}

/** HA forecast entries → ForecastPoints, dropping any without a time or temperature. */
export function toForecast(raw: HaForecast[] | null | undefined): ForecastPoint[] {
  return (raw ?? []).flatMap((f) => {
    const time = Date.parse(f.datetime);
    const temp = num(f.temperature);
    if (!Number.isFinite(time) || temp === null) return [];
    return [{
      time, temp, condition: f.condition ?? 'cloudy',
      low: num(f.templow), precip: num(f.precipitation), precipChance: num(f.precipitation_probability),
      wind: num(f.wind_speed), humidity: num(f.humidity), uv: num(f.uv_index),
    }];
  });
}

// ---- TVs: Android TV Remote + Google Cast, checked against a Chromecast with Google TV on 2026-10-25 ----

/** Android TV Remote reports the app's package name; Cast reports a friendly one. */
const TV_APPS: Record<string, string> = {
  'com.google.android.youtube.tvunplugged': 'YouTube TV',
  'com.google.android.youtube.tv': 'YouTube',
  'com.netflix.ninja': 'Netflix',
  'com.disney.disneyplus': 'Disney+',
  'com.hulu.livingroomplus': 'Hulu',
  'com.amazon.amazonvideo.livingroom': 'Prime Video',
  'com.google.android.apps.tv.launcherx': 'Home screen',
};

/**
 * Remote's media player (power, app) + Cast player (title, channel, artwork, play state) → TvState.
 * Cast goes "off" whenever nothing is casting, so on/off comes from the Android TV player when it's paired.
 * Neither integration reports TV volume through a Chromecast, so volume is usually null.
 */
export function toTvState(name: string, player: HassEntity | null, cast: HassEntity | null, hassUrl = ''): TvState {
  const castActive = !!cast && !['off', 'idle', 'standby', 'unknown'].includes(cast.state);
  const on = player ? player.state !== 'off' && player.state !== 'standby' : castActive;
  const pkg = player?.attributes.app_name ?? player?.attributes.app_id;
  const app = (castActive ? cast!.attributes.app_name : null) ?? (pkg ? TV_APPS[pkg] ?? pkg : null);
  const pic = castActive ? cast!.attributes.entity_picture : null;
  const vol = player?.attributes.volume_level;
  return {
    name,
    available: !!(player || cast),
    on,
    app: on ? app ?? null : null,
    title: on && castActive ? cast!.attributes.media_title ?? null : null,
    // YouTube TV puts the channel ("FOX 5") in media_artist.
    channel: on && castActive ? cast!.attributes.media_artist ?? null : null,
    artwork: on && pic ? (pic.startsWith('/') ? hassUrl + pic : pic) : null,
    paused: castActive && cast!.state === 'paused',
    live: castActive && cast!.attributes.media_content_type === 'video' && !!cast!.attributes.media_artist,
    volume: typeof vol === 'number' ? Math.round(vol * 100) : null,
    muted: (player ?? cast)?.attributes.is_volume_muted === true,
  };
}

/** Favorite "FOX" matches the local affiliate "FOX 5". */
export function channelMatches(channel: string | null, favorite: string): boolean {
  if (!channel) return false;
  const a = channel.toLowerCase(), b = favorite.toLowerCase();
  return a === b || a.startsWith(b + ' ');
}

// ---- Roomba+ (johnnyh1975/ha_roomba_plus), checked against an i-series robot on 2026-10-23 ----

export interface RoombaRoom { name: string; room_id: string; region_id?: string; outline?: [number, number][]; x?: number; y?: number }
export interface RoombaMissionRecord {
  id: string;
  n_mssn?: number;
  started_at: string;
  ended_at?: string | null;
  duration_min?: number | null;
  area_sqft?: number | null;
  result?: string | null;
  initiator?: string | null;
  room_coverage?: Record<string, number> | null;
}

/** Rooms covered at least this much count as "cleaned" in a run. */
const COVERED = 0.1;
const isZone = (name: string) => /^zone \d+$/i.test(name);

export function roombaRooms(rooms: Record<string, RoombaRoom> | undefined): RoombaRoom[] {
  return Object.values(rooms ?? {}).filter((r) => !isZone(r.name));
}

const RESULT: Record<string, MissionResult> = { completed: 'completed', cancelled: 'cancelled', canceled: 'cancelled', stuck: 'stuck' };
const INITIATOR: Record<string, string> = { schedule: 'Schedule', app: 'App', rmtapp: 'App', localapp: 'App', manual: 'Button', button: 'Button' };

export function toMission(r: RoombaMissionRecord): VacuumMission {
  const cov = Object.entries(r.room_coverage ?? {}).filter(([, c]) => c >= COVERED).sort((a, b) => b[1] - a[1]);
  const init = (r.initiator ?? '').toLowerCase();
  return {
    id: String(r.n_mssn ?? r.id),
    start: Date.parse(r.started_at),
    durationMin: Math.round(r.duration_min ?? 0),
    areaSqFt: r.area_sqft ?? null,
    result: RESULT[(r.result ?? '').toLowerCase()] ?? 'error',
    rooms: cov.length ? cov.map(([name]) => name) : null,
    initiator: init === 'kitchen hub' ? 'Kitchen hub' : INITIATOR[init] ?? (r.initiator || null),
  };
}

/** Last time each room was covered, from the run history. */
export function lastCleanedByRoom(missions: RoombaMissionRecord[]): Record<string, number> {
  const out: Record<string, number> = {};
  for (const m of missions) {
    const end = Date.parse(m.ended_at ?? m.started_at);
    for (const [room, c] of Object.entries(m.room_coverage ?? {})) {
      if (c >= COVERED && Number.isFinite(end) && end > (out[room] ?? 0)) out[room] = end;
    }
  }
  return out;
}

const VAC_STATUS: Record<string, VacuumStatus> = { cleaning: 'cleaning', docked: 'docked', returning: 'returning', paused: 'paused', idle: 'idle', error: 'error' };

export interface RoombaEntities {
  vacuum: HassEntity | null;
  battery: HassEntity | null;
  location: HassEntity | null; // device_tracker: room name, "Docked", …
  phase: HassEntity | null; // sensor.*_phase: "stuck" when stuck
  lastError: HassEntity | null; // sensor.*_last_error_code with description/action attributes
  roomsMap: HassEntity | null; // image.*_rooms_map with a `rooms` attribute
  roomAreas: HassEntity | null; // sensor.*_room_areas: { room: m² }
  baseStatus: HassEntity | null; // sensor.*_clean_base_status: "ready", or a full/bag state
  maintenance: HassEntity | null; // binary_sensor.*_maintenance_due with a `due` list
}

/** Dock bag state from the clean base and Roomba+'s maintenance tracker. */
export function bagState(base: HassEntity | null, maintenance: HassEntity | null): Vacuum['bag'] {
  if (base && /full|bag/i.test(base.state) && !/^ready$/i.test(base.state)) return 'full';
  const due = maintenance?.attributes.due;
  return maintenance?.state === 'on' && Array.isArray(due) && due.includes('clean_base_bag') ? 'due' : 'ok';
}

export function toVacuum(name: string, e: RoombaEntities, lastCleaned: Record<string, number>, now = Date.now()): Vacuum | null {
  const v = e.vacuum;
  if (!v) return null;
  if (v.state === 'unavailable') {
    return { name, available: false, status: 'idle', currentRoom: null, battery: null, binFull: false, bag: 'ok', error: null, targetRooms: null, missionStarted: null, rooms: null };
  }
  const a = v.attributes;
  let status: VacuumStatus = VAC_STATUS[v.state] ?? 'idle';
  if (e.phase?.state === 'stuck') status = 'stuck';
  const loc = e.location?.state ?? '';
  const inRoom = !!loc && !['docked', 'dock busy', 'not_home', 'home', 'unknown', 'unavailable'].includes(loc.toLowerCase());
  const elapsed = num(a.mission_elapsed_min);
  const running = status === 'cleaning' || status === 'paused' || status === 'stuck' || status === 'error';
  let error: Vacuum['error'] = null;
  if (status === 'stuck' || status === 'error') {
    const ea = e.lastError?.attributes ?? {};
    error = {
      description: String(ea.description || (status === 'stuck' ? 'Stuck' + (inRoom ? ' in the ' + loc.toLowerCase() : '') : 'Needs help')),
      action: ea.action ? String(ea.action) : null,
    };
  }
  const areas = (e.roomAreas?.attributes ?? {}) as Record<string, unknown>;
  const roomList = e.roomsMap ? roombaRooms(e.roomsMap.attributes.rooms as Record<string, RoombaRoom>) : null;
  return {
    name,
    available: true,
    status,
    currentRoom: running && inRoom ? loc : null,
    battery: num(e.battery?.state),
    binFull: a.bin_full === true,
    bag: bagState(e.baseStatus, e.maintenance),
    error,
    targetRooms: running && Array.isArray(a.mission_scope) ? (a.mission_scope as string[]) : null,
    missionStarted: running && elapsed != null ? now - elapsed * 60e3 : null,
    rooms: roomList && roomList.length
      ? roomList.map((r) => {
        const m2 = num(areas[r.name]);
        return { id: r.room_id, name: r.name, lastCleaned: lastCleaned[r.name] ?? null, areaSqFt: m2 != null ? Math.round(m2 * 10.7639) : null };
      })
      : null,
  };
}

/**
 * Floor plan drawn from Roomba+ room outlines (robot coordinates, y up), with `highlight`
 * rooms filled and an optional dot for the robot's current room. Returns an SVG data URL.
 */
export function roombaMapSvg(rooms: Record<string, RoombaRoom> | undefined, highlight: string[] | null, robotRoom?: string | null): string | null {
  const all = Object.values(rooms ?? {}).filter((r) => r.outline && r.outline.length > 2);
  if (!all.length) return null;
  const pts = all.flatMap((r) => r.outline!);
  const minX = Math.min(...pts.map((p) => p[0])), maxX = Math.max(...pts.map((p) => p[0]));
  const minY = Math.min(...pts.map((p) => p[1])), maxY = Math.max(...pts.map((p) => p[1]));
  const pad = 300;
  const W = maxX - minX + pad * 2, H = maxY - minY + pad * 2;
  const X = (x: number) => (x - minX + pad).toFixed(0);
  const Y = (y: number) => (maxY - y + pad).toFixed(0); // flip: robot y points up
  const on = new Set(highlight ?? []);
  const font = Math.round(Math.max(W, H) / 38);
  const shapes = all.map((r) => {
    const zone = isZone(r.name);
    const lit = on.has(r.name);
    const d = r.outline!.map((p, i) => (i ? 'L' : 'M') + X(p[0]) + ' ' + Y(p[1])).join(' ') + 'Z';
    return '<path d="' + d + '" fill="' + (lit ? '#1F3330' : zone ? '#1B1A17' : '#211F1B') + '" stroke="' + (lit ? '#5FB3A6' : '#3A362F')
      + '" stroke-width="' + Math.round(font / 5) + '" stroke-linejoin="round"/>';
  }).join('');
  const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;');
  const labels = all.filter((r) => !isZone(r.name) && r.x != null && r.y != null).map((r) =>
    '<text x="' + X(r.x!) + '" y="' + Y(r.y!) + '" text-anchor="middle" dominant-baseline="middle" font-family="Manrope, system-ui, sans-serif" font-size="'
      + font + '" font-weight="700" fill="' + (on.has(r.name) ? '#D6D0C4' : '#8C867B') + '">' + esc(r.name) + '</text>',
  ).join('');
  const bot = robotRoom ? all.find((r) => r.name === robotRoom && r.x != null) : null;
  const dot = bot
    ? '<circle cx="' + X(bot.x!) + '" cy="' + (Number(Y(bot.y!)) + font * 1.6) + '" r="' + font * 0.7 + '" fill="#F4EFE6" stroke="#1B1A17" stroke-width="' + font / 4 + '"/>'
    : '';
  const svg = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ' + W.toFixed(0) + ' ' + H.toFixed(0) + '">' + shapes + labels + dot + '</svg>';
  return 'data:image/svg+xml,' + encodeURIComponent(svg);
}
