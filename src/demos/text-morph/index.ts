import { createLoop } from '../../core/loop';
import { scrollProgress, trackPointer } from '../../core/pointer';
import { createStage2D } from '../../core/stage';
import type { Demo } from '../../core/types';

const WORDS = ['SCROLL', 'TIME', 'MOTION'];
const COUNT = 4200;
const FONT = 'Archivo';

/** 오프스크린 캔버스에 단어를 그려 채워진 픽셀 좌표를 COUNT 개로 샘플링 */
function sampleWord(word: string, w: number, h: number): Float32Array {
  const c = document.createElement('canvas');
  const scale = 0.5;
  c.width = Math.max(1, Math.round(w * scale));
  c.height = Math.max(1, Math.round(h * scale));
  const ctx = c.getContext('2d', { willReadFrequently: true });
  const out = new Float32Array(COUNT * 2);
  if (!ctx) return out;
  let size = c.height * 0.42;
  ctx.font = `800 ${size}px ${FONT}, sans-serif`;
  const tw = ctx.measureText(word).width;
  if (tw > c.width * 0.86) size *= (c.width * 0.86) / tw;
  ctx.font = `800 ${size}px ${FONT}, sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = '#000';
  ctx.fillText(word, c.width / 2, c.height * 0.55);
  const data = ctx.getImageData(0, 0, c.width, c.height).data;
  const pts: number[] = [];
  const stepPx = 2;
  for (let y = 0; y < c.height; y += stepPx) {
    for (let x = 0; x < c.width; x += stepPx) {
      if (data[(y * c.width + x) * 4 + 3] > 128) pts.push(x / scale, y / scale);
    }
  }
  const n = pts.length / 2;
  for (let i = 0; i < COUNT; i++) {
    // 점이 모자라면 무작위로 반복, 남으면 무작위로 고른다
    const k = n ? Math.floor(Math.random() * n) : 0;
    out[i * 2] = (pts[k * 2] ?? w / 2) + (Math.random() - 0.5) * 2;
    out[i * 2 + 1] = (pts[k * 2 + 1] ?? h / 2) + (Math.random() - 0.5) * 2;
  }
  return out;
}

export async function create(container: HTMLElement): Promise<Demo> {
  const block = container.closest<HTMLElement>('.demo-block') ?? container;
  await document.fonts.load(`800 100px ${FONT}`).catch(() => undefined);
  const stage = createStage2D(container);
  const { ctx } = stage;
  const pointer = trackPointer(container);
  const fg = getComputedStyle(container).getPropertyValue('--fg').trim() || '#0b0b0b';
  const accent = getComputedStyle(container).getPropertyValue('--accent').trim() || '#1a3cff';

  let targets: Float32Array[] = [];
  const delay = new Float32Array(COUNT);
  const pos = new Float32Array(COUNT * 2);
  const vel = new Float32Array(COUNT * 2);
  for (let i = 0; i < COUNT; i++) delay[i] = Math.random();

  const build = () => {
    const first = targets.length === 0;
    targets = WORDS.map((w) => sampleWord(w, stage.width, stage.height));
    // 첫 구축 때만 위치를 초기화 — 리사이즈 시에는 점들이 새 자리로 흘러가게 둔다
    if (first) pos.set(targets[0]);
  };
  build();
  // 리사이즈 중에는 샘플링 비용이 크므로 멈춘 뒤 한 번만 재구축
  let resizeTimer = 0;
  stage.onResize(() => {
    window.clearTimeout(resizeTimer);
    resizeTimer = window.setTimeout(build, 180);
  });

  let p = 0;
  const loop = createLoop((dt, time) => {
    p += (scrollProgress(block) - p) * 0.1;
    const seg = p * (WORDS.length - 1);
    const i0 = Math.min(WORDS.length - 2, Math.floor(seg));
    const local = seg - i0;
    const A = targets[i0];
    const B = targets[i0 + 1];
    ctx.clearRect(0, 0, stage.width, stage.height);
    const k = 1 - Math.pow(0.0005, dt);
    const mx = pointer.x;
    const my = pointer.y;
    const near = pointer.inside;
    ctx.fillStyle = fg;
    for (let i = 0; i < COUNT; i++) {
      // 점마다 출발이 어긋난 0..1 보간
      const t = Math.min(1, Math.max(0, (local - delay[i] * 0.45) / 0.5));
      const e = t * t * (3 - 2 * t);
      const lift = Math.sin(e * Math.PI) * 60 * (delay[i] - 0.5);
      let tx = A[i * 2] + (B[i * 2] - A[i * 2]) * e;
      let ty = A[i * 2 + 1] + (B[i * 2 + 1] - A[i * 2 + 1]) * e + lift;
      tx += Math.sin(time * 1.5 + i) * 0.6;
      ty += Math.cos(time * 1.3 + i * 0.7) * 0.6;
      const j = i * 2;
      // 커서 반발력
      if (near) {
        const dx = pos[j] - mx;
        const dy = pos[j + 1] - my;
        const d2 = dx * dx + dy * dy;
        if (d2 < 6400) {
          const f = (1 - d2 / 6400) * 900 * dt;
          const d = Math.sqrt(d2) || 1;
          vel[j] += (dx / d) * f;
          vel[j + 1] += (dy / d) * f;
        }
      }
      vel[j] *= 0.88;
      vel[j + 1] *= 0.88;
      pos[j] += (tx - pos[j]) * k + vel[j];
      pos[j + 1] += (ty - pos[j + 1]) * k + vel[j + 1];
      if (i % 11 === 0) {
        ctx.fillStyle = accent;
        ctx.fillRect(pos[j] - 1.2, pos[j + 1] - 1.2, 2.4, 2.4);
        ctx.fillStyle = fg;
      } else {
        ctx.fillRect(pos[j] - 0.9, pos[j + 1] - 0.9, 1.8, 1.8);
      }
    }
  });
  loop.start();

  return {
    pause: () => loop.stop(),
    resume: () => loop.start(),
    unmount: () => {
      loop.stop();
      window.clearTimeout(resizeTimer);
      pointer.dispose();
      stage.dispose();
    },
  };
}
