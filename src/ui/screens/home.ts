/** Home screen: player card, mode picker and navigation. */
import { h } from '../dom';
import { go, type Screen } from '../router';
import { MODES } from '../../game/modes';
import { averageSpeed, nextRank, rankFor } from '../../game/ranks';
import { getProfile, updateProfile } from '../../state/store';
import { sfx } from '../feedback';
import { playScreen } from './play';
import { practiceScreen } from './practice';
import { statsScreen } from './stats';
import { settingsScreen } from './settings';
import type { GameModeId } from '../../state/store';

export function homeScreen(): Screen {
  const p = getProfile();
  if (!p.name) return welcomeScreen();

  const avg = averageSpeed(p.sprintHistory);
  const rank = rankFor(avg);
  const next = nextRank(avg);

  const start = (id: GameModeId): void => {
    sfx.unlock();
    if (id === 'practice') go(practiceScreen);
    else go(() => playScreen({ mode: id }));
  };

  const modeCard = (id: GameModeId): HTMLElement => {
    const m = MODES[id];
    return h(
      'button',
      { class: `mode-card mode-${id}`, type: 'button', onclick: () => start(id) },
      h('span', { class: 'mode-icon', 'aria-hidden': 'true' }, m.icon),
      h('span', { class: 'mode-text' }, h('strong', null, m.title), h('small', null, m.tagline)),
    );
  };

  const el = h(
    'section',
    { class: 'screen home' },
    h(
      'header',
      { class: 'topbar' },
      h('div', { class: 'brand' }, h('span', { class: 'logo', 'aria-hidden': 'true' }, '×'), 'Turbo Tables'),
      h('button', { class: 'icon-btn', 'aria-label': 'Settings', onclick: () => go(settingsScreen) }, '⚙'),
    ),
    h(
      'button',
      { class: 'player-card', type: 'button', onclick: () => go(statsScreen), 'aria-label': 'View your stats' },
      h('span', { class: 'rank-emoji big' }, rank.emoji),
      h(
        'span',
        { class: 'player-info' },
        h('span', { class: 'player-name' }, p.name),
        h('span', { class: 'player-rank' }, rank.title),
        h(
          'span',
          { class: 'player-meta' },
          avg === null ? 'Play a Sprint to get ranked' : `${avg.toFixed(2)}s per answer`,
          next && avg !== null ? ` · ${next.needSec.toFixed(2)}s to ${next.rank.title}` : '',
        ),
      ),
      h('span', { class: 'points' }, h('strong', null, p.points.toLocaleString()), h('small', null, 'pts')),
    ),
    h('div', { class: 'modes' }, (['sprint', 'race', 'practice', 'pitstop'] as GameModeId[]).map(modeCard)),
    h('button', { class: 'btn btn-ghost wide', onclick: () => go(statsScreen) }, '📊 My stats'),
  );

  return { el };
}

function welcomeScreen(): Screen {
  const input = h('input', {
    class: 'text-input',
    type: 'text',
    maxlength: 16,
    autocomplete: 'nickname',
    enterkeyhint: 'go',
    placeholder: 'Your racer name',
    'aria-label': 'Racer name',
  });
  const submit = (e: Event): void => {
    e.preventDefault();
    const name = input.value.trim().slice(0, 16);
    if (!name) {
      input.focus();
      return;
    }
    sfx.unlock();
    updateProfile((p) => (p.name = name));
    const root = el.parentElement!;
    const home = homeScreen();
    root.replaceChildren(home.el);
  };
  const el = h(
    'section',
    { class: 'screen welcome' },
    h('div', { class: 'logo huge', 'aria-hidden': 'true' }, '×'),
    h('h1', null, 'Turbo Tables'),
    h('p', { class: 'lead' }, 'Race through your times tables. Get faster, climb the ranks, beat your rivals.'),
    h('form', { class: 'welcome-form', onsubmit: submit }, input, h('button', { class: 'btn btn-primary', type: 'submit' }, "Let's go")),
  );
  return { el };
}
