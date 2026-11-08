import { describe, expect, it } from 'vitest';
import { factKey, factWeight, QuestionGenerator } from '../src/game/questions';

function seeded(seed: number): () => number {
  // mulberry32
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

describe('QuestionGenerator', () => {
  it('only uses the chosen tables and gives correct answers', () => {
    const g = new QuestionGenerator({ tables: [7], ops: ['mul', 'div'], rng: seeded(1) });
    for (let i = 0; i < 500; i++) {
      const q = g.next();
      if (q.op === 'mul') {
        expect(q.a === 7 || q.b === 7).toBe(true);
        expect(q.answer).toBe(q.a * q.b);
      } else {
        expect(q.b).toBe(7);
        expect(q.a / q.b).toBe(q.answer);
        expect(Number.isInteger(q.answer)).toBe(true);
      }
      expect(q.answer).toBeGreaterThan(0);
      expect(q.answer).toBeLessThanOrEqual(84);
    }
  });

  it('never repeats the exact same question twice in a row', () => {
    const g = new QuestionGenerator({ tables: [2, 3], ops: ['mul'], rng: seeded(2) });
    let prev = '';
    for (let i = 0; i < 1000; i++) {
      const q = g.next();
      expect(q.fact).not.toBe(prev);
      prev = q.fact;
    }
  });

  it('adaptive mode favours weak facts', () => {
    const stats = { [factKey(7, 8)]: { n: 10, ok: 3, ms: 3 * 9000 } };
    for (let f = 1; f <= 12; f++) {
      if (f !== 8) stats[factKey(7, f)] = { n: 10, ok: 10, ms: 10 * 800 };
    }
    const g = new QuestionGenerator({ tables: [7], ops: ['mul'], adaptive: 1, stats, rng: seeded(3) });
    let hits = 0;
    const N = 2000;
    for (let i = 0; i < N; i++) if (g.next().fact === '7x8') hits++;
    // Uniform would be ~1/12 (8%); the weak fact should come up far more.
    expect(hits / N).toBeGreaterThan(0.3);
  });

  it('factKey is order independent', () => {
    expect(factKey(9, 4)).toBe('4x9');
    expect(factKey(4, 9)).toBe('4x9');
  });

  it('factWeight rewards slow and inaccurate facts', () => {
    const fast = factWeight({ n: 10, ok: 10, ms: 10 * 900 });
    const slow = factWeight({ n: 10, ok: 10, ms: 10 * 6000 });
    const wrong = factWeight({ n: 10, ok: 5, ms: 5 * 900 });
    expect(slow).toBeGreaterThan(fast);
    expect(wrong).toBeGreaterThan(fast);
  });
});
