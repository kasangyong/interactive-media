import * as THREE from 'three';
import { WebGLUnavailableError } from './types';

type ResizeCb = (w: number, h: number, dpr: number) => void;

interface BaseStage {
  canvas: HTMLCanvasElement;
  width: number;
  height: number;
  dpr: number;
  onResize(cb: ResizeCb): void;
  dispose(): void;
}

export interface Stage2D extends BaseStage {
  ctx: CanvasRenderingContext2D;
}

export interface StageThree extends BaseStage {
  renderer: THREE.WebGLRenderer;
}

export interface StageGL extends BaseStage {
  gl: WebGL2RenderingContext;
}

export const maxDpr = () => Math.min(window.devicePixelRatio || 1, 2);

/** 컨테이너를 꽉 채우는 캔버스 + ResizeObserver 공통 처리 */
function baseStage(
  container: HTMLElement,
  applySize: (canvas: HTMLCanvasElement, w: number, h: number, dpr: number) => void,
): BaseStage {
  const canvas = document.createElement('canvas');
  canvas.className = 'demo-canvas';
  container.appendChild(canvas);
  const cbs: ResizeCb[] = [];
  const stage: BaseStage = {
    canvas,
    width: 1,
    height: 1,
    dpr: maxDpr(),
    onResize: (cb) => {
      cbs.push(cb);
      cb(stage.width, stage.height, stage.dpr);
    },
    dispose: () => {
      ro.disconnect();
      canvas.remove();
    },
  };
  const measure = () => {
    const w = Math.max(1, container.clientWidth);
    const h = Math.max(1, container.clientHeight);
    const dpr = maxDpr();
    if (w === stage.width && h === stage.height && dpr === stage.dpr) return;
    stage.width = w;
    stage.height = h;
    stage.dpr = dpr;
    applySize(canvas, w, h, dpr);
    for (const cb of cbs) cb(w, h, dpr);
  };
  const ro = new ResizeObserver(measure);
  ro.observe(container);
  stage.width = 0;
  measure();
  return stage;
}

export function createStage2D(container: HTMLElement): Stage2D {
  let ctx: CanvasRenderingContext2D | null = null;
  const base = baseStage(container, (canvas, w, h, dpr) => {
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
    ctx?.setTransform(dpr, 0, 0, dpr, 0, 0);
  });
  ctx = base.canvas.getContext('2d');
  if (!ctx) throw new Error('2D context unavailable');
  ctx.setTransform(base.dpr, 0, 0, base.dpr, 0, 0);
  return Object.assign(base, { ctx });
}

export function createStageThree(
  container: HTMLElement,
  opts: { alpha?: boolean; antialias?: boolean } = {},
): StageThree {
  let renderer: THREE.WebGLRenderer | null = null;
  const base = baseStage(container, (_canvas, w, h, dpr) => {
    renderer?.setPixelRatio(dpr);
    renderer?.setSize(w, h, false);
  });
  try {
    renderer = new THREE.WebGLRenderer({
      canvas: base.canvas,
      alpha: opts.alpha ?? true,
      antialias: opts.antialias ?? true,
      powerPreference: 'high-performance',
    });
  } catch {
    base.dispose();
    throw new WebGLUnavailableError();
  }
  renderer.setPixelRatio(base.dpr);
  renderer.setSize(base.width, base.height, false);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  const r = renderer;
  const dispose = base.dispose;
  return Object.assign(base, {
    renderer: r,
    dispose: () => {
      r.dispose();
      r.forceContextLoss();
      dispose();
    },
  });
}

export function createStageGL(container: HTMLElement): StageGL {
  const base = baseStage(container, (canvas, w, h, dpr) => {
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
  });
  const gl = base.canvas.getContext('webgl2', { alpha: true, premultipliedAlpha: false, antialias: false });
  if (!gl) {
    base.dispose();
    throw new WebGLUnavailableError();
  }
  const dispose = base.dispose;
  return Object.assign(base, {
    gl,
    dispose: () => {
      gl.getExtension('WEBGL_lose_context')?.loseContext();
      dispose();
    },
  });
}
