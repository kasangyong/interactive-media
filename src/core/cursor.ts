import type { CursorMode } from './types';

const LABEL: Record<CursorMode, string> = { drag: 'Drag', view: 'Move', click: 'Click', sound: 'Play' };

/** 점(즉시 추적) + 링(지연 추적) 커스텀 커서. 터치 전용 기기에서는 비활성 */
export function initCursor(): void {
  if (!window.matchMedia('(hover: hover) and (pointer: fine)').matches) return;
  const root = document.querySelector<HTMLElement>('.cursor');
  const dot = root?.querySelector<HTMLElement>('.cursor__dot');
  const ring = root?.querySelector<HTMLElement>('.cursor__ring');
  const label = root?.querySelector<HTMLElement>('.cursor__label');
  if (!root || !dot || !ring || !label) return;
  document.documentElement.classList.add('has-cursor');

  let x = -100;
  let y = -100;
  let rx = x;
  let ry = y;
  let visible = false;

  window.addEventListener('pointermove', (e) => {
    if (e.pointerType !== 'mouse') return;
    x = e.clientX;
    y = e.clientY;
    if (!visible) {
      visible = true;
      rx = x;
      ry = y;
      root.classList.add('is-visible');
    }
  });
  document.addEventListener('pointerleave', () => {
    visible = false;
    root.classList.remove('is-visible');
  });
  window.addEventListener('pointerdown', () => root.classList.add('is-down'));
  window.addEventListener('pointerup', () => root.classList.remove('is-down'));

  document.addEventListener('pointerover', (e) => {
    const t = e.target as Element | null;
    const modeEl = t?.closest<HTMLElement>('[data-cursor]');
    const mode = modeEl?.dataset.cursor as CursorMode | undefined;
    const interactive = t?.closest('a, button');
    root.classList.toggle('is-link', !!interactive && !mode);
    root.classList.toggle('is-mode', !!mode && !interactive);
    label.textContent = mode && !interactive ? LABEL[mode] : '';
  });

  const tick = () => {
    rx += (x - rx) * 0.18;
    ry += (y - ry) * 0.18;
    dot.style.transform = `translate3d(${x}px, ${y}px, 0)`;
    ring.style.transform = `translate3d(${rx}px, ${ry}px, 0)`;
    requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
}
