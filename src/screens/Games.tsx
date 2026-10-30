import { adapter, config } from '../hub';
import { useStore } from '../store';
import { useAsync } from '../useAsync';
import { kickoff } from '../logic/sports';
import { now } from '../logic/time';
import type { Game, Opponent, TeamResult } from '../data/adapter';
import './games.css';

/** One card per followed team: a live score, the next game and the last few results. */
export function Games() {
  const games = useStore(adapter.state).games;
  const sensors = config.sports ?? [];
  return (
    <main class="screen games">
      <header class="games-head">
        <span class="page-title">Games</span>
        <span class="page-sub">Scores and schedules from ESPN</span>
      </header>
      {sensors.length === 0 ? (
        <div class="card games-team"><div class="not-connected">No teams set up yet</div></div>
      ) : (
        <div class="games-grid">
          {sensors.map((id) => <TeamCard key={id} sensor={id} game={games.find((g) => g.id === id) ?? null} />)}
        </div>
      )}
    </main>
  );
}

function Logo({ src, abbr, size }: { src: string | null; abbr: string; size: number }) {
  return (
    <span class="games-logo" style={{ width: size + 'px', height: size + 'px' }}>
      {src ? <img src={src} alt="" /> : <span class="games-logo-abbr">{abbr}</span>}
    </span>
  );
}

function TeamCard({ sensor, game }: { sensor: string; game: Game | null }) {
  const [sched] = useAsync(() => adapter.getTeamSchedule(sensor), [sensor]);
  const s = sched.value;
  const name = game?.team.name ?? s?.name ?? '';
  const logo = game?.team.logo ?? s?.logo ?? null;
  const record = game?.team.record ?? s?.record ?? null;
  // Team Tracker knows the next game's TV channel and live scores; ESPN's schedule fills in otherwise.
  const next = game?.state === 'pre'
    ? { start: game.start, opponent: { name: game.opponent.name, abbr: game.opponent.abbr, logo: game.opponent.logo }, home: game.home, tv: game.tv }
    : s?.next ?? null;
  const vsAt = (home: boolean) => (home ? 'vs' : 'at');

  return (
    <section class="card games-team" aria-label={name || 'Team'}>
      <div class="games-team-head">
        <Logo src={logo} abbr={game?.team.abbr ?? ''} size={44} />
        <div class="games-team-name">
          <span class="games-name">{name || 'Team not connected'}</span>
          <span class="games-meta">{[game?.league, record].filter(Boolean).join(' · ')}</span>
        </div>
      </div>

      {game?.state === 'in' && (
        <div class="games-live" aria-label={`Live: ${game.team.name} ${game.team.score}, ${game.opponent.name} ${game.opponent.score}`}>
          <span class="games-live-tag"><span class="dot" style={{ width: '9px', height: '9px', background: 'var(--alert)' }} />Live · {game.clock ?? ''}</span>
          <span class="games-live-score tnum">{game.team.score ?? 0}<span class="games-dash">–</span>{game.opponent.score ?? 0}</span>
          <span class="games-live-opp">{vsAt(game.home)} {game.opponent.name}{game.tv ? ' · ' + game.tv : ''}</span>
        </div>
      )}

      {next && game?.state !== 'in' && (
        <div class="games-next">
          <span class="eyebrow">Next game</span>
          <div class="games-row">
            <Logo src={next.opponent.logo} abbr={next.opponent.abbr} size={34} />
            <span class="games-row-text">
              <span class="games-row-title">{vsAt(next.home)} {next.opponent.name}</span>
              <span class="games-row-sub">{[kickoff(next.start, now()), next.tv].filter(Boolean).join(' · ')}</span>
            </span>
          </div>
        </div>
      )}

      <div class="games-recent">
        <span class="eyebrow">Recent</span>
        {sched.loading ? null
          : !s ? <span class="games-empty">Couldn’t load results</span>
          : s.results.length === 0 ? <span class="games-empty">No games yet this season</span>
          // A live score takes the room of one result.
          : s.results.slice(0, game?.state === 'in' ? 2 : 3).map((r) => <ResultRow key={r.start} r={r} vsAt={vsAt} />)}
      </div>
    </section>
  );
}

const OUTCOME = { W: ['Win', 'var(--ok)', 'var(--ok-tint)'], L: ['Loss', 'var(--alert-text)', 'var(--alert-tint)'], T: ['Tie', 'var(--muted)', 'var(--raised)'] } as const;

function ResultRow({ r, vsAt }: { r: TeamResult; vsAt: (home: boolean) => string }) {
  const [label, color, tint] = r.outcome ? OUTCOME[r.outcome] : ['Final', 'var(--muted)', 'var(--raised)'];
  const date = new Date(r.start).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
  return (
    <div class="games-row" aria-label={`${label} ${r.us}–${r.them} ${vsAt(r.home)} ${r.opponent.name}, ${date}`}>
      <span class="games-badge" style={{ color, background: tint }}>{r.outcome ?? '–'}</span>
      <span class="games-score tnum">{r.us ?? '–'}<span class="games-dash">–</span>{r.them ?? '–'}</span>
      <span class="games-row-text">
        <span class="games-row-title">{vsAt(r.home)} {r.opponent.name}</span>
        <span class="games-row-sub">{date}</span>
      </span>
      <OppLogo o={r.opponent} />
    </div>
  );
}

function OppLogo({ o }: { o: Opponent }) {
  return <Logo src={o.logo} abbr={o.abbr} size={30} />;
}
