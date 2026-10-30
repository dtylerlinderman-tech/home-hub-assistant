// Inline stroke icons, copied from the design files.
import type { CSSProperties, JSX } from 'preact';

const P: Record<string, JSX.Element> = {
  home: <path d="M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z" />,
  calendar: <><rect x="3" y="5" width="18" height="16" rx="2" /><path d="M3 10h18M8 3v4M16 3v4" /></>,
  meals: <path d="M5 3v6a2 2 0 0 0 4 0V3M7 11v10M17 21V3c-2.2 0-3.5 2.5-3.5 6v4H17" />,
  recipes: <><path d="M4 5a2 2 0 0 1 2-2h13v16H6a2 2 0 0 0-2 2z" /><path d="M4 21V5M8 7h7" /></>,
  tasks: <><rect x="4" y="3" width="16" height="18" rx="2" /><path d="m8 9 2 2 4-4M8 16h8" /></>,
  climate: <><path d="M14 14.8V5a2 2 0 0 0-4 0v9.8a4 4 0 1 0 4 0z" /><path d="M12 9v8" /></>,
  tv: <><rect x="2" y="5" width="20" height="13" rx="2" /><path d="M8 21h8M12 18v3" /></>,
  vacuum: <><circle cx="12" cy="12" r="9" /><path d="M5.6 8.5h12.8" /><circle cx="12" cy="14.5" r="2.2" /></>,
  lock: <><rect x="5" y="11" width="14" height="10" rx="2" /><path d="M8 11V7a4 4 0 0 1 8 0v4" /></>,
  unlock: <><rect x="5" y="11" width="14" height="10" rx="2" /><path d="M8 11V7a4 4 0 0 1 7.5-2" /></>,
  camera: <><rect x="3" y="6" width="13" height="12" rx="2" /><path d="m16 10 5-3v10l-5-3z" /></>,
  bell: <><path d="M6 16V11a6 6 0 0 1 12 0v5l2 2H4z" /><path d="M10 21h4" /></>,
  right: <path d="m9 18 6-6-6-6" />,
  left: <path d="m15 18-6-6 6-6" />,
  down: <path d="m6 9 6 6 6-6" />,
  up: <path d="m18 15-6-6-6 6" />,
  check: <path d="m5 12 5 5 9-10" />,
  timer: <><circle cx="12" cy="13" r="8" /><path d="M12 9v4l2.5 2.5M9 2h6" /></>,
  cart: <><path d="M3 4h2l2.5 11h11L21 7H6.2" /><circle cx="9" cy="19" r="1.5" /><circle cx="17" cy="19" r="1.5" /></>,
  shuffle: <path d="M3 7h3c4 0 6 10 10 10h5M3 17h3c1.5 0 2.7-1.4 3.8-3.2M14.2 10.2C15.3 8.4 16.5 7 18 7h3M18 4l3 3-3 3M18 14l3 3-3 3" />,
  swap: <path d="M20 11a8 8 0 0 0-14.9-4M4 4v4h4M4 13a8 8 0 0 0 14.9 4M20 20v-4h-4" />,
  search: <><circle cx="11" cy="11" r="7" /><path d="m20 20-4-4" /></>,
  plus: <path d="M12 5v14M5 12h14" />,
  package: <><path d="M21 8 12 3 3 8v8l9 5 9-5z" /><path d="m3 8 9 5 9-5M12 13v8M7.5 5.5l9 5" /></>,
  mail: <><rect x="3" y="5" width="18" height="14" rx="2" /><path d="m3.5 6.5 8.5 6.5 8.5-6.5" /></>,
  minus: <path d="M5 12h14" />,
  link: <path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1" />,
  power: <path d="M12 3v9M6.4 6.4a8 8 0 1 0 11.2 0" />,
  sun: <><circle cx="12" cy="12" r="4" /><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" /></>,
  // Weather icons beyond the design's sun, drawn in the same style.
  moon: <path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5z" />,
  cloud: <path d="M7 18a4 4 0 0 1-.6-8A6 6 0 0 1 18 9.5 4.3 4.3 0 0 1 17.5 18z" />,
  partly: <><path d="M8 2.5v1.5M3.4 4.4l1 1M2 9h1.5M12.6 4.4l-1 1" /><path d="M5.3 11.3a3.5 3.5 0 1 1 6-3.3" /><path d="M9 20a3.5 3.5 0 0 1-.5-7A5 5 0 0 1 18 12.5a3.8 3.8 0 0 1-.5 7.5z" /></>,
  rain: <><path d="M7 15a4 4 0 0 1-.6-8A6 6 0 0 1 18 6.5 4.3 4.3 0 0 1 17.5 15z" /><path d="M8 18l-1 3M12 18l-1 3M16 18l-1 3" /></>,
  snow: <><path d="M7 15a4 4 0 0 1-.6-8A6 6 0 0 1 18 6.5 4.3 4.3 0 0 1 17.5 15z" /><path d="M8 19h.01M12 21h.01M16 19h.01M10 17h.01M14 17h.01" /></>,
  storm: <><path d="M7 15a4 4 0 0 1-.6-8A6 6 0 0 1 18 6.5 4.3 4.3 0 0 1 17.5 15z" /><path d="m12 14-2 4h4l-2 4" /></>,
  fog: <path d="M4 9h16M4 13h16M6 17h12" />,
};

