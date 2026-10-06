import * as THREE from 'three';
import { createLoop } from '../../core/loop';
import { requestCamera, setStreamEnabled, showNotice, stopStream } from '../../core/permissions';
import { trackPointer } from '../../core/pointer';
import { createStageThree } from '../../core/stage';
import type { Demo } from '../../core/types';

const MODES = ['ASCII', 'Thermal', 'Pixel', 'Glitch'] as const;

const FRAG = /* glsl */ `
precision highp float;
uniform sampler2D uVideo;
uniform vec2 uRes;
uniform vec2 uVideoRes;
uniform float uTime;
uniform int uMode;
uniform vec2 uPointer;
varying vec2 vUv;

// 컨테이너를 꽉 채우도록(cover) + 좌우 반전(거울)
vec2 coverUv(vec2 uv){
  float rs = uRes.x / uRes.y;
  float rv = uVideoRes.x / uVideoRes.y;
  vec2 s = rs > rv ? vec2(1.0, rv / rs) : vec2(rs / rv, 1.0);
  uv = (uv - 0.5) * s + 0.5;
  uv.x = 1.0 - uv.x;
  return uv;
}
float luma(vec3 c){ return dot(c, vec3(0.299, 0.587, 0.114)); }
vec3 sampleV(vec2 uv){ return texture(uVideo, coverUv(uv)).rgb; }

// 5x5 비트맵 글리프 (movAX13h 의 아스키 셰이더 기법)
float glyph(int n, vec2 p){
  p = floor(p * vec2(-4.0, 4.0) + 2.5);
  if (clamp(p.x, 0.0, 4.0) == p.x && clamp(p.y, 0.0, 4.0) == p.y){
    int a = int(round(p.x) + 5.0 * round(p.y));
    if (((n >> a) & 1) == 1) return 1.0;
  }
  return 0.0;
}

vec3 thermal(float t){
  vec3 c0 = vec3(0.02, 0.0, 0.1);
  vec3 c1 = vec3(0.35, 0.0, 0.6);
  vec3 c2 = vec3(0.95, 0.15, 0.2);
  vec3 c3 = vec3(1.0, 0.75, 0.1);
  vec3 c4 = vec3(1.0, 1.0, 0.85);
  if (t < 0.25) return mix(c0, c1, t / 0.25);
  if (t < 0.5) return mix(c1, c2, (t - 0.25) / 0.25);
  if (t < 0.75) return mix(c2, c3, (t - 0.5) / 0.25);
  return mix(c3, c4, (t - 0.75) / 0.25);
}

float hash(vec2 p){ return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }

void main(){
  vec2 uv = vUv;
  vec3 col;
  if (uMode == 0) {
    float cell = 9.0;
    vec2 px = uv * uRes;
    vec2 cuv = floor(px / cell) * cell / uRes;
    vec3 c = sampleV(cuv);
    float g = luma(c);
    int n = 4096;
    if (g > 0.2) n = 65600;
    if (g > 0.3) n = 332772;
    if (g > 0.4) n = 15255086;
    if (g > 0.5) n = 23385164;
    if (g > 0.6) n = 15252014;
    if (g > 0.7) n = 13199452;
    if (g > 0.8) n = 11512810;
    vec2 p = mod(px / (cell * 0.5), 2.0) - vec2(1.0);
    col = vec3(0.776, 1.0, 0.239) * glyph(n, p) * (0.35 + g);
  } else if (uMode == 1) {
    vec3 c = sampleV(uv);
    float g = smoothstep(0.05, 0.95, luma(c));
    col = thermal(g);
  } else if (uMode == 2) {
    float cols = mix(18.0, 90.0, uPointer.x);
    vec2 grid = vec2(cols, cols * uRes.y / uRes.x);
    vec2 q = (floor(uv * grid) + 0.5) / grid;
    vec3 c = sampleV(q);
    // 4단계 포스터라이즈
    c = floor(c * 4.0 + 0.5) / 4.0;
    vec2 f = fract(uv * grid) - 0.5;
    col = c * smoothstep(0.5, 0.42, max(abs(f.x), abs(f.y)));
  } else {
    float band = floor(uv.y * 24.0 + uTime * 3.0);
    float jitter = (hash(vec2(band, floor(uTime * 8.0))) - 0.5) * 0.06 * step(0.75, hash(vec2(band, 1.0)));
    float off = 0.006 + uPointer.x * 0.03;
    vec2 u = uv + vec2(jitter, 0.0);
    col.r = sampleV(u + vec2(off, 0.0)).r;
    col.g = sampleV(u).g;
    col.b = sampleV(u - vec2(off, 0.0)).b;
    col *= 0.85 + 0.15 * sin(uv.y * uRes.y * 1.5);
  }
  gl_FragColor = vec4(col, 1.0);
}`;

