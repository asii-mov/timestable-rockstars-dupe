/** End-of-round summary: score, speed, rank changes and facts to revisit. */
import { h } from '../dom';
import { go, goHome, type Screen } from '../router';
import { MODES, type ModeSetup } from '../../game/modes';
import { averageSpeed, rankFor, secondsPerAnswer } from '../../game/ranks';
import type { AnswerLog } from '../../game/round';
import { getProfile, recordRound, updateProfile } from '../../state/store';
import { playScreen } from './play';

export interface RoundSummary {
  setup: ModeSetup;
  correct: number;
  wrong: number;
  bestStreak: number;
  elapsedMs: number;
  log: AnswerLog[];
  place?: number;
  standings?: { name: string; progress: number; you: boolean }[];
}

const PLACE = ['1st', '2nd', '3rd', '4th'];
const PLACE_BONUS = [10, 5, 2, 0];

function prettyFact(fact: string): string {
  return fact.replace('x', ' × ');
}

export function resultsScreen(s: RoundSummary): Screen {
  const profile = getProfile();
  const mode = MODES[s.setup.mode];

  const rankBefore = rankFor(averageSpeed(profile.sprintHistory));
  const bestBefore = profile.bestSprint;

  const bonus = s.place ? PLACE_BONUS[s.place - 1] ?? 0 : 0;
  const earned = s.correct + bonus;

  recordRound({ mode: s.setup.mode, at: Date.now(), correct: s.correct, wrong: s.wrong });
  updateProfile((p) => {
    p.points += earned;
    if (s.setup.mode === 'race') {
      p.racesPlayed++;
      if (s.place === 1) p.racesWon++;
    }
  });

  const avgAfter = averageSpeed(profile.sprintHistory);
  const rankAfter = rankFor(avgAfter);
  const rankedUp = mode.ranked && rankAfter !== rankBefore && rankAfter.maxSec < rankBefore.maxSec;
  const newBest = mode.ranked && s.correct > bestBefore && bestBefore > 0;

  const total = s.correct + s.wrong;
  const accuracy = total ? Math.round((s.correct / total) * 100) : 0;
  const okTimes = s.log.filter((l) => l.correct).map((l) => l.ms);
  const avgMs = okTimes.length ? okTimes.reduce((a, b) => a + b, 0) / okTimes.length : 0;

  // Facts missed this round (unique), then the slowest correct ones.
  const missed = [...new Set(s.log.filter((l) => !l.correct).map((l) => l.fact))];
  const slow = s.log
    .filter((l) => l.correct && !missed.includes(l.fact))
    .sort((a, b) => b.ms - a.ms)
    .slice(0, Math.max(0, 6 - missed.length))
    .filter((l) => l.ms > 3000)
    .map((l) => l.fact);
  const tricky = [...missed, ...new Set(slow)].slice(0, 6);

  let headline: string;
  if (s.place) headline = s.place === 1 ? '🏆 You won!' : `You finished ${PLACE[s.place - 1]}`;
  else if (rankedUp) headline = 'Rank up!';
  else if (newBest) headline = 'New personal best!';
  else headline = s.correct > 0 ? 'Round complete' : 'Keep practising!';

  const stat = (label: string, value: string): HTMLElement =>
    h('div', { class: 'stat' }, h('span', { class: 'stat-value' }, value), h('span', { class: 'stat-label' }, label));

  const el = h(
    'section',
    { class: 'screen results' },
    h('p', { class: 'eyebrow' }, `${mode.icon} ${mode.title}`),
    h('h1', { class: 'results-title' }, headline),

    rankedUp
      ? h(
          'div',
          { class: 'rank-badge rank-up' },
          h('span', { class: 'rank-emoji' }, rankAfter.emoji),
          h('span', null, `You're now a ${rankAfter.title}`),
        )
      : null,

    h(
      'div',
      { class: 'stats-grid' },
      stat('correct', String(s.correct)),
      stat('accuracy', `${accuracy}%`),
      mode.ranked
        ? stat('sec / answer', secondsPerAnswer(s.correct).toFixed(2))
        : stat('avg answer', `${(avgMs / 1000).toFixed(1)}s`),
      stat('best streak', String(s.bestStreak)),
    ),

    h('p', { class: 'points-earned' }, `+${earned} points`, bonus ? ` (incl. ${bonus} place bonus)` : ''),

    s.standings
      ? h(
          'ol',
          { class: 'standings' },
          s.standings.map((r, i) =>
            h(
              'li',
              { class: r.you ? 'you' : '' },
              h('span', { class: 'pos' }, PLACE[i] ?? ''),
              h('span', { class: 'who' }, r.name),
              h('span', { class: 'laps' }, `${r.progress} laps`),
            ),
          ),
        )
      : null,

    tricky.length
      ? h(
          'div',
          { class: 'tricky' },
          h('h2', null, 'Facts to work on'),
          h(
            'ul',
            { class: 'chips' },
            tricky.map((f) => {
              const [a, b] = f.split('x').map(Number) as [number, number];
              return h('li', { class: 'chip' }, `${prettyFact(f)} = ${a * b}`);
            }),
          ),
        )
      : null,

    h(
      'div',
      { class: 'actions' },
      h('button', { class: 'btn btn-primary', onclick: () => go(() => playScreen(s.setup)) }, 'Play again'),
      h('button', { class: 'btn btn-ghost', onclick: () => goHome() }, 'Home'),
    ),
  );

  return {
    el,
    mount() {
      el.querySelector<HTMLButtonElement>('.btn-primary')?.focus({ preventScroll: true });
    },
  };
}
