/**
 * CPU racers for Grand Prix mode. Each bot answers at a pace close to the
 * player's own average so races stay close, with random jitter and the odd
 * "stall" to keep them human-like.
 */

export interface Bot {
  name: string;
  color: string;
  /** Mean ms per correct answer. */
  meanMs: number;
  progress: number;
  nextAt: number;
  finishedAt: number | null;
}

const ROSTER: readonly { name: string; color: string; pace: number }[] = [
  { name: 'Bolt', color: '#ffd23f', pace: 0.85 },
  { name: 'Nova', color: '#3bceac', pace: 1.0 },
  { name: 'Dash', color: '#ee4266', pace: 1.2 },
];

/** Slowest and fastest bot pace allowed, in ms per answer. */
const MIN_MS = 700;
const MAX_MS = 9000;

function sampleGap(meanMs: number, rng: () => number): number {
  // Jitter ±40% around the mean, with a 1-in-10 chance of a "stall".
  let gap = meanMs * (0.6 + rng() * 0.8);
  if (rng() < 0.1) gap += meanMs * (0.5 + rng());
  return gap;
}

export function createBots(
  playerAvgSec: number | null,
  start: number,
  rng: () => number = Math.random,
): Bot[] {
  // New players race bots pitched at roughly 5s per answer.
  const baseMs = (playerAvgSec ?? 5) * 1000;
  return ROSTER.map((r) => {
    const meanMs = Math.min(MAX_MS, Math.max(MIN_MS, baseMs * r.pace));
    return {
      name: r.name,
      color: r.color,
      meanMs,
      progress: 0,
      nextAt: start + sampleGap(meanMs, rng) + 600, // small reaction delay at the start
      finishedAt: null,
    };
  });
}

/**
 * Advance bots to time `now`. Returns true if any bot's progress changed.
 * Handles large time jumps (e.g. after a dropped frame) correctly.
 */
export function stepBots(
  bots: Bot[],
  now: number,
  target: number,
  rng: () => number = Math.random,
): boolean {
  let changed = false;
  for (const b of bots) {
    while (b.finishedAt === null && now >= b.nextAt) {
      b.progress++;
      changed = true;
      if (b.progress >= target) {
        b.finishedAt = b.nextAt;
      } else {
        b.nextAt += sampleGap(b.meanMs, rng);
      }
    }
  }
  return changed;
}

/** Shift all bot timers forward by `ms` (used when the game is paused). */
export function delayBots(bots: Bot[], ms: number): void {
  for (const b of bots) if (b.finishedAt === null) b.nextAt += ms;
}
