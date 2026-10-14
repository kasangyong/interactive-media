// 한 장면의 성능 병목 찾기: 프레임당 JS 시간 + CPU 프로파일 상위 함수
//   node media-art/check/profile.mjs [html, 기본 media-art/index.html] [작품 번호, 기본 1] [시각, 기본 25]
// 실제 GPU(Intel Iris Xe 등)로 측정한다.
import { chromium } from '@playwright/test';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';

const file = process.argv[2] || 'media-art/index.html';
const work = Number(process.argv[3] ?? 1);
const at = Number(process.argv[4] ?? 25);
const srv = createServer(async (_q, s) => { s.writeHead(200, { 'content-type': 'text/html; charset=utf-8' }); s.end(await readFile(file)); }).listen(0, '127.0.0.1');
await new Promise((r) => srv.once('listening', r));
const browser = await chromium.launch({ args: ['--enable-gpu', '--ignore-gpu-blocklist', '--use-angle=d3d11', '--enable-gpu-rasterization'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
await page.goto(`http://127.0.0.1:${srv.address().port}/`);
await page.waitForTimeout(800);
await page.evaluate(([w, t]) => window.__proto.setWork(w, t), [work, at]);
await page.waitForTimeout(800);

const timing = await page.evaluate(async () => {
  let n = 0, cb = 0;
  const orig = window.requestAnimationFrame.bind(window);
  window.requestAnimationFrame = (f) => orig((ts) => { const a = performance.now(); f(ts); cb += performance.now() - a; n++; });
  const t0 = performance.now();
  await new Promise((r) => setTimeout(r, 3000));
  const wall = performance.now() - t0;
  return { fps: +((n / wall) * 1000).toFixed(1), jsMsPerFrame: +(cb / n).toFixed(2), frameMs: +(wall / n).toFixed(2) };
});

const cdp = await page.context().newCDPSession(page);
await cdp.send('Profiler.enable');
await cdp.send('Profiler.start');
await page.waitForTimeout(3000);
const { profile } = await cdp.send('Profiler.stop');
const byId = new Map(profile.nodes.map((n) => [n.id, n]));
const self = new Map();
profile.samples.forEach((id, i) => {
  const cf = byId.get(id).callFrame;
  const k = `${cf.functionName || '(익명)'}:${cf.lineNumber}`;
  self.set(k, (self.get(k) || 0) + (profile.timeDeltas[i] || 0));
});
const total = [...self.values()].reduce((a, b) => a + b, 0);
console.log(JSON.stringify(timing));
console.log([...self.entries()].sort((a, b) => b[1] - a[1]).slice(0, 10).map(([k, v]) => `${((v / total) * 100).toFixed(1).padStart(5)}%  ${k}`).join('\n'));
await browser.close();
srv.close();
