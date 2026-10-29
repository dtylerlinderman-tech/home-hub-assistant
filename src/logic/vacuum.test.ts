import { describe, expect, it } from 'vitest';
import { daysAgo, isRunning, lastCleanedLabel, recency, roomsLabel, statusLabel, whenLabel } from './vacuum';

const now = new Date(2026, 9, 20, 17, 45); // Tue Oct 20, 5:45 PM
const at = (d: number, h: number, m = 0) => new Date(2026, 9, d, h, m).getTime();

describe('vacuum recency', () => {
  it('counts calendar days, not 24-hour periods', () => {
    expect(daysAgo(at(20, 0, 5), now)).toBe(0);
    expect(daysAgo(at(19, 23, 50), now)).toBe(1);
    expect(daysAgo(at(15, 9), now)).toBe(5);
  });

  it('grades rooms', () => {
    expect(recency(at(20, 9, 40), now)).toBe('today');
    expect(recency(at(19, 9), now)).toBe('recent');
    expect(recency(at(17, 9), now)).toBe('recent'); // 3 days
    expect(recency(at(16, 9), now)).toBe('due'); // 4 days
    expect(recency(null, now)).toBe('never');
  });

  it('labels last-cleaned times', () => {
    expect(lastCleanedLabel(at(20, 9, 40), now)).toBe('Cleaned today 9:40 AM');
    expect(lastCleanedLabel(at(19, 9), now)).toBe('Cleaned yesterday');
    expect(lastCleanedLabel(at(15, 9), now)).toBe('Cleaned 5 days ago');
    expect(lastCleanedLabel(null, now)).toBe('Not cleaned recently');
  });

  it('labels run times', () => {
    expect(whenLabel(at(20, 9, 40), now)).toBe('Today 9:40 AM');
    expect(whenLabel(at(19, 16, 10), now)).toBe('Yesterday 4:10 PM');
    expect(whenLabel(at(17, 9), now)).toBe('Sat 9:00 AM');
    expect(whenLabel(at(2, 9), now)).toBe('Oct 2');
  });
});

describe('vacuum labels', () => {
  it('describes status', () => {
    expect(statusLabel('cleaning', 'Kitchen')).toBe('Cleaning the kitchen');
    expect(statusLabel('returning', null)).toBe('Heading home');
    expect(isRunning('paused')).toBe(true);
    expect(isRunning('docked')).toBe(false);
  });

  it('joins room names', () => {
    expect(roomsLabel(null)).toBe('Whole home');
    expect(roomsLabel(['Kitchen'])).toBe('Kitchen');
    expect(roomsLabel(['Kitchen', 'Dining room'])).toBe('Kitchen & dining room');
    expect(roomsLabel(['Kitchen', 'Entry', 'Hallway'])).toBe('Kitchen, entry & hallway');
  });
});
