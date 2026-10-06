import gsap from 'gsap';
import type { ScrollController } from './scroll';

/** 진행률 카운터 → 준비 완료 시 위로 걷히며 퇴장, 히어로 타이틀 등장 */
export async function runLoader(scroll: ScrollController, ready: Promise<unknown>): Promise<void> {
  const loader = document.querySelector<HTMLElement>('.loader');
  const count = loader?.querySelector<HTMLElement>('.loader__count');
  const bar = loader?.querySelector<HTMLElement>('.loader__bar span');
  if (!loader || !count || !bar) return;
  scroll.stop();

  const state = { p: 0 };
  const render = () => {
    count.textContent = String(Math.round(state.p));
    bar.style.transform = `scaleX(${state.p / 100})`;
  };
  // 준비될 때까지 80% 까지 천천히, 준비되면 100% 로
  const crawl = gsap.to(state, { p: 80, duration: 2.4, ease: 'power2.out', onUpdate: render });
  const minTime = new Promise((r) => setTimeout(r, 900));
  const timeout = new Promise((r) => setTimeout(r, 6000));
  await Promise.race([Promise.all([ready, minTime]), timeout]);
  crawl.kill();
  await gsap.to(state, { p: 100, duration: 0.5, ease: 'power2.inOut', onUpdate: render });

  const tl = gsap.timeline();
  tl.to(loader.querySelector('.loader__inner'), { yPercent: -40, opacity: 0, duration: 0.6, ease: 'power3.in' })
    .to(loader, { clipPath: 'inset(0 0 100% 0)', duration: 1.1, ease: 'expo.inOut' }, '-=0.2')
    .add(() => document.documentElement.classList.add('is-loaded'), '-=0.6');
  await tl;
  loader.remove();
  scroll.start();
}
