import { useEffect, useRef, useState } from 'preact/hooks';
import { adapter, act, config, params } from '../hub';
import { useStore, useTick } from '../store';
import { doorReturn, goBack, navigate, type Route } from '../router';
import { Icon } from '../components/Icon';
import { lockView } from '../components/lockView';
import { fmtCountdown, fmtTime, nowMs } from '../logic/time';
import './door.css';

const KEYS: [string, string, string][] = [
  ['1', '1', 'Digit 1'], ['2', '2', 'Digit 2'], ['3', '3', 'Digit 3'],
  ['4', '4', 'Digit 4'], ['5', '5', 'Digit 5'], ['6', '6', 'Digit 6'],
  ['7', '7', 'Digit 7'], ['8', '8', 'Digit 8'], ['9', '9', 'Digit 9'],
  ['Clear', 'clear', 'Clear PIN'], ['0', '0', 'Digit 0'], ['⌫', 'back', 'Delete digit'],
];

const RECENT_RING_MS = 10 * 60e3;
const HOLD_MS = 1000;

/** PIN pad only when config.door.pin is on (?pinpad in mock mode, for its tests). */
const usePin = () => !!config.door?.pin || (adapter.isMock && params.has('pinpad'));

export function Door({ route }: { route: Route }) {
  useTick(500);
  const { lock, lockSignInExpired, doorbell } = useStore(adapter.state);
  const [pin, setPin] = useState('');
  const [msg, setMsg] = useState<{ text: string; error: boolean } | null>(null);
  const [busy, setBusy] = useState(false);

  const v = lockView(lock, lockSignInExpired);
  const t = nowMs();
  const lockedOut = lock?.pinLockoutUntil != null && lock.pinLockoutUntil > t;
  const canUnlock = !!lock && lock.state === 'locked' && lock.pinUnlock;
  const relockIn = lock?.relockAt ? Math.max(0, Math.ceil((lock.relockAt - t) / 1000)) : null;

  const ringAt = doorbell?.lastRing ?? null;
  const ringing = route.query.has('ring') || (ringAt != null && t - ringAt < RECENT_RING_MS);

  let sub: string;
  if (!lock) sub = lockSignInExpired ? 'The lock’s Google sign-in expired. Redo the Nest Yale sign-in in Home Assistant.' : 'Lock not connected';
  else if (lock.state === 'unavailable') sub = 'The lock isn’t responding';
  else if (v.unlocked && relockIn != null) sub = 'Relocks automatically in ' + relockIn + 's';
  else if (v.unlocked) sub = 'Unlocked' + (lock.lastMethod ? ' by ' + lock.lastMethod.toLowerCase() : '');
  else sub = ['Nest x Yale', lock.battery != null ? 'Battery ' + lock.battery + '%' : null].filter(Boolean).join(' · ');

  async function press(k: string) {
    if (busy || lockedOut || !canUnlock) return;
    if (k === 'back') { setPin(pin.slice(0, -1)); setMsg(null); return; }
    if (k === 'clear') { setPin(''); setMsg(null); return; }
    const next = (pin + k).slice(0, 4);
    setMsg(null);
    if (next.length < 4) { setPin(next); return; }
    setPin(next);
    setBusy(true);
    const res = await act(adapter.unlock(next), 'Couldn’t reach the lock. Try again.');
    setBusy(false);
    setPin('');
    if (!res || res.ok) return;
    if (res.reason === 'wrong_pin') setMsg({ text: 'Wrong PIN, try again', error: true });
    else if (res.reason === 'error') setMsg({ text: res.message ?? 'Couldn’t unlock', error: true });
  }

  async function holdUnlock() {
    if (busy || !canUnlock) return;
    setMsg(null);
    setBusy(true);
    const res = await act(adapter.unlock(), 'Couldn’t reach the lock. Try again.');
    setBusy(false);
    if (res && !res.ok) setMsg({ text: res.message ?? 'Couldn’t unlock', error: true });
  }

  const dismiss = () => (route.query.has('ring') ? navigate(doorReturn.path, true) : goBack('/'));

  let status = msg;
  if (lockedOut) status = { text: 'Too many tries · wait ' + fmtCountdown((lock!.pinLockoutUntil! - t) / 1000), error: true };
  else if (busy) status = { text: 'Checking…', error: false };

  return (
    <div class="door">
      <LiveView connected={!!doorbell} canStream={!!doorbell?.streamAvailable} />


      <aside class="door-side">
        <div class="door-head">
          <span class="eyebrow door-eyebrow"><Icon name="bell" size={18} />Doorbell</span>
          <span class="door-title">{ringing ? 'Someone’s at the front door' : 'Front door'}</span>
          <span class="door-sub">
            {ringAt ? (ringing ? 'Rang at ' : 'Last rang at ') + fmtTime(new Date(ringAt)) : ringing ? 'Rang just now' : doorbell?.lastMotion ? 'Last motion ' + fmtTime(new Date(doorbell.lastMotion)) : 'No rings today'}
          </span>
        </div>

        <div class="door-lock card">
          <span class="door-lock-icon" style={{ background: v.tint, color: v.color }}><Icon name={v.icon} size={28} /></span>
          <div class="door-lock-text">
            <span class="door-lock-label" style={{ color: v.color }}>{v.label}</span>
            <span class="door-lock-sub">{sub}</span>
          </div>
        </div>

        {v.unlocked ? (
          <div class="door-unlocked">
            <button type="button" class="btn door-lock-now" onClick={() => act(adapter.lock())}><Icon name="lock" size={24} stroke={2.2} />Lock now</button>
          </div>
        ) : canUnlock && !usePin() ? (
          <div class="door-unlocked">
            <span class="door-pin-msg door-hold-msg" role="status" style={{ color: msg?.error ? 'var(--alert-text)' : 'var(--muted)' }}>
              {busy ? 'Unlocking…' : msg?.text ?? 'Relocks by itself after ' + (config.door?.relockSeconds ?? 30) + ' seconds'}
            </span>
            <HoldButton disabled={busy} onHeld={holdUnlock} />
          </div>
        ) : canUnlock ? (
          <div class="door-pin card">
            <div class="door-pin-head">
              <span class="door-pin-title">Enter PIN to unlock</span>
              <span class="door-pin-msg" role="status" style={{ color: status?.error ? 'var(--alert-text)' : 'var(--muted)' }}>{status?.text ?? ''}</span>
            </div>
            <div class="door-dots" aria-label={pin.length + ' of 4 digits entered'}>
              {[0, 1, 2, 3].map((i) => <span key={i} class="door-dot" style={{ background: i < pin.length ? 'var(--accent)' : 'transparent' }} />)}
            </div>
            <div class="door-keys">
              {KEYS.map(([label, val, aria]) => (
                <button key={val} type="button" class="btn door-key" aria-label={aria} disabled={lockedOut || busy} onClick={() => press(val)}>{label}</button>
              ))}
            </div>
          </div>
        ) : (
          <div class="door-pin card door-pin-off">
            <span>{!lock ? 'The lock isn’t connected yet.'
              : !lock.pinUnlock && lock.state === 'locked' ? 'Unlocking from the kitchen isn’t set up yet.'
              : 'The lock can’t be controlled right now.'}</span>
          </div>
        )}

        <button type="button" class="btn door-dismiss" onClick={dismiss}>Dismiss</button>
      </aside>
    </div>
  );
}

