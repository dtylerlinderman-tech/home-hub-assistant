import type { LockState } from '../data/adapter';

/** Label, colors and icon for a lock state, shared by Home and Door. */
export function lockView(lock: LockState | null, signInExpired = false) {
  if (!lock && signInExpired) return { label: 'Sign in again', color: 'var(--alert-text)', tint: 'var(--alert-tint)', icon: 'lock' as const, unlocked: false };
  if (!lock || lock.state === 'unavailable') return { label: 'Unavailable', color: 'var(--subtle)', tint: 'var(--raised)', icon: 'lock' as const, unlocked: false };
  if (lock.state === 'jammed') return { label: 'Jammed', color: 'var(--alert-text)', tint: 'var(--alert-tint)', icon: 'lock' as const, unlocked: false };
  const unlocked = lock.state === 'unlocked' || lock.state === 'unlocking';
  return unlocked
    ? { label: lock.state === 'unlocking' ? 'Unlocking…' : 'Unlocked', color: 'var(--alert-text)', tint: 'var(--alert-tint)', icon: 'unlock' as const, unlocked }
    : { label: lock.state === 'locking' ? 'Locking…' : 'Locked', color: 'var(--ok)', tint: 'var(--ok-tint)', icon: 'lock' as const, unlocked };
}
