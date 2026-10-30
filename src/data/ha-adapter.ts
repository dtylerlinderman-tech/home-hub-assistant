// HaAdapter: the real Home Assistant implementation of DataAdapter.
// Everything goes over HA's WebSocket API (home-assistant-js-websocket): one login, one connection.
//
// Phase 2 wires up the connection (login, reconnect, live entity updates), weather and the calendar.
// Every other feature reports "not connected" until its integration is built in Phase 4, so the
// screens show their quiet placeholders instead of fake data.
import {
  callService, createConnection, ERR_INVALID_AUTH, getAuth, subscribeEntities,
  type Auth, type AuthData, type Connection, type HassEntities, type HassEntity,
} from 'home-assistant-js-websocket';
import { createStore } from '../store';
import {
  lastCleanedByRoom, roombaMapSvg, toLockState, toPackages, toTeamSchedule, toTodoItems, toMealPlan, toMission, toRecipe, toRecipeSummary, toFlights, toForecast, toGame, toThermostat, toTvState, toVacuum,
  type HaForecast, type HaTodoItem, type RoombaMissionRecord, type RoombaRoom,
  type EspnSchedule, type MealieMealplan, type MealieRecipe, type MealieRecipeSummary,
} from './ha-mappers';
import { addDays, isoDate } from '../logic/time';
import { usualFromHistory } from '../logic/schoolRun';
import { itemsToAdd } from '../logic/groceries';
import { openWebRtcStream } from './webrtc';
import type { HubConfig } from '../config';
import type { PlanDay, Rules } from '../logic/mealRules';
import type {
  CalendarEvent, DataAdapter, FanMode, ForecastPoint, HubState, HvacMode, MealPlanDay, Recipe, RecipeSummary, TeamSchedule,
  TvCommand, UnlockResult, VacuumMission, Weather,
} from './adapter';

const TOKENS_KEY = 'kitchenhub.hassTokens';

function loadTokens(): Promise<AuthData | null> {
  try {
    const raw = localStorage.getItem(TOKENS_KEY);
    return Promise.resolve(raw ? (JSON.parse(raw) as AuthData) : null);
  } catch {
    return Promise.resolve(null);
  }
}

function saveTokens(data: AuthData | null): void {
  try {
    if (data) localStorage.setItem(TOKENS_KEY, JSON.stringify(data));
    else localStorage.removeItem(TOKENS_KEY);
  } catch {
    // Storage blocked: the user will just be asked to log in again next time.
  }
}

/** Entities created by ha/packages/kitchen_hub.yaml. */
const PKG = {
  relockTimer: 'timer.kitchen_door_relock',
  lockoutTimer: 'timer.kitchen_door_lockout',
  mealRule: (k: string) => 'input_boolean.kitchen_meal_rule_' + k,
  sendGroceries: 'script.kitchen_hub_send_groceries',
};

/** Integration behind config.door.lock (krozgrov/ha-nest-yale-integration). */
const LOCK_INTEGRATION = 'nest_yale_lock';

const notYet = () => Promise.reject(new Error('Not connected to Home Assistant yet'));

interface ForecastDay { datetime: string; temperature?: number; templow?: number; condition?: string }

/** Parse an HA calendar event time: "2026-10-20" (all day) or an ISO date-time. */
function parseEventTime(v: string | { dateTime?: string; date?: string }): { d: Date; allDay: boolean } {
  const s = typeof v === 'string' ? v : v.dateTime ?? v.date ?? '';
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) {
    const [y, m, d] = s.split('-').map(Number);
    return { d: new Date(y, m - 1, d), allDay: true };
  }
  return { d: new Date(s), allDay: false };
}

export class HaAdapter implements DataAdapter {
  readonly isMock = false;
  readonly state;
  private conn: Connection | null = null;
  private auth: Auth | null = null;
  private entities: HassEntities = {};
  private forecastToday: ForecastDay | null = null;
  private unsubForecast: (() => void) | null = null;
  private unsubGroceries: (() => void) | undefined;
  /** Resolves once the first full entity list has arrived, so reads made at page load see real entities. */
  private ready: Promise<void>;
  private markReady: () => void = () => {};

