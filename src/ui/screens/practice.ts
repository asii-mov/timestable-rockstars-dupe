/** Practice setup: choose tables, operations and timing. */
import { h } from '../dom';
import { go, goHome, type Screen } from '../router';
import { ALL_TABLES, type Op } from '../../game/questions';
import { PRACTICE_QUESTIONS } from '../../game/modes';
import { getProfile, updateProfile } from '../../state/store';
import { sfx } from '../feedback';
import { playScreen } from './play';

export function practiceScreen(): Screen {
  const saved = getProfile().practice;
  const tables = new Set<number>(saved.tables);
  const ops = new Set<Op>(saved.ops);
  let timed = saved.timed;

  const startBtn = h('button', { class: 'btn btn-primary wide', type: 'button' }, 'Start');

  const toggle = (btn: HTMLButtonElement, on: boolean): void => {
    btn.classList.toggle('on', on);
    btn.setAttribute('aria-pressed', String(on));
  };

  const refresh = (): void => {
    startBtn.disabled = tables.size === 0 || ops.size === 0;
  };

  const tableBtns = ALL_TABLES.map((t) => {
    const b = h('button', { class: 'chip-btn', type: 'button' }, `${t}×`);
    toggle(b, tables.has(t));
    b.addEventListener('click', () => {
      if (tables.has(t)) tables.delete(t);
      else tables.add(t);
      toggle(b, tables.has(t));
      refresh();
    });
    return b;
  });

  const quick = (label: string, set: number[]): HTMLButtonElement =>
    h(
      'button',
      {
        class: 'link-btn',
        type: 'button',
        onclick: () => {
          tables.clear();
          set.forEach((t) => tables.add(t));
          tableBtns.forEach((b, i) => toggle(b, tables.has(ALL_TABLES[i]!)));
          refresh();
        },
      },
      label,
    );

  const opBtn = (op: Op, label: string): HTMLButtonElement => {
    const b = h('button', { class: 'chip-btn wide-chip', type: 'button' }, label);
    toggle(b, ops.has(op));
    b.addEventListener('click', () => {
      if (ops.has(op)) ops.delete(op);
      else ops.add(op);
      toggle(b, ops.has(op));
      refresh();
    });
    return b;
  };

  const timedBtn = h('button', { class: 'chip-btn wide-chip', type: 'button' }, '⏱ 60 seconds');
  const countBtn = h('button', { class: 'chip-btn wide-chip', type: 'button' }, `🔢 ${PRACTICE_QUESTIONS} questions`);
  const syncTiming = (): void => {
    toggle(timedBtn, timed);
    toggle(countBtn, !timed);
  };
  timedBtn.addEventListener('click', () => {
    timed = true;
    syncTiming();
  });
  countBtn.addEventListener('click', () => {
    timed = false;
    syncTiming();
  });
  syncTiming();

  startBtn.addEventListener('click', () => {
    sfx.unlock();
    const practice = {
      tables: [...tables].sort((a, b) => a - b),
      ops: [...ops],
      timed,
    };
    updateProfile((p) => (p.practice = practice));
    go(() => playScreen({ mode: 'practice', practice }));
  });
  refresh();

  const el = h(
    'section',
    { class: 'screen practice' },
    h(
      'header',
      { class: 'topbar' },
      h('button', { class: 'icon-btn', 'aria-label': 'Back', onclick: () => goHome() }, '←'),
      h('h1', { class: 'screen-title' }, '🎯 Practice'),
      h('span', { class: 'spacer' }),
    ),
    h('h2', { class: 'section-title' }, 'Tables'),
    h('div', { class: 'table-grid' }, tableBtns),
    h(
      'div',
      { class: 'quick-picks' },
      quick('2, 5, 10', [2, 5, 10]),
      quick('3, 4, 8', [3, 4, 8]),
      quick('6, 7, 9', [6, 7, 9]),
      quick('11, 12', [11, 12]),
      quick('All', [...ALL_TABLES]),
    ),
    h('h2', { class: 'section-title' }, 'Questions'),
    h('div', { class: 'row' }, opBtn('mul', '× Multiply'), opBtn('div', '÷ Divide')),
    h('h2', { class: 'section-title' }, 'Length'),
    h('div', { class: 'row' }, timedBtn, countBtn),
    startBtn,
  );

  return { el };
}
