# Turbo Tables

A fast, mobile-first times tables game: race through multiplication and division
facts, climb the speed ranks and beat your CPU rivals. Built with **TypeScript and
plain DOM APIs** (no React, no runtime dependencies). The production build is
about 13 KB gzipped.

## Modes

| Mode | What it does |
| --- | --- |
| ⏱️ **Sprint** | 60 seconds, all tables 1–12. Your average seconds-per-answer over the last 10 sprints sets your **speed rank** (Learner Driver → Hyperdrive Legend). |
| 🏁 **Grand Prix** | Race three CPU racers to 15 correct answers. Rival pace adapts to your rank so races stay close. |
| 🎯 **Practice** | Choose any tables, × / ÷ / both, timed or 25 questions. |
| 🔧 **Pit Stop** | 20 questions weighted heavily towards the facts you're slowest at or get wrong most. |

**Stats** shows your rank ladder, recent sprint scores and a 12×12 heat map of every fact.

## Mobile & performance

- On-screen keypad uses one delegated `pointerdown` listener: instant taps, no 300 ms delay, no double-tap zoom (`touch-action`).
- Correct answers auto-submit as soon as they're typed. Wrong answers show the right answer for a moment.
- The play screen fits the viewport exactly (`100dvh`, safe-area insets) and has its own landscape layout. Tested at 320×568, iPhone 13 and 844×390 landscape.
- Per-frame work only touches `transform` and text that actually changed. The rAF loop stops when idle.
- Rounds pause automatically when the app is backgrounded.
- Sounds are synthesised with Web Audio (no audio files to download). Haptics use the Vibration API.
- Progress is saved to `localStorage` during idle time and flushed on `pagehide`.
- Installable PWA with a service worker for offline play.
- Respects `prefers-reduced-motion`. Keyboard is fully supported (digits, Enter, Backspace, Esc to pause).

## Development

This project uses [Bun](https://bun.sh) as its package manager and script runner.

```bash
bun install
bun run dev        # dev server
bun run test       # unit tests (Vitest)
bun run build      # typecheck + production build into dist/
bun run preview    # serve the build
```

Use `bun run test`, not `bun test`: the bare command starts Bun's built-in test runner instead of Vitest.

`dist/` uses relative paths, so it can be hosted from any static host or sub-path (e.g. GitHub Pages).

## Deploying to Cloudflare

Live at **https://turbo-tables.sameemalik101.workers.dev**.

```bash
bun run deploy     # build, bundle into a Worker, and `wrangler deploy`
```

`scripts/build-worker.ts` embeds the whole `dist/` build (~100 KB) into a single
Worker script (`dist-worker/worker.js`), so a deploy is one upload with no
separate asset step. Hashed `/assets/*` files are served with a one-year
immutable cache; `index.html` and `sw.js` always revalidate so updates reach
players straight away. Cloudflare compresses responses at the edge.

Wrangler needs `CLOUDFLARE_API_TOKEN` (with Workers edit permission) and
`CLOUDFLARE_ACCOUNT_ID`, or an interactive `bunx wrangler login`.

## Structure

```
src/
  game/      pure logic: question generator, round, ranks, CPU racers, modes
  state/     persisted profile (localStorage)
  ui/        DOM helpers, router, audio/haptics, screens/
tests/       Vitest unit tests for the game logic
public/      manifest, icons, service worker
```
