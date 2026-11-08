/**
 * The in-game screen shared by every mode.
 *
 * Performance notes:
 *  - All elements are created once; per-frame work only touches
 *    `transform` (compositor-only) and text that has actually changed.
 *  - Input uses `pointerdown` on a single delegated listener, so taps register
 *    instantly with no 300ms click delay and no per-button listeners.
 *  - The rAF loop stops itself when the round ends or the screen is destroyed.
 */
import { h, setText, flash } from '../dom';
import { go, goHome, type Screen } from '../router';
import { Round } from '../../game/round';
import { buildRoundConfig, MODES, RACE_LAPS, type ModeSetup } from '../../game/modes';
import { averageSpeed } from '../../game/ranks';
import { createBots, delayBots, stepBots, type Bot } from '../../game/bots';
import { questionText } from '../../game/questions';
import { getProfile, recordAnswer } from '../../state/store';
import { sfx, vibrate } from '../feedback';
import { resultsScreen, type RoundSummary } from './results';

const MAX_DIGITS = 3;
const WRONG_REVEAL_MS = 700;
const KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', 'back', '0', 'enter'] as const;

export function playScreen(setup: ModeSetup): Screen {
  const profile = getProfile();
  const mode = MODES[setup.mode];
  const cfg = buildRoundConfig(setup, profile.facts);
  const isRace = setup.mode === 'race';

  // ---- DOM ---------------------------------------------------------------
  const timerEl = h('span', { class: 'hud-value' }, '—');
  const scoreEl = h('span', { class: 'hud-value' }, '0');
  const streakEl = h('span', { class: 'streak' });
  const barFill = h('div', { class: 'bar-fill' });
  const questionEl = h('div', { class: 'question', 'aria-live': 'polite' });
  const answerEl = h('div', { class: 'answer', role: 'status' });
  const countdownEl = h('div', { class: 'countdown' });

  const pauseOverlay = h(
    'div',
    { class: 'overlay', hidden: true },
    h(
      'div',
      { class: 'overlay-card' },
      h('h2', null, 'Paused'),
      h('button', { class: 'btn btn-primary', onclick: () => resume() }, 'Resume'),
      h('button', { class: 'btn btn-ghost', onclick: () => quit() }, 'Quit round'),
    ),
  );

  const keypad = h(
    'div',
    { class: 'keypad', role: 'group', 'aria-label': 'Number pad' },
    KEYS.map((k) =>
      h(
        'button',
        {
          class: `key${k === 'enter' ? ' key-enter' : k === 'back' ? ' key-back' : ''}`,
          dataset: { key: k },
          'aria-label': k === 'enter' ? 'Submit' : k === 'back' ? 'Delete' : k,
          type: 'button',
        },
        k === 'enter' ? '✓' : k === 'back' ? '⌫' : k,
      ),
    ),
  );

  // Race track: player + bots, positioned with translateX.
  let bots: Bot[] = [];
  const carEls: HTMLElement[] = [];
  let playerCar: HTMLElement | null = null;
  let track: HTMLElement | null = null;
  if (isRace) {
    const lane = (label: string, color: string, isYou = false): HTMLElement => {
      const car = h('div', { class: 'car', style: { background: color } }, label.slice(0, 1));
      const laneEl = h('div', { class: `lane${isYou ? ' lane-you' : ''}` }, h('span', { class: 'lane-name' }, label), car);
      if (isYou) playerCar = car;
      else carEls.push(car);
      return laneEl;
    };
    bots = createBots(averageSpeed(profile.sprintHistory), performance.now());
    track = h(
      'div',
      { class: 'track', 'aria-hidden': 'true' },
      lane(profile.name || 'You', 'var(--accent)', true),
      bots.map((b) => lane(b.name, b.color)),
      h('div', { class: 'finish-line' }),
    );
  }

  const el = h(
    'section',
    { class: `screen play mode-${setup.mode}` },
    h(
      'header',
      { class: 'hud' },
      h('button', { class: 'icon-btn', 'aria-label': 'Pause', onclick: () => pause() }, '❚❚'),
      h('div', { class: 'hud-item' }, h('span', { class: 'hud-label' }, isRace ? 'Laps' : 'Time'), timerEl),
      h('div', { class: 'hud-item' }, h('span', { class: 'hud-label' }, 'Score'), scoreEl),
      streakEl,
    ),
    h('div', { class: 'bar' }, barFill),
    track,
    h('div', { class: 'stage' }, questionEl, answerEl, countdownEl),
    keypad,
    pauseOverlay,
  );

  // ---- State -------------------------------------------------------------
  let round: Round | null = null;
  let input = '';
  let locked = true; // during countdown and wrong-answer reveal
  let raf = 0;
  let revealTimer = 0;
  let countdownTimer = 0;
  let lastSecond = -1;
  let finished = false;
  let pauseStartedAt = 0;
  let fieldWidth = 0;

  const renderInput = (): void => {
    setText(answerEl, input || ' ');
  };

  const renderQuestion = (): void => {
    if (!round) return;
    setText(questionEl, `${questionText(round.question)} =`);
    flash(questionEl, 'pop');
  };

  const renderScore = (): void => {
    if (!round) return;
    setText(scoreEl, String(round.correct));
    setText(streakEl, round.streak >= 3 ? `🔥 ${round.streak}` : '');
    if (isRace) {
      setText(timerEl, `${round.correct}/${RACE_LAPS}`);
      moveCar(playerCar, round.correct);
    } else if (cfg.questionLimit !== undefined) {
      setText(timerEl, `${round.answered}/${cfg.questionLimit}`);
      barFill.style.transform = `scaleX(${round.answered / cfg.questionLimit})`;
    }
  };

  const measureTrack = (): void => {
    if (!track || !playerCar) return;
    fieldWidth = Math.max(0, track.clientWidth - playerCar.offsetWidth - 72);
  };

  function moveCar(car: HTMLElement | null, progress: number): void {
    if (!car) return;
    const x = (Math.min(progress, RACE_LAPS) / RACE_LAPS) * fieldWidth;
    car.style.transform = `translate3d(${x}px,0,0)`;
  }

  // ---- Input -------------------------------------------------------------
  const press = (key: string): void => {
    if (locked || !round || round.paused) return;
    if (key === 'back') {
      input = input.slice(0, -1);
      renderInput();
      return;
    }
    if (key === 'enter') {
      if (input) submit();
      return;
    }
    if (input.length >= MAX_DIGITS) return;
    input = input === '0' ? key : input + key;
    renderInput();
    // Auto-submit as soon as the typed answer is right: fastest flow on touch.
    if (round.isCorrect(Number(input))) submit();
  };

  const submit = (): void => {
    if (!round) return;
    const q = round.question;
    const result = round.submit(Number(input));
    if (result === 'ignored') return;
    const last = round.log[round.log.length - 1]!;
    recordAnswer(last.fact, last.correct, last.ms);

    if (result === 'correct') {
      sfx.correct(round.streak);
      flash(answerEl, 'good');
      input = '';
      renderScore();
      if (round.isOver()) return finish();
      round.advance();
      renderQuestion();
      renderInput();
    } else {
      sfx.wrong();
      flash(answerEl, 'bad');
      flash(keypad, 'shake');
      renderScore();
      // Show the right answer briefly so the player learns the fact.
      locked = true;
      setText(answerEl, String(q.answer));
      answerEl.classList.add('reveal');
      revealTimer = window.setTimeout(() => {
        answerEl.classList.remove('reveal');
        input = '';
        if (!round || round.isOver()) return finish();
        locked = false;
        round.advance();
        renderQuestion();
        renderInput();
      }, WRONG_REVEAL_MS);
    }
  };

  const onPointerDown = (e: PointerEvent): void => {
    const btn = (e.target as HTMLElement).closest<HTMLElement>('.key');
    if (!btn) return;
    // Prevent focus, text selection and double-tap zoom.
    e.preventDefault();
    btn.classList.add('down');
    press(btn.dataset.key!);
  };
  const onPointerUp = (e: PointerEvent): void => {
    (e.target as HTMLElement).closest('.key')?.classList.remove('down');
  };
  keypad.addEventListener('pointerdown', onPointerDown);
  keypad.addEventListener('pointerup', onPointerUp);
  keypad.addEventListener('pointercancel', onPointerUp);
  keypad.addEventListener('pointerleave', () => {
    keypad.querySelectorAll('.down').forEach((k) => k.classList.remove('down'));
  });
  // Swallow synthetic click from keypad (keyboard users use real keys).
  keypad.addEventListener('click', (e) => e.preventDefault());

  const onKey = (e: KeyboardEvent): void => {
    if (e.key >= '0' && e.key <= '9') press(e.key);
    else if (e.key === 'Backspace') press('back');
    else if (e.key === 'Enter') press('enter');
    else if (e.key === 'Escape') {
      if (round?.paused) resume();
      else pause();
    } else return;
    e.preventDefault();
  };

  // ---- Loop --------------------------------------------------------------
  const tick = (now: number): void => {
    raf = 0;
    if (!round || finished) return;

    if (cfg.durationMs !== undefined) {
      const remaining = round.remainingMs();
      const sec = Math.ceil(remaining / 1000);
      if (sec !== lastSecond) {
        lastSecond = sec;
        setText(timerEl, String(sec));
        el.classList.toggle('hurry', sec <= 10);
      }
      barFill.style.transform = `scaleX(${remaining / cfg.durationMs})`;
    }

    if (isRace && stepBots(bots, now, RACE_LAPS)) {
      bots.forEach((b, i) => moveCar(carEls[i]!, b.progress));
      if (bots.some((b) => b.finishedAt !== null) && round.correct < RACE_LAPS) {
        // A rival crossed the line; the race is over.
        round.end();
      }
    }

    if (round.isOver() && !locked) return finish();
    raf = requestAnimationFrame(tick);
  };

  const startLoop = (): void => {
    if (!raf && !finished) raf = requestAnimationFrame(tick);
  };

  // ---- Lifecycle ---------------------------------------------------------
  const pause = (): void => {
    if (!round || finished || round.paused) return;
    round.pause();
    pauseStartedAt = performance.now();
    pauseOverlay.hidden = false;
    cancelAnimationFrame(raf);
    raf = 0;
  };

  const resume = (): void => {
    if (!round || !round.paused) return;
    if (isRace) delayBots(bots, performance.now() - pauseStartedAt);
    round.resume();
    pauseOverlay.hidden = true;
    startLoop();
  };

  const quit = (): void => {
    finished = true;
    goHome();
  };

  const onVisibility = (): void => {
    if (document.visibilityState === 'hidden') pause();
  };

  const onResize = (): void => {
    measureTrack();
    if (round) {
      moveCar(playerCar, round.correct);
      bots.forEach((b, i) => moveCar(carEls[i]!, b.progress));
    }
  };

  const finish = (): void => {
    if (finished || !round) return;
    finished = true;
    cancelAnimationFrame(raf);
    clearTimeout(revealTimer);
    sfx.finish();
    vibrate([30, 40, 30]);

    let place: number | undefined;
    let standings: RoundSummary['standings'];
    if (isRace) {
      const rows = [
        { name: profile.name || 'You', progress: round.correct, you: true, at: round.correct >= RACE_LAPS ? round.elapsedMs() : Infinity },
        ...bots.map((b) => ({ name: b.name, progress: b.progress, you: false, at: b.finishedAt ?? Infinity })),
      ];
      // Finished racers by time, the rest by distance.
      rows.sort((a, b) => a.at - b.at || b.progress - a.progress);
      standings = rows.map(({ name, progress, you }) => ({ name, progress, you }));
      place = rows.findIndex((r) => r.you) + 1;
    }

    const summary: RoundSummary = {
      setup,
      correct: round.correct,
      wrong: round.wrong,
      bestStreak: round.bestStreak,
      elapsedMs: round.elapsedMs(),
      log: round.log,
      place,
      standings,
    };
    // Short beat so the last answer's feedback is visible.
    setTimeout(() => go(() => resultsScreen(summary)), 350);
  };

  const startCountdown = (): void => {
    let n = 3;
    const step = (): void => {
      if (n > 0) {
        setText(countdownEl, String(n));
        flash(countdownEl, 'pop');
        sfx.count();
        n--;
        countdownTimer = window.setTimeout(step, 600);
      } else {
        setText(countdownEl, '');
        sfx.go();
        round = new Round(cfg);
        if (isRace) {
          // Re-seat bots so their clock starts at "go".
          bots = createBots(averageSpeed(profile.sprintHistory), performance.now());
        }
        locked = false;
        renderQuestion();
        renderInput();
        renderScore();
        startLoop();
      }
    };
    step();
  };

  return {
    el,
    mount() {
      document.addEventListener('keydown', onKey);
      document.addEventListener('visibilitychange', onVisibility);
      addEventListener('resize', onResize, { passive: true });
      measureTrack();
      setText(questionEl, mode.title);
      renderInput();
      if (cfg.questionLimit !== undefined) {
        // Count-based modes fill the bar up from empty.
        setText(timerEl, `0/${cfg.questionLimit}`);
        barFill.style.transform = 'scaleX(0)';
      }
      else if (isRace) setText(timerEl, `0/${RACE_LAPS}`);
      else setText(timerEl, String(Math.round((cfg.durationMs ?? 0) / 1000)));
      startCountdown();
    },
    destroy() {
      finished = true;
      cancelAnimationFrame(raf);
      clearTimeout(revealTimer);
      clearTimeout(countdownTimer);
      document.removeEventListener('keydown', onKey);
      document.removeEventListener('visibilitychange', onVisibility);
      removeEventListener('resize', onResize);
    },
  };
}
