import { createLoop } from '../../core/loop';
import type { Demo } from '../../core/types';
import './style.css';

interface Pt {
  x: number;
  y: number;
}

interface Transform {
  x: number;
  y: number;
  s: number;
  r: number;
}

const clampScale = (s: number) => Math.min(4, Math.max(0.35, s));

export function create(container: HTMLElement): Demo {
  const root = document.createElement('div');
  root.className = 'mt';
  // 이 영역 안의 휠/터치는 페이지 스크롤 대신 제스처로 사용
  root.dataset.lenisPrevent = '';
  root.style.touchAction = 'none';
  root.innerHTML = `
    <div class="mt__grid"></div>
    <div class="mt__card">
      <span class="mt__card-k">GESTURE</span>
      <span class="mt__card-t">Pinch<br/>Rotate<br/>Pan</span>
      <span class="mt__card-v"></span>
    </div>
    <svg class="mt__overlay"></svg>
    <div class="demo-ui"><button type="button">리셋</button></div>
  `;
  container.appendChild(root);
  const card = root.querySelector<HTMLElement>('.mt__card')!;
  const readout = root.querySelector<HTMLElement>('.mt__card-v')!;
  const overlay = root.querySelector<SVGSVGElement>('.mt__overlay')!;
  const resetBtn = root.querySelector<HTMLButtonElement>('.demo-ui button')!;

  const target: Transform = { x: 0, y: 0, s: 1, r: 0 };
  const view: Transform = { x: 0, y: 0, s: 1, r: 0 };
  const pointers = new Map<number, Pt>();
  let start: { t: Transform; pts: Pt[] } | null = null;

  const local = (e: PointerEvent | WheelEvent): Pt => {
    const r = root.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  };

  let lastAngle = 0;
  const snapshot = () => {
    const pts = [...pointers.values()].slice(0, 2).map((p) => ({ ...p }));
    start = { t: { ...target }, pts };
    if (pts.length >= 2) lastAngle = Math.atan2(pts[1].y - pts[0].y, pts[1].x - pts[0].x);
  };

  const onDown = (e: PointerEvent) => {
    if ((e.target as Element).closest('.demo-ui')) return;
    root.setPointerCapture(e.pointerId);
    pointers.set(e.pointerId, local(e));
    snapshot();
  };
  const onMove = (e: PointerEvent) => {
    if (!pointers.has(e.pointerId) || !start) return;
    pointers.set(e.pointerId, local(e));
    const pts = [...pointers.values()].slice(0, 2);
    const s0 = start.pts;
    if (pts.length === 1 && s0.length >= 1) {
      target.x = start.t.x + pts[0].x - s0[0].x;
      target.y = start.t.y + pts[0].y - s0[0].y;
    } else if (pts.length >= 2 && s0.length >= 2) {
      const d0 = Math.hypot(s0[1].x - s0[0].x, s0[1].y - s0[0].y) || 1;
      const d1 = Math.hypot(pts[1].x - pts[0].x, pts[1].y - pts[0].y);
      const a1 = Math.atan2(pts[1].y - pts[0].y, pts[1].x - pts[0].x);
      const m0 = { x: (s0[0].x + s0[1].x) / 2, y: (s0[0].y + s0[1].y) / 2 };
      const m1 = { x: (pts[0].x + pts[1].x) / 2, y: (pts[0].y + pts[1].y) / 2 };
      target.s = clampScale(start.t.s * (d1 / d0));
      // 프레임 간 증분을 ±π 로 정규화해 누적 → 반 바퀴 이상 돌려도 튀지 않는다
      target.r += Math.atan2(Math.sin(a1 - lastAngle), Math.cos(a1 - lastAngle));
      lastAngle = a1;
      target.x = start.t.x + m1.x - m0.x;
      target.y = start.t.y + m1.y - m0.y;
    }
  };
  const onUp = (e: PointerEvent) => {
    pointers.delete(e.pointerId);
    snapshot();
  };
  const onWheel = (e: WheelEvent) => {
    e.preventDefault();
    if (e.shiftKey) target.r += (e.deltaY || e.deltaX) * 0.004;
    else target.s = clampScale(target.s * Math.exp(-e.deltaY * 0.0015));
  };
  const reset = () => Object.assign(target, { x: 0, y: 0, s: 1, r: 0 });

  root.addEventListener('pointerdown', onDown);
  root.addEventListener('pointermove', onMove);
  root.addEventListener('pointerup', onUp);
  root.addEventListener('pointercancel', onUp);
  root.addEventListener('wheel', onWheel, { passive: false });
  resetBtn.addEventListener('click', reset);

  const loop = createLoop(() => {
    const k = 0.22;
    view.x += (target.x - view.x) * k;
    view.y += (target.y - view.y) * k;
    view.s += (target.s - view.s) * k;
    view.r += (target.r - view.r) * k;
    card.style.transform = `translate(-50%, -50%) translate(${view.x}px, ${view.y}px) rotate(${view.r}rad) scale(${view.s})`;
    readout.textContent = `×${view.s.toFixed(2)}  ${Math.round((view.r * 180) / Math.PI)}°`;

    // 활성 포인터 시각화
    const pts = [...pointers.values()];
    let svg = pts
      .map((p) => `<circle cx="${p.x}" cy="${p.y}" r="34" class="mt__touch"/><circle cx="${p.x}" cy="${p.y}" r="4" class="mt__dot"/>`)
      .join('');
    if (pts.length >= 2) svg += `<line x1="${pts[0].x}" y1="${pts[0].y}" x2="${pts[1].x}" y2="${pts[1].y}" class="mt__line"/>`;
    overlay.innerHTML = svg;
  });
  loop.start();

  return {
    pause: () => loop.stop(),
    resume: () => loop.start(),
    unmount: () => {
      loop.stop();
      root.remove();
    },
  };
}
