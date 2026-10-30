// MockAdapter: reproduces the prototype's sample data and behavior so every screen
// works without Home Assistant. Enabled with ?mock=1, or when no HA URL is configured.
import { createStore } from '../store';
import type { HubConfig } from '../config';
import type { PlanDay, Rules } from '../logic/mealRules';
import { addDays, isoDate, nowMs, startOfDay, startOfWeek, now } from '../logic/time';
import { itemsToAdd } from '../logic/groceries';
import type {
  CalendarEvent, DataAdapter, FanMode, Flight, ForecastPoint, Game, GameSide, HubState, HvacMode, MealPlanDay, Recipe, RecipeSummary,
  Thermostat, TvCommand, TvState, UnlockResult, VacuumMission,
} from './adapter';
import {
  MOCK_EVENTS, MOCK_KID_TASKS, MOCK_LAST_WEEK, MOCK_RECIPES, MOCK_GROCERIES, MOCK_REMINDERS, MOCK_WEEK, placeholderRecipe, slug,
} from './mock-data';
import { MockRobot } from './mock-vacuum';

const DEMO_PIN = '1234';
const PRESET_TEMPS: Record<string, number> = { home: 72, away: 78, sleep: 69 };

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Alex's flight to Chicago, a little over halfway there. */
function mockFlights(): Flight[] {
  const t = nowMs();
  return [{
    id: 'mock-dl2290', number: 'DL2290', airline: 'Delta',
    from: { code: 'ATL', city: 'Atlanta' }, to: { code: 'ORD', city: 'Chicago' },
    schedDeparture: t - 65 * 60e3, estDeparture: t - 60 * 60e3, departed: t - 58 * 60e3,
    schedArrival: t + 45 * 60e3, estArrival: t + 47 * 60e3, arrived: null,
    onGround: false, altitude: 36000, speed: 452, photo: null,
  }];
}

/** Falcons live in the 3rd, GT football at Pitt Saturday night, GT basketball next week (outside the card's window). */
function mockGames(): Game[] {
  const side = (name: string, abbr: string, score: number | null, record: string | null): GameSide =>
    ({ name, abbr, logo: null, score, record, rank: null, winner: null });
  const t = nowMs();
  return [
    { id: 'sensor.falcons', league: 'NFL', state: 'in', start: t - 95 * 60e3, home: true, team: side('Falcons', 'ATL', 17, '3-4'), opponent: side('49ers', 'SF', 14, '6-1'), clock: '4:12 - 3rd', tv: 'FOX' },
    { id: 'sensor.gt_football', league: 'NCAAF', state: 'pre', start: t + 4 * 864e5, home: false, team: side('Georgia Tech', 'GT', 0, '2-5'), opponent: side('Pitt', 'PITT', 0, '5-3'), clock: null, tv: 'ESPN2' },
    { id: 'sensor.gt_basketball', league: 'NCAAM', state: 'pre', start: t + 8 * 864e5, home: true, team: side('Georgia Tech', 'GT', null, null), opponent: side('Hampton', 'HAMP', null, null), clock: null, tv: null },
  ];
}

const lockExpired = new URLSearchParams(location.search).has('lockexpired');

function todayAt(h: number, m: number): number {
  const d = startOfDay(now());
  d.setHours(h, m);
  return d.getTime();
}

function withAction(t: Thermostat): Thermostat {
  let action: Thermostat['action'] = 'idle';
  if (t.mode === 'off') action = 'off';
  else if (t.mode === 'cool' && t.target != null && t.current > t.target) action = 'cooling';
  else if (t.mode === 'heat' && t.target != null && t.current < t.target) action = 'heating';
  else if (t.mode === 'heat_cool' && t.high != null && t.current > t.high) action = 'cooling';
  else if (t.mode === 'heat_cool' && t.low != null && t.current < t.low) action = 'heating';
  return { ...t, action };
}

export class MockAdapter implements DataAdapter {
  readonly isMock = true;
  readonly state;
  private recipes: Recipe[] = MOCK_RECIPES.map((r) => ({ ...r }));
  private plans = new Map<string, PlanDay>(); // date → recipe id (null = a note night)
  private notes = new Map<string, string>(); // date → note title, for note nights
  private badPins: number[] = [];
  private relockTimer: ReturnType<typeof setTimeout> | undefined;
  private channel: number[] = [0, 2];
  private offline = false;
  private online!: HubState;
  private robot: MockRobot | null;

