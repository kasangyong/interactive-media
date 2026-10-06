import { createLoop } from '../../core/loop';
import type { Demo } from '../../core/types';
import './style.css';

interface Ball {
  el: HTMLElement;
  x: number;
  y: number;
  vx: number;
  vy: number;
  r: number;
  held: boolean;
  /** 잡은 지점 오프셋 */
  ox: number;
  oy: number;
  /** 최근 포인터 위치 기록 (던지기 속도 계산) */
  hist: Array<{ x: number; y: number; t: number }>;
}

interface Magnet {
  el: HTMLElement;
  inner: HTMLElement;
  x: number;
  y: number;
  tx: number;
  ty: number;
}

const LABELS = ['Hover', 'Pull', 'Snap'];
const BALL_COLORS = ['#7d95ff', '#eef0ff', '#3c55e8', '#b9c6ff', '#ffffff'];
const RADIUS = 120;

export function create(container: HTMLElement): Demo {
  const root = document.createElement('div');
  root.className = 'mag';
  container.appendChild(root);

  const row = document.createElement('div');
  row.className = 'mag__row';
  root.appendChild(row);
  const magnets: Magnet[] = LABELS.map((label) => {
    const el = document.createElement('button');
    el.type = 'button';
    el.className = 'mag__btn';
    const inner = document.createElement('span');
    inner.textContent = label;
    el.appendChild(inner);
    row.appendChild(el);
    return { el, inner, x: 0, y: 0, tx: 0, ty: 0 };
  });

  const ui = document.createElement('div');
  ui.className = 'demo-ui';
  const gravityBtn = document.createElement('button');
  gravityBtn.type = 'button';
  gravityBtn.textContent = '중력';
  gravityBtn.setAttribute('aria-pressed', 'true');
  ui.appendChild(gravityBtn);
  root.appendChild(ui);
  let gravity = true;
  gravityBtn.addEventListener('click', () => {
    gravity = !gravity;
    gravityBtn.setAttribute('aria-pressed', String(gravity));
    if (!gravity) for (const b of balls) {
      b.vx += (Math.random() - 0.5) * 300;
      b.vy -= 200 + Math.random() * 200;
    }
  });

  let W = container.clientWidth;
  let H = container.clientHeight;
  const balls: Ball[] = BALL_COLORS.map((c, i) => {
    const el = document.createElement('div');
    el.className = 'mag__ball';
    const r = 34 + ((i * 17) % 40);
    el.style.width = el.style.height = `${r * 2}px`;
    el.style.background = c;
    root.appendChild(el);
    return { el, r, x: W * (0.2 + i * 0.15), y: H * 0.45, vx: (Math.random() - 0.5) * 200, vy: 0, held: false, ox: 0, oy: 0, hist: [] };
  });

  const ro = new ResizeObserver(() => {
    W = container.clientWidth;
    H = container.clientHeight;
  });
  ro.observe(container);

  // 포인터
  let mx = -9999;
  let my = -9999;
  const local = (e: PointerEvent) => {
    const r = container.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  };
  const onMove = (e: PointerEvent) => {
    const p = local(e);
    mx = p.x;
    my = p.y;
    for (const b of balls) {
      if (!b.held) continue;
      b.x = p.x - b.ox;
      b.y = p.y - b.oy;
      b.hist.push({ x: b.x, y: b.y, t: performance.now() });
      if (b.hist.length > 6) b.hist.shift();
    }
  };
  const onLeave = () => {
    mx = my = -9999;
  };
  container.addEventListener('pointermove', onMove);
  container.addEventListener('pointerleave', onLeave);

  for (const b of balls) {
    b.el.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      b.el.setPointerCapture(e.pointerId);
      const p = local(e);
      b.held = true;
      b.ox = p.x - b.x;
      b.oy = p.y - b.y;
      b.hist = [{ x: b.x, y: b.y, t: performance.now() }];
      b.el.classList.add('is-held');
    });
    const release = () => {
      if (!b.held) return;
      b.held = false;
      b.el.classList.remove('is-held');
      const h = b.hist;
      if (h.length >= 2) {
        const a = h[0];
        const z = h[h.length - 1];
        const dt = Math.max(16, z.t - a.t) / 1000;
        b.vx = (z.x - a.x) / dt;
        b.vy = (z.y - a.y) / dt;
      }
    };
    b.el.addEventListener('pointerup', release);
    b.el.addEventListener('pointercancel', release);
  }

  const loop = createLoop((dt) => {
    // 자석 버튼
    for (const m of magnets) {
      const rect = m.el.getBoundingClientRect();
      const host = container.getBoundingClientRect();
      const cx = rect.left - host.left + rect.width / 2 - m.x;
      const cy = rect.top - host.top + rect.height / 2 - m.y;
      const dx = mx - cx;
      const dy = my - cy;
      const d = Math.hypot(dx, dy);
      const pull = d < RADIUS + rect.width / 2;
      m.tx = pull ? dx * 0.38 : 0;
      m.ty = pull ? dy * 0.38 : 0;
      const k = pull ? 0.2 : 0.1;
      m.x += (m.tx - m.x) * k;
      m.y += (m.ty - m.y) * k;
      m.el.style.transform = `translate3d(${m.x}px, ${m.y}px, 0)`;
      m.inner.style.transform = `translate3d(${m.x * 0.35}px, ${m.y * 0.35}px, 0)`;
      m.el.classList.toggle('is-pulled', pull);
    }

    // 공 물리
    const g = gravity ? 1600 : 0;
    const air = Math.pow(gravity ? 0.6 : 0.85, dt);
    for (const b of balls) {
      if (b.held) {
        b.vx = b.vy = 0;
        continue;
      }
      b.vy += g * dt;
      b.vx *= air;
      b.vy *= air;
      b.x += b.vx * dt;
      b.y += b.vy * dt;
      if (b.x < b.r) {
        b.x = b.r;
        b.vx = Math.abs(b.vx) * 0.78;
      }
      if (b.x > W - b.r) {
        b.x = W - b.r;
        b.vx = -Math.abs(b.vx) * 0.78;
      }
      if (b.y < b.r) {
        b.y = b.r;
        b.vy = Math.abs(b.vy) * 0.78;
      }
      if (b.y > H - b.r) {
        b.y = H - b.r;
        b.vy = -Math.abs(b.vy) * 0.62;
        b.vx *= Math.pow(0.2, dt);
      }
    }
    // 원-원 충돌 (위치 분리 + 탄성 충격량)
    for (let i = 0; i < balls.length; i++) {
      for (let j = i + 1; j < balls.length; j++) {
        const a = balls[i];
        const c = balls[j];
        const dx = c.x - a.x;
        const dy = c.y - a.y;
        const dist = Math.hypot(dx, dy) || 0.001;
        const overlap = a.r + c.r - dist;
        if (overlap <= 0) continue;
        const nx = dx / dist;
        const ny = dy / dist;
        const ma = a.held ? 1e6 : a.r * a.r;
        const mc = c.held ? 1e6 : c.r * c.r;
        const total = ma + mc;
        a.x -= nx * overlap * (mc / total);
        a.y -= ny * overlap * (mc / total);
        c.x += nx * overlap * (ma / total);
        c.y += ny * overlap * (ma / total);
        const rel = (c.vx - a.vx) * nx + (c.vy - a.vy) * ny;
        if (rel < 0) {
          const imp = (-(1 + 0.7) * rel) / (1 / ma + 1 / mc);
          a.vx -= (imp / ma) * nx;
          a.vy -= (imp / ma) * ny;
          c.vx += (imp / mc) * nx;
          c.vy += (imp / mc) * ny;
        }
      }
    }
    for (const b of balls) {
      const squash = Math.min(0.18, Math.hypot(b.vx, b.vy) / 6000);
      const ang = Math.atan2(b.vy, b.vx);
      b.el.style.transform = `translate3d(${b.x - b.r}px, ${b.y - b.r}px, 0) rotate(${ang}rad) scale(${1 + squash}, ${1 - squash}) rotate(${-ang}rad)`;
    }
  });
  loop.start();

  return {
    pause: () => loop.stop(),
    resume: () => loop.start(),
    unmount: () => {
      loop.stop();
      ro.disconnect();
      container.removeEventListener('pointermove', onMove);
      container.removeEventListener('pointerleave', onLeave);
      root.remove();
    },
  };
}
