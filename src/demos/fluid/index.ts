import { createLoop } from '../../core/loop';
import { createStageGL } from '../../core/stage';
import type { Demo } from '../../core/types';
import { WebGLUnavailableError } from '../../core/types';

/*
 * Stable Fluids (Jos Stam) 를 WebGL2 프래그먼트 셰이더로 구현.
 * 구조는 Pavel Dobryakov 의 WebGL-Fluid-Simulation (MIT) 을 참고해 단순화했다.
 */

const SIM_RES = 128;
const DYE_RES = 768;
const PRESSURE_ITER = 20;
const CURL = 28;
const VEL_DISSIPATION = 0.25;
const DYE_DISSIPATION = 0.9;
const SPLAT_RADIUS = 0.22;

const VERT = `#version 300 es
precision highp float;
in vec2 aPos;
out vec2 vUv; out vec2 vL; out vec2 vR; out vec2 vT; out vec2 vB;
uniform vec2 texel;
void main(){
  vUv = aPos * 0.5 + 0.5;
  vL = vUv - vec2(texel.x, 0.0); vR = vUv + vec2(texel.x, 0.0);
  vT = vUv + vec2(0.0, texel.y); vB = vUv - vec2(0.0, texel.y);
  gl_Position = vec4(aPos, 0.0, 1.0);
}`;

const HEAD = `#version 300 es
precision highp float;
precision highp sampler2D;
in vec2 vUv; in vec2 vL; in vec2 vR; in vec2 vT; in vec2 vB;
out vec4 outColor;
`;

