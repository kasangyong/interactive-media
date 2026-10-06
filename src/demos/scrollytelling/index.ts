import { createLoop } from '../../core/loop';
import { scrollProgress } from '../../core/pointer';
import type { Demo } from '../../core/types';
import './style.css';

const N = 180;

/** 극좌표 r(θ) 로 정의해 모든 도형이 같은 각도 샘플을 공유 → 자연스럽게 보간된다 */
const SHAPES: Array<(a: number) => number> = [
  () => 1,
  (a) => 0.86 / Math.max(Math.abs(Math.cos(a)), Math.abs(Math.sin(a))),
  (a) => {
    const k = Math.abs(((((a + Math.PI / 2) / ((Math.PI * 2) / 5)) % 1) + 1) % 1 - 0.5) * 2;
    return 0.48 + 0.62 * Math.pow(k, 1.6);
  },
  (a) => 0.78 + 0.22 * Math.sin(a * 8),
];

const STEPS = [
  { k: '01 / 진입', t: '스크롤은 재생 헤드다', d: '사용자가 손가락으로 시간을 움직인다. 화면은 고정되고, 장면만 흐른다.' },
  { k: '02 / 구간', t: '진행도를 장면으로 나눈다', d: '0에서 1 사이를 네 개의 구간으로 쪼개면 각각이 하나의 장면이 된다.' },
  { k: '03 / 보간', t: '사이를 부드럽게 잇는다', d: '두 장면 사이에서는 형태, 색, 회전을 보간한다. 이징이 감정을 만든다.' },
  { k: '04 / 착지', t: '마지막 장면에 머문다', d: '끝에서는 움직임을 줄여 여운을 남긴다. 그리고 다시 스크롤이 페이지를 넘긴다.' },
];

const COLORS = ['#0b0b0b', '#1a3cff', '#0b0b0b', '#1a3cff'];

const ease = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

function pathFor(rs: number[], rot: number, scale: number): string {
  let d = '';
  for (let i = 0; i < N; i++) {
    const a = (i / N) * Math.PI * 2 + rot;
    const x = Math.cos(a) * rs[i] * scale;
    const y = Math.sin(a) * rs[i] * scale;
    d += `${i ? 'L' : 'M'}${x.toFixed(2)},${y.toFixed(2)}`;
  }
  return d + 'Z';
}

export function create(container: HTMLElement): Demo {
  const block = container.closest<HTMLElement>('.demo-block') ?? container;
  const root = document.createElement('div');
  root.className = 'sty';
  root.innerHTML = `
    <div class="sty__steps">${STEPS.map(
      (s) => `<article class="sty__step"><span>${s.k}</span><h4>${s.t}</h4><p>${s.d}</p></article>`,
    ).join('')}</div>
    <svg class="sty__svg" viewBox="-130 -130 260 260" aria-hidden="true">
      <path class="sty__ghost"/>
      <path class="sty__shape"/>
    </svg>
    <div class="sty__bar">${STEPS.map(() => '<i></i>').join('')}<b></b></div>
  `;
  container.appendChild(root);
  const shape = root.querySelector<SVGPathElement>('.sty__shape')!;
  const ghost = root.querySelector<SVGPathElement>('.sty__ghost')!;
  const steps = Array.from(root.querySelectorAll<HTMLElement>('.sty__step'));
  const dots = Array.from(root.querySelectorAll<HTMLElement>('.sty__bar i'));
  const fill = root.querySelector<HTMLElement>('.sty__bar b')!;

  const table = SHAPES.map((f) => Array.from({ length: N }, (_, i) => f((i / N) * Math.PI * 2)));
  const rs = new Array<number>(N).fill(1);

  let p = 0;
  let active = -1;
  const loop = createLoop(() => {
    p += (scrollProgress(block) - p) * 0.12;
    // 각 장면이 머무는 구간(hold)과 넘어가는 구간을 나눈다
    const seg = p * (SHAPES.length - 1);
    const i0 = Math.min(SHAPES.length - 2, Math.floor(seg));
    const local = seg - i0;
    const t = ease(Math.min(1, Math.max(0, (local - 0.25) / 0.5)));
    for (let i = 0; i < N; i++) rs[i] = table[i0][i] + (table[i0 + 1][i] - table[i0][i]) * t;
    const rot = p * Math.PI * 1.5;
    shape.setAttribute('d', pathFor(rs, rot, 100));
    ghost.setAttribute('d', pathFor(rs, -rot * 0.5, 118));
    shape.style.fill = t < 0.5 ? COLORS[i0] : COLORS[i0 + 1];

    const idx = Math.min(STEPS.length - 1, Math.round(seg));
    if (idx !== active) {
      active = idx;
      steps.forEach((s, i) => s.classList.toggle('is-on', i === idx));
      dots.forEach((d, i) => d.classList.toggle('is-on', i <= idx));
    }
    fill.style.transform = `scaleX(${p})`;
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
