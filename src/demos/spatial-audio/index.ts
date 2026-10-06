import { createMaster, createScheduler, getAudio, mtof } from '../../core/audio';
import { createLoop } from '../../core/loop';
import { createStage2D } from '../../core/stage';
import type { Demo } from '../../core/types';

const NOTES = [69, 72, 76, 79, 76, 72];
/** 화면 반경(px)이 음향 공간에서 몇 미터인지 */
const METERS = 6;

export function create(container: HTMLElement): Demo {
  const ac = getAudio();
  const master = createMaster(0.9);
  const panner = new PannerNode(ac, {
    panningModel: 'HRTF',
    distanceModel: 'inverse',
    refDistance: 1,
    maxDistance: 50,
    rolloffFactor: 1.2,
  });
  panner.connect(master.node);
  // 청취자는 원점에서 화면 위쪽(-z)을 바라본다
  const L = ac.listener;
  if (L.positionX) {
    L.positionX.value = 0;
    L.positionY.value = 0;
    L.positionZ.value = 0;
    L.forwardX.value = 0;
    L.forwardY.value = 0;
    L.forwardZ.value = -1;
    L.upX.value = 0;
    L.upY.value = 1;
    L.upZ.value = 0;
  }

  const pulses: number[] = [];
  const scheduler = createScheduler(100, (step, t) => {
    if (step % 2) return;
    const o = ac.createOscillator();
    o.type = 'triangle';
    o.frequency.value = mtof(NOTES[(step / 2) % NOTES.length]);
    const g = ac.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(0.5, t + 0.005);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.35);
    o.connect(g).connect(panner);
    o.start(t);
    o.stop(t + 0.36);
    pulses.push(t);
  });

  const stage = createStage2D(container);
  const g = stage.ctx;
  // 음원 위치 (정규화: -1..1, 원점=청취자)
  const src = { x: 0.6, y: -0.3 };
  let dragging = false;
  let orbit = Math.atan2(src.y, src.x);
  let idle = 0;

  const toNorm = (e: PointerEvent) => {
    const r = container.getBoundingClientRect();
    const R = Math.min(r.width, r.height) * 0.42;
    return { x: (e.clientX - r.left - r.width / 2) / R, y: (e.clientY - r.top - r.height / 2) / R };
  };
  const onDown = (e: PointerEvent) => {
    const p = toNorm(e);
    if (Math.hypot(p.x - src.x, p.y - src.y) > 0.25) return;
    dragging = true;
    container.setPointerCapture(e.pointerId);
    e.preventDefault();
  };
  const onMove = (e: PointerEvent) => {
    if (!dragging) return;
    const p = toNorm(e);
    const d = Math.hypot(p.x, p.y);
    const k = d > 1.15 ? 1.15 / d : 1;
    src.x = p.x * k;
    src.y = p.y * k;
  };
  const onUp = () => {
    if (!dragging) return;
    dragging = false;
    idle = 0;
    orbit = Math.atan2(src.y, src.x);
  };
  container.addEventListener('pointerdown', onDown);
  container.addEventListener('pointermove', onMove);
  container.addEventListener('pointerup', onUp);
  container.addEventListener('pointercancel', onUp);

  const loop = createLoop((dt) => {
    if (!dragging) {
      idle += dt;
      if (idle > 1.2) {
        orbit += dt * 0.6;
        const r = Math.max(0.35, Math.hypot(src.x, src.y));
        src.x += (Math.cos(orbit) * r - src.x) * 0.05;
        src.y += (Math.sin(orbit) * r - src.y) * 0.05;
      }
    }
    const t = ac.currentTime;
    panner.positionX.setTargetAtTime(src.x * METERS, t, 0.03);
    panner.positionY.setTargetAtTime(0, t, 0.03);
    panner.positionZ.setTargetAtTime(src.y * METERS, t, 0.03);

    const w = stage.width;
    const h = stage.height;
    const cx = w / 2;
    const cy = h / 2;
    const R = Math.min(w, h) * 0.42;
    g.clearRect(0, 0, w, h);

    // 거리 링
    g.strokeStyle = 'rgba(11,11,11,0.18)';
    g.lineWidth = 1;
    for (let i = 1; i <= 4; i++) {
      g.beginPath();
      g.arc(cx, cy, (R * i) / 4, 0, Math.PI * 2);
      g.stroke();
    }
    g.beginPath();
    g.moveTo(cx - R, cy);
    g.lineTo(cx + R, cy);
    g.moveTo(cx, cy - R);
    g.lineTo(cx, cy + R);
    g.stroke();

    // 머리 + 귀 + 코(정면)
    g.fillStyle = '#0b0b0b';
    g.beginPath();
    g.arc(cx, cy, 18, 0, Math.PI * 2);
    g.fill();
    g.beginPath();
    g.ellipse(cx - 19, cy, 4, 8, 0, 0, Math.PI * 2);
    g.ellipse(cx + 19, cy, 4, 8, 0, 0, Math.PI * 2);
    g.fill();
    g.beginPath();
    g.moveTo(cx - 6, cy - 16);
    g.lineTo(cx, cy - 26);
    g.lineTo(cx + 6, cy - 16);
    g.fill();

    // 음원 + 소리 파동
    const sx = cx + src.x * R;
    const sy = cy + src.y * R;
    while (pulses.length && t - pulses[0] > 1.2) pulses.shift();
    for (const p0 of pulses) {
      const age = t - p0;
      if (age < 0) continue;
      g.strokeStyle = `rgba(11,11,11,${0.5 * (1 - age / 1.2)})`;
      g.beginPath();
      g.arc(sx, sy, 14 + age * R * 0.6, 0, Math.PI * 2);
      g.stroke();
    }
    g.setLineDash([4, 6]);
    g.strokeStyle = 'rgba(11,11,11,0.5)';
    g.beginPath();
    g.moveTo(cx, cy);
    g.lineTo(sx, sy);
    g.stroke();
    g.setLineDash([]);
    g.fillStyle = '#fff3ec';
    g.strokeStyle = '#0b0b0b';
    g.lineWidth = 2;
    g.beginPath();
    g.arc(sx, sy, dragging ? 17 : 14, 0, Math.PI * 2);
    g.fill();
    g.stroke();

    // 좌우 레벨 근사 (방위각 기반)
    const az = Math.atan2(src.x, -src.y);
    const dist = Math.hypot(src.x, src.y) * METERS;
    g.fillStyle = 'rgba(11,11,11,0.7)';
    g.font = '11px JetBrains Mono, monospace';
    g.fillText(`AZIMUTH ${Math.round((az * 180) / Math.PI)}°   DISTANCE ${dist.toFixed(1)} m`, 16, h - 16);
  });

  scheduler.start();
  loop.start();

  return {
    pause: () => {
      scheduler.stop();
      loop.stop();
      master.fadeTo(0);
    },
    resume: () => {
      master.fadeTo(0.9);
      scheduler.start();
      loop.start();
    },
    unmount: () => {
      scheduler.stop();
      loop.stop();
      container.removeEventListener('pointerdown', onDown);
      container.removeEventListener('pointermove', onMove);
      container.removeEventListener('pointerup', onUp);
      container.removeEventListener('pointercancel', onUp);
      master.dispose();
      window.setTimeout(() => panner.disconnect(), 100);
      stage.dispose();
    },
  };
}
