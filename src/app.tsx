// Shell: router, left rail, doorbell takeover, timer alerts and toasts.
import { useEffect, useRef } from 'preact/hooks';
import { adapter, config } from './hub';
import { doorReturn, navigate, parseHash, useRoute } from './router';
import { useStore } from './store';
import { Rail } from './components/Rail';
import { Overlays } from './components/Overlays';
import { DevPanel } from './components/DevPanel';
import { ErrorBoundary } from './components/ErrorBoundary';
import { Home } from './screens/Home';
import { Door } from './screens/Door';
import { Cook } from './screens/Cook';
import { Meals } from './screens/Meals';
import { Groceries } from './screens/Groceries';
import { Recipes } from './screens/Recipes';
import { Calendar } from './screens/Calendar';
import { Climate } from './screens/Climate';
import { Tasks } from './screens/Tasks';
import { TV } from './screens/TV';
import { Weather } from './screens/Weather';
import { Vacuum } from './screens/Vacuum';
import { params } from './hub';
import { nowMs } from './logic/time';

/** A ring older than this (e.g. from before the page loaded) doesn't take over the screen. */
const RING_FRESH_MS = 90_000;

function useDoorbellTakeover(): void {
  const state = useStore(adapter.state);
  const lastRing = state.doorbell?.lastRing ?? null;
  const seen = useRef(lastRing);
  useEffect(() => {
    if (lastRing == null || lastRing === seen.current) return;
    seen.current = lastRing;
    // The first state after connecting carries the last ring, however old: only take over for fresh rings.
    if (nowMs() - lastRing > RING_FRESH_MS) return;
    const cur = parseHash();
    if (cur.name !== 'door') doorReturn.path = cur.path + (cur.query.toString() ? '?' + cur.query : '');
    navigate('/door?ring=' + lastRing);
  }, [lastRing]);
}

export function App() {
  const route = useRoute();
  useDoorbellTakeover();

  let body;
  switch (route.name) {
    case 'door': body = <ErrorBoundary resetKey={route.path}><Door route={route} /></ErrorBoundary>; break;
    case 'cook': body = <ErrorBoundary resetKey={route.path}><Cook route={route} /></ErrorBoundary>; break;
    default: {
      const Screen = { home: Home, calendar: Calendar, meals: Meals, groceries: Groceries, recipes: Recipes, tasks: Tasks, climate: Climate, weather: Weather, tv: TV, vacuum: Vacuum }[route.name];
      body = (
        <>
          <Rail active={route.name} />
          <ErrorBoundary resetKey={route.path}><Screen /></ErrorBoundary>
        </>
      );
    }
  }

  return (
    <div class={'shell' + (config.background ? ' has-photo' : '')}>
      {config.background && (
        <>
          <div class="photo-bg" style={{ backgroundImage: `url("${config.background}")` }} aria-hidden="true" />
          <div class="photo-shade" aria-hidden="true" />
        </>
      )}
      {body}
      <Overlays />
      {adapter.isMock && !params.has('nodev') && <DevPanel />}
    </div>
  );
}
