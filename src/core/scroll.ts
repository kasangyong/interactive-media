import Lenis from 'lenis';
import 'lenis/dist/lenis.css';
import { prefersReducedMotion } from './loop';

export interface ScrollController {
  scrollTo(target: HTMLElement | number): void;
  onScroll(cb: (y: number) => void): void;
  stop(): void;
  start(): void;
}

/** Lenis 스무스 스크롤. reduced-motion 이면 네이티브 스크롤 그대로 사용 */
export function initScroll(): ScrollController {
  const cbs: Array<(y: number) => void> = [];
  const emit = () => {
    for (const cb of cbs) cb(window.scrollY);
  };

  if (prefersReducedMotion()) {
    window.addEventListener('scroll', emit, { passive: true });
    return {
      scrollTo: (t) => (typeof t === 'number' ? window.scrollTo(0, t) : t.scrollIntoView()),
      onScroll: (cb) => cbs.push(cb),
      stop: () => document.documentElement.classList.add('scroll-locked'),
      start: () => document.documentElement.classList.remove('scroll-locked'),
    };
  }

  const lenis = new Lenis({ autoRaf: true, lerp: 0.09, anchors: true });
  lenis.on('scroll', emit);
  return {
    scrollTo: (t) => lenis.scrollTo(t, { duration: 1.6 }),
    onScroll: (cb) => cbs.push(cb),
    stop: () => lenis.stop(),
    start: () => lenis.start(),
  };
}
