// Photo frame: after a few minutes without a touch, show the background photo full screen and sharp,
// with the time and weather in a corner. A tap brings the dashboard back (and only wakes it).
// In Fully Kiosk, camera motion brings it back too and holds it off (needs Fully's JavaScript interface).
import { useEffect, useState } from 'preact/hooks';
import { adapter, config, params } from '../hub';
import { useRoute } from '../router';
import { useStore, useTick } from '../store';
import { clockParts, fmtLongDate, now } from '../logic/time';
import { Icon, weatherIcon } from './Icon';

/** ?idle=10 shortens the wait to 10 seconds, for testing. Read at use: config loads after this module. */
const idleMs = () => (params.has('idle') ? Number(params.get('idle')) * 1000 : (config.idleMinutes ?? 3) * 60e3);

/** Fully Kiosk's JavaScript interface (Advanced web settings → Enable JavaScript interface). */
declare global {
  interface Window { fully?: { bind(event: string, code: string): void } }
}

/** Fired on window for Fully's camera motion; dispatch it by hand to test. */
export const MOTION_EVENT = 'kitchenhub-motion';

export function PhotoIdle() {
  const route = useRoute();
  const [idle, setIdle] = useState(false);

  useEffect(() => {
    const ms = idleMs();
    let t = setTimeout(() => setIdle(true), ms);
    const wake = () => { clearTimeout(t); t = setTimeout(() => setIdle(true), ms); };
    const motion = () => { setIdle(false); wake(); };
    const opts = { capture: true, passive: true };
    window.addEventListener('pointerdown', wake, opts);
    window.addEventListener('keydown', wake, opts);
    window.addEventListener(MOTION_EVENT, motion);
    try {
      window.fully?.bind('onMotion', `window.dispatchEvent(new Event('${MOTION_EVENT}'))`);
    } catch (e) {
      console.warn('Fully motion binding failed', e);
    }
    return () => {
      clearTimeout(t);
      window.removeEventListener('pointerdown', wake, opts);
      window.removeEventListener('keydown', wake, opts);
      window.removeEventListener(MOTION_EVENT, motion);
    };
  }, []);

  // Cooking and the doorbell need the real screen.
  if (!idle || !config.background || route.name === 'cook' || route.name === 'door') return null;
  return <Frame src={config.background} onWake={() => setIdle(false)} />;
}

function Frame({ src, onWake }: { src: string; onWake: () => void }) {
  useTick(10e3);
  const w = useStore(adapter.state).weather;
  const d = now();
  const { time, ampm } = clockParts(d);
  return (
    // onClick (not pointerdown) so the whole tap lands here and doesn't press anything underneath.
    <div class="photo-idle" role="button" tabIndex={0} aria-label="Photo frame. Tap to show the dashboard" onClick={onWake}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') onWake(); }}>
      <img class="photo-idle-img" src={src} alt="" />
      <div class="photo-idle-info">
        <span class="photo-idle-time tnum">{time}<span class="photo-idle-ampm">{ampm}</span></span>
        <span class="photo-idle-date">
          {fmtLongDate(d)}
          {w && <><Icon name={weatherIcon(w.condition)} size={26} stroke={2} />{Math.round(w.temp)}°</>}
        </span>
      </div>
    </div>
  );
}
