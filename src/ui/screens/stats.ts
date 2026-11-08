/** Stats: rank ladder, recent Sprint scores and a 12×12 fact heat map. */
import { h, svg } from '../dom';
import { goHome, type Screen } from '../router';
import { averageSpeed, RANKS, rankFor } from '../../game/ranks';
import { ALL_TABLES, factKey, type FactStat } from '../../game/questions';
import { getProfile } from '../../state/store';

type Level = 'none' | 'weak' | 'ok' | 'good' | 'great';

/** Classify how well a fact is known, from accuracy and speed. */
export function factLevel(s: FactStat | undefined): Level {
  if (!s || s.n === 0) return 'none';
  const acc = s.ok / s.n;
  const avg = s.ok ? s.ms / s.ok : Infinity;
  if (acc < 0.7 || avg > 6000) return 'weak';
  if (acc < 0.85 || avg > 3500) return 'ok';
  if (acc < 0.95 || avg > 2000) return 'good';
  return 'great';
}

const LEVEL_LABEL: Record<Level, string> = {
  none: 'Not tried',
  weak: 'Needs work',
  ok: 'Getting there',
  good: 'Good',
  great: 'Lightning fast',
};

function sparkline(values: number[]): SVGSVGElement {
  const w = 300;
  const hgt = 80;
  const pad = 6;
  const max = Math.max(10, ...values);
  const step = values.length > 1 ? (w - pad * 2) / (values.length - 1) : 0;
  const pts = values.map((v, i) => [pad + i * step, hgt - pad - (v / max) * (hgt - pad * 2)] as const);
  const d = pts.map(([x, y], i) => `${i ? 'L' : 'M'}${x.toFixed(1)},${y.toFixed(1)}`).join('');
  const last = pts[pts.length - 1];
  return svg(
    'svg',
    { viewBox: `0 0 ${w} ${hgt}`, class: 'spark', role: 'img', 'aria-label': `Last ${values.length} Sprint scores` },
    svg('path', { d, fill: 'none', stroke: 'currentColor', 'stroke-width': 3, 'stroke-linejoin': 'round', 'stroke-linecap': 'round' }),
    ...(last ? [svg('circle', { cx: last[0], cy: last[1], r: 5, fill: 'currentColor' })] : []),
  );
}

export function statsScreen(): Screen {
  const p = getProfile();
  const avg = averageSpeed(p.sprintHistory);
  const rank = rankFor(avg);
  const recent = p.sprintHistory.slice(-20);

  // Heat map: header row + 12 rows, built as a single fragment.
  const cells: HTMLElement[] = [h('div', { class: 'hm-head hm-corner' }, '×')];
  for (const c of ALL_TABLES) cells.push(h('div', { class: 'hm-head' }, String(c)));
  for (const r of ALL_TABLES) {
    cells.push(h('div', { class: 'hm-head' }, String(r)));
    for (const c of ALL_TABLES) {
      const s = p.facts[factKey(r, c)];
      const level = factLevel(s);
      const title = s?.ok
        ? `${r} × ${c} = ${r * c} · ${Math.round((s.ok / s.n) * 100)}% · ${(s.ms / s.ok / 1000).toFixed(1)}s`
        : `${r} × ${c} = ${r * c} · ${LEVEL_LABEL[level]}`;
      cells.push(h('div', { class: `hm-cell lv-${level}`, title }, String(r * c)));
    }
  }

  const el = h(
    'section',
    { class: 'screen stats' },
    h(
      'header',
      { class: 'topbar' },
      h('button', { class: 'icon-btn', 'aria-label': 'Back', onclick: () => goHome() }, '←'),
      h('h1', { class: 'screen-title' }, '📊 My stats'),
      h('span', { class: 'spacer' }),
    ),
    h(
      'div',
      { class: 'stats-grid' },
      h('div', { class: 'stat' }, h('span', { class: 'stat-value' }, p.points.toLocaleString()), h('span', { class: 'stat-label' }, 'points')),
      h('div', { class: 'stat' }, h('span', { class: 'stat-value' }, String(p.bestSprint)), h('span', { class: 'stat-label' }, 'best sprint')),
      h('div', { class: 'stat' }, h('span', { class: 'stat-value' }, avg === null ? '—' : avg.toFixed(2)), h('span', { class: 'stat-label' }, 'sec / answer')),
      h('div', { class: 'stat' }, h('span', { class: 'stat-value' }, `${p.racesWon}/${p.racesPlayed}`), h('span', { class: 'stat-label' }, 'races won')),
    ),

    h('h2', { class: 'section-title' }, 'Speed ranks'),
    h(
      'ol',
      { class: 'ladder' },
      RANKS.map((r) =>
        h(
          'li',
          { class: r === rank ? 'current' : '' },
          h('span', { class: 'rank-emoji' }, r.emoji),
          h('span', { class: 'ladder-title' }, r.title),
          h('span', { class: 'ladder-req' }, r.maxSec === Infinity ? 'start' : `< ${r.maxSec}s`),
        ),
      ),
    ),

    h('h2', { class: 'section-title' }, 'Recent Sprints'),
    recent.length > 1 ? sparkline(recent) : h('p', { class: 'muted' }, 'Play a couple of Sprints to see your progress.'),

    h('h2', { class: 'section-title' }, 'Fact map'),
    h('div', { class: 'heatmap', role: 'table', 'aria-label': 'How well you know each times table fact' }, cells),
    h(
      'ul',
      { class: 'legend' },
      (['none', 'weak', 'ok', 'good', 'great'] as Level[]).map((l) =>
        h('li', null, h('span', { class: `swatch lv-${l}` }), LEVEL_LABEL[l]),
      ),
    ),
  );

  return { el };
}
