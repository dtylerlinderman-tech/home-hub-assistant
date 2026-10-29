import { useEffect, useState } from 'preact/hooks';
import { adapter } from '../hub';
import { useStore } from '../store';
import { useAsync } from '../useAsync';
import { Icon, weatherIcon, weatherLabel } from '../components/Icon';
import { fmtTime, now, sameDay } from '../logic/time';
import type { ForecastPoint, Weather as WeatherNow } from '../data/adapter';
import './weather.css';

const REFRESH_MS = 15 * 60e3;
const DOW = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export function Weather() {
  const w = useStore(adapter.state).weather;
  const [hourly, reloadHourly] = useAsync(() => adapter.getForecast('hourly'), []);
  const [daily, reloadDaily] = useAsync(() => adapter.getForecast('daily'), []);
  useEffect(() => {
    const t = setInterval(() => { reloadHourly(); reloadDaily(); }, REFRESH_MS);
    return () => clearInterval(t);
  }, []);

  const connected = !!w || !!hourly.value?.length || !!daily.value?.length;
  return (
    <main class="screen weather">
      <header class="wx-head">
        <span class="page-title">Weather</span>
        <span class="page-sub">{connected ? 'Forecast from ' + (w?.source ?? 'Home Assistant') : 'Weather not connected'}</span>
      </header>
      <div class="wx-top">
        <NowCard w={w} />
        <section class="card wx-hourly" aria-label="Next 48 hours">
          {hourly.value?.length ? <Hourly points={hourly.value.slice(0, 48)} />
            : <div class="not-connected">{hourly.loading ? 'Loading the forecast…' : 'Hourly forecast not available'}</div>}
        </section>
      </div>
      <section class="card wx-days" aria-label="Next days">
        <span class="eyebrow">{daily.value?.length ? daily.value.length + '-day forecast' : 'Forecast'}</span>
        {daily.value?.length ? <Daily days={daily.value} />
          : <div class="not-connected">{daily.loading ? 'Loading…' : 'Daily forecast not available'}</div>}
      </section>
    </main>
  );
}

function NowCard({ w }: { w: WeatherNow | null }) {
  if (!w) return <section class="card wx-now"><div class="not-connected">Current weather not connected</div></section>;
  const uvWord = w.uv == null ? null : w.uv < 3 ? 'Low' : w.uv < 6 ? 'Moderate' : w.uv < 8 ? 'High' : 'Very high';
  // Whichever comes first: the next sunset, or (after dark) the next sunrise.
  const sunsetFirst = w.sunset != null && (w.sunrise == null || w.sunset < w.sunrise);
  const sunAt = sunsetFirst ? w.sunset : w.sunrise;
  const stats: [string, string | null][] = [
    ['Humidity', w.humidity != null ? Math.round(w.humidity) + '%' : null],
    ['Wind', w.wind != null ? Math.round(w.wind) + ' mph' : null],
    ['UV index', w.uv != null ? Math.round(w.uv) + ' · ' + uvWord : null],
    [sunsetFirst ? 'Sunset' : 'Sunrise', sunAt != null ? fmtTime(new Date(sunAt)) : null],
  ];
  return (
    <section class="card wx-now" aria-label="Right now">
      <span class="eyebrow">Right now</span>
      <div class="wx-now-main">
        <Icon name={weatherIcon(w.condition)} size={72} stroke={1.6} color="var(--accent)" />
        <div class="wx-now-text">
          <span class="wx-now-temp tnum">{Math.round(w.temp)}°</span>
          <span class="wx-now-cond">{weatherLabel(w.condition)}</span>
        </div>
      </div>
      {w.high != null && w.low != null && <span class="wx-now-hl">High {Math.round(w.high)}° · Low {Math.round(w.low)}°</span>}
      <div class="spacer" />
      <dl class="wx-stats">
        {stats.filter(([, v]) => v).map(([k, v]) => (
          <div key={k} class="wx-stat"><dt>{k}</dt><dd>{v}</dd></div>
        ))}
      </dl>
    </section>
  );
}