  constructor(private cfg: HubConfig) {
    const zone = (name: string, entity: string, current: number, humidity: number): Thermostat => withAction({
      name, entity, available: true, current, humidity, mode: 'cool', action: 'idle', target: 72, low: null, high: null,
      minTemp: 60, maxTemp: 85, fan: 'auto', preset: 'home',
    });
    const tv = (name: string, on: boolean, title: string, volume: number): TvState => ({
      name, available: true, on, app: on ? cfg.tvService : null, title: on ? title : null, channel: on ? title : null, artwork: null,
      paused: false, live: true, volume, muted: false,
    });
    const climate = cfg.climate.map((c, i) => zone(c.name, c.entity, i === 0 ? 71 : 74, i === 0 ? 44 : 47));
    const ch = cfg.favoriteChannels.map((c) => c.name);
    this.robot = cfg.vacuum ? new MockRobot(cfg.vacuum.name, (v) => this.patch({ vacuum: v })) : null;
    this.online = {
      connection: 'mock',
      weather: { temp: 72, condition: 'sunny', high: 76, low: 58, humidity: 48, wind: 7, uv: 5, sunrise: todayAt(7, 48) + 864e5, sunset: todayAt(18, 41), source: 'met.no' },
      climate,
      // ?lockexpired shows the lock's "sign in again" state.
      lock: lockExpired ? null : { state: 'locked', lastMethod: 'Keypad', lastChanged: todayAt(17, 48), battery: 82, relockAt: null, pinLockoutUntil: null, pinUnlock: true },
      lockSignInExpired: lockExpired,
      doorbell: { lastRing: null, lastMotion: todayAt(16, 12), snapshotUrl: null, streamAvailable: false },
      tvs: cfg.tvs.map((t, i) => tv(t.name, i === 0, ch[this.channel[i] ?? 0] ?? '', i === 0 ? 35 : 20)),
      reminders: MOCK_REMINDERS.map((r) => ({ ...r, done: false })),
      groceries: MOCK_GROCERIES.map((summary, i) => ({ uid: 'g' + i, summary, done: i >= MOCK_GROCERIES.length - 2, due: null })),
      kids: cfg.kids.map((k) => ({
        name: k.name,
        color: k.color,
        items: (MOCK_KID_TASKS[k.name] ?? []).flatMap((sec) => sec.tasks.map((summary, i) => ({
          uid: k.name + '-' + sec.section + '-' + i, summary, section: sec.section, days: null, done: sec.done.includes(i),
        }))),
      })),
      schoolRun: { dropoff: { driveMin: 14, usualMin: 9.75 }, pickup: { driveMin: 11, usualMin: 11 } },
      mealRules: { quick: true, grill: true, slow: true, leftovers: false },
      vacuum: this.robot?.state ?? null,
      games: mockGames(),
      flights: mockFlights(),
      packages: { arriving: 2, delivered: 1, inTransit: 3, arrivingBy: [{ carrier: 'Amazon', n: 1 }, { carrier: 'UPS', n: 1 }], deliveredBy: [{ carrier: 'USPS', n: 1 }] },
    };
    this.state = createStore<HubState>(this.online);

    const week = startOfWeek(now());
    MOCK_WEEK.forEach((id, i) => this.plans.set(isoDate(addDays(week, i)), id));
    MOCK_LAST_WEEK.forEach((id, i) => this.plans.set(isoDate(addDays(week, i - 7)), id));
  }

  async start(): Promise<void> {}

  private patch(p: Partial<HubState>): void {
    this.online = { ...this.online, ...p };
    if (!this.offline) this.state.set(this.online);
  }

  // ---- Mock-only controls (dev panel) ----

  ringDoorbell(): void {
    if (!this.online.doorbell) return;
    this.patch({ doorbell: { ...this.online.doorbell, lastRing: nowMs(), lastMotion: nowMs() } });
  }

  /** Show every card's "Not connected" state. */
  setOffline(off: boolean): void {
    this.offline = off;
    this.state.set(off
      ? {
        ...this.online, weather: null, lock: null, doorbell: null, reminders: null, groceries: null, packages: null, schoolRun: null,
        climate: this.online.climate.map((c) => ({ ...c, available: false })),
        tvs: this.online.tvs.map((t) => ({ ...t, available: false })),
        kids: this.online.kids.map((k) => ({ ...k, items: null })),
        vacuum: this.online.vacuum ? { ...this.online.vacuum, available: false } : null,
        games: [],
        flights: [],
      }
      : this.online);
  }

