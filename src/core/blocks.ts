import type { Category, DemoMeta, Registry } from './types';

const CHAPTER_NUM: Record<Category, string> = { pointer: '01', scroll: '02', audio: '03', sensor: '04' };

function el<K extends keyof HTMLElementTagNameMap>(tag: K, cls?: string, text?: string): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  if (cls) node.className = cls;
  if (text !== undefined) node.textContent = text;
  return node;
}

function info(meta: DemoMeta, index: number): HTMLElement {
  const box = el('div', 'demo-info');
  const title = el('h3', 'demo-title', meta.title);
  title.dataset.reveal = 'lines';
  box.append(
    el('span', 'demo-index', `${CHAPTER_NUM[meta.category]}.${index + 1}`),
    title,
    el('p', 'demo-desc', meta.description),
  );
  const apis = el('ul', 'demo-apis');
  for (const api of meta.apis) apis.append(el('li', undefined, api));
  box.append(apis);
  if (meta.hint) box.append(el('p', 'demo-hint', meta.hint));
  return box;
}

function stage(meta: DemoMeta): HTMLElement {
  const s = el('div', 'demo-stage');
  s.dataset.demo = meta.id;
  if (meta.cursor) s.dataset.cursor = meta.cursor;
  return s;
}

/** registry 순서대로 `[data-demo-list=<category>]` 안에 데모 블록 마크업을 만든다 */
export function renderBlocks(registry: Registry): HTMLElement[] {
  const counters: Record<Category, number> = { pointer: 0, scroll: 0, audio: 0, sensor: 0 };
  const stages: HTMLElement[] = [];
  for (const { meta } of Object.values(registry)) {
    const list = document.querySelector<HTMLElement>(`[data-demo-list="${meta.category}"]`);
    if (!list) continue;
    const i = counters[meta.category]++;
    const layout = meta.layout ?? 'split';
    const block = el('article', `demo-block demo-block--${layout}`);
    block.id = `demo-${meta.id}`;
    if (layout === 'split' && i % 2 === 1) block.classList.add('demo-block--reverse');
    const st = stage(meta);
    if (layout === 'scroll') {
      block.style.height = `${meta.scrollLength ?? 300}vh`;
      const sticky = el('div', 'demo-sticky');
      sticky.append(st, info(meta, i));
      block.append(sticky);
    } else {
      block.append(info(meta, i), st);
    }
    list.append(block);
    stages.push(st);
  }
  return stages;
}
