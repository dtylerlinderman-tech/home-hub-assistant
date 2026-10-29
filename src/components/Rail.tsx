import { Icon, type IconName } from './Icon';
import { href, type RouteName } from '../router';
import { adapter, config, enabled } from '../hub';
import { useStore } from '../store';
import './rail.css';

const ITEMS: { route: RouteName; label: string; icon: IconName; path: string }[] = [
  { route: 'home', label: 'Home', icon: 'home', path: '/' },
  { route: 'calendar', label: 'Calendar', icon: 'calendar', path: '/calendar' },
  { route: 'meals', label: 'Meals', icon: 'meals', path: '/meals' },
  { route: 'recipes', label: 'Recipes', icon: 'recipes', path: '/recipes' },
  { route: 'tasks', label: 'Tasks', icon: 'tasks', path: '/tasks' },
  { route: 'climate', label: 'Climate', icon: 'climate', path: '/climate' },
  { route: 'weather', label: 'Weather', icon: 'partly', path: '/weather' },
  { route: 'tv', label: 'TV', icon: 'tv', path: '/tv' },
  { route: 'vacuum', label: 'Vacuum', icon: 'vacuum', path: '/vacuum' },
];

export function Rail({ active }: { active: RouteName }) {
  const lock = useStore(adapter.state).lock;
  const unlocked = lock?.state === 'unlocked' || lock?.state === 'unlocking';
  const doorColor = !lock || lock.state === 'unavailable' ? 'var(--faint)' : unlocked ? 'var(--alert)' : 'var(--ok)';
  return (
    <nav class="rail" aria-label="Main">
      {ITEMS.filter((it) => (it.route !== 'tasks' || enabled('tasks')) && (it.route !== 'vacuum' || !!config.vacuum)).map((it) => (
        <a key={it.route} href={href(it.path)} class={'rail-item' + (active === it.route ? ' on' : '')} aria-current={active === it.route ? 'page' : undefined}>
          <Icon name={it.icon} size={26} />
          <span>{it.label}</span>
        </a>
      ))}
      <div class="spacer" />
      <a href={href('/door')} class="rail-item" aria-label={'Door, ' + (unlocked ? 'unlocked' : lock ? 'locked' : 'not connected')}>
        <Icon name={unlocked ? 'unlock' : 'lock'} size={26} color={doorColor} />
        <span>Door</span>
      </a>
    </nav>
  );
}
