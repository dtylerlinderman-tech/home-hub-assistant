// Mock Roomba: a fake floor plan, a week of cleaning runs, and a simulated robot
// that moves room to room. Used only by MockAdapter.
import { nowMs, startOfDay, now } from '../logic/time';
import type { Vacuum, VacuumMission } from './adapter';

interface RoomBox { name: string; x: number; y: number; w: number; h: number; sqft: number }

// Floor plan in a 480 × 300 box.
const PLAN: RoomBox[] = [
  { name: 'Living room', x: 10, y: 10, w: 180, h: 140, sqft: 320 },
  { name: 'Dining room', x: 190, y: 10, w: 130, h: 140, sqft: 210 },
  { name: 'Kitchen', x: 320, y: 10, w: 150, h: 140, sqft: 260 },
  { name: 'Entry', x: 10, y: 150, w: 100, h: 140, sqft: 120 },
  { name: 'Hallway', x: 110, y: 150, w: 220, h: 50, sqft: 110 },
  { name: 'Office', x: 110, y: 200, w: 220, h: 90, sqft: 190 },
  { name: 'Mudroom', x: 330, y: 150, w: 140, h: 140, sqft: 150 },
];
const DOCK = { x: 452, y: 132 };

export const MOCK_ROOM_NAMES = PLAN.map((r) => r.name);

function at(daysBack: number, h: number, m: number): number {
  const d = startOfDay(now());
  d.setDate(d.getDate() - daysBack);
  d.setHours(h, m);
  return d.getTime();
}

function areaOf(rooms: string[] | null): number {
  return PLAN.filter((r) => !rooms || rooms.includes(r.name)).reduce((a, r) => a + r.sqft, 0);
}

export function mockMissions(): VacuumMission[] {
  const m = (id: string, daysBack: number, h: number, min: number, durationMin: number, rooms: string[] | null, result: VacuumMission['result'], initiator: string): VacuumMission =>
    ({ id, start: at(daysBack, h, min), durationMin, areaSqFt: areaOf(rooms), result, rooms, initiator });
  return [
    m('m6', 0, 9, 10, 34, ['Kitchen', 'Dining room'], 'completed', 'Kitchen hub'),
    m('m5', 5, 10, 0, 71, null, 'completed', 'Schedule'),
    m('m4', 1, 19, 30, 24, ['Kitchen', 'Hallway'], 'completed', 'App'),
    m('m3', 4, 10, 0, 22, ['Living room'], 'stuck', 'Schedule'),
    m('m2', 3, 13, 15, 26, ['Mudroom', 'Entry'], 'completed', 'App'),
    m('m1', 8, 10, 0, 68, null, 'completed', 'Schedule'),
  ].sort((a, b) => b.start - a.start);
}

/** Last-cleaned time per room, derived from the runs. A run's `rooms` are the rooms it covered. */
export function lastCleanedFrom(missions: VacuumMission[]): Record<string, number> {
  const out: Record<string, number> = {};
  for (const mi of [...missions].sort((a, b) => a.start - b.start)) {
    for (const r of mi.rooms ?? MOCK_ROOM_NAMES) out[r] = mi.start + mi.durationMin * 60e3;
  }
  return out;
}

function trail(r: RoomBox): string {
  const pts: string[] = [];
  const x0 = r.x + 12, x1 = r.x + r.w - 12;
  for (let y = r.y + 14, i = 0; y < r.y + r.h - 8; y += 13, i++) {
    pts.push(i % 2 ? `${x1},${y} ${x0},${y}` : `${x0},${y} ${x1},${y}`);
  }
  return pts.join(' ');
}

/** SVG map (as a data URL) with the given rooms highlighted and the robot's path drawn over them. */
export function mockMapUrl(cleaned: string[] | null, robotIn?: string | null): string {
  const set = new Set(cleaned ?? MOCK_ROOM_NAMES);
  const rooms = PLAN.map((r) => {
    const on = set.has(r.name);
    return `<rect x="${r.x}" y="${r.y}" width="${r.w}" height="${r.h}" fill="${on ? '#1F3330' : '#211F1B'}" stroke="#3A362F" stroke-width="3"/>`
      + (on ? `<polyline points="${trail(r)}" fill="none" stroke="#5FB3A6" stroke-opacity="0.55" stroke-width="3" stroke-linejoin="round"/>` : '')
      + `<text x="${r.x + 12}" y="${r.y + r.h - 12}" font-family="Manrope, system-ui, sans-serif" font-size="13" font-weight="700" fill="${on ? '#D6D0C4' : '#8C867B'}">${r.name}</text>`;
  }).join('');
  const robotRoom = robotIn ? PLAN.find((r) => r.name === robotIn) : null;
  const robot = robotRoom
    ? `<circle cx="${robotRoom.x + robotRoom.w / 2}" cy="${robotRoom.y + robotRoom.h / 2}" r="11" fill="#F4EFE6" stroke="#1B1A17" stroke-width="3"/>`
    : '';
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 480 300">${rooms}`
    + `<circle cx="${DOCK.x}" cy="${DOCK.y}" r="7" fill="#B49CFA"/>${robot}</svg>`;
  return 'data:image/svg+xml,' + encodeURIComponent(svg);
}

