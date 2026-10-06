import { createMaster, getAudio, mtof } from '../../core/audio';
import { createLoop } from '../../core/loop';
import { trackPointer } from '../../core/pointer';
import type { Demo } from '../../core/types';
import './style.css';

// C 마이너 펜타토닉 2옥타브 + α (아래 행이 낮은 음)
const SCALE = [0, 3, 5, 7, 10];
const KEYS = ['z', 'x', 'c', 'v', 'a', 's', 'd', 'f', 'q', 'w', 'e', 'r', '1', '2', '3', '4'];
const BASE = 48;

function noteFor(i: number): number {
  return BASE + SCALE[i % 5] + 12 * Math.floor(i / 5);
}

export function create(container: HTMLElement): Demo {
  const ctx = getAudio();
  const master = createMaster(0.7);
  const pointer = trackPointer(container);

  // 신호 흐름: voice → filter → (dry + delay) → master
  const filter = ctx.createBiquadFilter();
  filter.type = 'lowpass';
  filter.Q.value = 6;
  const delay = ctx.createDelay(1);
  delay.delayTime.value = 0.28;
  const feedback = ctx.createGain();
  feedback.gain.value = 0.38;
  const wet = ctx.createGain();
  wet.gain.value = 0.35;
  const analyser = ctx.createAnalyser();
  analyser.fftSize = 1024;
  filter.connect(master.node);
  filter.connect(delay);
  delay.connect(feedback).connect(delay);
  delay.connect(wet).connect(master.node);
  master.node.connect(analyser);

  const root = document.createElement('div');
  root.className = 'synth';
  root.innerHTML = '<canvas class="synth__scope"></canvas><div class="synth__grid"></div>';
  container.appendChild(root);
  const grid = root.querySelector<HTMLElement>('.synth__grid')!;
  const scope = root.querySelector<HTMLCanvasElement>('.synth__scope')!;
  const sctx = scope.getContext('2d')!;

  // 4x4: 위 행이 높은 음이 되도록 역순 배치
  const pads: HTMLButtonElement[] = [];
  for (let row = 3; row >= 0; row--) {
    for (let col = 0; col < 4; col++) {
      const i = row * 4 + col;
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'synth__pad';
      b.innerHTML = `<span>${KEYS[i].toUpperCase()}</span>`;
      b.dataset.i = String(i);
      grid.appendChild(b);
      pads[i] = b;
    }
  }

  function play(i: number) {
    const t = ctx.currentTime;
    const f = mtof(noteFor(i));
    const env = ctx.createGain();
    env.gain.setValueAtTime(0, t);
    env.gain.linearRampToValueAtTime(0.32, t + 0.008);
    env.gain.exponentialRampToValueAtTime(0.12, t + 0.25);
    env.gain.exponentialRampToValueAtTime(0.0001, t + 1.6);
    env.connect(filter);
    const oscs = [
      { type: 'sawtooth' as OscillatorType, detune: -7, gain: 0.5 },
      { type: 'sawtooth' as OscillatorType, detune: 7, gain: 0.5 },
      { type: 'triangle' as OscillatorType, detune: -1200, gain: 0.6 },
    ].map((o) => {
      const osc = ctx.createOscillator();
      osc.type = o.type;
      osc.frequency.value = f;
      osc.detune.value = o.detune;
      const g = ctx.createGain();
      g.gain.value = o.gain;
      osc.connect(g).connect(env);
      osc.start(t);
      osc.stop(t + 1.7);
      return osc;
    });
    oscs[0].onended = () => env.disconnect();
    const pad = pads[i];
    pad.classList.remove('is-hit');
    void pad.offsetWidth;
    pad.classList.add('is-hit');
  }

  const onPad = (e: PointerEvent) => {
    const b = (e.target as Element).closest<HTMLButtonElement>('.synth__pad');
    if (!b) return;
    e.preventDefault();
    play(Number(b.dataset.i));
  };
  grid.addEventListener('pointerdown', onPad);

  // 키보드: 데모가 화면 안에 있고 입력창에 포커스가 없을 때만
  let active = true;
  const onKey = (e: KeyboardEvent) => {
    if (!active || e.repeat || e.metaKey || e.ctrlKey) return;
    const tag = (document.activeElement as HTMLElement | null)?.tagName;
    if (tag === 'INPUT' || tag === 'TEXTAREA') return;
    const i = KEYS.indexOf(e.key.toLowerCase());
    if (i >= 0) play(i);
  };
  window.addEventListener('keydown', onKey);

  const buf = new Uint8Array(analyser.fftSize);
  const resize = () => {
    const dpr = Math.min(window.devicePixelRatio, 2);
    scope.width = root.clientWidth * dpr;
    scope.height = root.clientHeight * dpr;
  };
  const ro = new ResizeObserver(resize);
  ro.observe(root);
  resize();

  const loop = createLoop(() => {
    // 커서 높이 → 필터 컷오프 (위로 갈수록 밝게)
    const cutoff = pointer.inside ? 300 + Math.pow(1 - pointer.ny, 2) * 7000 : 1800;
    filter.frequency.setTargetAtTime(cutoff, ctx.currentTime, 0.05);

    analyser.getByteTimeDomainData(buf);
    const w = scope.width;
    const h = scope.height;
    sctx.clearRect(0, 0, w, h);
    sctx.lineWidth = 2 * Math.min(window.devicePixelRatio, 2);
    sctx.strokeStyle = 'rgba(11, 11, 11, 0.55)';
    sctx.beginPath();
    for (let i = 0; i < buf.length; i++) {
      const x = (i / (buf.length - 1)) * w;
      const y = h / 2 + ((buf[i] - 128) / 128) * h * 0.4;
      if (i) sctx.lineTo(x, y);
      else sctx.moveTo(x, y);
    }
    sctx.stroke();
  });
  loop.start();

  return {
    pause: () => {
      active = false;
      loop.stop();
      master.fadeTo(0);
    },
    resume: () => {
      active = true;
      loop.start();
      master.fadeTo(0.7);
    },
    unmount: () => {
      active = false;
      loop.stop();
      ro.disconnect();
      window.removeEventListener('keydown', onKey);
      pointer.dispose();
      master.dispose();
      window.setTimeout(() => {
        filter.disconnect();
        delay.disconnect();
        feedback.disconnect();
        wet.disconnect();
        analyser.disconnect();
      }, 100);
      root.remove();
    },
  };
}
