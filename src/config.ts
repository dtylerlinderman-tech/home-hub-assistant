// Runtime config, loaded from config.json next to index.html (on HA: /local/kitchen/config.json).
// Everything household-specific lives here so it can change without a rebuild.
import type { SchoolRunConfig } from './logic/schoolRun';

export interface HubConfig {
  haUrl?: string;
  timezone?: string;
  weather?: string;
  people: Record<string, string>;
  calendars: { entity: string; person: string }[];
  /** Shown on the Calendar screen: "synced from …". */
  calendarSource?: string;
  door?: {
    camera?: string;
    doorbellEvent?: string; // event.* (doorbell class): state = time of the last ring
    motionEvent?: string; // event.* (motion class): state = time of the last motion
    lock?: string;
    /** Nest x Yale "Last Action" sensor (Keypad / Physical / Remote). */
    lastAction?: string;
    /** HA script the Unlock control runs. Without a PIN: hold to unlock; with door.pin: the PIN pad (checked by the script). */
    unlockScript?: string;
    pin?: boolean;
    relockSeconds: number;
  };
  climate: { name: string; entity: string }[];
  climatePresets: string[];
  schoolRun?: SchoolRunConfig;
  tvs: { name: string; remote?: string; player?: string; cast?: string }[];
  tvService: string;
  favoriteChannels: { name: string; deepLink?: string }[];
  kids: { name: string; color: string; todo?: string }[];
  homeReminders?: string;
  /** iRobot Roomba via the Roomba+ integration (HACS). Entity IDs follow Roomba+'s naming. */
  vacuum?: {
    name: string;
    entity: string; // vacuum.*
    /** Roomba+ config entry id, for its run-history API. */
    entryId?: string;
    battery?: string; // sensor.*_battery
    location?: string; // device_tracker.* (current room)
    phase?: string; // sensor.*_phase ("stuck")
    lastError?: string; // sensor.*_last_error_code
    roomsMap?: string; // image.*_rooms_map (room names, outlines)
    roomAreas?: string; // sensor.*_room_areas
    baseStatus?: string; // sensor.*_clean_base_status
    maintenance?: string; // binary_sensor.*_maintenance_due
    bagReset?: string; // button.*_reset_clean_base_bag
  };
  /**
   * Photo behind the glass, relative to the app (e.g. "backgrounds/home.jpg" in public/, which git ignores).
   * Shown blurred and darkened; without it the page uses the dusk gradient.
   */
  background?: string;
  /** Minutes without a touch before the photo frame shows (needs `background`). Default 3. */
  idleMinutes?: number;
  /** Flightradar24's tracked-flights sensor. Default sensor.flightradar24_additional_tracked. */
  flights?: string;
  /** Team Tracker sensors (sensor.*) for the game-day card on Home. */
  sports?: string[];
  /**
   * Mealie via HA's integration. url = Mealie's own address, used only to load recipe photos.
   * shoppingList = the grocery list's todo entity; sendListTo = who the "Send" button emails (the package's
   * script and HA's SMTP integration do the sending).
   */
  mealie?: { configEntryId?: string; mealTags: string[]; url?: string; shoppingList?: string; sendListTo?: string };
  notifyTarget?: string;
}

/** Defaults: the sample household from the prototype. Used in mock mode and as fallbacks. */
export const DEFAULT_CONFIG: HubConfig = {
  timezone: 'America/New_York',
  weather: 'weather.forecast_home',
  people: { Family: '#B49CFA', Alex: '#6EA8E8', Sam: '#E58FB5', Kids: '#5FB3A6' },
  calendars: [],
  door: { relockSeconds: 30 },
  climate: [{ name: 'Downstairs', entity: 'climate.downstairs' }, { name: 'Upstairs', entity: 'climate.upstairs' }],
  climatePresets: ['home', 'away', 'sleep'],
  schoolRun: {
    name: 'Oak Hill School',
    address: '2400 Old Alabama Rd, Roswell, GA 30076',
    days: ['tue', 'thu'],
    dropoff: '09:00',
    pickup: '14:00',
    leaveBufferMin: 5,
    dropoffWindow: ['07:00', '09:15'],
    pickupWindow: ['12:30', '14:15'],
  },
  tvs: [{ name: 'Living room' }, { name: 'Bedroom' }],
  tvService: 'YouTube TV',
  favoriteChannels: ['ESPN', 'SEC Network', 'NBC', 'CBS', 'ABC', 'FOX', 'Disney Junior', 'HGTV'].map((name) => ({ name })),
  kids: [{ name: 'Max', color: '#6EA8E8' }, { name: 'Lily', color: '#B79CF0' }],
  mealie: { mealTags: ['Weeknight', 'Kids', 'Grill', 'Slow cooker'], shoppingList: 'todo.mealie_groceries', sendListTo: 'Sam' },
  vacuum: { name: 'Roomba', entity: 'vacuum.roomba' },
  sports: ['sensor.falcons', 'sensor.gt_football', 'sensor.gt_basketball'],
};

/** `sampleOnly`: mock mode uses the prototype household and ignores config.json. */
export async function loadConfig(sampleOnly = false): Promise<HubConfig> {
  if (sampleOnly) return { ...DEFAULT_CONFIG };
  let file: Partial<HubConfig> = {};
  try {
    const res = await fetch('./config.json', { cache: 'no-store' });
    if (res.ok) file = await res.json();
  } catch {
    // No config.json: fall back to defaults (mock mode).
  }
  const cfg: HubConfig = { ...DEFAULT_CONFIG, ...file };
  // Served by Home Assistant itself (/local/kitchen/): use that same server, so a new IP needs no rebuild.
  if (!cfg.haUrl && location.pathname.startsWith('/local/')) cfg.haUrl = location.origin;
  if (!cfg.haUrl && import.meta.env.VITE_HA_URL) cfg.haUrl = import.meta.env.VITE_HA_URL;
  return cfg;
}
