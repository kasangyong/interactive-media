export type Category = 'pointer' | 'scroll' | 'audio' | 'sensor';
export type Requirement = 'webgl' | 'camera' | 'microphone' | 'motion' | 'audio-gesture';
export type CursorMode = 'drag' | 'view' | 'click' | 'sound';

export interface DemoMeta {
  id: string;
  category: Category;
  title: string;
  description: string;
  apis: string[];
  /** 조작 안내 한 줄 */
  hint?: string;
  requires?: Requirement[];
  /** split: 설명+캔버스, full: 풀블리드, scroll: sticky 스테이지 + 스크롤 길이 */
  layout?: 'split' | 'full' | 'scroll';
  /** layout 'scroll' 일 때 블록 높이(vh) */
  scrollLength?: number;
  cursor?: CursorMode;
}

export interface Demo {
  pause(): void;
  resume(): void;
  unmount(): void;
}

export interface DemoFactory {
  create(container: HTMLElement): Demo | Promise<Demo>;
}

export interface DemoEntry {
  meta: DemoMeta;
  load: () => Promise<DemoFactory>;
}

export type Registry = Record<string, DemoEntry>;

/** 사용자 클릭(게이트)이 있어야 시작할 수 있는 요구사항 */
export const GATED: readonly Requirement[] = ['camera', 'microphone', 'motion', 'audio-gesture'];

export class WebGLUnavailableError extends Error {
  constructor() {
    super('WebGL unavailable');
    this.name = 'WebGLUnavailableError';
  }
}
