import { createNoise3D } from 'simplex-noise';
import { createLoop } from '../../core/loop';
import { trackPointer } from '../../core/pointer';
import { createStage2D } from '../../core/stage';
import type { Demo } from '../../core/types';

const BG = '7, 7, 10';
const LIME = '198, 255, 61';
const PARTICLES = 3200;
const CELL = 9;

type Mode = 'flow' | 'life';

export function create(container: HTMLElement): Demo {
  // 풀블리드 + 매 프레임 전면 반투명 채우기라 픽셀 수를 줄인다
  const stage = createStage2D(container, { dprCap: 1.5 });
  const g = stage.ctx;
  const pointer = trackPointer(container);
  let noise = createNoise3D();
  let mode: Mode = 'flow';

  // ---- 흐름장 ----
  const px = new Float32Array(PARTICLES);
  const py = new Float32Array(PARTICLES);
  const age = new Float32Array(PARTICLES);
  const seedParticles = () => {
    for (let i = 0; i < PARTICLES; i++) {
      px[i] = Math.random() * stage.width;
      py[i] = Math.random() * stage.height;
      age[i] = Math.random() * 200;
    }
    g.fillStyle = `rgb(${BG})`;
    g.fillRect(0, 0, stage.width, stage.height);
  };

  // ---- 라이프 게임 ----
  let cols = 0;
  let rows = 0;
  let cells = new Uint8Array(0);
  let next = new Uint8Array(0);
  let lifeTimer = 0;
  const seedLife = () => {
    cols = Math.ceil(stage.width / CELL);
    rows = Math.ceil(stage.height / CELL);
    cells = new Uint8Array(cols * rows);
    next = new Uint8Array(cols * rows);
    for (let i = 0; i < cells.length; i++) cells[i] = Math.random() < 0.22 ? 1 : 0;
  };
  const stepLife = () => {
    for (let y = 0; y < rows; y++) {
      for (let x = 0; x < cols; x++) {
        let n = 0;
        for (let dy = -1; dy <= 1; dy++) {
          for (let dx = -1; dx <= 1; dx++) {
            if (dx || dy) n += cells[((y + dy + rows) % rows) * cols + ((x + dx + cols) % cols)];
          }
        }
        const i = y * cols + x;
        next[i] = n === 3 || (n === 2 && cells[i]) ? 1 : 0;
      }
    }
    [cells, next] = [next, cells];
  };

  stage.onResize(() => {
    seedParticles();
    seedLife();
  });

  // UI
  const ui = document.createElement('div');
  ui.className = 'demo-ui';
  const mk = (label: string, fn: () => void) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.textContent = label;
    b.addEventListener('click', (e) => {
      e.stopPropagation();
      fn();
    });
    ui.appendChild(b);
    return b;
  };
  const flowBtn = mk('Flow Field', () => setMode('flow'));
  const lifeBtn = mk('Game of Life', () => setMode('life'));
  mk('재생성', () => {
    noise = createNoise3D();
    seedParticles();
    seedLife();
  });
  container.appendChild(ui);
  const setMode = (m: Mode) => {
    mode = m;
    flowBtn.setAttribute('aria-pressed', String(m === 'flow'));
    lifeBtn.setAttribute('aria-pressed', String(m === 'life'));
    g.fillStyle = `rgb(${BG})`;
    g.fillRect(0, 0, stage.width, stage.height);
  };
  setMode('flow');

  // 클릭/드래그
  const paint = () => {
    if (mode !== 'life' || !pointer.down) return;
    const cx = Math.floor(pointer.x / CELL);
    const cy = Math.floor(pointer.y / CELL);
    for (let dy = -2; dy <= 2; dy++) {
      for (let dx = -2; dx <= 2; dx++) {
        if (Math.random() < 0.6) {
          const x = (cx + dx + cols) % cols;
          const y = (cy + dy + rows) % rows;
          cells[y * cols + x] = 1;
        }
      }
    }
  };
  const onClick = (e: MouseEvent) => {
    if ((e.target as Element).closest('.demo-ui')) return;
    if (mode === 'flow') {
      noise = createNoise3D();
    }
  };
  container.addEventListener('click', onClick);

  const loop = createLoop((dt, t) => {
    const w = stage.width;
    const h = stage.height;
    if (mode === 'flow') {
      // 반투명으로 덮어 꼬리를 남긴다
      g.fillStyle = `rgba(${BG}, 0.07)`;
      g.fillRect(0, 0, w, h);
      g.fillStyle = `rgba(${LIME}, 0.55)`;
      const scale = 0.0022;
      const z = t * 0.06;
      for (let i = 0; i < PARTICLES; i++) {
        const a = noise(px[i] * scale, py[i] * scale, z) * Math.PI * 2.2;
        let vx = Math.cos(a) * 1.4;
        let vy = Math.sin(a) * 1.4;
        // 커서 주변은 소용돌이
        if (pointer.inside) {
          const dx = px[i] - pointer.x;
          const dy = py[i] - pointer.y;
          const d2 = dx * dx + dy * dy;
          if (d2 < 22000) {
            const f = (1 - d2 / 22000) * 3;
            vx += (-dy / Math.sqrt(d2 + 1)) * f;
            vy += (dx / Math.sqrt(d2 + 1)) * f;
          }
        }
        px[i] += vx * dt * 60;
        py[i] += vy * dt * 60;
        age[i] += 1;
        if (px[i] < 0 || px[i] > w || py[i] < 0 || py[i] > h || age[i] > 400) {
          px[i] = Math.random() * w;
          py[i] = Math.random() * h;
          age[i] = 0;
        }
        g.fillRect(px[i], py[i], 1.2, 1.2);
      }
    } else {
      paint();
      lifeTimer += dt;
      if (lifeTimer > 1 / 14) {
        lifeTimer = 0;
        stepLife();
      }
      g.fillStyle = `rgba(${BG}, 0.45)`;
      g.fillRect(0, 0, w, h);
      g.fillStyle = `rgb(${LIME})`;
      for (let y = 0; y < rows; y++) {
        for (let x = 0; x < cols; x++) {
          if (cells[y * cols + x]) g.fillRect(x * CELL + 1, y * CELL + 1, CELL - 2, CELL - 2);
        }
      }
    }
  });
  loop.start();

  return {
    pause: () => loop.stop(),
    resume: () => loop.start(),
    unmount: () => {
      loop.stop();
      container.removeEventListener('click', onClick);
      pointer.dispose();
      ui.remove();
      stage.dispose();
    },
  };
}
