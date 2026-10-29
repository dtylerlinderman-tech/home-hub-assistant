import { Icon } from './Icon';

interface Props {
  done: boolean;
  size: number;
  radius: number;
  border: number;
  check: number;
  checkStroke?: number;
  color?: string; // ring + fill when done
}

/** The square check used by reminders, ingredients and kids' tasks. */
export function Checkbox({ done, size, radius, border, check, checkStroke = 3, color = 'var(--ok)' }: Props) {
  return (
    <span
      style={{
        width: size + 'px', height: size + 'px', flexShrink: 0, borderRadius: radius + 'px',
        border: border + 'px solid ' + (done ? color : 'var(--faint)'), background: done ? color : 'transparent',
        color: 'var(--on-accent)', display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}
    >
      {done && <Icon name="check" size={check} stroke={checkStroke} />}
    </span>
  );
}
