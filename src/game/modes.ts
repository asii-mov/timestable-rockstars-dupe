/** Game mode definitions: how each mode builds its round. */
import { ALL_TABLES, QuestionGenerator, type Op } from './questions';
import { SPRINT_SECONDS } from './ranks';
import type { RoundConfig } from './round';
import type { FactStats } from './questions';
import type { GameModeId } from '../state/store';

export const RACE_LAPS = 15;
export const PITSTOP_QUESTIONS = 20;
export const PRACTICE_QUESTIONS = 25;

export interface ModeInfo {
  id: GameModeId;
  title: string;
  tagline: string;
  icon: string;
  ranked: boolean;
}

export const MODES: Record<GameModeId, ModeInfo> = {
  sprint: {
    id: 'sprint',
    title: 'Sprint',
    tagline: '60 seconds, all tables. Sets your speed rank.',
    icon: '⏱️',
    ranked: true,
  },
  race: {
    id: 'race',
    title: 'Grand Prix',
    tagline: `Race 3 rivals to ${RACE_LAPS} correct answers.`,
    icon: '🏁',
    ranked: false,
  },
  practice: {
    id: 'practice',
    title: 'Practice',
    tagline: 'Pick your tables. Multiply, divide or both.',
    icon: '🎯',
    ranked: false,
  },
  pitstop: {
    id: 'pitstop',
    title: 'Pit Stop',
    tagline: 'Tune up the facts you find hardest.',
    icon: '🔧',
    ranked: false,
  },
};

export interface PracticeOptions {
  tables: number[];
  ops: Op[];
  timed: boolean;
}

export interface ModeSetup {
  mode: GameModeId;
  practice?: PracticeOptions;
}

export function buildRoundConfig(setup: ModeSetup, stats: FactStats): RoundConfig {
  switch (setup.mode) {
    case 'sprint':
      return {
        generator: new QuestionGenerator({ tables: ALL_TABLES, ops: ['mul'] }),
        durationMs: SPRINT_SECONDS * 1000,
      };
    case 'race':
      return {
        generator: new QuestionGenerator({ tables: ALL_TABLES, ops: ['mul'], adaptive: 0.3, stats }),
        targetCorrect: RACE_LAPS,
      };
    case 'pitstop':
      return {
        generator: new QuestionGenerator({
          tables: ALL_TABLES.filter((t) => t > 1),
          ops: ['mul', 'div'],
          adaptive: 1,
          stats,
        }),
        questionLimit: PITSTOP_QUESTIONS,
      };
    case 'practice': {
      const p = setup.practice ?? { tables: [...ALL_TABLES], ops: ['mul'], timed: true };
      return {
        generator: new QuestionGenerator({ tables: p.tables, ops: p.ops, adaptive: 0.4, stats }),
        ...(p.timed ? { durationMs: SPRINT_SECONDS * 1000 } : { questionLimit: PRACTICE_QUESTIONS }),
      };
    }
  }
}
