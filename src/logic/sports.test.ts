import { describe, expect, it } from 'vitest';
import { kickoff } from './sports';

const NOW = new Date(2026, 9, 26, 9, 0).getTime(); // Mon 9:00 AM

describe('kickoff', () => {
  it('words the start relative to today', () => {
    const now = new Date(NOW);
    expect(kickoff(new Date(2026, 9, 26, 19, 30).getTime(), now)).toBe('Today 7:30 PM');
    expect(kickoff(new Date(2026, 9, 27, 13, 0).getTime(), now)).toBe('Tomorrow 1:00 PM');
    expect(kickoff(new Date(2026, 9, 31, 19, 30).getTime(), now)).toBe('Sat 7:30 PM');
  });

  it('dates games more than a week out and drops a not-yet-set (midnight) time', () => {
    const now = new Date(NOW);
    expect(kickoff(new Date(2026, 10, 7, 13, 5).getTime(), now)).toBe('Sat, Nov 7 1:05 PM');
    expect(kickoff(new Date(2027, 1, 19, 0, 0).getTime(), now)).toBe('Fri, Feb 19');
  });
});