// Hourly chart geometry. Temperature and rain are two rows on one time axis, never a second y-scale.
const COL = 58;
const TEMP_TOP = 26; // room for value labels above the line
const TEMP_H = 84;
const RAIN_TOP = TEMP_TOP + TEMP_H + 34; // rain label row, then bars
const RAIN_H = 38;
const CHART_H = RAIN_TOP + RAIN_H + 2;
const HEAD_H = 64; // time + icon above the chart

function hourLabel(t: number, i: number): string {
  if (i === 0) return 'Now';
  const d = new Date(t);
  if (d.getHours() === 0) return DOW[d.getDay()];
  const h = d.getHours() % 12 || 12;
  return h + (d.getHours() < 12 ? ' AM' : ' PM');
}

function rainText(p: ForecastPoint): string | null {
  if (p.precipChance != null) return p.precipChance > 0 ? Math.round(p.precipChance) + '%' : null;
  if (p.precip != null && p.precip > 0) return p.precip < 0.01 ? '<0.01"' : p.precip.toFixed(2) + '"';
  return null;
}

function Hourly({ points }: { points: ForecastPoint[] }) {
  const [sel, setSel] = useState(0);
  const cur = points[Math.min(sel, points.length - 1)];
  const temps = points.map((p) => p.temp);
  const hi = Math.max(...temps), lo = Math.min(...temps);
  const y = (t: number) => TEMP_TOP + ((hi - t) / (hi - lo || 1)) * TEMP_H;
  const x = (i: number) => i * COL + COL / 2;
  const line = points.map((p, i) => (i ? 'L' : 'M') + x(i) + ' ' + y(p.temp).toFixed(1)).join(' ');
  const area = line + ` L${x(points.length - 1)} ${TEMP_TOP + TEMP_H + 6} L${x(0)} ${TEMP_TOP + TEMP_H + 6} Z`;

  // Rain: chance (%) when the source gives it, otherwise amount (in). Label only the peak of each wet stretch.
  const byChance = points.some((p) => p.precipChance != null);
  const rain = points.map((p) => (byChance ? p.precipChance ?? 0 : p.precip ?? 0));
  const rainMax = byChance ? 100 : Math.max(0.1, ...rain);
  const peaks = new Set<number>();
  for (let i = 0; i < rain.length; i++) {
    if (rain[i] <= 0) continue;
    let j = i, best = i;
    while (j < rain.length && rain[j] > 0) { if (rain[j] > rain[best]) best = j; j++; }
    peaks.add(best);
    i = j;
  }
  const labelAt = (i: number) => i % 3 === 0 || temps[i] === hi || temps[i] === lo;
  const wet = rain.some((v) => v > 0);

  const detail = [
    cur ? Math.round(cur.temp) + '°' : null,
    cur ? weatherLabel(cur.condition) : null,
    cur && rainText(cur) ? (byChance ? rainText(cur) + ' chance of rain' : rainText(cur) + ' rain') : null,
    cur?.wind != null ? 'Wind ' + Math.round(cur.wind) + ' mph' : null,
  ].filter(Boolean).join(' · ');

  return (
    <>
      <div class="wx-hourly-head">
        <span class="eyebrow">Next {points.length} hours</span>
        <span class="wx-hourly-detail"><b>{hourLabel(cur.time, sel)}</b> · {detail}</span>
      </div>
      <div class="wx-hours" role="group" aria-label="Hourly forecast. Tap an hour for details">
        <div class="wx-hours-inner" style={{ width: points.length * COL + 'px' }}>
          <svg class="wx-chart" width={points.length * COL} height={CHART_H} style={{ top: HEAD_H + 'px' }} aria-hidden="true">
            <defs>
              <linearGradient id="wx-temp-fill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0" stop-color="var(--accent)" stop-opacity="0.28" />
                <stop offset="1" stop-color="var(--accent)" stop-opacity="0" />
              </linearGradient>
            </defs>
            {points.map((p, i) => new Date(p.time).getHours() === 0 && i > 0 && (
              <line key={'d' + i} x1={i * COL} x2={i * COL} y1={0} y2={CHART_H} class="wx-midnight" />
            ))}
            <path d={area} fill="url(#wx-temp-fill)" />
            <path d={line} class="wx-temp-line" />
            {points.map((p, i) => labelAt(i) && (
              <text key={'t' + i} x={x(i)} y={y(p.temp) - 10} class="wx-temp-label">{Math.round(p.temp)}°</text>
            ))}
            <circle cx={x(sel)} cy={y(cur.temp)} r={5} class="wx-temp-dot" />
            <line x1={0} x2={points.length * COL} y1={RAIN_TOP + RAIN_H} y2={RAIN_TOP + RAIN_H} class="wx-baseline" />
            {rain.map((v, i) => v > 0 && (
              <rect key={'r' + i} x={x(i) - 11} width={22} rx={4}
                y={RAIN_TOP + RAIN_H - Math.max(3, (v / rainMax) * RAIN_H)} height={Math.max(3, (v / rainMax) * RAIN_H)} class="wx-rain-bar" />
            ))}
            {[...peaks].map((i) => (
              <text key={'p' + i} x={x(i)} y={RAIN_TOP + RAIN_H - Math.max(3, (rain[i] / rainMax) * RAIN_H) - 6} class="wx-rain-label">{rainText(points[i])}</text>
            ))}
            {!wet && <text x={8} y={RAIN_TOP + RAIN_H - 8} class="wx-rain-none">No rain expected</text>}
          </svg>
          {points.map((p, i) => (
            <button key={p.time} type="button" class="btn wx-hour" aria-pressed={i === sel} style={{ width: COL + 'px', height: HEAD_H + CHART_H + 'px' }}
              aria-label={`${hourLabel(p.time, i)}: ${Math.round(p.temp)}°, ${weatherLabel(p.condition)}`} onClick={() => setSel(i)}>
              <span class="wx-hour-time">{hourLabel(p.time, i)}</span>
              <Icon name={weatherIcon(p.condition)} size={24} stroke={1.9} />
            </button>
          ))}
        </div>
      </div>
      <span class="wx-rain-key">{byChance ? 'Bars: chance of rain' : 'Bars: rain in inches'}</span>
    </>
  );
}

