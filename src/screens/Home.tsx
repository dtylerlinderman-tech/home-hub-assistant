import { useEffect, useState } from 'preact/hooks';
import { act, adapter, config, enabled, sceneOverride } from '../hub';
import { useStore, useTick } from '../store';
import { useAsync } from '../useAsync';
import { href } from '../router';
import { Icon, weatherIcon, weatherLabel } from '../components/Icon';
import { Checkbox } from '../components/Checkbox';
import { addDays, clockParts, fmtLongDate, fmtMinOfDay, fmtShortHm, fmtTime, hmToMin, isoDate, now, sameDay, startOfDay } from '../logic/time';
import { deltaText, leaveByMin, sceneAt, trafficLevel, type Scene, type Traffic } from '../logic/schoolRun';
import type { Flight, Thermostat } from '../data/adapter';
import { agenda } from '../logic/calendar';
import { flightView, flightsToShow, onCalendar } from '../logic/flights';
import { lockView } from '../components/lockView';
import { isRunning, statusLabel } from '../logic/vacuum';
import './home.css';

export function Home() {
  useTick(1000);
  const d = now();
  const { time, ampm } = clockParts(d);
  const forced = useStore(sceneOverride) as Scene | null;
  const scene: Scene = forced ?? sceneAt(d, config.schoolRun);

  return (
    <main class="screen home">
      <header class="home-head">
        <div class="home-clock">
          <div class="home-time-row">
            <span class="home-time tnum">{time}</span>
            <span class="home-ampm">{ampm}</span>
          </div>
          <span class="home-date">{fmtLongDate(d)}</span>
        </div>
        <div class="home-head-side">
          <NowPlaying />
          <div class="home-head-right">
            <ClimateChips />
            <WeatherNow />
          </div>
        </div>
      </header>

      <div class="home-grid">
        {scene === 'dinner' ? <DinnerCard /> : <SchoolCard scene={scene} />}
        <div class="home-col">
          <WeekCard />
          {enabled('reminders') && <Reminders />}
        </div>
        <div class="home-col">
          <FlightsCard />
          <FrontDoor />
          <VacuumCard />
        </div>
      </div>
    </main>
  );
}

function ClimateChips() {
  const zones = useStore(adapter.state).climate;
  if (!zones.length) return null;
  return (
    <a href={href('/climate')} class="plain home-chips" aria-label="Climate controls">
      {zones.map((z) => (
        <span key={z.entity} class="home-chip">
          <span class="home-chip-name">{z.name}</span>
          {z.available ? <span class="home-chip-val">{Math.round(z.current)}° <ChipStatus z={z} /></span> : <span class="home-chip-off">Not connected</span>}
        </span>
      ))}
    </a>
  );
}

function ChipStatus({ z }: { z: Thermostat }) {
  if (z.action === 'cooling') return <span class="home-chip-sub" style={{ color: 'var(--cool)' }}>Cooling</span>;
  if (z.action === 'heating') return <span class="home-chip-sub" style={{ color: 'var(--alert-text)' }}>Heating</span>;
  if (z.mode === 'off') return <span class="home-chip-sub">Off</span>;
  const set = z.mode === 'heat_cool' ? z.low + '–' + z.high : z.target;
  return <span class="home-chip-sub">Set {set}°</span>;
}

function WeatherNow() {
  const w = useStore(adapter.state).weather;
  if (!w) return <div class="home-weather"><span class="home-weather-sub">Weather not connected</span></div>;
  const hl = w.high != null && w.low != null ? ' · H ' + Math.round(w.high) + '° L ' + Math.round(w.low) + '°' : '';
  return (
    <a href={href('/weather')} class="plain home-weather" aria-label={`${Math.round(w.temp)}°, ${weatherLabel(w.condition)}. Open the forecast`}>
      <Icon name={weatherIcon(w.condition)} size={52} stroke={1.8} color="var(--accent)" />
      <div class="home-weather-text">
        <span class="home-weather-temp">{Math.round(w.temp)}°</span>
        <span class="home-weather-sub">{weatherLabel(w.condition)}{hl}</span>
      </div>
    </a>
  );
}

// ---- First column: school run or tonight's dinner ----

const TRAFFIC: Record<Traffic, { label: string; bg: string; fg: string; segs: [string, string, string] }> = {
  light: { label: 'Light traffic', bg: 'var(--ok-tint)', fg: 'var(--ok)', segs: ['var(--ok)', 'var(--ok)', 'var(--ok)'] },
  moderate: { label: 'Moderate traffic', bg: 'var(--accent-soft)', fg: 'var(--accent)', segs: ['var(--ok)', 'var(--accent)', 'var(--alert)'] },
  heavy: { label: 'Heavy traffic', bg: 'var(--alert-tint)', fg: 'var(--alert-text)', segs: ['var(--accent)', 'var(--alert)', 'var(--alert)'] },
};

