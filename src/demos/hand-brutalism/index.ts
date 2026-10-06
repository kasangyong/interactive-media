import * as THREE from 'three';
import { type HandLandmarker, loadHandLandmarker, monotonicClock } from '../../core/hands';
import { createLoop } from '../../core/loop';
import { requestCamera, setStreamEnabled, stopStream } from '../../core/permissions';
import { trackPointer } from '../../core/pointer';
import { createStageThree } from '../../core/stage';
import type { Demo } from '../../core/types';
import './style.css';

const BOXES = 34;

interface Pt {
  x: number;
  y: number;
}

/** 거푸집 자국, 얼룩, 타이 구멍이 있는 노출 콘크리트 텍스처 */
function concreteTexture(): THREE.CanvasTexture {
  const S = 256;
  const c = document.createElement('canvas');
  c.width = c.height = S;
  const g = c.getContext('2d')!;
  const img = g.createImageData(S, S);
  for (let i = 0; i < S * S; i++) {
    const v = 150 + (Math.random() - 0.5) * 70;
    img.data.set([v, v, v, 255], i * 4);
  }
  g.putImageData(img, 0, 0);
  for (let i = 0; i < 14; i++) {
    const x = Math.random() * S;
    const y = Math.random() * S;
    const r = 20 + Math.random() * 70;
    const grad = g.createRadialGradient(x, y, 0, x, y, r);
    const dark = Math.random() < 0.6;
    grad.addColorStop(0, dark ? 'rgba(40,40,40,0.35)' : 'rgba(230,230,230,0.25)');
    grad.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = grad;
    g.fillRect(0, 0, S, S);
  }
  g.strokeStyle = 'rgba(30,30,30,0.35)';
  for (let y = 32; y < S; y += 64) {
    g.beginPath();
    g.moveTo(0, y);
    g.lineTo(S, y);
    g.stroke();
  }
  g.fillStyle = 'rgba(25,25,25,0.7)';
  for (let y = 16; y < S; y += 64) for (let x = 32; x < S; x += 64) g.fillRect(x - 2, y - 2, 4, 4);
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

const POST_FRAG = /* glsl */ `
uniform sampler2D tScene;
uniform float uDither;
uniform float uPix;
uniform vec2 uRes;
varying vec2 vUv;
// 4x4 Bayer 행렬 (순서 디더링 임계값)
float bayer4(vec2 p){
  int x = int(mod(p.x, 4.0));
  int y = int(mod(p.y, 4.0));
  float m[16] = float[16](0.,8.,2.,10.,12.,4.,14.,6.,3.,11.,1.,9.,15.,7.,13.,5.);
  return (m[x + y * 4] + 0.5) / 16.0;
}
void main(){
  // 렌더 타깃은 선형 색공간 — 화면 출력용 sRGB 로 근사 변환
  vec3 base = pow(texture2D(tScene, vUv).rgb, vec3(1.0 / 2.2));
  vec2 cell = floor(gl_FragCoord.xy / uPix);
  vec3 blockCol = pow(texture2D(tScene, (cell + 0.5) * uPix / uRes).rgb, vec3(1.0 / 2.2));
  float l = dot(blockCol, vec3(0.299, 0.587, 0.114));
  float on = step(bayer4(cell), l);
  // 점은 각 블록 안에서 작은 정사각형으로 — 디더가 강할수록 점묘처럼 보인다
  vec2 f = fract(gl_FragCoord.xy / uPix) - 0.5;
  float pixOn = on * step(max(abs(f.x), abs(f.y)), 0.36);
  vec3 dithered = vec3(pixOn) * (0.55 + 0.45 * l);
  gl_FragColor = vec4(mix(base, dithered, uDither), 1.0);
}`;

const POST_VERT = /* glsl */ `
varying vec2 vUv;
void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }`;

export function create(container: HTMLElement): Demo {
  const stage = createStageThree(container, { alpha: false, dprCap: 1.5 });
  const { renderer } = stage;
  const pointer = trackPointer(container);
  const disposables: Array<{ dispose(): void }> = [];

  // ---------- 장면 ----------
  const scene = new THREE.Scene();
  scene.background = new THREE.Color('#000000');
  const camera = new THREE.PerspectiveCamera(38, 1, 0.1, 100);
  camera.position.set(0, 0.6, 11);
  scene.add(new THREE.AmbientLight('#ffffff', 0.35));
  const key = new THREE.DirectionalLight('#ffffff', 2.4);
  key.position.set(4, 6, 5);
  scene.add(key);
  const rim = new THREE.DirectionalLight('#ffffff', 0.6);
  rim.position.set(-6, -2, -4);
  scene.add(rim);

  const tex = concreteTexture();
  const boxGeo = new THREE.BoxGeometry(1, 1, 1);
  disposables.push(tex, boxGeo);
  const sculpture = new THREE.Group();
  scene.add(sculpture);
  const rnd = mulberry(23);
  const q = (v: number) => Math.round(v * 10) / 10;
  for (let i = 0; i < BOXES; i++) {
    // 판(slab), 기둥, 덩어리를 섞어 쌓는다
    const kind = rnd();
    const sx = q(kind < 0.3 ? 2 + rnd() * 1.6 : 0.5 + rnd() * 1.4);
    const sy = q(kind > 0.75 ? 1.8 + rnd() * 1.6 : 0.3 + rnd() * 1.2);
    const sz = q(0.5 + rnd() * 1.6);
    const tone = 0.55 + rnd() * 0.45;
    const mat = new THREE.MeshStandardMaterial({ map: tex, color: new THREE.Color(tone, tone, tone), roughness: 0.95 });
    mat.map = tex.clone();
    mat.map.repeat.set(sx * 0.5, sy * 0.5);
    mat.map.offset.set(rnd(), rnd());
    mat.map.needsUpdate = true;
    disposables.push(mat, mat.map);
    const m = new THREE.Mesh(boxGeo, mat);
    m.scale.set(sx, sy, sz);
    m.position.set(q((rnd() - 0.5) * 3.2), q((rnd() - 0.5) * 3.6), q((rnd() - 0.5) * 2.4));
    sculpture.add(m);
  }

  const starGeo = new THREE.BufferGeometry();
  const stars = new Float32Array(1600 * 3);
  for (let i = 0; i < 1600; i++) {
    const r = 20 + Math.random() * 25;
    const th = Math.random() * Math.PI * 2;
    const ph = Math.acos(2 * Math.random() - 1);
    stars.set([r * Math.sin(ph) * Math.cos(th), r * Math.cos(ph), r * Math.sin(ph) * Math.sin(th)], i * 3);
  }
  starGeo.setAttribute('position', new THREE.BufferAttribute(stars, 3));
  const starMat = new THREE.PointsMaterial({ color: '#ffffff', size: 0.07, sizeAttenuation: true });
  disposables.push(starGeo, starMat);
  scene.add(new THREE.Points(starGeo, starMat));

  // ---------- 디더링 후처리 ----------
  const rt = new THREE.WebGLRenderTarget(1, 1);
  const postUniforms = {
    tScene: { value: rt.texture },
    uDither: { value: 0.6 },
    uPix: { value: 3 },
    uRes: { value: new THREE.Vector2(1, 1) },
  };
  const postMat = new THREE.ShaderMaterial({ vertexShader: POST_VERT, fragmentShader: POST_FRAG, uniforms: postUniforms });
  const postGeo = new THREE.PlaneGeometry(2, 2);
  const postScene = new THREE.Scene();
  postScene.add(new THREE.Mesh(postGeo, postMat));
  const postCam = new THREE.Camera();
  disposables.push(rt, postMat, postGeo);

  stage.onResize((w, h, dpr) => {
    camera.aspect = w / h;
    camera.position.z = w / h < 1 ? 11 / Math.max(w / h, 0.55) : 11;
    // 넓은 화면에선 왼쪽 아래 설명 패널을 피해 조형물을 오른쪽으로
    sculpture.position.x = w / h > 1.2 ? 1.6 : 0;
    camera.updateProjectionMatrix();
    rt.setSize(Math.round(w * dpr), Math.round(h * dpr));
    postUniforms.uRes.value.set(w * dpr, h * dpr);
    postUniforms.uPix.value = Math.round(3 * dpr);
  });

  // ---------- 카메라 미리보기 (PIP) ----------
  const pip = document.createElement('div');
  pip.className = 'hb-pip';
  pip.innerHTML = '<canvas></canvas><p class="hb-pip__status">마우스: X = 회전, Y = 디더</p>';
  pip.classList.add('is-off');
  container.appendChild(pip);
  const pipCanvas = pip.querySelector('canvas')!;
  const pg = pipCanvas.getContext('2d')!;
  const pipStatus = pip.querySelector<HTMLElement>('.hb-pip__status')!;
  const readout = document.createElement('div');
  readout.className = 'hb-readout';
  container.appendChild(readout);

  // ---------- 입력 ----------
  const control = { dither: 0.6, rot: 0, targetDither: 0.6, targetRot: 0 };
  let mode: 'camera' | 'mouse' = 'mouse';
  let video: HTMLVideoElement | null = null;
  let stream: MediaStream | null = null;
  let landmarker: HandLandmarker | null = null;
  let disposed = false;
  let paused = false;
  const clock = monotonicClock();
  let lastVideoTime = -1;
  let hands: Pt[][] = [];
  let lastAngle: number | null = null;
  let lastHandCount = 0;

  const useMouse = (reason: string) => {
    mode = 'mouse';
    pip.classList.add('is-off');
    pipStatus.textContent = reason;
  };

  // 카메라는 사용자가 버튼을 눌렀을 때만 켠다 (그 전엔 마우스 모드로 장면을 바로 보여 준다)
  const ui = document.createElement('div');
  ui.className = 'demo-ui';
  const camBtn = document.createElement('button');
  camBtn.type = 'button';
  camBtn.textContent = '카메라로 조작하기';
  ui.appendChild(camBtn);
  container.appendChild(ui);
  camBtn.addEventListener('click', () => {
    camBtn.disabled = true;
    camBtn.textContent = '카메라 연결 중…';
    pip.classList.remove('is-off');
    pipStatus.textContent = '카메라 연결 중…';
    void startCamera().finally(() => {
      camBtn.textContent = mode === 'camera' ? '카메라 사용 중' : '카메라로 조작하기';
      camBtn.setAttribute('aria-pressed', String(mode === 'camera'));
      camBtn.disabled = mode === 'camera';
    });
  });

  async function startCamera() {
    const cam = await requestCamera();
    if (disposed) {
      if (cam.ok) stopStream(cam.value);
      return;
    }
    if (!cam.ok) return useMouse(`${cam.message} 마우스로 조작합니다.`);
    stream = cam.value;
    video = document.createElement('video');
    video.muted = true;
    video.playsInline = true;
    video.srcObject = stream;
    await video.play().catch(() => undefined);
    if (disposed) return;
    pipStatus.textContent = '손 인식 모델 불러오는 중…';
    try {
      const lm = await loadHandLandmarker(2);
      if (disposed) {
        lm.close();
        return;
      }
      landmarker = lm;
      mode = 'camera';
      // 로딩 중 화면을 벗어났다면 카메라를 켜 둔 채 두지 않는다
      if (paused) {
        video.pause();
        setStreamEnabled(stream, false);
      }
      pipStatus.textContent = '두 손을 화면에 들어 보세요';
    } catch (err) {
      console.error('[hand-brutalism]', err);
      useMouse('손 인식 모델을 불러오지 못해 마우스로 조작 중');
      stopStream(stream);
      stream = null;
      video = null;
    }
  }

  function detect() {
    if (!video || !landmarker || video.readyState < 2 || video.currentTime === lastVideoTime) return;
    lastVideoTime = video.currentTime;
    const r = landmarker.detectForVideo(video, clock());
    // 거울 좌표(0..1)로 변환
    hands = r.landmarks.map((h) => h.map((p) => ({ x: 1 - p.x, y: p.y })));
  }

  function applyHands() {
    if (!hands.length) {
      lastAngle = null;
      pipStatus.textContent = '두 손을 화면에 들어 보세요';
      return false;
    }
    pipStatus.textContent = '';
    // 손 개수가 바뀌면 '오른손' 이 다른 손으로 바뀔 수 있으므로 회전 기준 각도를 초기화
    if (hands.length !== lastHandCount) lastAngle = null;
    lastHandCount = hands.length;
    // 화면 왼쪽 손 = 디더, 오른쪽 손 = 회전 (손 라벨 대신 위치로 구분해 혼동을 없앤다)
    const sorted = [...hands].sort((a, b) => a[0].x - b[0].x);
    const left = sorted.length === 2 ? sorted[0] : sorted[0][0].x < 0.5 ? sorted[0] : null;
    const right = sorted.length === 2 ? sorted[1] : sorted[0][0].x >= 0.5 ? sorted[0] : null;
    if (left) {
      const size = Math.hypot(left[0].x - left[9].x, left[0].y - left[9].y) || 1;
      const ratio = Math.hypot(left[4].x - left[8].x, left[4].y - left[8].y) / size;
      control.targetDither = Math.min(1, Math.max(0, (ratio - 0.15) / 0.85));
    }
    if (right) {
      const a = Math.atan2(right[8].y - right[4].y, right[8].x - right[4].x);
      if (lastAngle !== null) control.targetRot += Math.atan2(Math.sin(a - lastAngle), Math.cos(a - lastAngle)) * 1.6;
      lastAngle = a;
    } else lastAngle = null;
    return true;
  }

  function drawPip() {
    const w = pipCanvas.clientWidth;
    const h = pipCanvas.clientHeight;
    const dpr = Math.min(window.devicePixelRatio, 2);
    if (pipCanvas.width !== Math.round(w * dpr)) {
      pipCanvas.width = Math.round(w * dpr);
      pipCanvas.height = Math.round(h * dpr);
    }
    pg.setTransform(dpr, 0, 0, dpr, 0, 0);
    pg.clearRect(0, 0, w, h);
    if (!video) return;
    const vw = video.videoWidth || 16;
    const vh = video.videoHeight || 9;
    const s = Math.max(w / vw, h / vh);
    const ox = (w - vw * s) / 2;
    const oy = (h - vh * s) / 2;
    pg.save();
    pg.translate(w, 0);
    pg.scale(-1, 1);
    pg.drawImage(video, ox, oy, vw * s, vh * s);
    pg.restore();
    const P = (p: Pt) => ({ x: ox + p.x * vw * s, y: oy + p.y * vh * s });
    const sorted = [...hands].sort((a, b) => a[0].x - b[0].x);
    sorted.forEach((hand, i) => {
      const isDither = sorted.length === 2 ? i === 0 : hand[0].x < 0.5;
      const a = P(hand[4]);
      const b = P(hand[8]);
      pg.strokeStyle = isDither ? '#ffffff' : '#7d95ff';
      pg.lineWidth = 3;
      pg.beginPath();
      pg.moveTo(a.x, a.y);
      pg.lineTo(b.x, b.y);
      pg.stroke();
      pg.fillStyle = '#ffffff';
      for (const p of [a, b]) {
        pg.beginPath();
        pg.arc(p.x, p.y, 4, 0, Math.PI * 2);
        pg.fill();
      }
      pg.font = '11px JetBrains Mono, monospace';
      pg.fillText(
        isDither ? `Dither ${control.dither.toFixed(2)}` : `Rotate ${Math.round((control.rot * 180) / Math.PI) % 360}°`,
        (a.x + b.x) / 2 + 10,
        (a.y + b.y) / 2,
      );
    });
  }

  const loop = createLoop((dt) => {
    let driven = false;
    if (mode === 'camera') {
      detect();
      driven = applyHands();
    } else if (pointer.inside) {
      control.targetRot = (pointer.nx - 0.5) * Math.PI * 1.6;
      control.targetDither = 1 - pointer.ny;
      driven = true;
    }
    if (!driven) control.targetRot += dt * 0.15;

    control.dither += (control.targetDither - control.dither) * Math.min(1, dt * 8);
    control.rot += (control.targetRot - control.rot) * Math.min(1, dt * 6);
    sculpture.rotation.y = control.rot;
    sculpture.rotation.x = Math.sin(control.rot * 0.3) * 0.15;
    postUniforms.uDither.value = control.dither;
    readout.textContent = `DITHER ${control.dither.toFixed(2)}   ROTATE ${Math.round(((control.rot * 180) / Math.PI) % 360)}°   INPUT ${mode.toUpperCase()}`;

    renderer.setRenderTarget(rt);
    renderer.render(scene, camera);
    renderer.setRenderTarget(null);
    renderer.render(postScene, postCam);
    if (mode === 'camera') drawPip();
  });
  loop.start();

  return {
    pause: () => {
      paused = true;
      loop.stop();
      video?.pause();
      if (stream) setStreamEnabled(stream, false);
    },
    resume: () => {
      paused = false;
      if (stream) setStreamEnabled(stream, true);
      void video?.play().catch(() => undefined);
      loop.start();
    },
    unmount: () => {
      disposed = true;
      loop.stop();
      pointer.dispose();
      landmarker?.close();
      stopStream(stream);
      if (video) video.srcObject = null;
      pip.remove();
      readout.remove();
      ui.remove();
      disposables.forEach((d) => d.dispose());
      stage.dispose();
    },
  };
}

function mulberry(seed: number) {
  let a = seed;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