const FRAG = {
  splat: `${HEAD}
uniform sampler2D uTarget; uniform float aspect; uniform vec3 color; uniform vec2 point; uniform float radius;
void main(){
  vec2 p = vUv - point; p.x *= aspect;
  vec3 splat = exp(-dot(p, p) / radius) * color;
  outColor = vec4(texture(uTarget, vUv).xyz + splat, 1.0);
}`,
  advection: `${HEAD}
uniform sampler2D uVelocity; uniform sampler2D uSource; uniform vec2 texel; uniform float dt; uniform float dissipation;
void main(){
  vec2 coord = vUv - dt * texture(uVelocity, vUv).xy * texel;
  outColor = texture(uSource, coord) / (1.0 + dissipation * dt);
}`,
  divergence: `${HEAD}
uniform sampler2D uVelocity;
void main(){
  float L = texture(uVelocity, vL).x; float R = texture(uVelocity, vR).x;
  float T = texture(uVelocity, vT).y; float B = texture(uVelocity, vB).y;
  vec2 C = texture(uVelocity, vUv).xy;
  if (vL.x < 0.0) L = -C.x; if (vR.x > 1.0) R = -C.x;
  if (vT.y > 1.0) T = -C.y; if (vB.y < 0.0) B = -C.y;
  outColor = vec4(0.5 * (R - L + T - B), 0.0, 0.0, 1.0);
}`,
  curl: `${HEAD}
uniform sampler2D uVelocity;
void main(){
  float L = texture(uVelocity, vL).y; float R = texture(uVelocity, vR).y;
  float T = texture(uVelocity, vT).x; float B = texture(uVelocity, vB).x;
  outColor = vec4(0.5 * (R - L - T + B), 0.0, 0.0, 1.0);
}`,
  vorticity: `${HEAD}
uniform sampler2D uVelocity; uniform sampler2D uCurl; uniform float curl; uniform float dt;
void main(){
  float L = texture(uCurl, vL).x; float R = texture(uCurl, vR).x;
  float T = texture(uCurl, vT).x; float B = texture(uCurl, vB).x;
  float C = texture(uCurl, vUv).x;
  vec2 force = 0.5 * vec2(abs(T) - abs(B), abs(R) - abs(L));
  force /= length(force) + 0.0001;
  force *= curl * C; force.y *= -1.0;
  vec2 vel = texture(uVelocity, vUv).xy + force * dt;
  outColor = vec4(clamp(vel, -1000.0, 1000.0), 0.0, 1.0);
}`,
  pressure: `${HEAD}
uniform sampler2D uPressure; uniform sampler2D uDivergence;
void main(){
  float L = texture(uPressure, vL).x; float R = texture(uPressure, vR).x;
  float T = texture(uPressure, vT).x; float B = texture(uPressure, vB).x;
  float div = texture(uDivergence, vUv).x;
  outColor = vec4((L + R + B + T - div) * 0.25, 0.0, 0.0, 1.0);
}`,
  gradient: `${HEAD}
uniform sampler2D uPressure; uniform sampler2D uVelocity;
void main(){
  float L = texture(uPressure, vL).x; float R = texture(uPressure, vR).x;
  float T = texture(uPressure, vT).x; float B = texture(uPressure, vB).x;
  vec2 vel = texture(uVelocity, vUv).xy - vec2(R - L, T - B);
  outColor = vec4(vel, 0.0, 1.0);
}`,
  clear: `${HEAD}
uniform sampler2D uTexture; uniform float value;
void main(){ outColor = value * texture(uTexture, vUv); }`,
  display: `${HEAD}
uniform sampler2D uTexture; uniform vec2 texel;
void main(){
  vec3 raw = max(texture(uTexture, vUv).rgb, 0.0);
  // 노출 톤매핑: 옅은 잉크도 보이고 진한 곳은 하얗게 타지 않게
  vec3 c = 1.0 - exp(-raw * 4.0);
  // 밀도 기울기로 얕은 입체감
  float dx = length(texture(uTexture, vR).rgb) - length(texture(uTexture, vL).rgb);
  float dy = length(texture(uTexture, vT).rgb) - length(texture(uTexture, vB).rgb);
  vec3 n = normalize(vec3(dx, dy, length(texel) * 4.0));
  c *= 0.8 + 0.35 * n.z + 0.25 * clamp(dot(n.xy, vec2(-0.6, 0.6)), 0.0, 1.0);
  // 비-premultiplied 캔버스에서 가산 합성처럼 보이도록 색을 알파로 나눈다
  float a = clamp(max(c.r, max(c.g, c.b)) * 1.15, 0.0, 1.0);
  outColor = vec4(min(c / max(a, 0.001), 1.0), a);
}`,
};

type ProgName = keyof typeof FRAG;

interface Program {
  prog: WebGLProgram;
  u: Record<string, WebGLUniformLocation | null>;
}

interface FBO {
  tex: WebGLTexture;
  fbo: WebGLFramebuffer;
  w: number;
  h: number;
  attach(unit: number): number;
}

interface DoubleFBO {
  read: FBO;
  write: FBO;
  swap(): void;
  w: number;
  h: number;
}

