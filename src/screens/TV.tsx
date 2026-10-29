import { useState } from 'preact/hooks';
import { act, adapter } from '../hub';
import { useStore } from '../store';
import { Icon } from '../components/Icon';
import './tv.css';

/** What's on, and Play/Pause. The TV itself is turned on and changed with its own remote. */
export function TV() {
  const tvs = useStore(adapter.state).tvs;
  const [sel, setSel] = useState(() => Math.max(0, tvs.findIndex((t) => t.on)));
  const cur = tvs[sel] ?? tvs[0];
  if (!cur) return <main class="screen tv"><div class="not-connected">No TVs configured</div></main>;

  const on = cur.available && cur.on;
  const what = cur.title ?? cur.channel ?? cur.app ?? 'On';
  const sub = [cur.title !== cur.channel ? cur.channel : null, cur.app].filter(Boolean).join(' · ');
  const playPause = () => act(adapter.tvCommand(sel, 'play_pause'), 'The ' + cur.name.toLowerCase() + ' TV didn’t respond.');

  return (
    <main class="screen tv">
      <header class="tv-head">
        <span class="page-title">TV</span>
        {tvs.length > 1 && (
          <div role="group" aria-label="Choose TV" class="seg tv-pick">
            {tvs.map((t, i) => (
              <button key={t.name} type="button" class="btn" aria-pressed={i === sel} onClick={() => setSel(i)}>
                <span class="dot" style={{ width: '9px', height: '9px', background: t.available && t.on ? 'var(--ok)' : 'var(--faint)' }} />{t.name}
              </button>
            ))}
          </div>
        )}
      </header>

      <section class="card tv-now" aria-label="Now playing">
        <span class="eyebrow">Now playing · {cur.name}</span>

        {!cur.available ? (
          <div class="tv-off">
            <Icon name="tv" size={56} stroke={1.6} />
            <span class="tv-off-title">{cur.name} TV isn’t connected</span>
            <span>Check that the TV and its Chromecast are plugged in.</span>
          </div>
        ) : on ? (
          <>
            <div class="tv-np">
              <span class="tv-art">{cur.artwork ? <img src={cur.artwork} alt="" /> : cur.channel ?? cur.app ?? what}</span>
              <div class="tv-np-text">
                <span class="tv-status">
                  <span class="dot" style={{ width: '8px', height: '8px', background: cur.paused ? 'var(--muted)' : 'var(--alert)' }} />
                  {cur.paused ? 'Paused' : cur.live ? 'Live' : 'Playing'}
                </span>
                <span class="tv-title">{what}</span>
                {sub && <span class="tv-sub">{sub}</span>}
              </div>
            </div>
            <div class="spacer" />
            <button type="button" class="btn tv-play" onClick={playPause}>
              {cur.paused ? 'Play' : 'Pause'}
            </button>
          </>
        ) : (
          <div class="tv-off">
            <Icon name="tv" size={56} stroke={1.6} />
            <span class="tv-off-title">{cur.name} TV is off</span>
            <span>Turn it on with its remote and what’s playing shows up here.</span>
          </div>
        )}
      </section>
    </main>
  );
}