  get isOffline(): boolean { return this.offline; }

  // ---- Calendar and meals ----

  async getEvents(start: Date, end: Date): Promise<CalendarEvent[] | null> {
    if (this.offline) return null;
    const week = startOfWeek(now());
    const out: CalendarEvent[] = [];
    MOCK_EVENTS.forEach((evs, i) => {
      const day = addDays(week, i);
      for (const [h, m, title, person] of evs) {
        const s = new Date(day.getFullYear(), day.getMonth(), day.getDate(), h, m);
        if (s >= start && s < end) out.push({ start: s, end: new Date(s.getTime() + 3600e3), allDay: false, title, person });
      }
    });
    // A trip across two days (Wed 6 AM to Thu 4 PM), like a real work trip.
    const trip = { start: new Date(addDays(week, 2).getTime() + 6 * 3600e3), end: new Date(addDays(week, 3).getTime() + 16 * 3600e3), allDay: false, title: 'Chicago trip', person: 'Alex' };
    if (trip.start < end && trip.end > start) out.push(trip);
    // The calendar entry for the sample flight (mockFlights), like the Delta app adds.
    const leg = { start: new Date(nowMs() - 65 * 60e3), end: new Date(nowMs() + 45 * 60e3), allDay: false, title: 'Flight 1 of 2 | DL2290 | ATL to ORD', person: 'Alex' };
    if (leg.start < end && leg.end > start) out.push(leg);
    return out;
  }

  async getMealPlan(start: Date, end: Date): Promise<MealPlanDay[] | null> {
    if (this.offline) return null;
    const out: MealPlanDay[] = [];
    for (let d = startOfDay(start); d < end; d = addDays(d, 1)) {
      const key = isoDate(d);
      if (!this.plans.has(key)) continue;
      const id = this.plans.get(key) ?? null;
      out.push({ date: key, recipeId: id, title: id ? this.recipes.find((r) => r.id === id)?.name ?? 'Unknown recipe' : this.notes.get(key) ?? 'Leftovers night' });
    }
    return out;
  }

  async setMealPlan(days: { date: string; recipeId: PlanDay; note?: string }[]): Promise<void> {
    await wait(80);
    for (const d of days) {
      this.plans.set(d.date, d.recipeId);
      if (d.note) this.notes.set(d.date, d.note); else this.notes.delete(d.date);
    }
  }

  async setMealRule(key: keyof Rules, on: boolean): Promise<void> {
    this.patch({ mealRules: { ...this.online.mealRules, [key]: on } });
  }

  async addIngredients(recipeIds: string[]): Promise<number> {
    await wait(300);
    const lines: string[] = [];
    for (const id of new Set(recipeIds)) {
      const r = await this.getRecipe(id);
      r?.ingredients.forEach((i) => lines.push((i.qty ? i.qty + ' ' : '') + i.name));
    }
    const add = itemsToAdd(this.online.groceries ?? [], lines);
    add.forEach((summary) => this.pushGrocery(summary));
    return add.length;
  }

  // ---- Groceries ----

  private groceryUid = 0;

  private pushGrocery(summary: string): void {
    const list = this.online.groceries ?? [];
    const open = list.filter((i) => !i.done);
    this.patch({ groceries: [...open, { uid: 'n' + this.groceryUid++, summary, done: false, due: null }, ...list.filter((i) => i.done)] });
  }

  async addGrocery(text: string): Promise<void> {
    const [summary] = itemsToAdd(this.online.groceries ?? [], [text]);
    if (summary) this.pushGrocery(summary);
  }

  async setGroceryDone(uid: string, done: boolean): Promise<void> {
    const list = (this.online.groceries ?? []).map((i) => (i.uid === uid ? { ...i, done } : i));
    this.patch({ groceries: [...list.filter((i) => !i.done), ...list.filter((i) => i.done)] });
  }

  async clearCheckedGroceries(): Promise<void> {
    this.patch({ groceries: (this.online.groceries ?? []).filter((i) => !i.done) });
  }

  async sendGroceries(): Promise<void> {
    await wait(400);
    console.info('[mock] emailed', (this.online.groceries ?? []).filter((i) => !i.done).length, 'items');
  }

  // ---- Weather ----

