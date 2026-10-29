import { useState } from 'preact/hooks';
import { act, adapter, showToast } from '../hub';
import { useStore, useTick } from '../store';
import { useAsync } from '../useAsync';
import { Icon } from '../components/Icon';
import { Checkbox } from '../components/Checkbox';
import { fmtTime, now, nowMs } from '../logic/time';
import {
  RESULT_LABEL, isRunning, lastCleanedLabel, recency, roomsLabel, statusLabel, whenLabel, type Recency,
} from '../logic/vacuum';
import type { Vacuum as VacuumState, VacuumStatus } from '../data/adapter';
import './vacuum.css';

export const RECENCY_COLOR: Record<Recency, string> = {
  today: 'var(--ok)',
  recent: 'var(--accent)',
  due: 'var(--alert)',
  never: 'var(--alert)',
};

export function statusColors(s: VacuumStatus): { bg: string; fg: string } {
  switch (s) {
    case 'cleaning': return { bg: 'var(--accent-soft)', fg: 'var(--accent)' };
    case 'returning': return { bg: 'var(--cool-tint)', fg: 'var(--cool)' };
    case 'docked': case 'charging': return { bg: 'var(--ok-tint)', fg: 'var(--ok)' };
    case 'stuck': case 'error': return { bg: 'var(--alert-tint)', fg: 'var(--alert-text)' };
    default: return { bg: 'var(--raised)', fg: 'var(--text-soft)' };
  }
}

export function Vacuum() {
  const v = useStore(adapter.state).vacuum;
  if (!v || !v.available) {
    return (
      <main class="screen vac">
        <header class="vac-head"><span class="page-title">Vacuum</span></header>
        <div class="card vac-off"><Icon name="vacuum" size={56} stroke={1.6} /><span>{v ? v.name + ' isn’t connected' : 'No vacuum set up'}</span></div>
      </main>
    );
  }
  return <VacuumBody v={v} />;
}