function daysLabel(days: string[]): string {
  const names = days.map((k) => k[0].toUpperCase() + k.slice(1));
  return names.length <= 2 ? names.join(' & ') : names.slice(0, -1).join(', ') + ' & ' + names[names.length - 1];
}

function SchoolCard({ scene }: { scene: Exclude<Scene, 'dinner'> }) {
  const cfg = config.schoolRun!;
  const live = useStore(adapter.state).schoolRun?.[scene];
  const am = scene === 'dropoff';
  const eventHm = am ? cfg.dropoff : cfg.pickup;
  const level = live ? trafficLevel(live.driveMin, live.usualMin) : null;
  const t = level ? TRAFFIC[level] : null;
  const segs = t?.segs ?? ['var(--faint)', 'var(--faint)', 'var(--faint)'];
  return (
    <section class="card home-school" aria-label="School run">
      <div class="home-school-top">
        <span class="eyebrow">{am ? 'School drop-off' : 'School pick-up'} · {daysLabel(cfg.days)}</span>
        {t && (
          <span class="home-traffic" style={{ background: t.bg, color: t.fg }}>
            <span class="dot" style={{ width: '8px', height: '8px', background: t.fg }} />{t.label}
          </span>
        )}
      </div>
      <div class="home-school-main">
        <span class="home-school-name">{cfg.name}</span>
        {live ? (
          <span class="home-drive-row">
            <span class="home-drive">{Math.round(live.driveMin)} min</span>
            <span class="home-drive-delta">{deltaText(live.driveMin, live.usualMin)}</span>
          </span>
        ) : <span class="home-drive-off">Drive time not connected</span>}
      </div>
      <div class="home-map">
        <svg width="100%" height="140" viewBox="0 0 320 140" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
          <path d="M0 25H320M0 55H320M0 85H320M0 115H320M80 0V140M150 0V140M230 0V140" stroke="var(--border)" stroke-width="6" fill="none" />
          <path d="M24 115H80V85H150" stroke={segs[0]} stroke-width="6" fill="none" stroke-linecap="round" stroke-linejoin="round" />
          <path d="M150 85V55H230" stroke={segs[1]} stroke-width="6" fill="none" stroke-linecap="round" stroke-linejoin="round" />
          <path d="M230 55V25H296" stroke={segs[2]} stroke-width="6" fill="none" stroke-linecap="round" stroke-linejoin="round" />
          <circle cx="24" cy="115" r="9" fill="var(--text)" />
          <circle cx="296" cy="25" r="9" fill="var(--accent)" />
        </svg>
        <span class="home-map-label">Live traffic</span>
      </div>
      {live && (
        <div class="home-leave">
          <span class="home-leave-by">Leave by {fmtMinOfDay(leaveByMin(eventHm, live.driveMin, cfg.leaveBufferMin))}</span>
          <span class="home-leave-for">to arrive for {fmtShortHm(hmToMin(eventHm))} {am ? 'drop-off' : 'pick-up'}</span>
        </div>
      )}
      <div class="spacer" />
    </section>
  );
}

function DinnerCard() {
  const today = startOfDay(now());
  const key = isoDate(today);
  const [plan] = useAsync(() => adapter.getMealPlan(today, addDays(today, 1)), [key]);
  const entry = plan.value?.find((p) => p.date === key) ?? null;
  const [recipe] = useAsync(() => (entry?.recipeId ? adapter.getRecipes().then((rs) => rs?.find((r) => r.id === entry.recipeId) ?? null) : Promise.resolve(null)), [entry?.recipeId]);
  const r = recipe.value;
  const meta = r ? [r.mins ? r.mins + ' min' : null, ...r.tags.slice(0, 1), r.servings ? 'Serves ' + r.servings : null].filter(Boolean).join(' · ') : '';

  return (
    <section class="card home-dinner" aria-label="Tonight's dinner">
      <span class="eyebrow">Tonight's dinner</span>
      <div class="home-dinner-img">
        {r?.image ? <img src={r.image} alt="" /> : <Icon name="meals" size={40} stroke={1.6} />}
      </div>
      {plan.loading ? null : plan.value === null ? (
        <div class="not-connected">Meal plan not connected</div>
      ) : (
        <div class="home-dinner-text">
          <span class="home-dinner-name">{entry ? entry.title : 'Nothing planned tonight'}</span>
          <span class="home-dinner-meta">{entry ? meta : 'Pick something on the Meals screen.'}</span>
        </div>
      )}
      <div class="spacer" />
      {entry?.recipeId ? (
        <a href={href('/cook/' + encodeURIComponent(entry.recipeId))} class="btn home-cook"><Icon name="play" size={22} />Start cooking</a>
      ) : null}
      <a href={href('/meals')} class="btn home-week">See this week’s meals</a>
    </section>
  );
}