/** Unlock needs a 1-second press so a stray tap (or a curious kid) doesn't open the door. */
function HoldButton({ disabled, onHeld }: { disabled: boolean; onHeld: () => void }) {
  const [holding, setHolding] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const start = () => {
    if (disabled || timer.current) return;
    setHolding(true);
    timer.current = setTimeout(() => { timer.current = undefined; setHolding(false); onHeld(); }, HOLD_MS);
  };
  const cancel = () => { clearTimeout(timer.current); timer.current = undefined; setHolding(false); };
  useEffect(() => cancel, []);
  return (
    <button type="button" class={'btn door-hold' + (holding ? ' holding' : '')} disabled={disabled} aria-label="Hold to unlock"
      onPointerDown={start} onPointerUp={cancel} onPointerLeave={cancel} onPointerCancel={cancel} onContextMenu={(e) => e.preventDefault()}
      onKeyDown={(e) => { if ((e.key === 'Enter' || e.key === ' ') && !e.repeat) { e.preventDefault(); start(); } }}
      onKeyUp={(e) => { if (e.key === 'Enter' || e.key === ' ') cancel(); }}>
      <span class="door-hold-fill" style={{ transitionDuration: holding ? HOLD_MS + 'ms' : '150ms' }} />
      <span class="door-hold-label"><Icon name="unlock" size={26} stroke={2.2} />{holding ? 'Keep holding…' : 'Hold to unlock'}</span>
    </button>
  );
}

