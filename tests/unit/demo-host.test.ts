import { beforeEach, describe, expect, test, vi } from 'vitest';
import { DemoHost } from '../../src/core/demo-host';
import type { Demo, DemoEntry, DemoMeta, Registry, Requirement } from '../../src/core/types';
import { WebGLUnavailableError } from '../../src/core/types';

type IOCallback = (entries: Array<{ target: Element; isIntersecting: boolean }>) => void;

class MockIO {
  static instances: MockIO[] = [];
  targets = new Set<Element>();
  constructor(public cb: IOCallback, public options: { rootMargin?: string } = {}) {
    MockIO.instances.push(this);
  }
  observe(el: Element) { this.targets.add(el); }
  unobserve(el: Element) { this.targets.delete(el); }
  disconnect() { this.targets.clear(); }
}

const near = () => MockIO.instances[0];
const far = () => MockIO.instances[1];
const fire = (io: MockIO, el: Element, isIntersecting: boolean) => io.cb([{ target: el, isIntersecting }]);
const flush = () => new Promise((r) => setTimeout(r, 0));

type FakeDemo = Demo & { calls: string[] };

function fakeDemo(): FakeDemo {
  const calls: string[] = [];
  return {
    calls,
    pause: () => calls.push('pause'),
    resume: () => calls.push('resume'),
    unmount: () => calls.push('unmount'),
  };
}

type CreateFn = (container: HTMLElement) => Demo | Promise<Demo>;

function entry(id: string, requires: Requirement[] = [], impl: CreateFn = () => fakeDemo()) {
  const create = vi.fn(impl);
  const meta: DemoMeta = { id, category: 'pointer', title: id, description: '', apis: [], requires };
  const e: DemoEntry = { meta, load: async () => ({ create }) };
  return { ...e, create };
}

function stage(id: string, top = 0): HTMLElement {
  const el = document.createElement('div');
  el.dataset.demo = id;
  el.getBoundingClientRect = () =>
    ({ top, bottom: top + 100, left: 0, right: 100, width: 100, height: 100, x: 0, y: top, toJSON: () => ({}) }) as DOMRect;
  document.body.appendChild(el);
  return el;
}

beforeEach(() => {
  MockIO.instances = [];
  document.body.innerHTML = '';
  vi.stubGlobal('IntersectionObserver', MockIO);
});