  constructor(private cfg: HubConfig) {
    this.ready = new Promise((resolve) => { this.markReady = resolve; });
    this.state = createStore<HubState>({
      connection: 'connecting',
      weather: null,
      climate: cfg.climate.map((c) => ({
        name: c.name, entity: c.entity, available: false, current: 0, humidity: null, mode: 'off', action: 'off',
        target: null, low: null, high: null, minTemp: 45, maxTemp: 95, fan: 'auto', preset: null,
      })),
      lock: null,
      lockSignInExpired: false,
      doorbell: null,
      tvs: cfg.tvs.map((t) => ({
        name: t.name, available: false, on: false, app: null, title: null, channel: null, artwork: null, paused: false, live: false, volume: null, muted: false,
      })),
      reminders: null,
      groceries: null,
      kids: cfg.kids.map((k) => ({ name: k.name, color: k.color, items: null })),
      schoolRun: null,
      // Phase 3 moves these into input_boolean helpers so they sync between devices.
      mealRules: { quick: true, grill: true, slow: true, leftovers: false },
      vacuum: cfg.vacuum
        ? { name: cfg.vacuum.name, available: false, status: 'idle', currentRoom: null, battery: null, binFull: false, bag: 'ok', error: null, targetRooms: null, missionStarted: null, rooms: null }
        : null,
      games: [],
      flights: [],
      packages: null,
    });
  }

  get hassUrl(): string {
    return this.cfg.haUrl!.replace(/\/$/, '');
  }

  // ---- Connection ----

  async start(): Promise<void> {
    const auth = await this.retry(() => this.authenticate());
    this.auth = auth;
    // Drop ?auth_callback=1&code=…&storeToken=… from the address bar after the login redirect.
    if (location.search.includes('auth_callback=1')) {
      const qs = new URLSearchParams(location.search);
      ['auth_callback', 'code', 'state', 'storeToken'].forEach((k) => qs.delete(k));
      history.replaceState(null, '', location.pathname + (qs.toString() ? '?' + qs : '') + location.hash);
    }

    const conn = await this.retry(() => createConnection({ auth }));
    this.conn = conn;
    conn.addEventListener('ready', () => {
      this.set({ connection: 'connected' });
      // After an HA restart the library re-sends the grocery subscription before the todo entity is back,
      // and it fails quietly. Drop it; subscribeGroceries() starts a fresh one once the entity reappears.
      const old = this.unsubGroceries;
      this.unsubGroceries = undefined;
      if (old) Promise.resolve().then(old).catch(() => {});
    });
    conn.addEventListener('disconnected', () => this.set({ connection: 'disconnected' }));
    conn.addEventListener('reconnect-error', (_c, err) => {
      this.set({ connection: 'disconnected' });
      if (err === ERR_INVALID_AUTH) { saveTokens(null); location.reload(); }
    });

    subscribeEntities(conn, (ents) => { this.entities = ents; this.refresh(); this.subscribeGroceries(); this.markReady(); });
    this.subscribeForecast();
    void this.loadTravelHistory();
    setInterval(() => void this.loadTravelHistory(), 3600e3);
    void this.loadMissions();
    setInterval(() => void this.loadMissions(), 10 * 60e3);
    this.set({ connection: 'connected' });
  }

  /** Log in (or reuse stored tokens). Revoked tokens are cleared and the HA login page shown again. */
  private async authenticate(): Promise<Auth> {
    try {
      return await getAuth({ hassUrl: this.hassUrl, loadTokens, saveTokens });
    } catch (e) {
      if (e !== ERR_INVALID_AUTH) throw e;
      saveTokens(null);
      return getAuth({ hassUrl: this.hassUrl, loadTokens, saveTokens });
    }
  }

  /**
   * Keep trying until Home Assistant answers: after a power cut the tablet usually boots before HA does.
   * Waits 2 s, 4 s, 8 s … up to 60 s between attempts; a revoked login reloads to the login page.
   */
  private async retry<T>(fn: () => Promise<T>): Promise<T> {
    for (let delay = 2000; ; delay = Math.min(delay * 2, 60_000)) {
      try {
        return await fn();
      } catch (e) {
        if (e === ERR_INVALID_AUTH) { saveTokens(null); location.reload(); throw e; }
        console.warn('Home Assistant not reachable yet; retrying in', delay / 1000, 's', e);
        this.set({ connection: 'disconnected' });
        await new Promise((r) => setTimeout(r, delay));
      }
    }
  }

  /** Wait for the first entity list (up to 60 s, then reads fall back to "not connected"). */
  private whenReady(): Promise<void> {
    return Promise.race([this.ready, new Promise<void>((r) => setTimeout(r, 60_000))]);
  }

