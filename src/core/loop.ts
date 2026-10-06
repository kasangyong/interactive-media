export interface Loop {
  start(): void;
  stop(): void;
  readonly running: boolean;
}

/** requestAnimationFrame 루프. dt 는 초 단위, 최대 1/20s 로 제한 */
export function createLoop(tick: (dt: number, time: number) => void): Loop {
  let raf = 0;
  let last = 0;
  let running = false;
  const frame = (now: number) => {
    const dt = Math.min((now - last) / 1000, 0.05);
    last = now;
    tick(dt, now / 1000);
    raf = requestAnimationFrame(frame);
  };
  return {
    start() {
      if (running) return;
      running = true;
      last = performance.now();
      raf = requestAnimationFrame(frame);
    },
    stop() {
      running = false;
      cancelAnimationFrame(raf);
    },
    get running() {
      return running;
    },
  };
}

export const prefersReducedMotion = () =>
  typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches === true;