describe('DemoHost lifecycle', () => {
  test('enter → create once, leave → pause, re-enter → resume, far → unmount', async () => {
    const e = entry('a');
    const host = new DemoHost({ a: e });
    const el = stage('a');
    host.observe(el);

    fire(near(), el, true);
    await flush();
    expect(e.create).toHaveBeenCalledTimes(1);
    const demo = e.create.mock.results[0].value as FakeDemo;

    fire(near(), el, false);
    expect(demo.calls).toEqual(['pause']);
    fire(near(), el, true);
    expect(demo.calls).toEqual(['pause', 'resume']);
    fire(near(), el, false);
    fire(far(), el, false);
    expect(demo.calls.at(-1)).toBe('unmount');

    fire(near(), el, true);
    await flush();
    expect(e.create).toHaveBeenCalledTimes(2);
  });

  test('unmount requested while loading → demo unmounted on resolve, not active', async () => {
    let resolve!: (d: Demo) => void;
    const demo = fakeDemo();
    const e = entry('a', [], () => new Promise<Demo>((r) => { resolve = r; }));
    const host = new DemoHost({ a: e });
    const el = stage('a');
    host.observe(el);

    fire(near(), el, true);
    await flush();
    fire(near(), el, false);
    fire(far(), el, false);
    resolve(demo);
    await flush();
    expect(demo.calls).toContain('unmount');
    expect(host.stateOf('a')).toBe('idle');
  });

  test('webgl demos capped at maxActiveGL, farthest evicted', async () => {
    const reg: Registry = {};
    const els: HTMLElement[] = [];
    for (let i = 0; i < 4; i++) {
      reg[`g${i}`] = entry(`g${i}`, ['webgl']);
      els.push(stage(`g${i}`, i * 1000));
    }
    const host = new DemoHost(reg, { maxActiveGL: 3 });
    els.forEach((el) => host.observe(el));
    for (const el of els) {
      fire(near(), el, true);
      await flush();
    }
    expect(host.activeGLCount()).toBe(3);
    // 마지막에 로드된 g3 는 유지, 나머지 중 뷰포트에서 가장 먼 g2(top 2000) 해제
    expect(host.stateOf('g2')).toBe('idle');
    expect(host.stateOf('g3')).toBe('active');
  });

  test('GL eviction prefers slots that are not near the viewport', async () => {
    const reg: Registry = {};
    const els: HTMLElement[] = [];
    for (let i = 0; i < 4; i++) {
      reg[`g${i}`] = entry(`g${i}`, ['webgl']);
      els.push(stage(`g${i}`, i * 1000));
    }
    const host = new DemoHost(reg, { maxActiveGL: 3 });
    els.forEach((el) => host.observe(el));
    fire(near(), els[0], true);
    fire(near(), els[1], true);
    await flush();
    fire(near(), els[1], false); // g1: 화면 밖 → paused (로드는 유지)
    fire(near(), els[2], true);
    await flush();
    fire(near(), els[3], true);
    await flush();
    expect(host.activeGLCount()).toBe(3);
    // g2 가 뷰포트에서 더 멀지만 near 이므로 남고, near 가 아닌 g1 이 해제된다
    expect(host.stateOf('g1')).toBe('idle');
    expect(host.stateOf('g2')).toBe('active');
  });

  test('create throws → fallback rendered, others unaffected', async () => {
    const bad = entry('bad', ['webgl'], () => { throw new WebGLUnavailableError(); });
    const good = entry('good');
    const host = new DemoHost({ bad, good });
    const elBad = stage('bad');
    const elGood = stage('good');
    host.observe(elBad);
    host.observe(elGood);
    fire(near(), elBad, true);
    fire(near(), elGood, true);
    await flush();
    expect(elBad.querySelector('.demo-fallback')?.textContent).toContain('WebGL');
    expect(host.stateOf('bad')).toBe('failed');
    expect(host.stateOf('good')).toBe('active');
  });

  test('unlocking one gate unlocks other demos with the same requirement', async () => {
    const a = entry('a', ['audio-gesture']);
    const b = entry('b', ['audio-gesture']);
    const cam = entry('cam', ['camera']);
    const host = new DemoHost({ a, b, cam });
    const [ea, eb, ec] = [stage('a'), stage('b'), stage('cam')];
    [ea, eb, ec].forEach((el) => host.observe(el));
    [ea, eb, ec].forEach((el) => fire(near(), el, true));
    await flush();
    ea.querySelector<HTMLButtonElement>('.demo-gate')!.click();
    await flush();
    expect(a.create).toHaveBeenCalledTimes(1);
    expect(b.create).toHaveBeenCalledTimes(1);
    expect(eb.querySelector('.demo-gate')).toBeNull();
    expect(cam.create).not.toHaveBeenCalled();
    expect(ec.querySelector('.demo-gate')).not.toBeNull();
  });

  test('gated demo waits for click, then creates and calls onUnlock', async () => {
    const e = entry('cam', ['camera']);
    const onUnlock = vi.fn();
    const host = new DemoHost({ cam: e }, { onUnlock });
    const el = stage('cam');
    host.observe(el);
    fire(near(), el, true);
    await flush();
    expect(e.create).not.toHaveBeenCalled();
    const gate = el.querySelector<HTMLButtonElement>('.demo-gate');
    expect(gate).not.toBeNull();
    gate!.click();
    await flush();
    expect(onUnlock).toHaveBeenCalledWith(['camera']);
    expect(e.create).toHaveBeenCalledTimes(1);
    expect(el.querySelector('.demo-gate')).toBeNull();
  });
});