  private set(p: Partial<HubState>): void {
    this.state.set((s) => ({ ...s, ...p }));
  }

  private entity(id: string | undefined): HassEntity | null {
    if (!id) return null;
    const e = this.entities[id];
    return e && e.state !== 'unavailable' ? e : null;
  }

  /** Map HA entity states onto HubState. Runs on every entity update. */
  private refresh(): void {
    this.set({
      weather: this.weather(),
      climate: this.cfg.climate.map((c) => toThermostat(c.name, c.entity, this.entities[c.entity] ?? null)),
      schoolRun: this.schoolRun(),
      vacuum: this.vacuum(),
      games: (this.cfg.sports ?? []).flatMap((id) => toGame(this.entity(id)) ?? []),
      flights: toFlights(this.entity(this.cfg.flights ?? 'sensor.flightradar24_additional_tracked')),
      packages: this.cfg.packages ? toPackages((id) => this.entity(id), this.cfg.packages.sensorPrefixes) : null,
      doorbell: this.doorbell(),
      tvs: this.cfg.tvs.map((t) => toTvState(t.name, this.entity(t.player), this.entity(t.cast), this.hassUrl)),
      lock: toLockState(
        this.entity(this.cfg.door?.lock),
        this.entity(this.cfg.door?.lastAction),
        // Unlock goes through the HA script (kitchen_hub package), which also starts the relock timer.
        !!this.entity(this.cfg.door?.unlockScript),
        this.entity(PKG.relockTimer),
        this.entity(PKG.lockoutTimer),
      ),
      mealRules: this.mealRules(),
    });
    void this.checkLockSignIn();
  }

  // ---- Lock sign-in (Nest x Yale uses copied Google cookies, which Google can expire) ----

  private lockAuthCheckedAt = 0;

  /** While the lock is unavailable, ask HA (at most once a minute) whether its integration failed on sign-in. */
  private async checkLockSignIn(): Promise<void> {
    const id = this.cfg.door?.lock;
    if (!id || !this.conn) return;
    if (this.entity(id)) {
      if (this.state.get().lockSignInExpired) this.set({ lockSignInExpired: false });
      return;
    }
    if (Date.now() - this.lockAuthCheckedAt < 60e3) return;
    this.lockAuthCheckedAt = Date.now();
    try {
      const entries = await this.conn.sendMessagePromise<{ state: string; reason: string | null }[]>(
        { type: 'config_entries/get', domain: LOCK_INTEGRATION },
      );
      const expired = entries.some((e) => (e.state === 'setup_error' || e.state === 'setup_retry') && /cookie|session|logged.?out|auth/i.test(e.reason ?? ''));
      if (expired !== this.state.get().lockSignInExpired) this.set({ lockSignInExpired: expired });
    } catch (e) {
      console.warn('Could not check the lock integration', e); // needs an admin HA user; just shows "Unavailable" then
    }
  }

  // ---- School run (Waze Travel Time sensor) ----

  private travelHistory: { t: number; v: number }[] = [];

  private schoolRun(): HubState['schoolRun'] {
    const sr = this.cfg.schoolRun;
    const s = this.entity(sr?.travelSensor);
    const driveMin = s ? Number(s.state) : NaN;
    if (!sr || !Number.isFinite(driveMin)) return null;
    const now = new Date();
    return {
      dropoff: { driveMin, usualMin: usualFromHistory(this.travelHistory, now, sr.dropoffWindow) },
      pickup: { driveMin, usualMin: usualFromHistory(this.travelHistory, now, sr.pickupWindow) },
    };
  }

  /** Load ~5 weeks of drive-time readings from the recorder for the "usual" comparison. Refreshed hourly. */
  private async loadTravelHistory(): Promise<void> {
    const id = this.cfg.schoolRun?.travelSensor;
    if (!this.conn || !id) return;
    try {
      const res = await this.conn.sendMessagePromise<Record<string, { s?: string; state?: string; lu?: number; last_updated?: string }[]>>({
        type: 'history/history_during_period',
        start_time: new Date(Date.now() - 35 * 24 * 3600e3).toISOString(),
        entity_ids: [id],
        minimal_response: true,
        no_attributes: true,
        significant_changes_only: false,
      });
      this.travelHistory = (res[id] ?? []).map((p) => ({
        t: p.lu != null ? p.lu * 1000 : Date.parse(p.last_updated ?? ''),
        v: Number(p.s ?? p.state),
      })).filter((p) => Number.isFinite(p.t) && Number.isFinite(p.v));
      this.refresh();
    } catch (e) {
      console.warn('Could not load drive-time history', e);
    }
  }