/** Live view stops after this long to spare the battery doorbell; "Watch again" restarts it. */
const LIVE_MS = 2 * 60e3;

type LiveState = 'placeholder' | 'connecting' | 'live' | 'stopped' | 'error';

function LiveView({ connected, canStream }: { connected: boolean; canStream: boolean }) {
  const video = useRef<HTMLVideoElement>(null);
  const [state, setState] = useState<LiveState>(canStream ? 'connecting' : 'placeholder');
  const [error, setError] = useState('');
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (!canStream) { setState('placeholder'); return; }
    let alive = true;
    let close = () => {};
    setState('connecting');
    const stop = setTimeout(() => { close(); if (alive) setState('stopped'); }, LIVE_MS);
    adapter.openCameraStream(
      (media) => {
        if (!alive) return;
        if (video.current && video.current.srcObject !== media) {
          video.current.srcObject = media;
          void video.current.play().catch(() => {});
        }
        setState('live');
      },
      (message) => { if (alive) { setError(message); setState('error'); } },
    ).then((c) => { if (alive) close = c; else c(); });
    return () => { alive = false; clearTimeout(stop); close(); };
  }, [canStream, attempt]);

  // Mock mode keeps the design's LIVE pill; live mode only shows it once video is playing.
  const pill = adapter.isMock ? connected : state === 'live';
  return (
    <section class="door-live" aria-label="Doorbell live view">
      {canStream && <video ref={video} class="door-media" muted autoplay playsinline aria-label="Front door camera" style={{ opacity: state === 'live' ? 1 : 0 }} />}
      <div class="door-live-top">
        {pill
          ? <span class="door-live-pill"><span class="dot" style={{ width: '10px', height: '10px', background: 'var(--alert)' }} />LIVE</span>
          : <span />}
        <span class="door-live-name">Front door camera</span>
      </div>
      {state !== 'live' ? (
        <div class="door-live-empty">
          <Icon name="camera" size={72} stroke={1.4} />
          <span>
            {!connected ? 'Camera not connected'
              : state === 'placeholder' ? 'Nest doorbell live stream'
              : state === 'connecting' ? 'Connecting to the doorbell…'
              : state === 'stopped' ? 'Live view paused to save the doorbell’s battery'
              : error || 'The camera didn’t answer.'}
          </span>
          {(state === 'stopped' || state === 'error') && (
            <button type="button" class="btn door-watch" onClick={() => setAttempt((n) => n + 1)}>
              <Icon name="play" size={20} />{state === 'error' ? 'Try again' : 'Watch again'}
            </button>
          )}
        </div>
      ) : <div />}
      <span class="door-live-note">Video comes through Google’s cloud, so it runs 1–3 seconds behind.</span>
    </section>
  );
}
