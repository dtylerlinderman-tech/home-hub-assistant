import { useState } from 'preact/hooks';
import { adapter, config } from '../hub';
import { useAsync } from '../useAsync';
import { href } from '../router';
import { Icon } from '../components/Icon';
import { addDays, fmtWeekRange, isoDate, now, sameDay, startOfWeek } from '../logic/time';
import { eventsOnDay } from '../logic/calendar';
import './calendar.css';

const DOWS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

export function Calendar() {
  const [offset, setOffset] = useState(0);
  const today = now();
  const week = addDays(startOfWeek(today), offset * 7);
  const end = addDays(week, 7);
  const key = isoDate(week);
  const [events] = useAsync(() => adapter.getEvents(week, end), [key]);
  const [plan] = useAsync(() => adapter.getMealPlan(week, end), [key]);

  return (
    <main class="screen cal">
      <header class="cal-head">
        <div class="cal-nav">
          <button type="button" class="btn cal-arrow" aria-label="Previous week" onClick={() => setOffset(offset - 1)}><Icon name="left" size={24} stroke={2.2} /></button>
          <button type="button" class="btn cal-arrow" aria-label="Next week" onClick={() => setOffset(offset + 1)}><Icon name="right" size={24} stroke={2.2} /></button>
          <div class="cal-title">
            <span class="cal-range">{fmtWeekRange(week)}</span>
            <span class="cal-sub">{events.value === null ? 'Family calendar · not connected' : 'Family calendar · synced from ' + (config.calendarSource ?? 'Google Calendar')}</span>
          </div>
          {offset !== 0 && <button type="button" class="btn cal-today" onClick={() => setOffset(0)}>Today</button>}
        </div>
        <div class="cal-legend">
          {legendPeople().map(([name, color]) => (
            <span key={name} class="cal-legend-item"><span class="dot" style={{ width: '12px', height: '12px', background: color }} />{name}</span>
          ))}
        </div>
      </header>

      <div class="cal-grid">
        {DOWS.map((dow, i) => {
          const d = addDays(week, i);
          const isToday = sameDay(d, today);
          const evs = eventsOnDay(events.value ?? [], d);
          const dinner = plan.value?.find((p) => p.date === isoDate(d));
          return (
            <section key={dow} class={'cal-day' + (isToday ? ' today' : '')} aria-label={dow + ' ' + d.getDate()}>
              <div class="cal-day-head">
                <span class="cal-dow">{dow}</span>
                <span class="cal-num">{d.getDate()}</span>
              </div>
              <div class="cal-events">
                {evs.map(({ ev, time, note }) => (
                  <div key={ev.title + ev.start.getTime()} class="cal-ev">
                    <span class="cal-ev-time tnum"><span class="dot" style={{ width: '9px', height: '9px', background: config.people[ev.person] ?? 'var(--muted)' }} />{time}</span>
                    <span class="cal-ev-title">{ev.title}</span>
                    {note && <span class="cal-ev-note">{note}</span>}
                  </div>
                ))}
                {!events.loading && events.value && evs.length === 0 && <span class="cal-none">Nothing scheduled</span>}
              </div>
              {dinner && (
                <a href={href('/meals')} class="plain cal-dinner">
                  <span class="cal-dinner-label">Dinner</span>
                  <span class="cal-dinner-name">{dinner.title}</span>
                </a>
              )}
            </section>
          );
        })}
      </div>
    </main>
  );
}

/** People with a connected calendar (all of them in mock mode or when none are configured). */
function legendPeople(): [string, string][] {
  const used = new Set(config.calendars.map((c) => c.person));
  const all = Object.entries(config.people);
  return used.size ? all.filter(([name]) => used.has(name)) : all;
}