export function create(container: HTMLElement): Demo {
  const stage = createStageGL(container);
  const { gl, canvas } = stage;
  // 속도장은 음수를 저장해야 하므로 반정밀도 렌더 타깃이 필수
  const floatExt = gl.getExtension('EXT_color_buffer_float') ?? gl.getExtension('EXT_color_buffer_half_float');
  if (!floatExt) {
    stage.dispose();
    throw new WebGLUnavailableError();
  }
  const halfType = gl.HALF_FLOAT;
  const fmtRGBA = gl.RGBA16F;
  const fmtRG = gl.RG16F;
  const fmtR = gl.R16F;
  const baseRG = gl.RG;
  const baseR = gl.RED;

  function compile(type: number, src: string): WebGLShader {
    const s = gl.createShader(type);
    if (!s) throw new Error('createShader failed');
    gl.shaderSource(s, src);
    gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s) ?? 'shader error');
    return s;
  }
  const vs = compile(gl.VERTEX_SHADER, VERT);
  const programs = {} as Record<ProgName, Program>;
  for (const name of Object.keys(FRAG) as ProgName[]) {
    const prog = gl.createProgram();
    if (!prog) throw new Error('createProgram failed');
    gl.attachShader(prog, vs);
    gl.attachShader(prog, compile(gl.FRAGMENT_SHADER, FRAG[name]));
    gl.bindAttribLocation(prog, 0, 'aPos');
    gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(prog) ?? 'link error');
    const u: Program['u'] = {};
    const n = gl.getProgramParameter(prog, gl.ACTIVE_UNIFORMS) as number;
    for (let i = 0; i < n; i++) {
      const info = gl.getActiveUniform(prog, i);
      if (info) u[info.name] = gl.getUniformLocation(prog, info.name);
    }
    programs[name] = { prog, u };
  }

  const vbo = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, vbo);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, -1, 1, 1, 1, 1, -1]), gl.STATIC_DRAW);
  const ibo = gl.createBuffer();
  gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, ibo);
  gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint16Array([0, 1, 2, 0, 2, 3]), gl.STATIC_DRAW);
  gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
  gl.enableVertexAttribArray(0);

  const textures: WebGLTexture[] = [];
  const framebuffers: WebGLFramebuffer[] = [];

  function createFBO(w: number, h: number, internal: number, format: number, filter: number): FBO {
    gl.activeTexture(gl.TEXTURE0);
    const tex = gl.createTexture();
    const fbo = gl.createFramebuffer();
    if (!tex || !fbo) throw new Error('FBO alloc failed');
    textures.push(tex);
    framebuffers.push(fbo);
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, filter);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, filter);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texImage2D(gl.TEXTURE_2D, 0, internal, w, h, 0, format, halfType, null);
    gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0);
    if (gl.checkFramebufferStatus(gl.FRAMEBUFFER) !== gl.FRAMEBUFFER_COMPLETE) throw new WebGLUnavailableError();
    gl.viewport(0, 0, w, h);
    gl.clear(gl.COLOR_BUFFER_BIT);
    return {
      tex,
      fbo,
      w,
      h,
      attach(unit) {
        gl.activeTexture(gl.TEXTURE0 + unit);
        gl.bindTexture(gl.TEXTURE_2D, tex);
        return unit;
      },
    };
  }

  function createDouble(w: number, h: number, internal: number, format: number, filter: number): DoubleFBO {
    const d: DoubleFBO = {
      read: createFBO(w, h, internal, format, filter),
      write: createFBO(w, h, internal, format, filter),
      w,
      h,
      swap() {
        const t = d.read;
        d.read = d.write;
        d.write = t;
      },
    };
    return d;
  }

  function res(base: number) {
    const aspect = stage.width / stage.height;
    const min = Math.round(base);
    const max = Math.round(base * Math.max(aspect, 1 / aspect));
    return aspect >= 1 ? { w: max, h: min } : { w: min, h: max };
  }

  const linear = gl.LINEAR;
  let velocity: DoubleFBO;
  let dye: DoubleFBO;
  let pressure: DoubleFBO;
  let divergence: FBO;
  let curl: FBO;

  function freeAll() {
    textures.forEach((t) => gl.deleteTexture(t));
    framebuffers.forEach((f) => gl.deleteFramebuffer(f));
    textures.length = 0;
    framebuffers.length = 0;
  }

  function initFramebuffers() {
    freeAll();
    const sim = res(SIM_RES);
    const dyeRes = res(DYE_RES);
    velocity = createDouble(sim.w, sim.h, fmtRG, baseRG, linear);
    dye = createDouble(dyeRes.w, dyeRes.h, fmtRGBA, gl.RGBA, linear);
    pressure = createDouble(sim.w, sim.h, fmtR, baseR, gl.NEAREST);
    divergence = createFBO(sim.w, sim.h, fmtR, baseR, gl.NEAREST);
    curl = createFBO(sim.w, sim.h, fmtR, baseR, gl.NEAREST);
  }

  function blit(target: FBO | null) {
    if (target) {
      gl.viewport(0, 0, target.w, target.h);
      gl.bindFramebuffer(gl.FRAMEBUFFER, target.fbo);
    } else {
      gl.viewport(0, 0, gl.drawingBufferWidth, gl.drawingBufferHeight);
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    }
    gl.drawElements(gl.TRIANGLES, 6, gl.UNSIGNED_SHORT, 0);
  }

  function use(name: ProgName): Program['u'] {
    const p = programs[name];
    gl.useProgram(p.prog);
    return p.u;
  }

  function splat(x: number, y: number, dx: number, dy: number, color: [number, number, number]) {
    let u = use('splat');
    gl.uniform2f(u.texel, 1 / velocity.w, 1 / velocity.h);
    gl.uniform1i(u.uTarget, velocity.read.attach(0));
    gl.uniform1f(u.aspect, canvas.width / canvas.height);
    gl.uniform2f(u.point, x, y);
    gl.uniform3f(u.color, dx, dy, 0);
    const r = (SPLAT_RADIUS / 100) * (canvas.width > canvas.height ? canvas.width / canvas.height : 1);
    gl.uniform1f(u.radius, r);
    blit(velocity.write);
    velocity.swap();

    u = use('splat');
    gl.uniform1i(u.uTarget, dye.read.attach(0));
    gl.uniform3f(u.color, color[0], color[1], color[2]);
    blit(dye.write);
    dye.swap();
  }

  function step(dt: number) {
    gl.disable(gl.BLEND);
    let u = use('curl');
    gl.uniform2f(u.texel, 1 / velocity.w, 1 / velocity.h);
    gl.uniform1i(u.uVelocity, velocity.read.attach(0));
    blit(curl);

    u = use('vorticity');
    gl.uniform2f(u.texel, 1 / velocity.w, 1 / velocity.h);
    gl.uniform1i(u.uVelocity, velocity.read.attach(0));
    gl.uniform1i(u.uCurl, curl.attach(1));
    gl.uniform1f(u.curl, CURL);
    gl.uniform1f(u.dt, dt);
    blit(velocity.write);
    velocity.swap();

    u = use('divergence');
    gl.uniform2f(u.texel, 1 / velocity.w, 1 / velocity.h);
    gl.uniform1i(u.uVelocity, velocity.read.attach(0));
    blit(divergence);

    u = use('clear');
    gl.uniform2f(u.texel, 1 / velocity.w, 1 / velocity.h);
    gl.uniform1i(u.uTexture, pressure.read.attach(0));
    gl.uniform1f(u.value, 0.8);
    blit(pressure.write);
    pressure.swap();

    u = use('pressure');
    gl.uniform2f(u.texel, 1 / velocity.w, 1 / velocity.h);
    gl.uniform1i(u.uDivergence, divergence.attach(0));
    for (let i = 0; i < PRESSURE_ITER; i++) {
      gl.uniform1i(u.uPressure, pressure.read.attach(1));
      blit(pressure.write);
      pressure.swap();
    }

    u = use('gradient');
    gl.uniform2f(u.texel, 1 / velocity.w, 1 / velocity.h);
    gl.uniform1i(u.uPressure, pressure.read.attach(0));
    gl.uniform1i(u.uVelocity, velocity.read.attach(1));
    blit(velocity.write);
    velocity.swap();

    u = use('advection');
    gl.uniform2f(u.texel, 1 / velocity.w, 1 / velocity.h);
    gl.uniform1i(u.uVelocity, velocity.read.attach(0));
    gl.uniform1i(u.uSource, velocity.read.attach(0));
    gl.uniform1f(u.dt, dt);
    gl.uniform1f(u.dissipation, VEL_DISSIPATION);
    blit(velocity.write);
    velocity.swap();

    gl.uniform1i(u.uVelocity, velocity.read.attach(0));
    gl.uniform1i(u.uSource, dye.read.attach(1));
    gl.uniform1f(u.dissipation, DYE_DISSIPATION);
    blit(dye.write);
    dye.swap();
  }

  function render() {
    gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
    gl.enable(gl.BLEND);
    gl.clearColor(0, 0, 0, 0);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.viewport(0, 0, gl.drawingBufferWidth, gl.drawingBufferHeight);
    gl.clear(gl.COLOR_BUFFER_BIT);
    const u = use('display');
    gl.uniform2f(u.texel, 1 / gl.drawingBufferWidth, 1 / gl.drawingBufferHeight);
    gl.uniform1i(u.uTexture, dye.read.attach(0));
    blit(null);
  }

  // 팔레트: 시안~블루~바이올렛 (hue 0.52~0.80)
  let hueBase = Math.random();
  function color(): [number, number, number] {
    hueBase = (hueBase + 0.07) % 1;
    const h = 0.66 + Math.sin(hueBase * Math.PI * 2) * 0.14;
    const [r, g, b] = hsv(h, 0.8, 1);
    return [r * 0.65, g * 0.65, b * 0.65];
  }

  // 포인터
  let last: { x: number; y: number } | null = null;
  let idle = 0;
  const onMove = (e: PointerEvent) => {
    const rect = canvas.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width;
    const y = 1 - (e.clientY - rect.top) / rect.height;
    if (last) {
      const dx = (x - last.x) * 6000;
      const dy = (y - last.y) * 6000;
      if (Math.abs(dx) + Math.abs(dy) > 0.5) splat(x, y, dx, dy, color());
    }
    last = { x, y };
    idle = 0;
  };
  const onLeave = () => (last = null);
  container.addEventListener('pointermove', onMove);
  container.addEventListener('pointerleave', onLeave);
  container.addEventListener('pointercancel', onLeave);

  try {
    initFramebuffers();
  } catch (err) {
    freeAll();
    stage.dispose();
    throw err;
  }
  let w0 = stage.width;
  let h0 = stage.height;
  stage.onResize((w, h) => {
    if (Math.abs(w - w0) > 40 || Math.abs(h - h0) > 40) {
      w0 = w;
      h0 = h;
      try {
        initFramebuffers();
      } catch (err) {
        console.error('[fluid] resize realloc failed', err);
        loop.stop();
      }
    }
  });

  let autoT = 0;
  function autoSplat() {
    const x = 0.2 + Math.random() * 0.6;
    const y = 0.2 + Math.random() * 0.6;
    const a = Math.random() * Math.PI * 2;
    splat(x, y, Math.cos(a) * 900, Math.sin(a) * 900, color());
  }
  for (let i = 0; i < 4; i++) autoSplat();

  const loop = createLoop((dt) => {
    idle += dt;
    autoT += dt;
    if (idle > 2.5 && autoT > 1.1) {
      autoT = 0;
      autoSplat();
    }
    step(dt);
    render();
  });
  loop.start();

  return {
    pause: () => loop.stop(),
    resume: () => loop.start(),
    unmount: () => {
      loop.stop();
      container.removeEventListener('pointermove', onMove);
      container.removeEventListener('pointerleave', onLeave);
      container.removeEventListener('pointercancel', onLeave);
      freeAll();
      stage.dispose();
    },
  };
}

function hsv(h: number, s: number, v: number): [number, number, number] {
  const i = Math.floor(h * 6);
  const f = h * 6 - i;
  const p = v * (1 - s);
  const q = v * (1 - f * s);
  const t = v * (1 - (1 - f) * s);
  switch (((i % 6) + 6) % 6) {
    case 0:
      return [v, t, p];
    case 1:
      return [q, v, p];
    case 2:
      return [p, v, t];
    case 3:
      return [p, q, v];
    case 4:
      return [t, p, v];
    default:
      return [v, p, q];
  }
}
