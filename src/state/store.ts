/**
 * Persistent player profile in localStorage. Writes are batched onto idle time
 * so recording an answer never blocks the input path.
 */
import type { FactStats } from '../game/questions';

export interface RoundRecord {
  mode: GameModeId;
  at: number;
  correct: number;
  wrong: number;
}

export type GameModeId = 'sprint' | 'race' | 'practice' | 'pitstop';

export interface Settings {
  sound: boolean;
  haptics: boolean;
}

export interface Profile {
  version: 1;
  name: string;
  points: number;
  /** Correct counts from ranked Sprint rounds, oldest first. */
  sprintHistory: number[];
  bestSprint: number;
  racesWon: number;
  racesPlayed: number;
  facts: FactStats;
  recent: RoundRecord[];
  settings: Settings;
  /** Last tables/ops chosen in Practice. */
  practice: { tables: number[]; ops: ('mul' | 'div')[]; timed: boolean };
}

const KEY = 'turbo-tables:v1';
const MAX_HISTORY = 50;
const MAX_RECENT = 30;

export function defaultProfile(): Profile {
  return {
    version: 1,
    name: '',
    points: 0,
    sprintHistory: [],
    bestSprint: 0,
    racesWon: 0,
    racesPlayed: 0,
    facts: {},
    recent: [],
    settings: { sound: true, haptics: true },
    practice: { tables: [2, 5, 10], ops: ['mul'], timed: true },
  };
}

function load(): Profile {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return defaultProfile();
    const parsed = JSON.parse(raw) as Partial<Profile>;
    const base = defaultProfile();
    return {
      ...base,
      ...parsed,
      settings: { ...base.settings, ...parsed.settings },
      practice: { ...base.practice, ...parsed.practice },
      facts: parsed.facts ?? {},
    };
  } catch {
    return defaultProfile();
  }
}

let profile: Profile = load();
let saveQueued = false;

type IdleCb = (cb: () => void) => void;
const whenIdle: IdleCb =
  typeof requestIdleCallback === 'function'
    ? (cb) => requestIdleCallback(cb, { timeout: 1000 })
    : (cb) => setTimeout(cb, 200);

function flush(): void {
  saveQueued = false;
  try {
    localStorage.setItem(KEY, JSON.stringify(profile));
  } catch {
    /* storage full or unavailable (private mode) — keep playing in memory */
  }
}

export function save(): void {
  if (saveQueued) return;
  saveQueued = true;
  whenIdle(flush);
}

/** Write immediately — used when the page is being hidden. */
export function saveNow(): void {
  flush();
}

export function getProfile(): Profile {
  return profile;
}

export function updateProfile(mut: (p: Profile) => void): void {
  mut(profile);
  save();
}

export function resetProfile(): void {
  const { name, settings } = profile;
  profile = { ...defaultProfile(), name, settings };
  saveNow();
}

export function recordAnswer(fact: string, correct: boolean, ms: number): void {
  const s = (profile.facts[fact] ??= { n: 0, ok: 0, ms: 0 });
  s.n++;
  if (correct) {
    s.ok++;
    // Cap outliers (e.g. the player walked away) so one slow answer doesn't
    // dominate the average forever.
    s.ms += Math.min(ms, 15000);
  }
}

export function recordRound(rec: RoundRecord): void {
  profile.recent.push(rec);
  if (profile.recent.length > MAX_RECENT) profile.recent.splice(0, profile.recent.length - MAX_RECENT);
  if (rec.mode === 'sprint') {
    profile.sprintHistory.push(rec.correct);
    if (profile.sprintHistory.length > MAX_HISTORY) profile.sprintHistory.shift();
    profile.bestSprint = Math.max(profile.bestSprint, rec.correct);
  }
  save();
}

if (typeof window !== 'undefined') {
  // Mobile browsers may kill a backgrounded tab without warning.
  addEventListener('pagehide', saveNow);
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') saveNow();
  });
}
