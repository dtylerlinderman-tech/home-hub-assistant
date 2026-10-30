// The DataAdapter interface covers every read and action in HANDOFF §7.
// MockAdapter implements it with prototype data; HaAdapter (Phase 2) talks to Home Assistant.
//
// Live state is pushed into `state` (a store the UI subscribes to). A slice that is `null`
// means "not connected": its card shows a quiet placeholder instead of crashing.
// One-shot reads (calendar ranges, meal plans, recipes) are async methods.
import type { Store } from '../store';
import type { PlanDay, Rules } from '../logic/mealRules';

export type ConnectionStatus = 'mock' | 'connecting' | 'connected' | 'disconnected';

export interface Weather {
  temp: number;
  condition: string; // HA condition, e.g. "sunny", "partlycloudy"
  high: number | null;
  low: number | null;
  humidity?: number | null; // %
  wind?: number | null; // mph
  uv?: number | null;
  sunrise?: number | null; // next sunrise, epoch ms
  sunset?: number | null; // next sunset, epoch ms
  source?: string | null; // e.g. "met.no"
}

/** One hour or one day of forecast. Fields a source doesn't provide are null. */
export interface ForecastPoint {
  time: number; // epoch ms
  condition: string;
  temp: number; // the day's high, for daily
  low: number | null; // daily only
  precip: number | null; // inches
  precipChance: number | null; // %
  wind: number | null; // mph
  humidity: number | null; // %
  uv: number | null;
}

export type HvacMode = 'heat' | 'cool' | 'heat_cool' | 'off';
export type HvacAction = 'heating' | 'cooling' | 'idle' | 'off';
export type FanMode = 'auto' | 'on';

export interface Thermostat {
  name: string;
  entity: string;
  available: boolean;
  current: number;
  humidity: number | null;
  mode: HvacMode;
  action: HvacAction;
  target: number | null; // heat / cool
  low: number | null; // heat_cool
  high: number | null; // heat_cool
  minTemp: number;
  maxTemp: number;
  fan: FanMode;
  preset: string | null;
}

export interface LockState {
  state: 'locked' | 'unlocked' | 'locking' | 'unlocking' | 'jammed' | 'unavailable';
  lastMethod: string | null; // "Keypad", "App", "Kitchen hub"
  lastChanged: number | null; // epoch ms
  battery: number | null;
  relockAt: number | null; // epoch ms, while the kitchen relock timer runs
  pinLockoutUntil: number | null; // epoch ms, after too many wrong PINs
  /** Whether the PIN pad can unlock (the HA unlock script exists). Locking always works. */
  pinUnlock: boolean;
}

export interface Doorbell {
  lastRing: number | null;
  lastMotion: number | null;
  snapshotUrl: string | null;
  streamAvailable: boolean;
}

export interface TvState {
  name: string;
  available: boolean;
  on: boolean;
  app: string | null;
  title: string | null; // channel or show title
  channel: string | null; // live-TV channel, when the app reports one
  artwork: string | null;
  paused: boolean;
  live: boolean;
  volume: number | null; // 0–100; null when the TV doesn't report it
  muted: boolean;
}

export interface TodoItem {
  uid: string;
  summary: string;
  done: boolean;
  due: string | null; // display text, e.g. "Tonight"
}

export type TaskSection = 'morning' | 'after_school' | 'evening';

export interface KidTask {
  uid: string;
  summary: string;
  done: boolean;
  section: TaskSection;
  days: string[] | null; // ["mon","tue"], null = every day
}

export interface KidTasks {
  name: string;
  color: string;
  items: KidTask[] | null; // null = list not connected
}

export interface SchoolRunLive {
  driveMin: number;
  usualMin: number | null;
}

export type VacuumStatus = 'cleaning' | 'paused' | 'returning' | 'docked' | 'charging' | 'idle' | 'stuck' | 'error';

export interface VacuumRoom {
  id: string;
  name: string;
  lastCleaned: number | null; // epoch ms
  areaSqFt: number | null;
}

export interface Vacuum {
  name: string;
  available: boolean;
  status: VacuumStatus;
  currentRoom: string | null;
  battery: number | null;
  binFull: boolean;
  /** Clean-base dust bag: "full" when the dock reports it, "due" when Roomba+ says it's time by run hours. */
  bag: 'ok' | 'due' | 'full';
  error: { description: string; action: string | null } | null;
  /** Rooms targeted by the current run; null = whole home. */
  targetRooms: string[] | null;
  missionStarted: number | null; // epoch ms, while a run is in progress
  rooms: VacuumRoom[] | null; // null = room data not available (no cloud login)
}

export type MissionResult = 'completed' | 'cancelled' | 'stuck' | 'error';

export interface VacuumMission {
  id: string;
  start: number; // epoch ms
  durationMin: number;
  areaSqFt: number | null;
  result: MissionResult;
  rooms: string[] | null; // null = whole home
  initiator: string | null; // "Schedule", "Kitchen hub", "App"
}

export interface HubState {
  connection: ConnectionStatus;
  weather: Weather | null;
  climate: Thermostat[];
  lock: LockState | null;
  /** The lock's integration stopped because its Google sign-in expired (not just an offline lock). */
  lockSignInExpired: boolean;
  doorbell: Doorbell | null;
  tvs: TvState[];
  reminders: TodoItem[] | null;
  /** The Mealie shopping list (a todo entity); null = not connected. */
  groceries: TodoItem[] | null;
  kids: KidTasks[];
  /** Drive time per window; "usual" is computed per window from history. */
  schoolRun: { dropoff: SchoolRunLive; pickup: SchoolRunLive } | null;
  mealRules: Rules;
  vacuum: Vacuum | null; // null = no vacuum configured or not connected
  games: Game[]; // one per followed team (Team Tracker), whatever its state
  flights: Flight[]; // tracked by Flightradar24 (added from calendar flight numbers by the HA package)
}

