import { GATED, WebGLUnavailableError } from './types';
import type { Demo, Registry, Requirement } from './types';

export type DemoState = 'idle' | 'gated' | 'loading' | 'active' | 'paused' | 'failed';

interface Slot {
  id: string;
  el: HTMLElement;
  state: DemoState;
  near: boolean;
  unlocked: boolean;
  token: number;
  demo?: Demo;
  mountEl?: HTMLElement;
}

export interface DemoHostOptions {
  maxActiveGL?: number;
  /** 이 범위 안에 들어오면 mount/resume, 벗어나면 pause */
  nearMargin?: string;
  /** 이 범위를 벗어나면 unmount */
  farMargin?: string;
  /** 게이트 클릭 시 (사용자 제스처 안에서) 호출 — AudioContext.resume 등 */
  onUnlock?: (requires: Requirement[]) => void;
}

const GATE_LABEL: Record<Requirement, string> = {
  webgl: '',
  camera: '카메라 켜기',
  microphone: '마이크 켜기',
  motion: '센서 사용하기',
  'audio-gesture': '소리 켜기',
};

export class DemoHost {
  private slots = new Map<string, Slot>();
  private byEl = new Map<Element, Slot>();
  private nearIO: IntersectionObserver;
  private farIO: IntersectionObserver;
  private maxActiveGL: number;
  private onUnlock?: (requires: Requirement[]) => void;

  constructor(private registry: Registry, opts: DemoHostOptions = {}) {
    this.maxActiveGL = opts.maxActiveGL ?? 3;
    this.onUnlock = opts.onUnlock;
    this.nearIO = new IntersectionObserver((entries) => {
      for (const e of entries) {
        const slot = this.byEl.get(e.target);
        if (!slot) continue;
        if (e.isIntersecting) this.enter(slot);
        else this.leave(slot);
      }
    }, { rootMargin: opts.nearMargin ?? '15% 0px' });
    this.farIO = new IntersectionObserver((entries) => {
      for (const e of entries) {
        const slot = this.byEl.get(e.target);
        if (slot && !e.isIntersecting) this.unload(slot);
      }
    }, { rootMargin: opts.farMargin ?? '150% 0px' });
  }

  observe(el: HTMLElement): void {
    const id = el.dataset.demo;
    if (!id || !this.registry[id]) throw new Error(`Unknown demo: ${id}`);
    const slot: Slot = { id, el, state: 'idle', near: false, unlocked: false, token: 0 };
    this.slots.set(id, slot);
    this.byEl.set(el, slot);
    this.nearIO.observe(el);
    this.farIO.observe(el);
  }

  stateOf(id: string): DemoState | undefined {
    return this.slots.get(id)?.state;
  }

  activeGLCount(): number {
    return this.glSlots().length;
  }

  destroy(): void {
    this.nearIO.disconnect();
    this.farIO.disconnect();
    for (const slot of this.slots.values()) this.unload(slot);
  }

  private requires(slot: Slot): Requirement[] {
    return this.registry[slot.id].meta.requires ?? [];
  }

  private gatedRequires(slot: Slot): Requirement[] {
    return this.requires(slot).filter((r) => GATED.includes(r));
  }

  private isGL(slot: Slot): boolean {
    return this.requires(slot).includes('webgl');
  }

  private glSlots(): Slot[] {
    return [...this.slots.values()].filter(
      (s) => this.isGL(s) && (s.state === 'loading' || s.state === 'active' || s.state === 'paused'),
    );
  }

  private enter(slot: Slot): void {
    slot.near = true;
    slot.el.classList.add('is-near');
    if (slot.state === 'paused' && slot.demo) {
      slot.demo.resume();
      slot.state = 'active';
    } else if (slot.state === 'idle') {
      if (this.gatedRequires(slot).length > 0 && !slot.unlocked) this.renderGate(slot);
      else void this.start(slot);
    }
  }

  private leave(slot: Slot): void {
    slot.near = false;
    slot.el.classList.remove('is-near');
    if (slot.state === 'active' && slot.demo) {
      slot.demo.pause();
      slot.state = 'paused';
    }
  }

