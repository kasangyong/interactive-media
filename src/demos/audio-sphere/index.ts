import * as THREE from 'three';
import { createMaster, createScheduler, getAudio, mtof } from '../../core/audio';
import { DISPLACE_VERT, IRIDESCENT_FRAG } from '../../core/glsl';
import { createLoop } from '../../core/loop';
import { trackPointer } from '../../core/pointer';
import { createStageThree } from '../../core/stage';
import type { Demo } from '../../core/types';

const SCALE = [0, 3, 5, 7, 10, 12, 15];
const PATTERNS = [
  { kick: [0, 4, 8, 12], bass: [0, 3, 8, 11, 14], hat: [2, 6, 10, 14] },
  { kick: [0, 6, 8, 11], bass: [0, 6, 10], hat: [1, 3, 5, 7, 9, 11, 13, 15] },
  { kick: [0, 8], bass: [0, 2, 4, 8, 10, 12], hat: [4, 12] },
];

export function create(container: HTMLElement): Demo {
  const ac = getAudio();
  const master = createMaster(0.6);
  const analyser = ac.createAnalyser();
  analyser.fftSize = 512;
  analyser.smoothingTimeConstant = 0.7;
  master.node.connect(analyser);

  // 하이햇용 노이즈 버퍼
  const noise = ac.createBuffer(1, ac.sampleRate * 0.2, ac.sampleRate);
  const nd = noise.getChannelData(0);
  for (let i = 0; i < nd.length; i++) nd[i] = Math.random() * 2 - 1;

  let pattern = 0;
  let root = 45;
  const kick = (t: number) => {
    const o = ac.createOscillator();
    const g = ac.createGain();
    o.frequency.setValueAtTime(150, t);
    o.frequency.exponentialRampToValueAtTime(42, t + 0.12);
    g.gain.setValueAtTime(1, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.4);
    o.connect(g).connect(master.node);
    o.start(t);
    o.stop(t + 0.42);
    return [o];
  };
  const bass = (t: number, note: number) => {
    const o = ac.createOscillator();
    o.type = 'sawtooth';
    o.frequency.value = mtof(note);
    const f = ac.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.setValueAtTime(900, t);
    f.frequency.exponentialRampToValueAtTime(140, t + 0.2);
    f.Q.value = 8;
    const g = ac.createGain();
    g.gain.setValueAtTime(0.32, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.24);
    o.connect(f).connect(g).connect(master.node);
    o.start(t);
    o.stop(t + 0.26);
    return [o];
  };
  const hat = (t: number) => {
    const s = ac.createBufferSource();
    s.buffer = noise;
    const f = ac.createBiquadFilter();
    f.type = 'highpass';
    f.frequency.value = 7000;
    const g = ac.createGain();
    g.gain.setValueAtTime(0.18, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.05);
    s.connect(f).connect(g).connect(master.node);
    s.start(t);
    s.stop(t + 0.06);
    return [s];
  };
  const arp = (t: number, note: number) => {
    const o = ac.createOscillator();
    o.type = 'square';
    o.frequency.value = mtof(note);
    const g = ac.createGain();
    g.gain.setValueAtTime(0.07, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.15);
    o.connect(g).connect(master.node);
    o.start(t);
    o.stop(t + 0.16);
    return [o];
  };

  const scheduler = createScheduler(118, (step, t) => {
    const s = step % 16;
    const p = PATTERNS[pattern];
    if (p.kick.includes(s)) kick(t);
    if (p.bass.includes(s)) bass(t, root - 12 + (s === 14 ? 7 : 0));
    if (p.hat.includes(s)) hat(t);
    if (s % 2 === 0) arp(t, root + 12 + SCALE[(step * 3 + pattern) % SCALE.length]);
    if (step % 64 === 63) root = root === 45 ? 41 : 45;
  });

  // 비주얼
  const stage = createStageThree(container, { alpha: true, dprCap: 1.5 });
  const { renderer } = stage;
  const pointer = trackPointer(container);
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(35, 1, 0.1, 50);
  camera.position.z = 6.5;
  stage.onResize((w, h) => {
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  });
  const uniforms = {
    uTime: { value: 0 },
    uAmp: { value: 0.15 },
    uFreq: { value: 1 },
    uPointer: { value: new THREE.Vector3(0, 0, 1) },
    uPointerForce: { value: 0.2 },
    uColorA: { value: new THREE.Color('#0b0b0b') },
    uColorB: { value: new THREE.Color('#5a1d06') },
    uRim: { value: new THREE.Color('#ffe2d4') },
    uOpacity: { value: 1 },
  };
  // detail 32 ≈ 6.5만 정점 (72 는 32만 — 정점마다 노이즈 6회라 GPU 부하가 컸다)
  const geo = new THREE.IcosahedronGeometry(1.3, 32);
  const mat = new THREE.ShaderMaterial({ vertexShader: DISPLACE_VERT, fragmentShader: IRIDESCENT_FRAG, uniforms });
  const mesh = new THREE.Mesh(geo, mat);
  scene.add(mesh);

  const onClick = () => {
    pattern = (pattern + 1) % PATTERNS.length;
  };
  container.addEventListener('click', onClick);

  const bins = new Uint8Array(analyser.frequencyBinCount);
  const band = (a: number, b: number) => {
    let s = 0;
    for (let i = a; i < b; i++) s += bins[i];
    return s / ((b - a) * 255);
  };
  const lvl = { low: 0, mid: 0, high: 0 };
  const dir = new THREE.Vector3();
  const loop = createLoop((dt, t) => {
    analyser.getByteFrequencyData(bins);
    lvl.low += (band(1, 6) - lvl.low) * 0.35;
    lvl.mid += (band(6, 40) - lvl.mid) * 0.25;
    lvl.high += (band(40, 120) - lvl.high) * 0.25;
    uniforms.uTime.value = t * (1 + lvl.high * 3);
    uniforms.uAmp.value = 0.08 + lvl.mid * 0.55;
    uniforms.uFreq.value = 0.8 + lvl.high * 2.5;
    mesh.scale.setScalar(0.9 + lvl.low * 0.45);
    dir.set((pointer.nx - 0.5) * 2.4, -(pointer.ny - 0.5) * 2.4, 1).normalize();
    dir.applyQuaternion(mesh.quaternion.clone().invert());
    uniforms.uPointer.value.copy(dir);
    uniforms.uPointerForce.value += ((pointer.inside ? 0.45 : 0.1) - uniforms.uPointerForce.value) * 0.1;
    mesh.rotation.y += dt * (0.15 + lvl.low * 0.6);
    mesh.rotation.x += dt * 0.05;
    renderer.render(scene, camera);
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
      master.fadeTo(0.6);
      scheduler.start();
      loop.start();
    },
    unmount: () => {
      scheduler.stop();
      loop.stop();
      container.removeEventListener('click', onClick);
      pointer.dispose();
      master.dispose();
      window.setTimeout(() => analyser.disconnect(), 100);
      geo.dispose();
      mat.dispose();
      stage.dispose();
    },
  };
}
