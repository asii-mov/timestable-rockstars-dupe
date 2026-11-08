/**
 * A single round of play: owns the current question, score and clock.
 * Framework/DOM-free; the clock is injectable for tests.
 */
import type { Question, QuestionGenerator } from './questions';

export interface RoundConfig {
  generator: QuestionGenerator;
  /** Round ends when this many ms have elapsed (timed modes). */
  durationMs?: number;
  /** Round ends when this many questions have been answered. */
  questionLimit?: number;
  /** Round ends when this many correct answers are reached (race). */
  targetCorrect?: number;
  now?: () => number;
}

export interface AnswerLog {
  fact: string;
  correct: boolean;
  ms: number;
}

export type SubmitResult = 'correct' | 'wrong' | 'ignored';

export class Round {
  question: Question;
  correct = 0;
  wrong = 0;
  streak = 0;
  bestStreak = 0;
  readonly log: AnswerLog[] = [];

  private readonly cfg: RoundConfig;
  private readonly now: () => number;
  private startedAt: number;
  private questionAt: number;
  private pausedAt: number | null = null;
  private ended = false;

  constructor(cfg: RoundConfig) {
    this.cfg = cfg;
    this.now = cfg.now ?? (() => performance.now());
    this.startedAt = this.now();
    this.questionAt = this.startedAt;
    this.question = cfg.generator.next();
  }

  get answered(): number {
    return this.correct + this.wrong;
  }

  elapsedMs(): number {
    const end = this.pausedAt ?? this.now();
    return end - this.startedAt;
  }

  /** Remaining ms for timed rounds, otherwise Infinity. */
  remainingMs(): number {
    if (this.cfg.durationMs === undefined) return Infinity;
    return Math.max(0, this.cfg.durationMs - this.elapsedMs());
  }

  isOver(): boolean {
    if (this.ended) return true;
    const { durationMs, questionLimit, targetCorrect } = this.cfg;
    if (durationMs !== undefined && this.elapsedMs() >= durationMs) return true;
    if (questionLimit !== undefined && this.answered >= questionLimit) return true;
    if (targetCorrect !== undefined && this.correct >= targetCorrect) return true;
    return false;
  }

  /** Force-finish (e.g. a CPU racer crossed the line first). */
  end(): void {
    this.ended = true;
  }

  /** True if `value` is the right answer — used for instant auto-submit. */
  isCorrect(value: number): boolean {
    return value === this.question.answer;
  }

  submit(value: number): SubmitResult {
    if (this.isOver() || this.pausedAt !== null) return 'ignored';
    const t = this.now();
    const ms = t - this.questionAt;
    const ok = value === this.question.answer;
    this.log.push({ fact: this.question.fact, correct: ok, ms });
    if (ok) {
      this.correct++;
      this.streak++;
      if (this.streak > this.bestStreak) this.bestStreak = this.streak;
    } else {
      this.wrong++;
      this.streak = 0;
    }
    return ok ? 'correct' : 'wrong';
  }

  /** Move on to a fresh question and restart its timer. */
  advance(): void {
    this.question = this.cfg.generator.next();
    // If paused, start the question clock at the pause point so resume()
    // shifts it correctly.
    this.questionAt = this.pausedAt ?? this.now();
  }

  pause(): void {
    if (this.pausedAt === null && !this.isOver()) this.pausedAt = this.now();
  }

  resume(): void {
    if (this.pausedAt === null) return;
    const gap = this.now() - this.pausedAt;
    this.startedAt += gap;
    this.questionAt += gap;
    this.pausedAt = null;
  }

  get paused(): boolean {
    return this.pausedAt !== null;
  }
}