const VERT = /* glsl */ `
varying vec2 vUv;
void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }`;

export async function create(container: HTMLElement): Promise<Demo> {
  const res = await requestCamera();
  if (!res.ok) {
    const box = showNotice(container, res.message);
    return { pause() {}, resume() {}, unmount: () => box.remove() };
  }
  const stream = res.value;
  const video = document.createElement('video');
  video.muted = true;
  video.playsInline = true;
  video.srcObject = stream;
  await video.play().catch(() => undefined);

  let stage;
  try {
    stage = createStageThree(container, { alpha: false, antialias: false });
  } catch (err) {
    stopStream(stream);
    throw err;
  }
  const { renderer } = stage;
  const pointer = trackPointer(container);
  const tex = new THREE.VideoTexture(video);
  tex.colorSpace = THREE.SRGBColorSpace;
  const uniforms = {
    uVideo: { value: tex },
    uRes: { value: new THREE.Vector2(1, 1) },
    uVideoRes: { value: new THREE.Vector2(1280, 720) },
    uTime: { value: 0 },
    uMode: { value: 0 },
    uPointer: { value: new THREE.Vector2(0.5, 0.5) },
  };
  // glslVersion 을 지정하지 않아도 WebGL2 에서는 #version 300 es 로 컴파일되어
  // round / 정수 비트 연산을 쓸 수 있고, gl_FragColor·varying 매핑도 three 가 해 준다
  const mat = new THREE.ShaderMaterial({ vertexShader: VERT, fragmentShader: FRAG, uniforms });
  const geo = new THREE.PlaneGeometry(2, 2);
  const scene = new THREE.Scene();
  scene.add(new THREE.Mesh(geo, mat));
  const camera = new THREE.Camera();
  stage.onResize((w, h, dpr) => uniforms.uRes.value.set(w * dpr, h * dpr));

  const ui = document.createElement('div');
  ui.className = 'demo-ui';
  const buttons = MODES.map((m, i) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.textContent = m;
    b.setAttribute('aria-pressed', String(i === 0));
    b.addEventListener('click', () => {
      uniforms.uMode.value = i;
      buttons.forEach((x, j) => x.setAttribute('aria-pressed', String(j === i)));
    });
    ui.appendChild(b);
    return b;
  });
  container.appendChild(ui);

  const loop = createLoop((_dt, t) => {
    if (video.videoWidth) uniforms.uVideoRes.value.set(video.videoWidth, video.videoHeight);
    uniforms.uTime.value = t;
    uniforms.uPointer.value.set(pointer.inside ? pointer.nx : 0.5, pointer.inside ? pointer.ny : 0.5);
    renderer.render(scene, camera);
  });
  loop.start();

  return {
    pause: () => {
      loop.stop();
      video.pause();
      setStreamEnabled(stream, false);
    },
    resume: () => {
      setStreamEnabled(stream, true);
      void video.play().catch(() => undefined);
      loop.start();
    },
    unmount: () => {
      loop.stop();
      pointer.dispose();
      stopStream(stream);
      video.srcObject = null;
      tex.dispose();
      mat.dispose();
      geo.dispose();
      ui.remove();
      stage.dispose();
    },
  };
}
