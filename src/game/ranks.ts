/**
 * Speed ranks. A player's rank comes from their average seconds per correct
 * answer across their most recent ranked Sprint rounds.
 */

export interface Rank {
  /** Upper bound (exclusive) on seconds per answer for this rank. */
  maxSec: number;
  title: string;
  emoji: string;
}

// Ordered fastest → slowest.
export const RANKS: readonly Rank[] = [
  { maxSec: 1, title: 'Hyperdrive Legend', emoji: '🌌' },
  { maxSec: 1.5, title: 'Grand Champion', emoji: '🏆' },
  { maxSec: 2, title: 'Speed Demon', emoji: '🔥' },
  { maxSec: 3, title: 'Turbo Ace', emoji: '⚡' },
  { maxSec: 4, title: 'Pro Racer', emoji: '🏎️' },
  { maxSec: 5, title: 'Street Racer', emoji: '🚗' },
  { maxSec: 7, title: 'Rally Rookie', emoji: '🚙' },
  { maxSec: 10, title: 'Go-Karter', emoji: '🛞' },
  { maxSec: Infinity, title: 'Learner Driver', emoji: '🚲' },
];

/** Number of recent ranked rounds that count towards the rank. */
export const RANK_WINDOW = 10;
export const SPRINT_SECONDS = 60;

/** Seconds per answer for one Sprint round. Zero correct counts as 60s. */
export function secondsPerAnswer(correct: number, durationSec = SPRINT_SECONDS): number {
  return correct > 0 ? durationSec / correct : durationSec;
}

/** Average seconds per answer over recent rounds, or null if none played. */
export function averageSpeed(recentCorrect: readonly number[]): number | null {
  const window = recentCorrect.slice(-RANK_WINDOW);
  if (window.length === 0) return null;
  const total = window.reduce((s, c) => s + secondsPerAnswer(c), 0);
  return total / window.length;
}

export function rankFor(avgSec: number | null): Rank {
  if (avgSec === null) return RANKS[RANKS.length - 1]!;
  for (const r of RANKS) {
    if (avgSec < r.maxSec) return r;
  }
  return RANKS[RANKS.length - 1]!;
}

/** The next rank up and how many seconds faster the player needs to be. */
export function nextRank(avgSec: number | null): { rank: Rank; needSec: number } | null {
  const current = rankFor(avgSec);
  const idx = RANKS.indexOf(current);
  if (idx <= 0) return null;
  const target = RANKS[idx - 1]!;
  const from = avgSec ?? SPRINT_SECONDS;
  return { rank: target, needSec: Math.max(0, from - target.maxSec) };
}
