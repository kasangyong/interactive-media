import './styles/tokens.css';
import './styles/base.css';
import './styles/sections.css';
import './styles/demos.css';
import { unlockAudio } from './core/audio';
import { initBackground } from './core/background';
import { renderBlocks } from './core/blocks';
import { initCursor } from './core/cursor';
import { DemoHost } from './core/demo-host';
import { runLoader } from './core/loader';
import { initNav } from './core/nav';
import { primeMotion } from './core/permissions';
import { initReveal } from './core/reveal';
import { initScroll } from './core/scroll';
import { registry } from './demos/registry';
import { initHero } from './sections/hero';
import { initOutro } from './sections/outro';
import { initTimeline } from './sections/timeline';

declare global {
  interface Window {
    __demoHost?: DemoHost;
  }
}

function boot() {
  history.scrollRestoration = 'manual';
  window.scrollTo(0, 0);

  const stages = renderBlocks(registry);
  const scroll = initScroll();
  const bg = initBackground();
  scroll.onScroll((y) => bg.update(y));
  bg.refresh();
  new ResizeObserver(() => bg.refresh()).observe(document.body);

  initCursor();
  initNav(scroll);
  initReveal(scroll);
  initTimeline();
  initOutro();
  const heroReady = initHero(scroll);
  void runLoader(scroll, Promise.all([document.fonts.ready, heroReady]));

  const host = new DemoHost(registry, {
    // 게이트 클릭(사용자 제스처) 안에서 바로 호출해야 브라우저가 허용한다
    onUnlock: (reqs) => {
      if (reqs.includes('audio-gesture') || reqs.includes('microphone')) unlockAudio();
      if (reqs.includes('motion')) primeMotion();
    },
  });
  stages.forEach((s) => host.observe(s));
  window.__demoHost = host;
}

boot();
