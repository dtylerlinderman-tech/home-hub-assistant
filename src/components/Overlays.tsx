// Full-screen timer alert, the photo frame and the toast line. All sit above every screen.
import { useStore } from '../store';
import { adapter, toast } from '../hub';
import { dismissFinished, finished } from '../cookTimers';
import { navigate, parseHash } from '../router';
import { Icon } from './Icon';
import { PhotoIdle } from './PhotoIdle';
import './overlays.css';

function TimerAlert() {
  const done = useStore(finished);
  if (!done.length) return null;
  const first = done[0];
  const more = done.length - 1;
  const goToStep = () => {
    dismissFinished();
    const r = parseHash();
    if (r.name !== 'cook' || r.param !== first.recipeId) navigate('/cook/' + encodeURIComponent(first.recipeId) + '?step=' + (first.step + 1));
  };
  return (
    <div class="timer-alert" role="alertdialog" aria-modal="true" aria-labelledby="timer-alert-title">
      <div class="timer-alert-card">
        <span class="timer-alert-ring"><Icon name="timer" size={64} color="var(--on-accent)" /></span>
        <span class="eyebrow" style={{ color: 'var(--accent)' }}>Timer done</span>
        <span id="timer-alert-title" class="timer-alert-title">{first.label} is done</span>
        <span class="timer-alert-sub">
          {first.recipeName} · Step {first.step + 1}{more > 0 ? ' · ' + more + ' more finished' : ''}
        </span>
        <div class="timer-alert-actions">
          <button type="button" class="btn timer-alert-secondary" onClick={goToStep}>Go to step</button>
          <button type="button" class="btn timer-alert-primary" onClick={dismissFinished}>Stop alarm</button>
        </div>
      </div>
    </div>
  );
}

function Toast() {
  const t = useStore(toast);
  if (!t) return null;
  return <div key={t.id} class={'toast' + (t.error ? ' error' : '')} role="status">{t.text}</div>;
}

/** Small pill at the top while connecting to Home Assistant or after losing the connection. */
function ConnectionBanner() {
  const status = useStore(adapter.state).connection;
  if (status === 'mock' || status === 'connected') return null;
  return (
    <div class={'conn-banner' + (status === 'disconnected' ? ' lost' : '')} role="status">
      <span class="dot" style={{ width: '8px', height: '8px', background: status === 'disconnected' ? 'var(--alert)' : 'var(--accent)' }} />
      {status === 'disconnected' ? 'Lost connection to Home Assistant · reconnecting…' : 'Connecting to Home Assistant…'}
    </div>
  );
}

export function Overlays() {
  return (
    <>
      <ConnectionBanner />
      <Toast />
      <PhotoIdle />
      <TimerAlert />
    </>
  );
}