/** A tracked flight. Times are epoch ms; null when Flightradar24 doesn't know them yet. */
export interface Flight {
  id: string;
  number: string; // "DL1234"
  airline: string | null; // "Delta"
  from: { code: string; city: string | null };
  to: { code: string; city: string | null };
  schedDeparture: number | null;
  estDeparture: number | null;
  departed: number | null; // actual takeoff
  schedArrival: number | null;
  estArrival: number | null;
  arrived: number | null; // actual landing
  onGround: boolean;
  altitude: number | null; // feet
  speed: number | null; // knots
  photo: string | null;
}

export interface GameSide {
  name: string; // "Falcons"
  abbr: string;
  logo: string | null;
  score: number | null;
  record: string | null; // "3-4"
  rank: number | null; // college top-25
  winner: boolean | null;
}

/** A followed team's current or next game, from a Team Tracker sensor. */
export interface Game {
  id: string; // sensor entity id
  league: string; // "NFL", "NCAAF"
  state: 'pre' | 'in' | 'post';
  start: number; // epoch ms
  home: boolean; // our team is at home
  team: GameSide;
  opponent: GameSide;
  clock: string | null; // ESPN's status text: "10/31 - 7:30 PM EDT", "4:12 - 3rd", "Final"
  tv: string | null;
}

export interface CalendarEvent {
  start: Date;
  end: Date;
  allDay: boolean;
  title: string;
  person: string;
}

export interface RecipeSummary {
  id: string;
  name: string;
  mins: number | null;
  tags: string[];
  servings: number | null;
  image: string | null;
}

export interface Ingredient {
  id: string;
  qty: string;
  name: string;
}

export interface RecipeStep {
  text: string;
  title?: string; // short name for the step, used as the timer label
  section?: string; // recipe section heading, e.g. "Orzo"
  uses?: string[]; // ingredient ids linked to this step
}

export interface Recipe extends RecipeSummary {
  ingredients: Ingredient[];
  steps: RecipeStep[];
  placeholder?: boolean;
}

export interface MealPlanDay {
  date: string; // YYYY-MM-DD
  recipeId: string | null;
  title: string; // recipe name, or a note like "Leftovers night"
}

export type UnlockResult = { ok: true } | { ok: false; reason: 'wrong_pin' | 'locked_out' | 'error'; message?: string };

export type TvCommand = 'channel_up' | 'channel_down' | 'play_pause' | 'mute' | 'volume_up' | 'volume_down' | 'power';

export interface DataAdapter {
  readonly state: Store<HubState>;
  readonly isMock: boolean;
  start(): Promise<void>;

  // Weather
  getForecast(kind: 'hourly' | 'daily'): Promise<ForecastPoint[] | null>;

  // Calendar and meals
  getEvents(start: Date, end: Date): Promise<CalendarEvent[] | null>;
  getMealPlan(start: Date, end: Date): Promise<MealPlanDay[] | null>;
  /** recipeId null writes a note night: `note` as its title (default "Leftovers night"). */
  setMealPlan(days: { date: string; recipeId: PlanDay; note?: string }[]): Promise<void>;
  setMealRule(key: keyof Rules, on: boolean): Promise<void>;
  /** Add these recipes' ingredients to the grocery list, skipping what's already on it. Returns how many were added. */
  addIngredients(recipeIds: string[]): Promise<number>;

  // Groceries (the Mealie shopping list)
  addGrocery(text: string): Promise<void>;
  setGroceryDone(uid: string, done: boolean): Promise<void>;
  clearCheckedGroceries(): Promise<void>;
  /** Email the open items through the HA package's script. */
  sendGroceries(): Promise<void>;

  // Recipes
  getRecipes(): Promise<RecipeSummary[] | null>;
  getRecipe(id: string): Promise<Recipe | null>;
  importRecipe(url: string): Promise<RecipeSummary>;

  // Todo lists
  setReminderDone(uid: string, done: boolean): Promise<void>;
  setKidTaskDone(kid: string, uid: string, done: boolean): Promise<void>;

  // Climate
  setTemperature(entity: string, t: { target?: number; low?: number; high?: number }): Promise<void>;
  setHvacMode(entity: string, mode: HvacMode): Promise<void>;
  setFanMode(entity: string, fan: FanMode): Promise<void>;
  setPresetAll(preset: string): Promise<void>;

  // Door
  unlock(pin: string): Promise<UnlockResult>;
  lock(): Promise<void>;

  // TV
  tvCommand(tv: number, cmd: TvCommand): Promise<void>;
  tvTune(tv: number, channel: string): Promise<void>;

  // Vacuum (Roomba+ integration)
  /** Start cleaning: the given rooms (by name), or the whole home when omitted. */
  vacuumStart(rooms?: string[]): Promise<void>;
  vacuumPause(): Promise<void>;
  vacuumResume(): Promise<void>;
  vacuumDock(): Promise<void>;
  vacuumLocate(): Promise<void>;
  /** "I replaced it": reset the dock-bag maintenance counter. */
  vacuumBagReplaced(): Promise<void>;

  // Front door camera
  /**
   * Open the live camera stream (WebRTC through HA). Calls onStream when video arrives,
   * onError if it can't start. Resolves to a function that closes the stream.
   */
  openCameraStream(onStream: (s: MediaStream) => void, onError: (message: string) => void): Promise<() => void>;
  /** Most recent runs first. */
  getVacuumMissions(limit: number): Promise<VacuumMission[] | null>;
  /** Image URL of a run's cleaning map (latest run when id is omitted). */
  getVacuumMapUrl(missionId?: string): Promise<string | null>;
}
