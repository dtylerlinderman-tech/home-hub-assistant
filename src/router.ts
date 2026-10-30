// Hash router: #/meals, #/cook/<id>?step=4. Hash routes work from a static file
// (/local/kitchen/index.html) with no server rewrites.
import { useEffect, useState } from 'preact/hooks';

export type RouteName = 'home' | 'calendar' | 'meals' | 'groceries' | 'recipes' | 'tasks' | 'climate' | 'weather' | 'tv' | 'vacuum' | 'door' | 'cook';

export interface Route {
  name: RouteName;
  param: string | null;
  query: URLSearchParams;
  path: string;
}

const NAMES: RouteName[] = ['home', 'calendar', 'meals', 'groceries', 'recipes', 'tasks', 'climate', 'weather', 'tv', 'vacuum', 'door', 'cook'];

export function parseHash(hash = location.hash): Route {
  const raw = hash.replace(/^#\/?/, '');
  const [pathPart, qs = ''] = raw.split('?');
  const [first = '', param = null] = pathPart.split('/');
  const name = (NAMES as string[]).includes(first) ? (first as RouteName) : 'home';
  return { name, param: param ? decodeURIComponent(param) : null, query: new URLSearchParams(qs), path: '/' + pathPart };
}

let depth = 0; // in-app history depth, so Back never leaves the app

export function navigate(path: string, replace = false): void {
  const hash = '#' + (path.startsWith('/') ? path : '/' + path);
  if (location.hash === hash) return;
  if (replace) history.replaceState(null, '', hash);
  else { history.pushState(null, '', hash); depth++; }
  window.dispatchEvent(new HashChangeEvent('hashchange'));
}

/** Go back within the app, or to `fallback` if this is the first screen. */
export function goBack(fallback = '/'): void {
  if (depth > 0) { depth--; history.back(); } else navigate(fallback, true);
}

export function useRoute(): Route {
  const [route, setRoute] = useState(parseHash);
  useEffect(() => {
    const on = () => setRoute(parseHash());
    window.addEventListener('hashchange', on);
    window.addEventListener('popstate', on);
    return () => { window.removeEventListener('hashchange', on); window.removeEventListener('popstate', on); };
  }, []);
  return route;
}

export const href = (path: string) => '#' + path;

/** Where Dismiss on the Door screen returns to after a doorbell takeover. */
export const doorReturn = { path: '/' };
