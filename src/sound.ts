// Timer alarm via Web Audio. Browsers only allow sound after a user gesture,
// so the first tap anywhere unlocks the audio context.

let ctx: AudioContext | null = null;
let loop: ReturnType<typeof setInterval> | undefined;

export function unlockAudioOnFirstTap(): void {
  const unlock = () => {
    try {
      ctx ??= new AudioContext();
      void ctx.resume();
    } catch {
      // No Web Audio: alerts are visual only.
    }
    window.removeEventListener('pointerdown', unlock);
  };
  window.addEventListener('pointerdown', unlock);
}

function beep(): void {
  if (!ctx) return;
  const t = ctx.currentTime;
  for (const [offset, freq] of [[0, 880], [0.18, 1175], [0.36, 880]] as const) {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(0.0001, t + offset);
    gain.gain.exponentialRampToValueAtTime(0.35, t + offset + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + offset + 0.16);
    osc.connect(gain).connect(ctx.destination);
    osc.start(t + offset);
    osc.stop(t + offset + 0.17);
  }
}

export function startAlarm(): void {
  if (loop) return;
  beep();
  loop = setInterval(beep, 1400);
}

export function stopAlarm(): void {
  clearInterval(loop);
  loop = undefined;
}
