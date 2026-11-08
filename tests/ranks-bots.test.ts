import { describe, expect, it } from 'vitest';
import { averageSpeed, nextRank, rankFor, RANKS, secondsPerAnswer } from '../src/game/ranks';
import { createBots, delayBots, stepBots } from '../src/game/bots';

describe('ranks', () => {
  it('computes seconds per answer', () => {
    expect(secondsPerAnswer(30)).toBe(2);
    expect(secondsPerAnswer(0)).toBe(60);
  });

  it('averages only the most recent 10 rounds', () => {
    const history = [...Array(10).fill(1), ...Array(10).fill(60)];
    expect(averageSpeed(history)).toBe(1);
    expect(averageSpeed([])).toBeNull();
  });

  it('maps speed to ranks', () => {
    expect(rankFor(null).title).toBe('Learner Driver');
    expect(rankFor(0.9).title).toBe(RANKS[0]!.title);
    expect(rankFor(2.5).title).toBe('Turbo Ace');
    expect(rankFor(50).title).toBe('Learner Driver');
    expect(nextRank(0.5)).toBeNull();
    const n = nextRank(2.5)!;
    expect(n.rank.title).toBe('Speed Demon');
    expect(n.needSec).toBeCloseTo(0.5);
  });
});

describe('bots', () => {
  it('advance over time and finish at the target', () => {
    const rng = () => 0.5;
    const bots = createBots(2, 0, rng);
    expect(bots).toHaveLength(3);
    expect(stepBots(bots, 0, 10, rng)).toBe(false);
    stepBots(bots, 1_000_000, 10, rng);
    for (const b of bots) {
      expect(b.progress).toBe(10);
      expect(b.finishedAt).not.toBeNull();
    }
    // Faster bot finishes first.
    expect(bots[0]!.finishedAt!).toBeLessThan(bots[2]!.finishedAt!);
  });

  it('delayBots postpones the next answer', () => {
    const bots = createBots(3, 0, () => 0.5);
    const before = bots[0]!.nextAt;
    delayBots(bots, 5000);
    expect(bots[0]!.nextAt).toBe(before + 5000);
  });
});