  private call(domain: string, service: string, data: object, entityId: string | string[]): Promise<void> {
    if (!this.conn) return notYet();
    return callService(this.conn, domain, service, data, { entity_id: entityId }).then(() => undefined);
  }

  // ---- Team schedules: straight from ESPN (where Team Tracker gets its data), cached 15 minutes ----

  private schedules = new Map<string, { at: number; value: TeamSchedule }>();

  async getTeamSchedule(sensor: string): Promise<TeamSchedule | null> {
    await this.whenReady();
    const a = this.entity(sensor)?.attributes;
    const sport = a?.sport_path, league = a?.league_path, team = a?.team_id;
    if (typeof sport !== 'string' || typeof league !== 'string' || team == null) return null;
    const hit = this.schedules.get(sensor);
    if (hit && Date.now() - hit.at < 15 * 60e3) return hit.value;
    const res = await fetch(`https://site.api.espn.com/apis/site/v2/sports/${sport}/${league}/teams/${team}/schedule`);
    if (!res.ok) return hit?.value ?? null;
    const value = toTeamSchedule((await res.json()) as EspnSchedule, String(team), Date.now());
    this.schedules.set(sensor, { at: Date.now(), value });
    return value;
  }

  // ---- Weather ----

  private weather(): Weather | null {
    const w = this.entity(this.cfg.weather);
    if (!w) return null;
    const temp = Number(w.attributes.temperature);
    if (Number.isNaN(temp)) return null;
    const f = this.forecastToday;
    const a = w.attributes;
    const sun = this.entity('sun.sun')?.attributes;
    const at = (v: unknown) => { const t = Date.parse(String(v ?? '')); return Number.isFinite(t) ? t : null; };
    const n = (v: unknown) => (typeof v === 'number' ? v : null);
    return {
      temp,
      condition: w.state,
      high: f?.temperature ?? null,
      low: f?.templow ?? null,
      humidity: n(a.humidity),
      wind: n(a.wind_speed),
      uv: n(a.uv_index),
      sunrise: at(sun?.next_rising),
      sunset: at(sun?.next_setting),
      source: typeof a.attribution === 'string' ? (a.attribution.match(/from ([\w.]+)/)?.[1] ?? null) : null,
    };
  }

  async getForecast(kind: 'hourly' | 'daily'): Promise<ForecastPoint[] | null> {
    await this.whenReady();
    const id = this.cfg.weather;
    if (!this.conn || !id || !this.entity(id)) return null;
    const res = (await callService(this.conn, 'weather', 'get_forecasts', { type: kind }, { entity_id: id }, true)) as
      { response?: Record<string, { forecast?: HaForecast[] }> };
    return toForecast(res.response?.[id]?.forecast);
  }

  /** Live daily forecast, for today's high and low. */
  private subscribeForecast(): void {
    if (!this.conn || !this.cfg.weather) return;
    this.unsubForecast?.();
    this.conn
      .subscribeMessage<{ type: string; forecast: ForecastDay[] | null }>(
        (msg) => { this.forecastToday = msg.forecast?.[0] ?? null; this.refresh(); },
        { type: 'weather/subscribe_forecast', entity_id: this.cfg.weather, forecast_type: 'daily' },
      )
      .then((unsub) => { this.unsubForecast = unsub; })
      .catch((e) => console.warn('Weather forecast subscription failed', e));
  }

  // ---- Calendar ----

  async getEvents(start: Date, end: Date): Promise<CalendarEvent[] | null> {
    await this.whenReady();
    const cals = this.cfg.calendars.filter((c) => this.entity(c.entity));
    if (!this.conn || cals.length === 0) return null;
    const res = (await callService(
      this.conn, 'calendar', 'get_events',
      { start_date_time: start.toISOString(), end_date_time: end.toISOString() },
      { entity_id: cals.map((c) => c.entity) },
      true,
    )) as { response?: Record<string, { events: { start: string; end: string; summary: string }[] }> };
    const out: CalendarEvent[] = [];
    for (const cal of cals) {
      for (const ev of res.response?.[cal.entity]?.events ?? []) {
        const s = parseEventTime(ev.start);
        const e = parseEventTime(ev.end);
        out.push({ start: s.d, end: e.d, allDay: s.allDay, title: ev.summary, person: cal.person });
      }
    }
    return out.sort((a, b) => a.start.getTime() - b.start.getTime());
  }