  private unload(slot: Slot): void {
    slot.token++;
    if (slot.demo) {
      try {
        slot.demo.unmount();
      } catch (err) {
        console.error(`[demo:${slot.id}] unmount failed`, err);
      }
    }
    slot.demo = undefined;
    slot.mountEl?.remove();
    slot.mountEl = undefined;
    slot.el.classList.remove('is-loading', 'is-active');
    if (slot.state !== 'gated' && slot.state !== 'failed') slot.state = 'idle';
  }

  private async start(slot: Slot): Promise<void> {
    const token = ++slot.token;
    slot.state = 'loading';
    slot.el.classList.add('is-loading');
    slot.el.querySelector('.demo-fallback')?.remove();
    const mountEl = document.createElement('div');
    mountEl.className = 'demo-mount';
    slot.el.appendChild(mountEl);
    slot.mountEl = mountEl;
    if (this.isGL(slot)) this.enforceGLLimit(slot);

    let demo: Demo;
    try {
      const factory = await this.registry[slot.id].load();
      if (token !== slot.token) return;
      demo = await factory.create(mountEl);
    } catch (err) {
      if (token !== slot.token) return;
      console.error(`[demo:${slot.id}]`, err);
      mountEl.remove();
      slot.mountEl = undefined;
      slot.el.classList.remove('is-loading');
      slot.state = 'failed';
      this.renderFallback(slot, err);
      return;
    }

    if (token !== slot.token) {
      demo.unmount();
      return;
    }
    slot.demo = demo;
    slot.el.classList.remove('is-loading');
    slot.el.classList.add('is-active');
    if (slot.near) {
      slot.state = 'active';
    } else {
      demo.pause();
      slot.state = 'paused';
    }
  }

  private enforceGLLimit(keep: Slot): void {
    const gl = this.glSlots();
    while (gl.length > this.maxActiveGL) {
      let farthest: Slot | undefined;
      let max = -1;
      for (const s of gl) {
        if (s === keep) continue;
        const d = distanceToViewport(s.el);
        if (d > max) {
          max = d;
          farthest = s;
        }
      }
      if (!farthest) break;
      this.unload(farthest);
      gl.splice(gl.indexOf(farthest), 1);
    }
  }

  private renderGate(slot: Slot): void {
    slot.state = 'gated';
    if (slot.el.querySelector('.demo-gate')) return;
    const reqs = this.gatedRequires(slot);
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'demo-gate';
    btn.dataset.cursor = 'click';
    btn.innerHTML = `<span class="demo-gate__dot"></span><span>${GATE_LABEL[reqs[0]]}</span>`;
    btn.addEventListener('click', () => {
      slot.unlocked = true;
      this.onUnlock?.(reqs);
      btn.remove();
      slot.state = 'idle';
      if (slot.near) void this.start(slot);
    });
    slot.el.appendChild(btn);
  }

  private renderFallback(slot: Slot, err: unknown): void {
    const box = document.createElement('div');
    box.className = 'demo-fallback';
    const msg = document.createElement('p');
    msg.textContent =
      err instanceof WebGLUnavailableError
        ? '이 기기 또는 브라우저에서는 WebGL을 사용할 수 없어 데모를 표시할 수 없습니다.'
        : '데모를 불러오지 못했습니다.';
    box.appendChild(msg);
    if (!(err instanceof WebGLUnavailableError)) {
      const retry = document.createElement('button');
      retry.type = 'button';
      retry.textContent = '다시 시도';
      retry.addEventListener('click', () => {
        slot.state = 'idle';
        box.remove();
        if (slot.near) void this.start(slot);
      });
      box.appendChild(retry);
    }
    slot.el.appendChild(box);
  }
}

export function distanceToViewport(el: Element): number {
  const r = el.getBoundingClientRect();
  if (r.bottom < 0) return -r.bottom;
  if (r.top > window.innerHeight) return r.top - window.innerHeight;
  return 0;
}
