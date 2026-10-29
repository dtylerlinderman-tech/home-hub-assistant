import { useEffect, useRef, useState } from 'preact/hooks';
import { act, adapter, config } from '../hub';
import { useStore } from '../store';
import { Icon, weatherLabel } from '../components/Icon';
import type { FanMode, HvacMode, Thermostat } from '../data/adapter';
import './climate.css';

const MODES: [HvacMode, string][] = [['heat', 'Heat'], ['cool', 'Cool'], ['heat_cool', 'Auto'], ['off', 'Off']];
const FANS: [FanMode, string][] = [['auto', 'Auto'], ['on', 'On']];
const DEBOUNCE_MS = 800;
const COUNT = ['No', 'One', 'Two', 'Three', 'Four', 'Five'];

const cap = (s: string) => s[0].toUpperCase() + s.slice(1);

export function Climate() {
  const { climate, weather } = useStore(adapter.state);
  const presets = config.climatePresets;
  const live = climate.filter((z) => z.available);
  const shared = live.length && live.every((z) => z.preset === live[0].preset) ? live[0].preset : null;
  const outside = weather ? 'Outside ' + Math.round(weather.temp) + '° · ' + weatherLabel(weather.condition) + ' · ' : '';
  const n = climate.length;

  return (
    <main class="screen climate">
      <header class="climate-head">
        <div class="climate-title">
          <span class="page-title">Climate</span>
          <span class="page-sub">{outside}{(COUNT[n] ?? n) + ' ecobee thermostat' + (n === 1 ? '' : 's')}</span>
        </div>
        <div role="group" aria-label="Comfort setting for the whole house" class="climate-presets">
          <span class="climate-presets-label">Whole house</span>
          {presets.map((p) => (
            <button key={p} type="button" class={'btn climate-preset' + (shared === p ? ' on' : '')} aria-pressed={shared === p} disabled={!live.length}
              onClick={() => act(adapter.setPresetAll(p))}>{cap(p)}</button>
          ))}
        </div>
      </header>
      <div class="climate-grid">
        {climate.map((z) => <Zone key={z.entity} z={z} />)}
      </div>
    </main>
  );
}

type Pending = { target?: number; low?: number; high?: number };

function Zone({ z }: { z: Thermostat }) {
  const [pending, setPending] = useState<Pending | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  useEffect(() => () => clearTimeout(timer.current), []);

  if (!z.available) {
    return (
      <section class="card climate-zone" aria-label={z.name + ' thermostat'}>
        <span class="climate-name">{z.name}</span>
        <div class="not-connected">Thermostat not connected</div>
      </section>
    );
  }

  const off = z.mode === 'off';
  const auto = z.mode === 'heat_cool';
  const target = pending?.target ?? z.target;
  const low = pending?.low ?? z.low;
  const high = pending?.high ?? z.high;

  function nudge(delta: number) {
    if (off) return;
    let next: Pending;
    if (auto && low != null && high != null) {
      const d = Math.max(z.minTemp - low, Math.min(z.maxTemp - high, delta));
      next = { low: low + d, high: high + d };
    } else {
      next = { target: Math.max(z.minTemp, Math.min(z.maxTemp, (target ?? 72) + delta)) };
    }
    setPending(next);
    clearTimeout(timer.current);
    timer.current = setTimeout(async () => {
      await act(adapter.setTemperature(z.entity, next), 'Couldn’t change the ' + z.name.toLowerCase() + ' temperature.');
      setPending(null);
    }, DEBOUNCE_MS);
  }

  let status = 'Idle';
  let statusBg = 'var(--raised)';
  let statusFg = 'var(--text-soft)';
  if (off) status = 'Off';
  else if (z.action === 'cooling') { status = 'Cooling to ' + (auto ? high : target) + '°'; statusBg = 'var(--cool-tint)'; statusFg = 'var(--cool)'; }
  else if (z.action === 'heating') { status = 'Heating to ' + (auto ? low : target) + '°'; statusBg = 'var(--alert-tint)'; statusFg = 'var(--alert-text)'; }

  const setText = off ? 'Off' : auto ? low + '–' + high + '°' : target + '°';

  return (
    <section class="card climate-zone" aria-label={z.name + ' thermostat'}>
      <div class="climate-zone-head">
        <span class="climate-name">{z.name}</span>
        <span class="climate-status" style={{ background: statusBg, color: statusFg }}>
          <span class="dot" style={{ width: '9px', height: '9px', background: statusFg }} />{status}
        </span>
      </div>

      <div class="climate-temps">
        <div class="climate-now">
          <span class="climate-now-label">Inside now</span>
          <span class="climate-now-temp tnum">{Math.round(z.current)}°</span>
          {z.humidity != null && <span class="climate-humidity">Humidity {Math.round(z.humidity)}%</span>}
        </div>
        <div class="climate-stepper">
          <button type="button" class="btn climate-step" aria-label={'Lower ' + z.name + ' temperature'} disabled={off} onClick={() => nudge(-1)} style={{ color: 'var(--blue)' }}>
            <Icon name="minus" size={30} stroke={2.6} />
          </button>
          <div class="climate-set">
            <span class="climate-set-label">{off ? 'System' : 'Set to'}</span>
            <span class={'climate-set-val tnum' + (auto && !off ? ' range' : '')} style={{ color: off ? 'var(--subtle)' : 'var(--text)' }}>{setText}</span>
          </div>
          <button type="button" class="btn climate-step" aria-label={'Raise ' + z.name + ' temperature'} disabled={off} onClick={() => nudge(1)} style={{ color: 'var(--alert-text)' }}>
            <Icon name="plus" size={30} stroke={2.6} />
          </button>
        </div>
      </div>

      <div class="spacer" />

      <div class="climate-mode">
        <span class="climate-mode-label">Mode</span>
        <div role="group" aria-label={z.name + ' mode'} class="seg climate-modes">
          {MODES.map(([m, label]) => (
            <button key={m} type="button" class="btn" aria-pressed={z.mode === m} onClick={() => act(adapter.setHvacMode(z.entity, m))}>{label}</button>
          ))}
        </div>
      </div>

      <div class="climate-fan">
        <span class="climate-fan-label">Fan</span>
        <div role="group" aria-label={z.name + ' fan'} class="seg climate-fans">
          {FANS.map(([f, label]) => (
            <button key={f} type="button" class="btn" aria-pressed={z.fan === f} onClick={() => act(adapter.setFanMode(z.entity, f))}>{label}</button>
          ))}
        </div>
      </div>
    </section>
  );
}