  // ---- Climate (ecobee) ----

  setTemperature(entity: string, t: { target?: number; low?: number; high?: number }): Promise<void> {
    const data = t.low != null && t.high != null
      ? { target_temp_low: t.low, target_temp_high: t.high }
      : { temperature: t.target };
    return this.call('climate', 'set_temperature', data, entity);
  }

  setHvacMode(entity: string, mode: HvacMode): Promise<void> {
    return this.call('climate', 'set_hvac_mode', { hvac_mode: mode }, entity);
  }

  setFanMode(entity: string, fan: FanMode): Promise<void> {
    return this.call('climate', 'set_fan_mode', { fan_mode: fan }, entity);
  }

  setPresetAll(preset: string): Promise<void> {
    const ids = this.cfg.climate.map((c) => c.entity).filter((id) => this.entity(id));
    return ids.length ? this.call('climate', 'set_preset_mode', { preset_mode: preset }, ids) : notYet();
  }

  // ---- Vacuum (Roomba+) ----

  private missionsRaw: RoombaMissionRecord[] = [];
  private lastVacState = '';

  private roombaEntities() {
    const v = this.cfg.vacuum;
    return {
      vacuum: this.entities[v?.entity ?? ''] ?? null,
      battery: this.entity(v?.battery),
      location: this.entity(v?.location),
      phase: this.entity(v?.phase),
      lastError: this.entity(v?.lastError),
      roomsMap: this.entity(v?.roomsMap),
      roomAreas: this.entity(v?.roomAreas),
      baseStatus: this.entity(v?.baseStatus),
      maintenance: this.entity(v?.maintenance),
    };
  }

  private vacuum(): HubState['vacuum'] {
    const v = this.cfg.vacuum;
    if (!v) return null;
    const e = this.roombaEntities();
    // A run just ended: reload history so last-cleaned times and Recent cleans update.
    const st = e.vacuum?.state ?? '';
    if (this.lastVacState && this.lastVacState !== st && (st === 'docked' || st === 'returning')) void this.loadMissions();
    this.lastVacState = st;
    return toVacuum(v.name, e, lastCleanedByRoom(this.missionsRaw)) ?? { ...this.state.get().vacuum!, available: false };
  }

  /** Authenticated GET to an HA HTTP endpoint (Roomba+ serves run history there). */
  private async api<T>(path: string): Promise<T> {
    if (!this.auth) throw new Error('Not connected');
    if (this.auth.expired) await this.auth.refreshAccessToken();
    const r = await fetch(this.hassUrl + path, { headers: { Authorization: 'Bearer ' + this.auth.accessToken } });
    if (!r.ok) throw new Error(path + ' → ' + r.status);
    return r.json() as Promise<T>;
  }

  private async loadMissions(): Promise<void> {
    const id = this.cfg.vacuum?.entryId;
    if (!id) return;
    try {
      this.missionsRaw = await this.api<RoombaMissionRecord[]>('/api/roomba_plus/' + id + '/mission_history?format=records');
      this.refresh();
    } catch (e) {
      console.warn('Could not load vacuum history', e);
    }
  }

  async getVacuumMissions(limit: number): Promise<VacuumMission[] | null> {
    await this.whenReady();
    if (!this.cfg.vacuum?.entryId) return null;
    if (!this.missionsRaw.length) await this.loadMissions();
    return this.missionsRaw.map(toMission).filter((m) => Number.isFinite(m.start)).sort((a, b) => b.start - a.start).slice(0, limit);
  }

  async getVacuumMapUrl(missionId?: string): Promise<string | null> {
    await this.whenReady();
    const e = this.roombaEntities();
    const rooms = e.roomsMap?.attributes.rooms as Record<string, RoombaRoom> | undefined;
    const v = this.state.get().vacuum;
    if (!missionId && v?.missionStarted) {
      // Live: rooms covered so far in this run, plus a dot where the robot is.
      const cov = (e.vacuum?.attributes.room_coverage ?? {}) as Record<string, number>;
      return roombaMapSvg(rooms, Object.keys(cov).filter((k) => cov[k] >= 0.1), v.currentRoom);
    }
    const missions = await this.getVacuumMissions(50);
    const m = missionId ? missions?.find((x) => x.id === missionId) : missions?.[0];
    return roombaMapSvg(rooms, m?.rooms ?? []);
  }

