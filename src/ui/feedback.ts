/**
 * Sound effects synthesised with Web Audio (no audio files to download) and
 * haptic feedback via the Vibration API where available.
 */
import { getProfile } from '../state/store';

let ctx: AudioContext | null = null;

function audio(): AudioContext | null {
  if (!getProfile().settings.sound) return null;
  if (!ctx) {
    const Ctor =
      window.AudioContext ??
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return null;
    ctx = new Ctor({ latencyHint: 'interactive' });
  }
  // iOS starts contexts suspended until a user gesture.
  if (ctx.state === 'suspended') void ctx.resume();
  return ctx;
}

function tone(freq: number, start: number, dur: number, type: OscillatorType, gain = 0.12): void {
  const ac = audio();
  if (!ac) return;
  const t = ac.currentTime + start;
  const osc = ac.createOscillator();
  const g = ac.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(gain, t + 0.01);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  osc.connect(g).connect(ac.destination);
  osc.start(t);
  osc.stop(t + dur + 0.02);
}

export const sfx = {
  /** Call from a user gesture to unlock audio on iOS. */
  unlock(): void {
    audio();
  },
  tap(): void {
    tone(660, 0, 0.04, 'square', 0.03);
  },
  correct(streak: number): void {
    // Pitch climbs with the streak for a satisfying "revving" feel.
    const base = 520 + Math.min(streak, 20) * 18;
    tone(base, 0, 0.08, 'triangle');
    tone(base * 1.5, 0.05, 0.1, 'triangle');
  },
  wrong(): void {
    tone(180, 0, 0.18, 'sawtooth', 0.08);
    vibrate(80);
  },
  count(): void {
    tone(440, 0, 0.12, 'square', 0.06);
  },
  go(): void {
    tone(880, 0, 0.25, 'square', 0.08);
  },
  finish(): void {
    [523, 659, 784, 1047].forEach((f, i) => tone(f, i * 0.09, 0.18, 'triangle'));
  },
};

export function vibrate(ms: number | number[]): void {
  if (!getProfile().settings.haptics) return;
  if ('vibrate' in navigator) {
    try {
      navigator.vibrate(ms);
    } catch {
      /* ignore */
    }
  }
}
