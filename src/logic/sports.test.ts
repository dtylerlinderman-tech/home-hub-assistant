import { describe, expect, it } from 'vitest';
import { finalText, gamesToShow, kickoff } from './sports';
import type { Game, GameSide } from '../data/adapter';

const side = (name: string, score: number | null = null, winner: boolean | null = null): GameSide =>
  ({ name, abbr: name, logo: null, score, record: null, rank: null, winner });
const game = (id: string, state: Game['state'], start: number, extra: Partial<Game> = {}): Game =>
  ({ id, league: 'NFL', state, start, home: true, team: side('Us'), opponent: side('Them'), clock: null, tv: null, ...extra });

const NOW = new Date(2026, 9, 26, 9, 0).getTime(); // Mon 9:00 AM
const H = 3600e3;

describe('gamesToShow', () => {
  it('orders live, then recent finals, then upcoming; drops stale and far-off games', () => {
    const shown = gamesToShow([
      game('next-week', 'pre', NOW + 8 * 24 * H),
      game('saturday', 'pre', NOW + 5 * 24 * H),
      game('yesterday', 'post', NOW - 16 * H),
      game('last-week', 'post', NOW - 7 * 24 * H),
      game('live', 'in', NOW - H),
    ], NOW);
    expect(shown.map((g) => g.id)).toEqual(['live', 'yesterday', 'saturday']);
  });

  it('caps the list', () => {
    const many = [1, 2, 3, 4].map((d) => game('g' + d, 'pre', NOW + d * 24 * H));
    expect(gamesToShow(many, NOW, 3).map((g) => g.id)).toEqual(['g1', 'g2', 'g3']);
  });
});

describe('kickoff and finalText', () => {
  it('words the start relative to today', () => {
    const now = new Date(NOW);
    expect(kickoff(new Date(2026, 9, 26, 19, 30).getTime(), now)).toBe('Today 7:30 PM');
    expect(kickoff(new Date(2026, 9, 27, 13, 0).getTime(), now)).toBe('Tomorrow 1:00 PM');
    expect(kickoff(new Date(2026, 9, 31, 19, 30).getTime(), now)).toBe('Sat 7:30 PM');
  });

  it('marks wins, losses and ties', () => {
    expect(finalText(game('w', 'post', NOW, { team: side('Us', 29, true), opponent: side('Them', 20, false) }))).toBe('Final · W');
    expect(finalText(game('l', 'post', NOW, { team: side('Us', 10, false), opponent: side('Them', 20, true) }))).toBe('Final · L');
    expect(finalText(game('t', 'post', NOW, { team: side('Us', 3), opponent: side('Them', 3) }))).toBe('Final · T');
  });
});
