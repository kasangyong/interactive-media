import type { ScrollController } from './scroll';

/** `<br>` 기준으로 줄을 나눠 .rv-line > span 으로 감싼다 */
function splitLines(el: HTMLElement) {
  const parts = el.innerHTML.split(/<br\s*\/?>/i);
  el.innerHTML = parts.map((p) => `<span class="rv-line"><span>${p.trim()}</span></span>`).join('');
}

function splitWords(el: HTMLElement): HTMLElement[] {
  const words = (el.textContent ?? '').trim().split(/\s+/);
  el.textContent = '';
  return words.map((w, i) => {
    const span = document.createElement('span');
    span.className = 'rv-word';
    span.textContent = w;
    el.append(span);
    if (i < words.length - 1) el.append(' ');
    return span;
  });
}

/**
 * [data-reveal="lines"] : 화면 진입 시 줄 단위 마스크 리빌
 * [data-reveal="scrub"] : 스크롤 진행도에 따라 단어가 하나씩 켜짐
 */
export function initReveal(scroll: ScrollController, root: ParentNode = document): void {
  const io = new IntersectionObserver(
    (entries) => {
      for (const e of entries) {
        if (!e.isIntersecting) continue;
        e.target.classList.add('is-revealed');
        io.unobserve(e.target);
      }
    },
    { rootMargin: '0px 0px -12% 0px' },
  );
  root.querySelectorAll<HTMLElement>('[data-reveal="lines"]').forEach((el) => {
    splitLines(el);
    io.observe(el);
  });

  const scrubs = Array.from(root.querySelectorAll<HTMLElement>('[data-reveal="scrub"]')).map((el) => ({
    el,
    words: splitWords(el),
  }));
  const update = () => {
    const vh = window.innerHeight;
    for (const { el, words } of scrubs) {
      const r = el.getBoundingClientRect();
      const p = Math.min(1, Math.max(0, (vh * 0.85 - r.top) / (r.height + vh * 0.3)));
      const on = Math.round(p * words.length);
      words.forEach((w, i) => w.classList.toggle('is-on', i < on));
    }
  };
  scroll.onScroll(update);
  update();
}
