import { describe, expect, it } from 'vitest';
import { Round } from '../src/game/round';
import { QuestionGenerator } from '../src/game/questions';

function clock() {
  let t = 0;
  return { now: () => t, advance: (ms: number) => (t += ms) };
}

describe('Round', () => {
  it('scores answers and tracks streaks', () => {
    const c = clock();
    const r = new Round({ generator: new QuestionGenerator({ tables: [5], ops: ['mul'] }), now: c.now });
    for (let i = 0; i < 3; i++) {
      c.advance(1000);
      expect(r.submit(r.question.answer)).toBe('correct');
      r.advance();
    }
    expect(r.submit(-1)).toBe('wrong');
    expect(r.correct).toBe(3);
    expect(r.wrong).toBe(1);
    expect(r.streak).toBe(0);
    expect(r.bestStreak).toBe(3);
    expect(r.log[0]!.ms).toBe(1000);
  });

  it('ends a timed round and ignores late answers', () => {
    const c = clock();
    const r = new Round({ generator: new QuestionGenerator({ tables: [2], ops: ['mul'] }), durationMs: 60000, now: c.now });
    c.advance(59999);
    expect(r.isOver()).toBe(false);
    c.advance(1);
    expect(r.isOver()).toBe(true);
    expect(r.submit(r.question.answer)).toBe('ignored');
  });

  it('pausing stops the clock', () => {
    const c = clock();
    const r = new Round({ generator: new QuestionGenerator({ tables: [2], ops: ['mul'] }), durationMs: 10000, now: c.now });
    c.advance(4000);
    r.pause();
    c.advance(100000);
    expect(r.remainingMs()).toBe(6000);
    expect(r.submit(r.question.answer)).toBe('ignored');
    r.resume();
    expect(r.remainingMs()).toBe(6000);
    c.advance(500);
    r.submit(r.question.answer);
    expect(r.log[0]!.ms).toBe(4500);
  });

  it('ends a race at the target and supports forced end', () => {
    const r = new Round({ generator: new QuestionGenerator({ tables: [3], ops: ['mul'] }), targetCorrect: 2 });
    r.submit(r.question.answer);
    r.advance();
    expect(r.isOver()).toBe(false);
    r.submit(r.question.answer);
    expect(r.isOver()).toBe(true);

    const r2 = new Round({ generator: new QuestionGenerator({ tables: [3], ops: ['mul'] }), targetCorrect: 20 });
    r2.end();
    expect(r2.isOver()).toBe(true);
  });
});