  private vac(service: string, data: object = {}): Promise<void> {
    const id = this.cfg.vacuum?.entity;
    return id && this.entity(id) ? this.call('vacuum', service, data, id) : notYet();
  }

  vacuumStart(rooms?: string[]): Promise<void> {
    const id = this.cfg.vacuum?.entity;
    if (rooms?.length && id && this.entity(id)) return this.call('roomba_plus', 'smart_start', { rooms }, id);
    return this.vac('start');
  }
  vacuumPause(): Promise<void> { return this.vac('pause'); }
  vacuumResume(): Promise<void> { return this.vac('start'); }
  vacuumDock(): Promise<void> { return this.vac('return_to_base'); }
  vacuumLocate(): Promise<void> { return this.vac('locate'); }

  vacuumBagReplaced(): Promise<void> {
    const b = this.cfg.vacuum?.bagReset;
    return b && this.entity(b) ? this.call('button', 'press', {}, b) : notYet();
  }

  // ---- Doorbell and camera (Nest) ----

  private doorbell(): HubState['doorbell'] {
    const d = this.cfg.door;
    const cam = this.entity(d?.camera);
    const ring = this.entity(d?.doorbellEvent);
    if (!cam && !ring) return null;
    const time = (e: HassEntity | null) => { const t = e ? Date.parse(e.state) : NaN; return Number.isFinite(t) ? t : null; };
    return {
      lastRing: time(ring),
      lastMotion: time(this.entity(d?.motionEvent)),
      // Battery Nest doorbells only stream (WebRTC); their "picture" is a placeholder, so no snapshot.
      snapshotUrl: null,
      streamAvailable: !!cam,
    };
  }

  async openCameraStream(onStream: (s: MediaStream) => void, onError: (message: string) => void): Promise<() => void> {
    const id = this.cfg.door?.camera;
    if (!this.conn || !id || !this.entity(id)) { onError('Camera not connected'); return () => {}; }
    try {
      return await openWebRtcStream(this.conn, id, onStream, onError);
    } catch (e) {
      console.warn('Camera stream failed', e);
      onError('Couldn’t start the camera.');
      return () => {};
    }
  }

  // ---- Front door lock ----

  /** PIN unlock through the package's script, which checks the PIN against secrets.yaml. */
  async unlock(pin?: string): Promise<UnlockResult> {
    const script = this.cfg.door?.unlockScript;
    if (!this.conn || !script || !this.entity(script)) return { ok: false, reason: 'error', message: 'Unlocking from the kitchen isn’t set up yet' };
    const res = (await callService(this.conn, 'script', script.replace(/^script./, ''), pin === undefined ? {} : { pin }, undefined, true)) as {
      response?: { ok?: boolean; reason?: string };
    };
    const r = res.response;
    if (r?.ok) return { ok: true };
    if (r?.reason === 'wrong_pin' || r?.reason === 'locked_out') return { ok: false, reason: r.reason };
    return { ok: false, reason: 'error', message: 'The lock didn’t answer' };
  }

  lock(): Promise<void> {
    const id = this.cfg.door?.lock;
    return id && this.entity(id) ? this.call('lock', 'lock', {}, id) : notYet();
  }

  // ---- Mealie (recipes, meal plan, grocery list) via HA's mealie.* actions ----

  /** slug → Mealie recipe UUID; the meal-plan actions need the UUID. */
  private recipeUuids = new Map<string, string>();

  private get mealTags(): string[] {
    return this.cfg.mealie?.mealTags ?? [];
  }

  private async mealie<T>(service: string, data: object = {}): Promise<T | null> {
    await this.whenReady();
    const entry = this.cfg.mealie?.configEntryId;
    if (!this.conn || !entry) return null;
    const res = (await callService(this.conn, 'mealie', service, { config_entry_id: entry, ...data }, undefined, true)) as { response?: T };
    return res.response ?? null;
  }

  async getRecipes(): Promise<RecipeSummary[] | null> {
    // The response is { recipes: { items: [...] } } (paged); accept a bare array too.
    const res = await this.mealie<{ recipes: MealieRecipeSummary[] | { items: MealieRecipeSummary[] } }>('get_recipes', { result_limit: 100 });
    if (!res) return null;
    const list = Array.isArray(res.recipes) ? res.recipes : res.recipes?.items ?? [];
    for (const r of list) this.recipeUuids.set(r.slug, r.recipe_id);
    return list
      .map((r) => toRecipeSummary(r, this.mealTags, this.cfg.mealie?.url))
      .sort((a, b) => a.name.localeCompare(b.name));
  }

