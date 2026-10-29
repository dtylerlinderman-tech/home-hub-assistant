import { render } from 'preact';
import './styles/fonts.css';
import './styles/tokens.css';
import { loadConfig } from './config';
import { initHub, params } from './hub';
import { setNowOverride } from './logic/time';
import { MockAdapter } from './data/mock-adapter';
import { HaAdapter } from './data/ha-adapter';
import { unlockAudioOnFirstTap } from './sound';
import { App } from './app';
import { fitToScreen } from './fit';

async function boot() {
  setNowOverride(params.get('now'));
  const cfg = await loadConfig(params.get('mock') === '1');
  const useMock = params.get('mock') === '1' || !cfg.haUrl;
  const adapter = useMock ? new MockAdapter(cfg) : new HaAdapter(cfg);
  initHub(cfg, adapter);
  unlockAudioOnFirstTap();
  fitToScreen();
  // Render right away; HaAdapter fills in live data as it connects (and may redirect to the HA login).
  render(<App />, document.getElementById('app')!);
  try {
    await adapter.start();
  } catch (e) {
    console.error('Could not connect to Home Assistant', e);
  }
}

void boot();