  /** A mild fall forecast: lows near 58 at dawn, highs near 76 mid-afternoon, showers tomorrow afternoon. */
  async getForecast(kind: 'hourly' | 'daily'): Promise<ForecastPoint[] | null> {
    if (this.offline) return null;
    const base = { low: null, wind: 6, humidity: 55, uv: null, precipChance: null } as const;
    if (kind === 'daily') {
      const days: [string, number, number, number][] = [['sunny', 76, 58, 0], ['rainy', 68, 57, 0.4], ['partlycloudy', 71, 54, 0], ['sunny', 74, 52, 0], ['cloudy', 69, 55, 0.05], ['sunny', 73, 53, 0]];
      return days.map(([condition, temp, low, precip], i) => ({ ...base, time: startOfDay(addDays(now(), i)).getTime() + 12 * 3600e3, condition, temp, low, precip }));
    }
    const start = Math.floor(nowMs() / 3600e3) * 3600e3;
    return Array.from({ length: 48 }, (_, i) => {
      const t = start + i * 3600e3;
      const h = new Date(t).getHours();
      const temp = Math.round(67 + 9 * Math.sin(((h - 9) / 24) * 2 * Math.PI));
      const rain = i >= 24 && h >= 13 && h <= 17 ? [0.02, 0.08, 0.14, 0.06, 0.01][h - 13] : 0;
      const condition = rain ? 'rainy' : h < 7 || h >= 19 ? 'clear-night' : h >= 11 && h <= 15 ? 'partlycloudy' : 'sunny';
      return { ...base, time: t, condition, temp, precip: rain };
    });
  }

  // ---- Recipes ----

  async getRecipes(): Promise<RecipeSummary[] | null> {
    if (this.offline) return null;
    return this.recipes.map(({ ingredients: _i, steps: _s, ...summary }) => summary);
  }

  async getRecipe(id: string): Promise<Recipe | null> {
    if (this.offline) return null;
    return this.recipes.find((r) => r.id === id) ?? null;
  }

  async importRecipe(url: string): Promise<RecipeSummary> {
    await wait(1200);
    let host = 'the web';
    try { host = new URL(url).hostname.replace(/^www\./, ''); } catch { throw new Error('That doesn’t look like a link.'); }
    const r = placeholderRecipe('Recipe from ' + host, 30, []);
    r.id = slug(r.name) + '-' + this.recipes.length;
    this.recipes.push(r);
    return r;
  }

  // ---- Todo lists ----

  async setReminderDone(uid: string, done: boolean): Promise<void> {
    const list = this.online.reminders;
    if (list) this.patch({ reminders: list.map((r) => (r.uid === uid ? { ...r, done } : r)) });
  }

  async setKidTaskDone(kid: string, uid: string, done: boolean): Promise<void> {
    this.patch({
      kids: this.online.kids.map((k) => (k.name !== kid || !k.items ? k : { ...k, items: k.items.map((t) => (t.uid === uid ? { ...t, done } : t)) })),
    });
  }

  // ---- Climate ----

  private zone(entity: string, fn: (t: Thermostat) => Thermostat): void {
    this.patch({ climate: this.online.climate.map((t) => (t.entity === entity ? withAction(fn(t)) : t)) });
  }

  async setTemperature(entity: string, t: { target?: number; low?: number; high?: number }): Promise<void> {
    this.zone(entity, (z) => ({ ...z, target: t.target ?? z.target, low: t.low ?? z.low, high: t.high ?? z.high, preset: null }));
  }

  async setHvacMode(entity: string, mode: HvacMode): Promise<void> {
    this.zone(entity, (z) => {
      const base = z.target ?? (z.low != null && z.high != null ? Math.round((z.low + z.high) / 2) : 72);
      return mode === 'heat_cool'
        ? { ...z, mode, target: null, low: z.low ?? base - 3, high: z.high ?? base + 2 }
        : { ...z, mode, target: mode === 'off' ? z.target ?? base : base, low: null, high: null };
    });
  }

  async setFanMode(entity: string, fan: FanMode): Promise<void> {
    this.zone(entity, (z) => ({ ...z, fan }));
  }

  async setPresetAll(preset: string): Promise<void> {
    const t = PRESET_TEMPS[preset] ?? 72;
    this.patch({
      climate: this.online.climate.map((z) => withAction(
        z.mode === 'heat_cool' ? { ...z, preset, low: t - 3, high: t + 2 } : { ...z, preset, target: t },
      )),
    });
  }

  // ---- Door ----

