import { beforeEach, expect, test, vi } from 'vitest';
import { createStage2D, createStageGL } from '../../src/core/stage';
import { WebGLUnavailableError } from '../../src/core/types';

class MockRO {
  constructor(public cb: () => void) {}
  observe() {}
  disconnect() {}
}

beforeEach(() => {
  vi.stubGlobal('ResizeObserver', MockRO);
  document.body.innerHTML = '';
});

function container(w: number, h: number): HTMLElement {
  const el = document.createElement('div');
  Object.defineProperty(el, 'clientWidth', { value: w });
  Object.defineProperty(el, 'clientHeight', { value: h });
  document.body.appendChild(el);
  return el;
}

test('createStage2D sizes canvas by container × dpr without throwing', () => {
  const setTransform = vi.fn();
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({ setTransform } as unknown as CanvasRenderingContext2D);
  vi.stubGlobal('devicePixelRatio', 3);
  const s = createStage2D(container(200, 100));
  expect(s.dpr).toBe(2);
  expect(s.canvas.width).toBe(400);
  expect(s.canvas.height).toBe(200);
  const cb = vi.fn();
  s.onResize(cb);
  expect(cb).toHaveBeenCalledWith(200, 100, 2);
  s.dispose();
  expect(s.canvas.isConnected).toBe(false);
});

test('createStageGL throws WebGLUnavailableError and cleans up when context is null', () => {
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null);
  const c = container(100, 100);
  expect(() => createStageGL(c)).toThrow(WebGLUnavailableError);
  expect(c.querySelector('canvas')).toBeNull();
});