function VacuumBody({ v }: { v: VacuumState }) {
  useTick(15_000);
  const [picked, setPicked] = useState<string[]>([]);
  const [missionId, setMissionId] = useState<string | null>(null); // null = latest / live
  const running = isRunning(v.status);
  const today = now();

  // Refetch history and the map whenever a run starts or ends, or the robot changes rooms.
  const [missions] = useAsync(() => adapter.getVacuumMissions(8), [v.missionStarted, v.status === 'charging']);
  const [map] = useAsync(() => adapter.getVacuumMapUrl(missionId ?? undefined), [missionId, v.currentRoom, v.missionStarted, missions.value]);

  const list = missions.value ?? [];
  const shown = missionId ? list.find((m) => m.id === missionId) : running ? null : list[0];
  const mapCaption = !missionId && running
    ? 'Live · this run so far'
    : shown ? whenLabel(shown.start, today) + ' · ' + roomsLabel(shown.rooms) : 'Cleaning map';

  const sc = statusColors(v.status);
  const elapsed = v.missionStarted ? Math.max(1, Math.round((nowMs() - v.missionStarted) / 60e3)) : 0;
  const sub = running
    ? ['Started ' + fmtTime(new Date(v.missionStarted ?? nowMs())), elapsed + ' min', roomsLabel(v.targetRooms)].join(' · ')
    : list[0] ? 'Last clean ' + whenLabel(list[0].start, today).replace(/^Today/, 'today').replace(/^Yesterday/, 'yesterday') + ' · ' + roomsLabel(list[0].rooms) : 'No cleans yet';

  const toggleRoom = (name: string) => setPicked(picked.includes(name) ? picked.filter((r) => r !== name) : [...picked, name]);

  async function cleanPicked() {
    await act(adapter.vacuumStart(picked), 'Couldn’t start ' + v.name + '.');
    setPicked([]);
    setMissionId(null);
  }

  async function locate() {
    await act(adapter.vacuumLocate().then(() => showToast(v.name + ' is playing a sound')), 'Couldn’t reach ' + v.name + '.');
  }

  const atDock = v.status === 'docked' || v.status === 'charging';

  return (
    <main class="screen vac">
      <header class="vac-head">
        <div class="vac-title">
          <span class="page-title">Vacuum</span>
          <span class="page-sub">
            {v.name}{v.battery != null ? ' · Battery ' + v.battery + '%' : ''} · {v.binFull ? <span style={{ color: 'var(--alert-text)', fontWeight: 700 }}>Bin full</span> : 'Bin OK'}
          </span>
        </div>
        <button type="button" class="btn vac-find" onClick={locate}><Icon name="bell" size={22} />Find {v.name}</button>
      </header>

      <div class="vac-body">
        <section class="card vac-status" aria-label="Vacuum status">
          <div class="vac-status-top">
            <span class="eyebrow">Right now</span>
            <span class="vac-pill" style={{ background: sc.bg, color: sc.fg }}>
              <span class="dot" style={{ width: '9px', height: '9px', background: sc.fg }} />{statusLabel(v.status, null)}
            </span>
          </div>
          <div class="vac-now">
            <span class="vac-now-title">{statusLabel(v.status, v.currentRoom)}</span>
            <span class="vac-now-sub">{sub}</span>
          </div>

          {v.error && (
            <div class="vac-error" role="alert">
              <span class="vac-error-title">{v.error.description}</span>
              {v.error.action && <span class="vac-error-action">{v.error.action}</span>}
            </div>
          )}
          {v.binFull && !v.error && (
            <div class="vac-error"><span class="vac-error-title">The bin is full</span><span class="vac-error-action">Empty it so {v.name} can keep picking up.</span></div>
          )}
          {v.bag !== 'ok' && !v.error && !v.binFull && (
            <div class={'vac-error vac-bag' + (v.bag === 'due' ? ' due' : '')}>
              <span class="vac-bag-text">
                <span class="vac-error-title">{v.bag === 'full' ? 'The dock bag is full' : 'Time to replace the dock bag'}</span>
                <span class="vac-error-action">
                  {v.bag === 'full' ? 'Put a new bag in the clean base so it can empty the robot.' : 'It’s past the usual replacement interval for the clean-base bag.'}
                </span>
              </span>
              <button type="button" class="btn vac-bag-done" onClick={() => act(adapter.vacuumBagReplaced().then(() => showToast('Thanks, the bag timer is reset.')), 'Couldn’t reset the bag timer.')}>
                I replaced it
              </button>
            </div>
          )}

          <div class="vac-map">
            {map.value ? <img src={map.value} alt={'Cleaning map: ' + mapCaption} /> : <span class="vac-map-empty">{map.loading ? '' : 'Map not available yet'}</span>}
            <span class="vac-map-label">{mapCaption}</span>
            {missionId && <button type="button" class="btn vac-map-back" onClick={() => setMissionId(null)}>{running ? 'Show live' : 'Show latest'}</button>}
          </div>

          <div class="vac-controls">
            {!running ? (
              <>
                <button type="button" class="btn vac-ctl primary" onClick={() => { setMissionId(null); act(adapter.vacuumStart(), 'Couldn’t start ' + v.name + '.'); }}>
                  <Icon name="play" size={22} />Clean all
                </button>
                <button type="button" class="btn vac-ctl" disabled={atDock || v.status === 'returning'} onClick={() => act(adapter.vacuumDock())}>
                  <Icon name="home" size={22} />{v.status === 'returning' ? 'Heading home' : 'Send home'}
                </button>
              </>
            ) : (
              <>
                {v.status === 'cleaning'
                  ? <button type="button" class="btn vac-ctl" onClick={() => act(adapter.vacuumPause())}>Pause</button>
                  : <button type="button" class="btn vac-ctl primary" onClick={() => act(adapter.vacuumResume())}><Icon name="play" size={22} />Resume</button>}
                <button type="button" class="btn vac-ctl" onClick={() => act(adapter.vacuumDock())}><Icon name="home" size={22} />Send home</button>
              </>
            )}
          </div>
        </section>

        <section class="card vac-rooms" aria-label="Rooms">
          <div class="vac-col-head">
            <span class="eyebrow">Rooms</span>
            <span class="vac-hint">Tap to pick</span>
          </div>
          <div class="vac-legend">
            <span><span class="dot" style={{ width: '10px', height: '10px', background: RECENCY_COLOR.today }} />Today</span>
            <span><span class="dot" style={{ width: '10px', height: '10px', background: RECENCY_COLOR.recent }} />Last 3 days</span>
            <span><span class="dot" style={{ width: '10px', height: '10px', background: RECENCY_COLOR.due }} />Due</span>
          </div>
          {v.rooms === null ? (
            <div class="not-connected">Add your iRobot account to Roomba+ to see rooms.</div>
          ) : (
            <div class="vac-room-list">
              {[...v.rooms].sort((a, b) => (a.lastCleaned ?? 0) - (b.lastCleaned ?? 0)).map((r) => {
                const on = picked.includes(r.name);
                const here = running && v.currentRoom === r.name;
                return (
                  <button key={r.id} type="button" class={'btn vac-room' + (on ? ' on' : '')} aria-pressed={on} disabled={running} onClick={() => toggleRoom(r.name)}>
                    <span class="dot" style={{ width: '12px', height: '12px', background: RECENCY_COLOR[recency(r.lastCleaned, today)] }} />
                    <span class="vac-room-text">
                      <span class="vac-room-name">{r.name}</span>
                      <span class="vac-room-when">{here ? 'Cleaning now' : lastCleanedLabel(r.lastCleaned, today)}</span>
                    </span>
                    <Checkbox done={on} size={28} radius={9} border={2} check={16} color="var(--accent)" />
                  </button>
                );
              })}
            </div>
          )}
          <div class="spacer" />
          <button type="button" class="btn vac-clean-rooms" disabled={running || picked.length === 0} onClick={cleanPicked}>
            {running ? 'Cleaning in progress' : picked.length === 0 ? 'Pick rooms to clean' : 'Clean ' + (picked.length === 1 ? picked[0].toLowerCase() : picked.length + ' rooms')}
          </button>
        </section>

        <section class="card vac-history" aria-label="Recent cleans">
          <div class="vac-col-head">
            <span class="eyebrow">Recent cleans</span>
            <span class="vac-hint">Tap for map</span>
          </div>
          {missions.value === null ? (
            <div class="not-connected">History not available</div>
          ) : (
            <div class="vac-hist-list">
              {list.map((m) => {
                const sel = missionId === m.id || (!missionId && !running && m === list[0]);
                const bad = m.result === 'stuck' || m.result === 'error';
                return (
                  <button key={m.id} type="button" class={'btn vac-hist' + (sel ? ' on' : '')} aria-pressed={sel} onClick={() => setMissionId(m.id)}>
                    <span class="vac-hist-when">{whenLabel(m.start, today)}</span>
                    <span class="vac-hist-rooms">{roomsLabel(m.rooms)}</span>
                    <span class="vac-hist-meta">
                      <span style={{ color: bad ? 'var(--alert-text)' : m.result === 'cancelled' ? 'var(--muted)' : 'var(--ok)' }}>{RESULT_LABEL[m.result]}</span>
                      {' · ' + m.durationMin + ' min' + (m.areaSqFt ? ' · ' + Math.round(m.areaSqFt) + ' sq ft' : '')}
                    </span>
                  </button>
                );
              })}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