  async getRecipe(id: string): Promise<Recipe | null> {
    const res = await this.mealie<{ recipe: MealieRecipe }>('get_recipe', { recipe_id: id });
    if (!res?.recipe) return null;
    this.recipeUuids.set(res.recipe.slug, res.recipe.recipe_id);
    return toRecipe(res.recipe, this.mealTags, this.cfg.mealie?.url);
  }

  async importRecipe(url: string): Promise<RecipeSummary> {
    // Skip the site's own tags: they're SEO keywords, not the household's meal tags.
    const res = await this.mealie<{ recipe: MealieRecipeSummary }>('import_recipe', { url, include_tags: false });
    if (!res?.recipe) throw new Error('Mealie couldn’t read a recipe from that link.');
    this.recipeUuids.set(res.recipe.slug, res.recipe.recipe_id);
    return toRecipeSummary(res.recipe, this.mealTags, this.cfg.mealie?.url);
  }

  private async rawMealPlan(start: Date, endInclusive: Date): Promise<MealieMealplan[] | null> {
    const res = await this.mealie<{ mealplan: MealieMealplan[] }>('get_mealplan', {
      start_date: isoDate(start), end_date: isoDate(endInclusive),
    });
    return res?.mealplan ?? null;
  }

  async getMealPlan(start: Date, end: Date): Promise<MealPlanDay[] | null> {
    const raw = await this.rawMealPlan(start, addDays(end, -1));
    return raw ? toMealPlan(raw) : null;
  }

