import { createLoop } from '../../core/loop';
import { scrollProgress, trackPointer } from '../../core/pointer';
import type { Demo } from '../../core/types';
import './style.css';

interface Layer {
  el: HTMLElement;
  /** 깊이: 0=배경(느림) ~ 1=전경(빠름) */
  depth: number;
}

const img = (name: string) => `${import.meta.env.BASE_URL}img/${name}.jpg`;

/** [left%, top%, width(vw), depth, 이미지 or 텍스트] */
const ITEMS: Array<[number, number, number, number, string]> = [
  [8, 58, 15, 0.25, 'parallax-3'],
  [64, 8, 13, 0.4, 'parallax-2'],
  [50, 50, 0, 0.15, 'text:DEPTH'],
  [72, 56, 20, 0.75, 'parallax-1'],
  [18, 12, 18, 0.95, 'parallax-4'],
];

export function create(container: HTMLElement): Demo {
  const block = container.closest<HTMLElement>('.demo-block') ?? container;
  const root = document.createElement('div');
  root.className = 'plx';
  container.appendChild(root);
  const pointer = trackPointer(container);

  const layers: Layer[] = ITEMS.map(([x, y, w, depth, src]) => {
    const el = document.createElement('div');
    el.className = 'plx__layer';
    el.style.left = `${x}%`;
    el.style.top = `${y}%`;
    el.style.zIndex = String(Math.round(depth * 10));
    if (src.startsWith('text:')) {
      el.classList.add('plx__text');
      el.textContent = src.slice(5);
    } else {
      el.style.width = `${w}vw`;
      const im = document.createElement('img');
      im.src = img(src);
      im.alt = '';
      im.decoding = 'async';
      el.appendChild(im);
      // 가까울수록 선명, 멀수록 흐리게
      el.style.filter = `blur(${(1 - depth) * 2.5}px)`;
    }
    root.appendChild(el);
    return { el, depth };
  });

  let p = 0;
  let tx = 0;
  let ty = 0;
  const loop = createLoop(() => {
    p += (scrollProgress(block) - p) * 0.15;
    const vh = window.innerHeight;
    tx += ((pointer.inside ? pointer.nx - 0.5 : 0) - tx) * 0.08;
    ty += ((pointer.inside ? pointer.ny - 0.5 : 0) - ty) * 0.08;
    for (const l of layers) {
      const y = (0.5 - p) * vh * (0.4 + l.depth * 1.4);
      const x = -tx * 80 * l.depth;
      const yy = -ty * 50 * l.depth;
      const extra = l.el.classList.contains('plx__text') ? 'translate(-50%, -50%) ' : '';
      l.el.style.transform = `${extra}translate3d(${x}px, ${y + yy}px, 0)`;
    }
  });
  loop.start();

  return {
    pause: () => loop.stop(),
    resume: () => loop.start(),
    unmount: () => {
      loop.stop();
      pointer.dispose();
      root.remove();
    },
  };
}
