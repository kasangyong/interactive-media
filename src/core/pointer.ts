export interface PointerState {
  /** 요소 기준 px */
  x: number;
  y: number;
  /** 0..1 정규화 */
  nx: number;
  ny: number;
  /** px/s 속도 (지수 평활) */
  vx: number;
  vy: number;
  down: boolean;
  inside: boolean;
  dispose(): void;
}

/** 요소 위의 단일 포인터(마우스/첫 터치)를 추적 */
export function trackPointer(el: HTMLElement): PointerState {
  let lastT = performance.now();
  const s: PointerState = {
    x: el.clientWidth / 2,
    y: el.clientHeight / 2,
    nx: 0.5,
    ny: 0.5,
    vx: 0,
    vy: 0,
    down: false,
    inside: false,
    dispose,
  };
  const move = (e: PointerEvent) => {
    if (!e.isPrimary) return;
    const r = el.getBoundingClientRect();
    const x = e.clientX - r.left;
    const y = e.clientY - r.top;
    const now = performance.now();
    const dt = Math.max(1, now - lastT) / 1000;
    lastT = now;
    s.vx = s.vx * 0.6 + ((x - s.x) / dt) * 0.4;
    s.vy = s.vy * 0.6 + ((y - s.y) / dt) * 0.4;
    s.x = x;
    s.y = y;
    s.nx = r.width ? x / r.width : 0.5;
    s.ny = r.height ? y / r.height : 0.5;
    s.inside = true;
  };
  const down = (e: PointerEvent) => {
    if (!e.isPrimary) return;
    move(e);
    s.down = true;
  };
  const up = () => (s.down = false);
  const leave = () => {
    s.inside = false;
    s.down = false;
  };
  el.addEventListener('pointermove', move);
  el.addEventListener('pointerdown', down);
  window.addEventListener('pointerup', up);
  el.addEventListener('pointerleave', leave);
  function dispose() {
    el.removeEventListener('pointermove', move);
    el.removeEventListener('pointerdown', down);
    window.removeEventListener('pointerup', up);
    el.removeEventListener('pointerleave', leave);
  }
  return s;
}

/** sticky 블록의 스크롤 진행도 0..1 (블록 상단이 뷰포트 상단에 닿을 때 0, 하단이 닿을 때 1) */
export function scrollProgress(block: HTMLElement): number {
  const r = block.getBoundingClientRect();
  const total = r.height - window.innerHeight;
  if (total <= 0) return r.top <= 0 ? 1 : 0;
  return Math.min(1, Math.max(0, -r.top / total));
}
