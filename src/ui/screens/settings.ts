/** Settings: name, sound, haptics and progress reset. */
import { h } from '../dom';
import { goHome, type Screen } from '../router';
import { getProfile, resetProfile, updateProfile } from '../../state/store';
import { sfx } from '../feedback';

export function settingsScreen(): Screen {
  const p = getProfile();

  const nameInput = h('input', {
    class: 'text-input',
    type: 'text',
    maxlength: 16,
    value: p.name,
    enterkeyhint: 'done',
    'aria-label': 'Racer name',
  });
  nameInput.addEventListener('change', () => {
    const name = nameInput.value.trim().slice(0, 16);
    if (name) updateProfile((pr) => (pr.name = name));
    else nameInput.value = getProfile().name;
  });

  const switchRow = (label: string, key: 'sound' | 'haptics', note?: string): HTMLElement => {
    const input = h('input', { type: 'checkbox', role: 'switch', checked: p.settings[key] });
    input.addEventListener('change', () => {
      updateProfile((pr) => (pr.settings[key] = input.checked));
      if (key === 'sound' && input.checked) sfx.correct(0);
    });
    return h(
      'label',
      { class: 'setting-row' },
      h('span', null, label, note ? h('small', null, note) : null),
      input,
      h('span', { class: 'switch', 'aria-hidden': 'true' }),
    );
  };

  const haptics = 'vibrate' in navigator;

  const el = h(
    'section',
    { class: 'screen settings' },
    h(
      'header',
      { class: 'topbar' },
      h('button', { class: 'icon-btn', 'aria-label': 'Back', onclick: () => goHome() }, '←'),
      h('h1', { class: 'screen-title' }, '⚙ Settings'),
      h('span', { class: 'spacer' }),
    ),
    h('label', { class: 'field' }, h('span', null, 'Racer name'), nameInput),
    switchRow('Sound effects', 'sound'),
    switchRow('Vibration', 'haptics', haptics ? undefined : 'Not supported on this device'),
    h(
      'button',
      {
        class: 'btn btn-danger wide',
        type: 'button',
        onclick: () => {
          if (confirm('Reset all scores, ranks and fact stats? This cannot be undone.')) {
            resetProfile();
            goHome();
          }
        },
      },
      'Reset progress',
    ),
    h('p', { class: 'muted small' }, 'Progress is saved on this device only.'),
  );

  return { el };
}
