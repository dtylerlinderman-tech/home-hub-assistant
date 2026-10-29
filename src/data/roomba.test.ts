import { describe, expect, it } from 'vitest';
import type { HassEntity } from 'home-assistant-js-websocket';
import { bagState, lastCleanedByRoom, roombaMapSvg, toMission, toVacuum, type RoombaMissionRecord, type RoombaRoom } from './ha-mappers';

// Trimmed from the real DJ Roomba (i-series, Roomba+) on 2026-10-23.
const missions: RoombaMissionRecord[] = [
  { id: 'c_1792764872', n_mssn: 1402, started_at: '2026-10-23T14:14:32+00:00', ended_at: '2026-10-23T15:07:44+00:00', duration_min: 52, area_sqft: 285, result: 'completed', initiator: 'schedule', room_coverage: { 'Living Room': 0.506 } },
  { id: 'c_1792677572', n_mssn: 1401, started_at: '2026-10-22T13:59:32+00:00', ended_at: '2026-10-22T14:37:06+00:00', duration_min: 36, area_sqft: 237, result: 'completed', initiator: 'schedule', room_coverage: { 'Breakfast Room': 0.612, Kitchen: 0.708, Entryway: 0.04 } },
  { id: 'c_1', n_mssn: 1399, started_at: '2026-10-20T14:00:00+00:00', duration_min: 12, area_sqft: null, result: 'stuck', initiator: 'rmtApp', room_coverage: {} },
];

const rooms: Record<string, RoombaRoom> = {
  Kitchen: { name: 'Kitchen', room_id: 'kitchen', outline: [[0, 0], [100, 0], [100, 100], [0, 100]], x: 50, y: 50 },
  'Living Room': { name: 'Living Room', room_id: 'living_room', outline: [[100, 0], [300, 0], [300, 100], [100, 100]], x: 200, y: 50 },
  'Zone 22': { name: 'Zone 22', room_id: 'zone_22', outline: [[0, 100], [10, 100], [10, 110]], x: 5, y: 105 },
};

const ent = (entity_id: string, state: string, attributes: Record<string, unknown> = {}): HassEntity => ({
  entity_id, state, attributes, last_changed: '', last_updated: '', context: { id: '', user_id: null, parent_id: null },
});

describe('Roomba+ mapping', () => {
  it('maps run records', () => {
    expect(toMission(missions[1])).toEqual({
      id: '1401', start: Date.parse('2026-10-22T13:59:32+00:00'), durationMin: 36, areaSqFt: 237,
      result: 'completed', rooms: ['Kitchen', 'Breakfast Room'], initiator: 'Schedule', // Entryway at 4% is below the bar
    });
    expect(toMission(missions[2])).toMatchObject({ result: 'stuck', rooms: null, initiator: 'App' });
  });

  it('works out last-cleaned per room from history', () => {
    expect(lastCleanedByRoom(missions)).toEqual({
      'Living Room': Date.parse('2026-10-23T15:07:44+00:00'),
      'Breakfast Room': Date.parse('2026-10-22T14:37:06+00:00'),
      Kitchen: Date.parse('2026-10-22T14:37:06+00:00'),
    });
  });

  it('maps the docked robot and its rooms (zones left out)', () => {
    const v = toVacuum('DJ Roomba', {
      vacuum: ent('vacuum.dj_roomba', 'docked', { bin_full: false, status: 'Charging', mission_elapsed_min: null }),
      battery: ent('sensor.dj_roomba_battery', '100'),
      location: ent('device_tracker.dj_roomba', 'Docked'),
      phase: ent('sensor.dj_roomba_phase', 'idle'),
      lastError: null,
      roomsMap: ent('image.dj_roomba_rooms_map', 'x', { rooms }),
      roomAreas: ent('sensor.dj_roomba_room_areas', '8', { Kitchen: 9, 'Living Room': 39 }),
      baseStatus: ent('sensor.dj_roomba_clean_base_status', 'ready'),
      maintenance: ent('binary_sensor.dj_roomba_maintenance_due', 'on', { due: ['clean_base_bag'] }),
    }, lastCleanedByRoom(missions));
    expect(v).toMatchObject({ available: true, status: 'docked', bag: 'due', battery: 100, currentRoom: null, binFull: false, error: null, missionStarted: null });
    expect(v!.rooms).toEqual([
      { id: 'kitchen', name: 'Kitchen', lastCleaned: Date.parse('2026-10-22T14:37:06+00:00'), areaSqFt: 97 },
      { id: 'living_room', name: 'Living Room', lastCleaned: Date.parse('2026-10-23T15:07:44+00:00'), areaSqFt: 420 },
    ]);
  });

  it('reports a stuck robot in a room', () => {
    const now = Date.parse('2026-10-23T16:00:00Z');
    const v = toVacuum('DJ Roomba', {
      vacuum: ent('vacuum.dj_roomba', 'cleaning', { mission_elapsed_min: 14 }),
      battery: ent('sensor.dj_roomba_battery', '81'),
      location: ent('device_tracker.dj_roomba', 'Kitchen'),
      phase: ent('sensor.dj_roomba_phase', 'stuck'),
      lastError: ent('sensor.dj_roomba_last_error_code', '15', { description: 'Wheel stuck', action: 'Lift Roomba and clear the wheel.' }),
      roomsMap: null, roomAreas: null, baseStatus: null, maintenance: null,
    }, {}, now);
    expect(v).toMatchObject({ status: 'stuck', currentRoom: 'Kitchen', missionStarted: now - 14 * 60e3, error: { description: 'Wheel stuck', action: 'Lift Roomba and clear the wheel.' }, rooms: null });
  });

  it('reads the dock bag state', () => {
    const due = ent('binary_sensor.dj_roomba_maintenance_due', 'on', { due: ['clean_base_bag'] });
    expect(bagState(ent('s', 'ready'), due)).toBe('due');
    expect(bagState(ent('s', 'bag_full'), null)).toBe('full');
    expect(bagState(ent('s', 'ready'), ent('b', 'on', { due: ['filter'] }))).toBe('ok');
    expect(bagState(null, null)).toBe('ok');
  });

  it('draws the floor plan with highlighted rooms', () => {
    const url = roombaMapSvg(rooms, ['Kitchen'], 'Kitchen')!;
    const svg = decodeURIComponent(url.replace('data:image/svg+xml,', ''));
    expect(svg).toContain('>Kitchen</text>');
    expect(svg).not.toContain('>Zone 22</text>');
    expect(svg).toContain('<circle');
    expect(roombaMapSvg(undefined, null)).toBeNull();
  });
});
