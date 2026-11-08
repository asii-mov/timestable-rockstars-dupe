/**
 * Minimal screen router. Each screen builds its own DOM and returns an
 * optional cleanup. The hardware/browser Back button returns to the home
 * screen instead of leaving the app.
 */

export interface Screen {
  el: HTMLElement;
  /** Called after the element is attached (focus, start loops, …). */
  mount?(): void;
  /** Called before the element is removed (stop loops, remove listeners). */
  destroy?(): void;
}

export type ScreenFactory = () => Screen;

let root: HTMLElement;
let current: Screen | null = null;
let homeFactory: ScreenFactory;
let depth = 0;

export function initRouter(el: HTMLElement, home: ScreenFactory): void {
  root = el;
  homeFactory = home;
  history.replaceState({ depth: 0 }, '');
  addEventListener('popstate', (e) => {
    const d = (e.state as { depth?: number } | null)?.depth ?? 0;
    depth = d;
    if (d === 0) swap(homeFactory());
  });
  swap(home());
}

function swap(next: Screen): void {
  current?.destroy?.();
  root.replaceChildren(next.el);
  current = next;
  // Each screen starts scrolled to the top.
  root.scrollTop = 0;
  window.scrollTo(0, 0);
  next.mount?.();
}

/** Show a screen. Screens off the home screen get a history entry. */
export function go(factory: ScreenFactory): void {
  if (depth === 0) {
    depth = 1;
    history.pushState({ depth: 1 }, '');
  }
  swap(factory());
}

export function goHome(): void {
  if (depth > 0) {
    // Pop our history entry; popstate renders home.
    history.back();
  } else {
    swap(homeFactory());
  }
}
