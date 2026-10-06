import { createLoop, prefersReducedMotion } from '../core/loop';

interface Letter {
  el: HTMLElement;
  /** 기준 위치 (페이지 좌표가 아닌 요소 내부 중심) */
  cx: number;
  cy: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
}

/** 아웃트로 타이포: 글자마다 스프링이 달려 커서를 피했다가 돌아온다 */
export function initOutro(): void {
  const box = document.querySelector<HTMLElement>('[data-outro]');
  if (!box || prefersReducedMotion()) return;
  const lines = box.innerHTML.split(/<br\s*\/?>/i);
  box.innerHTML = lines
    .map(
      (line) =>
        `<span class="outro__line" aria-hidden="true">${[...line.trim()]
          .map((ch) => (ch === ' ' ? '<span class="outro__sp"> </span>' : `<span class="outro__ch">${ch}</span>`))
          .join('')}</span>`,
    )
    .join('');
  const letters: Letter[] = Array.from(box.querySelectorAll<HTMLElement>('.outro__ch')).map((el) => ({
    el,
    cx: 0,
    cy: 0,
    x: 0,
    y: 0,
    vx: 0,
    vy: 0,
  }));

  const measure = () => {
    const host = box.getBoundingClientRect();
    for (const l of letters) {
      const r = l.el.getBoundingClientRect();
      l.cx = r.left - host.left - l.x + r.width / 2;
      l.cy = r.top - host.top - l.y + r.height / 2;
    }
  };
  new ResizeObserver(measure).observe(box);

  let mx = -1e4;
  let my = -1e4;
  box.addEventListener('pointermove', (e) => {
    const r = box.getBoundingClientRect();
    mx = e.clientX - r.left;
    my = e.clientY - r.top;
  });
  box.addEventListener('pointerleave', () => {
    mx = my = -1e4;
  });

  const R = 180;
  const loop = createLoop((dt) => {
    const k = Math.min(1, dt * 60);
    for (const l of letters) {
      const dx = l.cx + l.x - mx;
      const dy = l.cy + l.y - my;
      const d = Math.hypot(dx, dy);
      if (d < R && d > 0) {
        const f = (1 - d / R) * 2.6 * k;
        l.vx += (dx / d) * f;
        l.vy += (dy / d) * f;
      }
      // 스프링 복원 + 감쇠
      l.vx += -l.x * 0.06 * k;
      l.vy += -l.y * 0.06 * k;
      l.vx *= Math.pow(0.86, k);
      l.vy *= Math.pow(0.86, k);
      l.x += l.vx * k;
      l.y += l.vy * k;
      const rot = l.x * 0.15;
      l.el.style.transform = `translate3d(${l.x}px, ${l.y}px, 0) rotate(${rot}deg)`;
    }
  });
  new IntersectionObserver(([e]) => (e.isIntersecting ? (measure(), loop.start()) : loop.stop())).observe(box);
}
