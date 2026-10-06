import './styles/tokens.css';
import './styles/base.css';
import './styles/demos.css';
import { initBackground } from './core/background';
import { renderBlocks } from './core/blocks';
import { DemoHost } from './core/demo-host';
import { initScroll } from './core/scroll';
import { registry } from './demos/registry';

declare global {
  interface Window {
    __demoHost?: DemoHost;
  }
}

function boot() {
  const stages = renderBlocks(registry);
  const scroll = initScroll();
  const bg = initBackground();
  scroll.onScroll((y) => bg.update(y));
  bg.refresh();
  new ResizeObserver(() => bg.refresh()).observe(document.body);

  const host = new DemoHost(registry);
  stages.forEach((s) => host.observe(s));
  window.__demoHost = host;
}

boot();