const FILLED: Record<string, JSX.Element> = {
  play: <path d="M7 4v16l13-8z" />,
  star: <path d="M12 2.5l2.9 6 6.6.8-4.9 4.5 1.3 6.5L12 17l-5.9 3.3 1.3-6.5L2.5 9.3l6.6-.8z" />,
  // Lucide "plane" (ISC); nose points up-right
  plane: <path d="M17.8 19.2 16 11l3.5-3.5C21 6 21.5 4 21 3c-1-.5-3 0-4.5 1.5L13 8 4.8 6.2c-.5-.1-.9.1-1.1.5l-.3.5c-.2.5-.1 1 .3 1.3L9 12l-2 3H4l-1 1 3 2 2 3 1-1v-3l3-2 3.5 5.3c.3.4.8.5 1.3.3l.5-.2c.4-.3.6-.7.5-1.2z" />,
};

export type IconName = keyof typeof P | keyof typeof FILLED;

interface Props {
  name: IconName;
  size?: number;
  stroke?: number;
  color?: string;
  class?: string;
  style?: CSSProperties;
}

export function Icon({ name, size = 24, stroke = 2, color, class: cls, style }: Props) {
  const filled = name in FILLED;
  return (
    <svg
      width={size} height={size} viewBox="0 0 24 24" aria-hidden="true" class={cls}
      fill={filled ? color ?? 'currentColor' : 'none'}
      stroke={filled ? undefined : color ?? 'currentColor'}
      stroke-width={filled ? undefined : stroke} stroke-linecap="round" stroke-linejoin="round"
      style={style}
    >
      {filled ? FILLED[name] : P[name]}
    </svg>
  );
}

const WEATHER: Record<string, IconName> = {
  sunny: 'sun', 'clear-night': 'moon', cloudy: 'cloud', partlycloudy: 'partly', rainy: 'rain', pouring: 'rain',
  'lightning-rainy': 'storm', lightning: 'storm', snowy: 'snow', 'snowy-rainy': 'snow', hail: 'snow', fog: 'fog',
  windy: 'cloud', 'windy-variant': 'cloud', exceptional: 'cloud',
};

export function weatherIcon(condition: string): IconName {
  return WEATHER[condition] ?? 'cloud';
}

const WEATHER_LABEL: Record<string, string> = {
  sunny: 'Sunny', 'clear-night': 'Clear', cloudy: 'Cloudy', partlycloudy: 'Partly cloudy', rainy: 'Rain',
  pouring: 'Heavy rain', 'lightning-rainy': 'Storms', lightning: 'Lightning', snowy: 'Snow', 'snowy-rainy': 'Sleet',
  hail: 'Hail', fog: 'Fog', windy: 'Windy', 'windy-variant': 'Windy', exceptional: 'Unusual weather',
};

export function weatherLabel(condition: string): string {
  return WEATHER_LABEL[condition] ?? condition;
}
