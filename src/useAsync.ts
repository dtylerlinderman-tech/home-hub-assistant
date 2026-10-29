import { useEffect, useState } from 'preact/hooks';
import { adapter } from './hub';
import { useStore } from './store';

export type Async<T> = { loading: true; value: undefined } | { loading: false; value: T };

/**
 * Run an async read; re-runs when deps change, and again whenever the Home Assistant
 * connection comes (back) up, so a screen opened while offline fills in by itself.
 * `reload` refetches without changing deps.
 */
export function useAsync<T>(fn: () => Promise<T>, deps: unknown[]): [Async<T>, () => void] {
  const [state, setState] = useState<Async<T>>({ loading: true, value: undefined });
  const [n, setN] = useState(0);
  const online = useStore(adapter.state).connection !== 'disconnected';
  useEffect(() => {
    let live = true;
    fn().then(
      (value) => { if (live) setState({ loading: false, value }); },
      (e) => { console.error(e); if (live) setState({ loading: false, value: null as T }); },
    );
    return () => { live = false; };
  }, [...deps, n, online]);
  return [state, () => setN((x) => x + 1)];
}