  async unlock(pin?: string): Promise<UnlockResult> {
    await wait(250);
    const lock = this.online.lock;
    if (!lock) return { ok: false, reason: 'error', message: 'Lock not connected' };
    const t = nowMs();
    if (lock.pinLockoutUntil && lock.pinLockoutUntil > t) return { ok: false, reason: 'locked_out' };
    if (pin !== undefined && pin !== DEMO_PIN) {
      this.badPins = this.badPins.filter((x) => t - x < 5 * 60e3).concat(t);
      if (this.badPins.length >= 3) {
        this.badPins = [];
        this.patch({ lock: { ...lock, pinLockoutUntil: t + 5 * 60e3 } });
        return { ok: false, reason: 'locked_out' };
      }
      return { ok: false, reason: 'wrong_pin' };
    }
    this.badPins = [];
    const relockMs = (this.cfg.door?.relockSeconds ?? 30) * 1000;
    this.patch({ lock: { ...lock, state: 'unlocked', lastMethod: 'Kitchen hub', lastChanged: t, relockAt: t + relockMs, pinLockoutUntil: null } });
    clearTimeout(this.relockTimer);
    this.relockTimer = setTimeout(() => this.lock(), relockMs);
    return { ok: true };
  }

  async lock(): Promise<void> {
    clearTimeout(this.relockTimer);
    const lock = this.online.lock;
    if (lock) this.patch({ lock: { ...lock, state: 'locked', lastMethod: 'Kitchen hub', lastChanged: nowMs(), relockAt: null } });
  }

  // ---- TV ----

  private tv(i: number, fn: (t: TvState) => Partial<TvState>): void {
    this.patch({ tvs: this.online.tvs.map((t, j) => (j === i ? { ...t, ...fn(t) } : t)) });
  }

  async tvCommand(i: number, cmd: TvCommand): Promise<void> {
    const names = this.cfg.favoriteChannels.map((c) => c.name);
    const step = (d: number) => {
      this.channel[i] = ((this.channel[i] ?? 0) + d + names.length) % names.length;
      return { title: names[this.channel[i]], channel: names[this.channel[i]], paused: false };
    };
    switch (cmd) {
      case 'channel_up': return this.tv(i, () => step(1));
      case 'channel_down': return this.tv(i, () => step(-1));
      case 'play_pause': return this.tv(i, (t) => ({ paused: !t.paused }));
      case 'mute': return this.tv(i, (t) => ({ muted: !t.muted }));
      case 'volume_up': return this.tv(i, (t) => ({ volume: Math.min(100, (t.volume ?? 0) + 5), muted: false }));
      case 'volume_down': return this.tv(i, (t) => ({ volume: Math.max(0, (t.volume ?? 0) - 5) }));
      case 'power': return this.tv(i, (t) => (t.on
        ? { on: false, app: null, title: null, channel: null }
        : { on: true, app: this.cfg.tvService, title: names[this.channel[i] ?? 0], channel: names[this.channel[i] ?? 0], paused: false }));
    }
  }

  async tvTune(i: number, channel: string): Promise<void> {
    const idx = this.cfg.favoriteChannels.findIndex((c) => c.name === channel);
    if (idx >= 0) this.channel[i] = idx;
    this.tv(i, () => ({ on: true, app: this.cfg.tvService, title: channel, channel, paused: false, live: true }));
  }

  // ---- Vacuum ----

  async vacuumStart(rooms?: string[]): Promise<void> { this.robot?.start(rooms); }
  async vacuumPause(): Promise<void> { this.robot?.pause(); }
  async vacuumResume(): Promise<void> { this.robot?.resume(); }
  async vacuumDock(): Promise<void> { this.robot?.dock(); }
  async vacuumLocate(): Promise<void> { await wait(150); }
  async vacuumBagReplaced(): Promise<void> { this.robot?.bagReplaced(); }

  /** No camera in mock mode: the Door screen shows its placeholder. */
  async openCameraStream(): Promise<() => void> { return () => {}; }

  async getVacuumMissions(limit: number): Promise<VacuumMission[] | null> {
    if (this.offline || !this.robot) return null;
    return this.robot.missions.slice(0, limit);
  }

  async getVacuumMapUrl(missionId?: string): Promise<string | null> {
    if (this.offline || !this.robot) return null;
    return this.robot.mapUrl(missionId);
  }

  /** Dev panel: make the robot get stuck mid-run. */
  vacuumGetStuck(): void { this.robot?.makeStuck(); }
  /** Dev panel: toggle the bin-full warning. */
  vacuumToggleBin(): void { this.robot?.toggleBinFull(); }
  /** Dev panel: cycle the dock bag state. */
  vacuumCycleBag(): void { this.robot?.cycleBag(); }
}