function Daily({ days }: { days: ForecastPoint[] }) {
  const today = now();
  const lows = days.map((d) => d.low ?? d.temp);
  const min = Math.min(...lows), max = Math.max(...days.map((d) => d.temp));
  const pct = (t: number) => ((t - min) / (max - min || 1)) * 100;
  return (
    <div class="wx-day-list">
      {days.map((d, i) => {
        const date = new Date(d.time);
        const low = lows[i];
        const rain = rainText(d);
        return (
          <div key={d.time} class="wx-day">
            <span class="wx-day-name">{sameDay(date, today) ? 'Today' : DOW[date.getDay()]}</span>
            <Icon name={weatherIcon(d.condition)} size={26} stroke={1.9} color="var(--text-soft)" />
            <span class="wx-day-cond">{weatherLabel(d.condition)}</span>
            <span class="wx-day-rain">{rain ? <><Icon name="rain" size={16} stroke={2} />{rain}</> : null}</span>
            <span class="wx-day-lo tnum">{Math.round(low)}°</span>
            <span class="wx-range" aria-hidden="true">
              <span style={{ left: pct(low) + '%', width: Math.max(2, pct(d.temp) - pct(low)) + '%' }} />
            </span>
            <span class="wx-day-hi tnum">{Math.round(d.temp)}°</span>
          </div>
        );
      })}
    </div>
  );
}