const ROOM_MS = 6000; // simulated time in each room
const RETURN_MS = 3000;

/** Simulated robot. Calls `onChange` whenever its state changes. */
export class MockRobot {
  missions = mockMissions();
  state: Vacuum;
  private timer: ReturnType<typeof setTimeout> | undefined;
  private queue: string[] = [];
  private done: string[] = [];
  private initiator = 'Kitchen hub';

  constructor(name: string, private onChange: (v: Vacuum) => void) {
    const last = lastCleanedFrom(this.missions);
    this.state = {
      name, available: true, status: 'docked', currentRoom: null, battery: 100, binFull: false, bag: 'ok', error: null,
      targetRooms: null, missionStarted: null,
      rooms: PLAN.map((r) => ({ id: r.name.toLowerCase().replace(/\s+/g, '_'), name: r.name, lastCleaned: last[r.name] ?? null, areaSqFt: r.sqft })),
    };
  }

  private set(p: Partial<Vacuum>): void {
    this.state = { ...this.state, ...p };
    this.onChange(this.state);
  }

  start(rooms?: string[]): void {
    clearTimeout(this.timer);
    this.queue = rooms?.length ? MOCK_ROOM_NAMES.filter((r) => rooms.includes(r)) : [...MOCK_ROOM_NAMES];
    this.done = [];
    this.set({ status: 'cleaning', error: null, targetRooms: rooms?.length ? this.queue.slice() : null, missionStarted: nowMs(), currentRoom: this.queue[0] });
    this.tick();
  }

  private tick(): void {
    clearTimeout(this.timer);
    this.timer = setTimeout(() => {
      const room = this.queue.shift();
      if (room) {
        this.done.push(room);
        this.markCleaned([room]);
      }
      this.set({ battery: Math.max(5, (this.state.battery ?? 100) - 6) });
      if (this.queue.length) { this.set({ currentRoom: this.queue[0] }); this.tick(); }
      else this.finish('completed');
    }, ROOM_MS);
  }

  private markCleaned(names: string[]): void {
    const t = nowMs();
    this.set({ rooms: this.state.rooms?.map((r) => (names.includes(r.name) ? { ...r, lastCleaned: t } : r)) ?? null });
  }

  private finish(result: VacuumMission['result']): void {
    clearTimeout(this.timer);
    const started = this.state.missionStarted ?? nowMs();
    const rooms = this.state.targetRooms;
    this.missions = [{
      id: 'm' + (this.missions.length + 1) + '-' + started,
      start: started,
      // Pretend each room took 9 minutes so the history looks realistic.
      durationMin: Math.max(1, this.done.length * 9),
      areaSqFt: areaOf(this.done.length ? this.done : []),
      result,
      rooms: result === 'completed' ? rooms : this.done.slice(),
      initiator: this.initiator,
    }, ...this.missions];
    this.set({ status: 'returning', currentRoom: null, targetRooms: null, missionStarted: null });
    this.timer = setTimeout(() => this.set({ status: 'charging' }), RETURN_MS);
  }

  pause(): void {
    if (this.state.status !== 'cleaning') return;
    clearTimeout(this.timer);
    this.set({ status: 'paused' });
  }

  resume(): void {
    if (this.state.status === 'paused' || this.state.status === 'stuck' || this.state.status === 'error') {
      this.set({ status: 'cleaning', error: null });
      this.tick();
    } else if (!['cleaning', 'returning'].includes(this.state.status)) {
      this.start();
    }
  }

  dock(): void {
    if (this.state.missionStarted) this.finish(this.state.status === 'stuck' ? 'stuck' : 'cancelled');
    else if (this.state.status !== 'docked' && this.state.status !== 'charging') {
      this.set({ status: 'returning' });
      this.timer = setTimeout(() => this.set({ status: 'docked' }), RETURN_MS);
    }
  }

  // ---- Dev panel ----

  makeStuck(): void {
    if (this.state.status !== 'cleaning') this.start();
    clearTimeout(this.timer);
    this.set({
      status: 'stuck',
      error: { description: 'Stuck near the ' + (this.state.currentRoom ?? 'dining room').toLowerCase() + ' chairs', action: 'Move Roomba to a flat spot, then tap Resume.' },
    });
  }

  toggleBinFull(): void {
    this.set({ binFull: !this.state.binFull });
  }

  /** Dev panel: cycle the dock bag ok → due → full → ok. */
  cycleBag(): void {
    this.set({ bag: this.state.bag === 'ok' ? 'due' : this.state.bag === 'due' ? 'full' : 'ok' });
  }

  bagReplaced(): void {
    this.set({ bag: 'ok' });
  }

  mapUrl(missionId?: string): string {
    if (!missionId && this.state.missionStarted) return mockMapUrl(this.done, this.state.currentRoom);
    const m = missionId ? this.missions.find((x) => x.id === missionId) : this.missions[0];
    return mockMapUrl(m ? m.rooms : []);
  }
}
