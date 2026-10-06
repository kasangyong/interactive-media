import type { ScrollController } from './scroll';

/** 고정 내비: 섹션 점프, 현재 섹션 하이라이트, 진행 바 */
export function initNav(scroll: ScrollController): void {
  const nav = document.querySelector<HTMLElement>('.nav');
  const bar = document.querySelector<HTMLElement>('.nav__progress span');
  if (!nav) return;

  document.querySelectorAll<HTMLAnchorElement>('a[data-nav]').forEach((a) => {
    a.addEventListener('click', (e) => {
      const id = a.getAttribute('href')?.slice(1);
      const target = id ? document.getElementById(id) : null;
      if (!target) return;
      e.preventDefault();
      scroll.scrollTo(target);
    });
  });

  const links = new Map<string, HTMLAnchorElement>();
  nav.querySelectorAll<HTMLAnchorElement>('.nav__links a').forEach((a) => {
    links.set(a.getAttribute('href')?.slice(1) ?? '', a);
  });

  const io = new IntersectionObserver(
    (entries) => {
      for (const e of entries) {
        if (!e.isIntersecting) continue;
        links.forEach((a, id) => a.classList.toggle('is-active', id === e.target.id));
      }
    },
    { rootMargin: '-45% 0px -54% 0px' },
  );
  document.querySelectorAll('main > section[id]').forEach((s) => io.observe(s));

  nav.addEventListener('focusin', () => nav.classList.remove('is-hidden'));

  let lastY = 0;
  scroll.onScroll((y) => {
    const max = document.documentElement.scrollHeight - window.innerHeight;
    if (bar) bar.style.transform = `scaleX(${max > 0 ? y / max : 0})`;
    const focused = nav.contains(document.activeElement);
    nav.classList.toggle('is-hidden', !focused && y > lastY && y > window.innerHeight * 0.5);
    nav.classList.toggle('is-solid', y > window.innerHeight * 0.8);
    lastY = y;
  });
}
