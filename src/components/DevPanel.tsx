// Mock-mode-only controls for testing on a laptop: ring the doorbell, force the Home
// scene, finish cook timers fast, and preview every "Not connected" state.
// Hidden with ?nodev=1 and never shown when connected to Home Assistant.
import { useState } from 'preact/hooks';
import { adapter, sceneOverride } from '../hub';
import { useStore } from '../store';
import { fastForwardTimers } from '../cookTimers';
import type { MockAdapter } from '../data/mock-adapter';
import './devpanel.css';

const SCENES: [string | null, string][] = [[null, 'Auto'], ['dropoff', 'Drop-off'], ['pickup', 'Pick-up'], ['dinner', 'Dinner']];

export function DevPanel() {
  const [open, setOpen] = useState(false);
  const scene = useStore(sceneOverride);
  useStore(adapter.state);
  const mock = adapter as MockAdapter;

  if (!open) {
    return <button type="button" class="btn dev-fab" onClick={() => setOpen(true)} aria-label="Open mock controls">Mock</button>;
  }
  return (
    <div class="dev-panel" role="dialog" aria-label="Mock controls">
      <div class="dev-head">
        <span class="eyebrow">Mock controls</span>
        <button type="button" class="btn dev-close" onClick={() => setOpen(false)} aria-label="Close">×</button>
      </div>
      <button type="button" class="btn dev-btn primary" onClick={() => { mock.ringDoorbell(); setOpen(false); }}>Ring the doorbell</button>
      <span class="dev-label">Home card</span>
      <div class="dev-seg">
        {SCENES.map(([v, label]) => (
          <button key={label} type="button" class={'btn' + (scene === v ? ' on' : '')} onClick={() => sceneOverride.set(v)}>{label}</button>
        ))}
      </div>
      <button type="button" class="btn dev-btn" onClick={fastForwardTimers}>Finish running timers in 3 s</button>
      <span class="dev-label">Vacuum</span>
      <div class="dev-row">
        <button type="button" class="btn dev-btn" onClick={() => mock.vacuumGetStuck()}>Get stuck</button>
        <button type="button" class="btn dev-btn" onClick={() => mock.vacuumToggleBin()}>{adapter.state.get().vacuum?.binFull ? 'Empty bin' : 'Bin full'}</button>
        <button type="button" class="btn dev-btn" onClick={() => mock.vacuumCycleBag()}>Dock bag: {adapter.state.get().vacuum?.bag ?? 'ok'}</button>
      </div>
      <button type="button" class="btn dev-btn" onClick={() => mock.setOffline(!mock.isOffline)}>
        {mock.isOffline ? 'Reconnect everything' : 'Show “Not connected” states'}
      </button>
      <span class="dev-note">Demo PIN is 1234. Three wrong PINs lock the pad for 5 minutes.</span>
    </div>
  );
}
