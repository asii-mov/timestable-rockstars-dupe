/**
 * Question generation. Pure functions only — no DOM — so it can be unit tested
 * and stays cheap to call on every answer.
 */

export type Op = 'mul' | 'div';

export interface Question {
  /** Left operand as displayed. */
  a: number;
  /** Right operand as displayed. */
  b: number;
  op: Op;
  answer: number;
  /** Canonical multiplication fact key, e.g. "3x7" (smaller factor first). */
  fact: string;
}

export interface FactStat {
  /** Times asked. */
  n: number;
  /** Times answered correctly. */
  ok: number;
  /** Total milliseconds spent on correct answers. */
  ms: number;
}

export type FactStats = Record<string, FactStat>;

export interface GeneratorOptions {
  /** Which times tables to draw from (1–12). */
  tables: readonly number[];
  ops: readonly Op[];
  /** Highest multiplier used (default 12). */
  maxFactor?: number;
  /**
   * 0 = uniform random, 1 = strongly favour slow / frequently missed facts.
   */
  adaptive?: number;
  stats?: FactStats;
  rng?: () => number;
}

export const ALL_TABLES: readonly number[] = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];

export function factKey(x: number, y: number): string {
  return x <= y ? `${x}x${y}` : `${y}x${x}`;
}

/**
 * How much a fact should be favoured. Unseen facts get a moderate boost,
 * slow and inaccurate facts get a large one.
 */
export function factWeight(stat: FactStat | undefined): number {
  if (!stat || stat.n === 0) return 2;
  const accuracy = stat.ok / stat.n;
  const avgMs = stat.ok > 0 ? stat.ms / stat.ok : 8000;
  const speedPart = Math.min(6, Math.max(0.4, avgMs / 1500));
  const errorPart = (1 - accuracy) * 6;
  return speedPart + errorPart;
}

interface Candidate {
  table: number;
  factor: number;
  weight: number;
}

export class QuestionGenerator {
  private readonly candidates: Candidate[];
  private readonly ops: readonly Op[];
  private readonly rng: () => number;
  private readonly totalWeight: number;
  private last = '';

  constructor(opts: GeneratorOptions) {
    const tables = opts.tables.length ? opts.tables : ALL_TABLES;
    const maxFactor = opts.maxFactor ?? 12;
    const adaptive = Math.min(1, Math.max(0, opts.adaptive ?? 0));
    this.ops = opts.ops.length ? opts.ops : ['mul'];
    this.rng = opts.rng ?? Math.random;

    this.candidates = [];
    let total = 0;
    for (const table of tables) {
      for (let factor = 1; factor <= maxFactor; factor++) {
        const raw = factWeight(opts.stats?.[factKey(table, factor)]);
        // Blend between uniform (1) and the adaptive weight.
        const weight = 1 + (raw - 1) * adaptive;
        this.candidates.push({ table, factor, weight });
        total += weight;
      }
    }
    this.totalWeight = total;
  }

  next(): Question {
    let q: Question;
    let guard = 0;
    do {
      q = this.build(this.pick());
    } while (this.candidates.length > 1 && q.fact + q.op === this.last && ++guard < 8);
    this.last = q.fact + q.op;
    return q;
  }

  private pick(): Candidate {
    let r = this.rng() * this.totalWeight;
    for (const c of this.candidates) {
      r -= c.weight;
      if (r <= 0) return c;
    }
    return this.candidates[this.candidates.length - 1]!;
  }

  private build({ table, factor }: Candidate): Question {
    const op = this.ops[Math.floor(this.rng() * this.ops.length)] ?? 'mul';
    const fact = factKey(table, factor);
    if (op === 'div') {
      // (table × factor) ÷ table = factor
      return { a: table * factor, b: table, op, answer: factor, fact };
    }
    // Randomly swap the order so both "7 × 3" and "3 × 7" appear.
    const swap = this.rng() < 0.5;
    return {
      a: swap ? factor : table,
      b: swap ? table : factor,
      op,
      answer: table * factor,
      fact,
    };
  }
}

export function questionText(q: Question): string {
  return `${q.a} ${q.op === 'mul' ? '×' : '÷'} ${q.b}`;
}
