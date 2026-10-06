import { createLoop } from '../../core/loop';
import { trackPointer } from '../../core/pointer';
import { createStage2D } from '../../core/stage';
import type { Demo } from '../../core/types';

const MAX = 1600;

export function create(container: HTMLElement): Demo {
  const stage = createStage2D(container);
  const { ctx } = stage;
  const pointer = trackPointer(container);

  // 구조체 배열 대신 typed array 풀
  const px = new Float32Array(MAX);
  const py = new Float32Array(MAX);
  const vx = new Float32Array(MAX);
  const vy = new Float32Array(MAX);
  const life = new Float32Array(MAX);
  const hue = new Float32Array(MAX);
  const size = new Float32Array(MAX);
  let cursor = 0;

  const trail: Array<{ x: number; y: number }> = [];
  let ex = stage.width / 2;
  let ey = stage.height / 2;

  function emit(x: number, y: number, dx: number, dy: number, speed: number) {
    const n = Math.min(24, 1 + Math.floor(speed / 90));
    for (let k = 0; k < n; k++) {
      const i = cursor;
      cursor = (cursor + 1) % MAX;
      const a = Math.random() * Math.PI * 2;
      const s = 20 + Math.random() * 60 + speed * 0.05;
      px[i] = x + (Math.random() - 0.5) * 6;
      py[i] = y + (Math.random() - 0.5) * 6;
      vx[i] = Math.cos(a) * s + dx * 0.15;
      vy[i] = Math.sin(a) * s + dy * 0.15;
      life[i] = 1;
      hue[i] = (220 + speed * 0.04 + Math.random() * 40) % 360;
      size[i] = 1 + Math.random() * 2.6;
    }
  }

  const loop = createLoop((dt, t) => {
    let x: number;
    let y: number;
    let dx: number;
    let dy: number;
    if (pointer.inside) {
      x = pointer.x;
      y = pointer.y;
      dx = pointer.vx;
      dy = pointer.vy;
    } else {
      // 어트랙트 모드: 리사주 곡선을 따라 스스로 움직인다
      const w = stage.width;
      const h = stage.height;
      const nx = w / 2 + Math.sin(t * 1.3) * w * 0.32;
      const ny = h / 2 + Math.sin(t * 1.9 + 1) * h * 0.28;
      dx = (nx - ex) / Math.max(dt, 1e-3);
      dy = (ny - ey) / Math.max(dt, 1e-3);
      x = nx;
      y = ny;
    }
    const speed = Math.hypot(dx, dy);
    // 이전 위치와 현재 위치 사이를 보간해 끊김 없이 방출
    const steps = Math.max(1, Math.min(6, Math.floor(Math.hypot(x - ex, y - ey) / 12)));
    for (let s = 1; s <= steps; s++) emit(ex + ((x - ex) * s) / steps, ey + ((y - ey) * s) / steps, dx, dy, speed / steps);
    ex = x;
    ey = y;
    trail.push({ x, y });
    if (trail.length > 28) trail.shift();

    ctx.clearRect(0, 0, stage.width, stage.height);
    ctx.globalCompositeOperation = 'lighter';
    const drag = Math.pow(0.04, dt);
    for (let i = 0; i < MAX; i++) {
      if (life[i] <= 0) continue;
      life[i] -= dt / 1.2;
      vx[i] *= drag;
      vy[i] = vy[i] * drag + 30 * dt;
      px[i] += vx[i] * dt;
      py[i] += vy[i] * dt;
      const l = Math.max(life[i], 0);
      ctx.fillStyle = `hsla(${hue[i]}, 95%, ${55 + (1 - l) * 25}%, ${l * 0.9})`;
      ctx.beginPath();
      ctx.arc(px[i], py[i], size[i] * (0.4 + l), 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalCompositeOperation = 'source-over';

    // 리본
    if (trail.length > 2) {
      ctx.lineCap = 'round';
      for (let i = 1; i < trail.length; i++) {
        const k = i / trail.length;
        ctx.strokeStyle = `rgba(238, 240, 255, ${k * 0.8})`;
        ctx.lineWidth = k * 3;
        ctx.beginPath();
        ctx.moveTo(trail[i - 1].x, trail[i - 1].y);
        ctx.lineTo(trail[i].x, trail[i].y);
        ctx.stroke();
      }
    }
  });
  loop.start();

  return {
    pause: () => loop.stop(),
    resume: () => loop.start(),
    unmount: () => {
      loop.stop();
      pointer.dispose();
      stage.dispose();
    },
  };
}