// ---- Middle column ----

/** The next 7 days, only the days with something on them. Multi-day events show on each day they cover. */
function WeekCard() {
  const today = startOfDay(now());
  const [events] = useAsync(() => adapter.getEvents(today, addDays(today, 7)), [isoDate(today)]);
  const days = events.value ? agenda(events.value, today, 7) : [];
  // With one shared calendar every event says the same name, so skip that line and fit more of the week.
  const onePerson = new Set(config.calendars.map((c) => c.person)).size === 1;
  const dayName = (d: Date) => sameDay(d, today) ? 'Today' : sameDay(d, addDays(today, 1)) ? 'Tomorrow'
    : d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
  return (
    <section class="card home-today" aria-label="This week">
      <div class="home-today-head">
        <span class="eyebrow">This week</span>
        <a href={href('/calendar')} class="home-full-week">Calendar</a>
      </div>
      {events.loading ? null : events.value == null ? (
        <div class="not-connected">Calendar not connected</div>
      ) : days.length === 0 ? (
        <div class="home-today-empty">Nothing on the calendar this week.</div>
      ) : (
        <div class="home-agenda">
          {days.map(({ day, items }) => (
            <div key={isoDate(day)} class="home-agenda-day">
              <span class={'home-agenda-name' + (sameDay(day, today) ? ' today' : '')}>{dayName(day)}</span>
              {items.map(({ ev, time, note }) => (
                <div key={ev.title + ev.start.getTime()} class="home-ev">
                  <span class="home-ev-time tnum">{time}</span>
                  <div class="home-ev-body">
                    <span class="home-ev-title">{ev.title}</span>
                    {onePerson ? note && <span class="home-ev-who">{note}</span> : (
                      <span class="home-ev-who">
                        <span class="dot" style={{ width: '10px', height: '10px', background: config.people[ev.person] ?? 'var(--muted)' }} />
                        {ev.person}{note ? ' · ' + note : ''}
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

/** Slim bar in the header, above the temperatures. Hidden while no TV is on. */
function NowPlaying() {
  const tvs = useStore(adapter.state).tvs;
  const playing = tvs.find((t) => t.available && t.on);
  if (!playing) return null;
  const status = playing.paused ? 'Paused' : playing.live ? 'Live' : 'Playing';
  const what = playing.title ?? playing.channel ?? playing.app ?? 'On';
  const from = [playing.channel, playing.app].find((x) => x && x !== what);
  return (
    <a href={href('/tv')} class="card plain home-np" aria-label={`Now playing on the ${playing.name.toLowerCase()} TV: ${what}. Open TV controls`}>
      <span class="home-np-icon">{playing.artwork ? <img src={playing.artwork} alt="" /> : <Icon name="tv" size={20} />}</span>
      <span class="home-np-status"><span class="dot" style={{ width: '8px', height: '8px', background: playing.paused ? 'var(--muted)' : 'var(--alert)' }} />{playing.name} · {status}</span>
      <span class="home-np-title">{what}{from ? <span class="home-np-app"> · {from}</span> : null}</span>
      <Icon name="right" size={20} stroke={2.2} color="var(--muted)" />
    </a>
  );
}

/** Tracked flights (from calendar flight numbers): departing within a day, in the air, or just landed. */
/** Tracked flights that match a calendar event (see onCalendar), as shown on Home. Falls back to all without a calendar. */
function useShownFlights(): Flight[] {
  const tracked = useStore(adapter.state).flights;
  const hour = Math.floor(now().getTime() / 3600e3);
  const [events] = useAsync(
    () => (tracked.length ? adapter.getEvents(new Date((hour - 24) * 3600e3), new Date((hour + 48) * 3600e3)) : Promise.resolve([])),
    [hour, tracked.length],
  );
  const mine = events.value ? onCalendar(tracked, events.value) : events.loading ? [] : tracked;
  return flightsToShow(mine, now().getTime());
}

function FlightsCard() {
  const flights = useShownFlights();
  if (!flights.length) return null;
  return (
    <section class="card home-flights" aria-label="Flights">
      <span class="eyebrow">{flights.length === 1 ? 'Flight' : 'Flights'}</span>
      {flights.map((f) => <FlightRow key={f.id} f={f} />)}
    </section>
  );
}

function FlightRow({ f }: { f: Flight }) {
  const v = flightView(f, now().getTime());
  const place = (p: Flight['from']) => p.city ?? p.code;
  const air = v.phase === 'air';
  return (
    <div class="home-flight">
      <div class="home-flight-top">
        <span class="home-flight-route">{place(f.from)} <span class="home-flight-arrow">→</span> {place(f.to)}</span>
        <span class="home-flight-num" title={f.airline ?? undefined}>{f.number}</span>
      </div>
      <span class={'home-flight-status ' + v.phase}>{v.status}</span>
      {air && v.progress != null && (
        <div class="home-flight-track" role="meter" aria-label="Flight progress" aria-valuenow={Math.round(v.progress * 100)} aria-valuemin={0} aria-valuemax={100}>
          <span class="home-flight-code">{f.from.code}</span>
          <span class="home-flight-bar"><span style={{ width: v.progress * 100 + '%' }} /><Icon name="plane" size={18} stroke={2} style={{ left: `calc(${v.progress * 100}% - 9px)` }} /></span>
          <span class="home-flight-code">{f.to.code}</span>
        </div>
      )}
      {air && (f.altitude != null || f.speed != null) && (
        <span class="home-flight-sub">{[f.altitude != null ? Math.round(f.altitude).toLocaleString() + ' ft' : null, f.speed != null ? Math.round(f.speed * 1.151) + ' mph' : null].filter(Boolean).join(' · ')}</span>
      )}
    </div>
  );
}

/** Shown only while the vacuum is running or needs help (stuck, error, bin full). */
function VacuumCard() {
  const v = useStore(adapter.state).vacuum;
  if (!v || !v.available) return null;
  const needsHelp = v.status === 'stuck' || v.status === 'error';
  const idle = !isRunning(v.status) && v.status !== 'returning';
  if (idle && !v.binFull && v.bag === 'ok') return null;
  // While idle, a full bin or dock bag is the thing to show.
  const chore = idle ? (v.binFull ? 'The bin is full' : v.bag === 'full' ? 'The dock bag is full' : v.bag === 'due' ? 'Time to replace the dock bag' : null) : null;
  const color = needsHelp || v.binFull || v.bag === 'full' ? 'var(--alert-text)' : 'var(--accent)';
  const title = v.error?.description ?? chore ?? statusLabel(v.status, v.currentRoom);
  return (
    <a href={href('/vacuum')} class="card plain home-mini" aria-label={'Vacuum: ' + title + '. Open vacuum controls'}>
      <span class="home-mini-head"><span class="eyebrow">Vacuum</span>{v.battery != null && <span class="home-mini-note">Battery {v.battery}%</span>}</span>
      <span class="home-mini-row">
        <span class="home-mini-icon" style={{ color }}><Icon name="vacuum" size={26} /></span>
        <span class="home-mini-text">
          <span class="home-mini-status" style={{ color }}>
            <span class="dot" style={{ width: '8px', height: '8px', background: color }} />{v.name} · {needsHelp ? 'Needs help' : chore ? (v.binFull ? 'Empty the bin' : 'Dock bag') : statusLabel(v.status, null)}
          </span>
          <span class="home-mini-title home-vac-title">{title}</span>
        </span>
        <Icon name="right" size={22} stroke={2.2} color="var(--muted)" />
      </span>
    </a>
  );
}

function Reminders() {
  const list = useStore(adapter.state).reminders;
  return (
    <section class="card home-rem" aria-label="Reminders">
      <span class="eyebrow">Home reminders</span>
      {list === null ? (
        <div class="not-connected" style={{ minHeight: '44px' }}>Reminders not connected</div>
      ) : list.length === 0 ? (
        <span class="home-rem-empty">Nothing to remember right now.</span>
      ) : (
        list.slice(0, 3).map((r) => (
          <button key={r.uid} type="button" class="btn home-rem-item" aria-pressed={r.done} onClick={() => act(adapter.setReminderDone(r.uid, !r.done))}>
            <Checkbox done={r.done} size={28} radius={9} border={2} check={16} />
            <span class="home-rem-text">
              <span class="home-rem-title" style={{ textDecoration: r.done ? 'line-through' : 'none' }}>{r.summary}</span>
              {r.due && <span class="home-rem-when">{r.due}</span>}
            </span>
          </button>
        ))
      )}
    </section>
  );
}

// ---- Front door ----

function FrontDoor() {
  const { lock, lockSignInExpired, doorbell } = useStore(adapter.state);
  const v = lockView(lock, lockSignInExpired);
  // A flight card shares this column; drop the camera placeholder so everything fits (View camera still opens it).
  const compact = useShownFlights().length > 0;
  const sub = lock
    ? [lock.lastMethod, lock.lastChanged ? fmtTime(new Date(lock.lastChanged)) : null, lock.battery != null ? 'Battery ' + lock.battery + '%' : null].filter(Boolean).join(' · ')
    : lockSignInExpired ? 'Google sign-in expired · redo it in Home Assistant' : 'Lock not connected';
  return (
    <section class={'card home-door' + (compact ? ' compact' : '')} aria-label="Front door">
      <span class="eyebrow">Front door</span>
      {!compact && <a href={href('/door')} class="plain home-snap" aria-label="Open doorbell camera">
        <Snapshot url={doorbell?.snapshotUrl ?? null} />
        {!doorbell?.snapshotUrl && (
          <>
            <Icon name="camera" size={40} stroke={1.6} />
            <span class="home-snap-text">
              {!doorbell ? 'Camera not connected'
                : [doorbell.snapshotUrl || adapter.isMock ? 'Doorbell snapshot' : 'Front door camera',
                  doorbell.lastRing && !adapter.isMock ? 'Last ring ' + whenShort(doorbell.lastRing) : null,
                  doorbell.lastMotion ? 'Last motion ' + whenShort(doorbell.lastMotion) : null].filter(Boolean).join(' · ')}
            </span>
          </>
        )}
      </a>}
      <div class="home-lock">
        <span class="home-lock-icon" style={{ background: v.tint, color: v.color }}><Icon name={v.icon} size={28} /></span>
        <div class="home-lock-text">
          <span class="home-lock-label" style={{ color: v.color }}>{v.label}</span>
          <span class="home-lock-sub">{sub}</span>
        </div>
      </div>
      <PackagesRow />
      <div class="spacer" />
      <div class="home-door-btns">
        <a href={href('/door')} class="btn home-door-btn">View camera</a>
        {v.unlocked
          ? <button type="button" class="btn home-door-btn" onClick={() => act(adapter.lock())}>Lock now</button>
          : <a href={href('/door')} class="btn home-door-btn">Unlock</a>}
      </div>
    </section>
  );
}

/** Packages from shipping emails; only shown when something is arriving, delivered today or on the way. */
function PackagesRow() {
  const p = useStore(adapter.state).packages;
  if (!p || !(p.arriving || p.delivered || p.inTransit)) return null;
  const byCarrier = (xs: { carrier: string; n: number }[]) => xs.map((x) => (xs.length > 1 ? x.carrier + ' ' + x.n : x.carrier)).join(' · ');
  const title = p.arriving ? p.arriving + ' arriving today' : p.delivered ? p.delivered + ' delivered today' : p.inTransit + ' on the way';
  const sub = [
    p.arriving ? byCarrier(p.arrivingBy) : p.delivered ? byCarrier(p.deliveredBy) : null,
    p.arriving && p.delivered ? p.delivered + ' delivered' : null,
    (p.arriving || p.delivered) && p.inTransit ? p.inTransit + ' on the way' : null,
  ].filter(Boolean).join(' · ');
  return (
    <div class="home-pkg" aria-label={'Packages: ' + title}>
      <span class="home-pkg-icon"><Icon name="package" size={22} /></span>
      <div class="home-pkg-text">
        <span class="home-pkg-title">{title}</span>
        {sub && <span class="home-pkg-sub">{sub}</span>}
      </div>
    </div>
  );
}

/** Latest camera snapshot, refreshed every 60 s while visible. */
function Snapshot({ url }: { url: string | null }) {
  const [bust, setBust] = useState(0);
  useEffect(() => {
    if (!url) return;
    const t = setInterval(() => { if (!document.hidden) setBust(Date.now()); }, 60_000);
    return () => clearInterval(t);
  }, [url]);
  if (!url) return null;
  return <img class="home-snap-img" src={url + (url.includes('?') ? '&' : '?') + 't=' + bust} alt="Front door camera snapshot" />;
}

/** "4:12 PM" today, otherwise "Wed 4:12 PM". */
function whenShort(t: number): string {
  const d = new Date(t);
  return sameDay(d, now()) ? fmtTime(d) : d.toLocaleDateString('en-US', { weekday: 'short' }) + ' ' + fmtTime(d);
}