  /** Write dinners: update the day's existing dinner entry, or add one. Null = "Leftovers night" note. */
  async setMealPlan(days: { date: string; recipeId: PlanDay; note?: string }[]): Promise<void> {
    if (!days.length) return;
    const sorted = [...days].sort((a, b) => a.date.localeCompare(b.date));
    const parse = (s: string) => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); };
    const existing = (await this.rawMealPlan(parse(sorted[0].date), parse(sorted[sorted.length - 1].date))) ?? [];
    if (days.some((d) => d.recipeId && !this.recipeUuids.has(d.recipeId))) await this.getRecipes();
    for (const d of days) {
      const current = existing.find((e) => e.mealplan_date === d.date && e.entry_type === 'dinner');
      const what = d.recipeId
        ? { recipe_id: this.recipeUuids.get(d.recipeId) ?? d.recipeId }
        : d.note
          ? { note_title: d.note, note_text: '' }
          : { note_title: 'Leftovers night', note_text: 'Clean out the fridge' };
      if (current?.mealplan_id != null) {
        await this.mealie('update_mealplan', { mealplan_id: String(current.mealplan_id), date: d.date, entry_type: 'dinner', ...what });
      } else {
        await this.mealie('set_mealplan', { date: d.date, entry_type: 'dinner', ...what });
      }
    }
  }

  // ---- Groceries: the Mealie shopping list, as HA's todo entity ----

  private groceryList(): string | null {
    const list = this.cfg.mealie?.shoppingList;
    return list && this.entity(list) ? list : null;
  }

  /** Live items via todo/item/subscribe. Re-subscribed on reconnect by the websocket library. */
  private subscribeGroceries(): void {
    const list = this.cfg.mealie?.shoppingList;
    if (!this.conn || !list || !this.entity(list) || this.unsubGroceries) return;
    this.unsubGroceries = () => {}; // claimed; replaced once the subscription is up
    this.conn
      .subscribeMessage<{ items: HaTodoItem[] }>(
        (msg) => this.set({ groceries: toTodoItems(msg.items) }),
        { type: 'todo/item/subscribe', entity_id: list },
      )
      .then((unsub) => { this.unsubGroceries = unsub; })
      .catch((e) => { this.unsubGroceries = undefined; console.warn('Grocery list subscription failed', e); });
  }

  /** Add the week's ingredients, skipping anything already on the list. */
  async addIngredients(recipeIds: string[]): Promise<number> {
    const list = this.groceryList();
    if (!this.conn || !list) return notYet();
    const lines: string[] = [];
    for (const id of new Set(recipeIds)) {
      const r = await this.getRecipe(id);
      r?.ingredients.forEach((i) => lines.push((i.qty ? i.qty + ' ' : '') + i.name));
    }
    const add = itemsToAdd(this.state.get().groceries ?? [], lines);
    for (const item of add) await this.call('todo', 'add_item', { item }, list);
    return add.length;
  }

  async addGrocery(text: string): Promise<void> {
    const list = this.groceryList();
    if (!list) return notYet();
    if (!itemsToAdd(this.state.get().groceries ?? [], [text]).length) return;
    return this.call('todo', 'add_item', { item: text.trim() }, list);
  }

  async setGroceryDone(uid: string, done: boolean): Promise<void> {
    const list = this.groceryList();
    if (!list) return notYet();
    return this.call('todo', 'update_item', { item: uid, status: done ? 'completed' : 'needs_action' }, list);
  }

  async clearCheckedGroceries(): Promise<void> {
    const list = this.groceryList();
    if (!list) return notYet();
    return this.call('todo', 'remove_completed_items', {}, list);
  }

  async sendGroceries(): Promise<void> {
    if (!this.conn) return notYet();
    if (!this.entity(PKG.sendGroceries)) throw new Error('The send-list script isn’t installed');
    await callService(this.conn, 'script', PKG.sendGroceries.replace(/^script\./, ''), {});
  }

  // ---- Not built yet (Phase 3–4). Reads report "not connected"; actions fail with a toast. ----

  /** Meal rules live in the package's input_booleans so every screen agrees; local-only until it's installed. */
  private localRules: Rules = { quick: true, grill: true, slow: true, leftovers: false };

  private mealRules(): Rules {
    const out = { ...this.localRules };
    for (const k of Object.keys(out) as (keyof Rules)[]) {
      const e = this.entity(PKG.mealRule(k));
      if (e) out[k] = e.state === 'on';
    }
    return out;
  }

  async setMealRule(key: keyof Rules, on: boolean): Promise<void> {
    const id = PKG.mealRule(key);
    if (this.entity(id)) return this.call('input_boolean', on ? 'turn_on' : 'turn_off', {}, id);
    this.localRules = { ...this.localRules, [key]: on };
    this.set({ mealRules: this.mealRules() });
  }
  setReminderDone(_uid: string, _done: boolean): Promise<void> { return notYet(); }
  setKidTaskDone(_kid: string, _uid: string, _done: boolean): Promise<void> { return notYet(); }


  // ---- TV (Android TV Remote keys; command names have no KEYCODE_ prefix) ----

  async tvCommand(i: number, c: TvCommand): Promise<void> {
    // Play/pause goes through Cast while something is casting: it's what reports the paused state.
    const cast = this.entity(this.cfg.tvs[i]?.cast);
    if (c === 'play_pause' && cast && ['playing', 'paused'].includes(cast.state)) {
      return this.call('media_player', 'media_play_pause', {}, cast.entity_id);
    }
    const remote = this.cfg.tvs[i]?.remote;
    if (!remote || !this.entity(remote)) return notYet();
    if (c === 'power') return this.call('remote', this.state.get().tvs[i]?.on ? 'turn_off' : 'turn_on', {}, remote);
    // VOLUME_MUTE, not MUTE: Android's MUTE key is the microphone mute.
    const keys: Record<Exclude<TvCommand, 'power'>, string> = {
      channel_up: 'CHANNEL_UP', channel_down: 'CHANNEL_DOWN', play_pause: 'MEDIA_PLAY_PAUSE',
      mute: 'VOLUME_MUTE', volume_up: 'VOLUME_UP', volume_down: 'VOLUME_DOWN',
    };
    return this.call('remote', 'send_command', { command: keys[c] }, remote);
  }

  /** Open a favorite channel's deep link in the live-TV app, turning the TV on first. */
  async tvTune(i: number, channel: string): Promise<void> {
    const tv = this.cfg.tvs[i];
    const link = this.cfg.favoriteChannels.find((c) => c.name === channel)?.deepLink;
    if (!tv?.player || !this.entity(tv.player)) return notYet();
    if (!link) throw new Error(`No ${this.cfg.tvService} link saved for ${channel} yet`);
    if (!this.state.get().tvs[i]?.on && tv.remote) await this.call('remote', 'turn_on', {}, tv.remote);
    return this.call('media_player', 'play_media', { media_content_type: 'url', media_content_id: link }, tv.player);
  }

}
