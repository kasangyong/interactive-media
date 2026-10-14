// media-art 자동 검증: 4작품 × 3막 스크린샷 + fps + 콘솔 오류 + 막 점프·시간 흐름·모바일 폭
//   node media-art/check/shoot.mjs [html 파일, 기본 index.html] [출력 폴더, 기본 media-art/shots/latest]
// media-art 폴더를 자체 정적 서버로 띄우므로 따로 서버를 켤 필요가 없다.
import { chromium } from '@playwright/test';
import { createServer } from 'node:http';
import { readFile, mkdir } from 'node:fs/promises';
import { extname, join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const file = process.argv[2] || 'index.html';
const out = resolve(process.argv[3] || join(ROOT, 'shots', 'latest'));
await mkdir(out, { recursive: true });

const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.jpg': 'image/jpeg' };
const server = createServer(async (req, res) => {
  try {
    const p = join(ROOT, decodeURIComponent(new URL(req.url, 'http://x').pathname));
    if (!p.startsWith(ROOT)) throw new Error('outside');
    res.writeHead(200, { 'content-type': TYPES[extname(p)] ?? 'application/octet-stream' });
    res.end(await readFile(p));
  } catch {
    res.writeHead(404).end();
  }
}).listen(0, '127.0.0.1');
await new Promise((r) => server.once('listening', r));
const url = `http://127.0.0.1:${server.address().port}/${encodeURIComponent(file)}`;

// 브리프의 성능 목표(노트북 내장 그래픽 60fps)에 맞춰 실제 GPU(이 PC는 Intel Iris Xe)로 렌더링한다.
// 기본 헤드리스는 GPU 없는 SwiftShader 라 CSS filter·합성이 CPU 로 돌아 실제보다 훨씬 느리게 잰다. CHECK_SOFTWARE=1 이면 그 조건으로.
const GPU_ARGS = ['--enable-gpu', '--ignore-gpu-blocklist', '--use-angle=d3d11', '--enable-gpu-rasterization'];
const browser = await chromium.launch({ args: process.env.CHECK_SOFTWARE ? [] : GPU_ARGS });
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
const errors = [];
page.on('pageerror', (e) => errors.push('pageerror ' + e.message));
page.on('console', (m) => { if (m.type() === 'error') errors.push('console ' + m.text()); });
await page.goto(url);
await page.waitForTimeout(1000);
const stage = page.locator('#stage');

const fps = {}, seekErr = {};
const SHOT_AT = { 1: 9, 2: 25, 3: 41.5 };
for (let w = 0; w < 4; w++) {
  for (const [k, at] of [[1, 0], [2, 14], [3, 36]]) {
    const got = await page.evaluate(([w, at]) => { window.__proto.setWork(w, at); return window.__proto.t; }, [w, at]);
    seekErr[`${w}-${k}`] = Math.round((got - at) * 100) / 100;
  }
  for (const k of [1, 2, 3]) {
    await page.evaluate(([w, at]) => window.__proto.setWork(w, at), [w, SHOT_AT[k]]);
    fps[`${w}-${k}`] = await page.evaluate(async () => {
      let n = 0; const t0 = performance.now();
      await new Promise((r) => { const g = () => { n++; if (performance.now() - t0 < 2500) requestAnimationFrame(g); else r(); }; requestAnimationFrame(g); });
      return Math.round(n / ((performance.now() - t0) / 1000));
    });
    await stage.screenshot({ path: join(out, `w${w}a${k}.png`) });
  }
}
const pace = await page.evaluate(async () => { window.__proto.setWork(0, 20); const a = window.__proto.t; await new Promise((r) => setTimeout(r, 2000)); return Math.round((window.__proto.t - a) * 100) / 100; });
await page.evaluate(() => window.__proto.setWork(3, 47.3));
await page.waitForTimeout(1600);
const afterEnd = await page.evaluate(() => window.__proto.work);
await page.setViewportSize({ width: 400, height: 860 });
await page.waitForTimeout(600);
const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);

// 접촉 시트: 행 = 숲·바다·우주·꽃밭, 열 = 1·2·3막
const sheet = await browser.newPage({ viewport: { width: 1440, height: 1080 } });
const imgs = [];
for (let w = 0; w < 4; w++) for (let k = 1; k <= 3; k++) imgs.push((await readFile(join(out, `w${w}a${k}.png`))).toString('base64'));
await sheet.setContent(`<body style="margin:0;background:#000;display:grid;grid-template-columns:repeat(3,480px)">${imgs.map((b) => `<img src="data:image/png;base64,${b}" style="width:480px;height:270px;display:block">`).join('')}</body>`);
await sheet.screenshot({ path: join(out, 'sheet.jpg'), quality: 88, type: 'jpeg' });
// 블랙 레벨: 각 장면 위쪽 두 모서리(32×32) 평균 밝기(0~255) 중 최댓값. 검은 바탕 위의 빛이어야 한다
const blackLevel = await sheet.evaluate(async (list) => {
  let worst = 0;
  for (const b64 of list) {
    const img = new Image(); img.src = `data:image/png;base64,${b64}`; await img.decode();
    const c = document.createElement('canvas'); c.width = img.naturalWidth; c.height = img.naturalHeight;
    const g = c.getContext('2d'); g.drawImage(img, 0, 0);
    for (const x of [0, c.width - 32]) {
      const d = g.getImageData(x, 0, 32, 32).data; let sum = 0;
      for (let i = 0; i < d.length; i += 4) sum += (d[i] + d[i + 1] + d[i + 2]) / 3;
      worst = Math.max(worst, sum / (d.length / 4));
    }
  }
  return Math.round(worst * 10) / 10;
}, imgs);

const report = { errors, fps, minFps: Math.min(...Object.values(fps)), seekErr, pace, afterEnd, overflow, blackLevel };
console.log(JSON.stringify(report));
await browser.close();
server.close();
const pass = errors.length === 0 && report.minFps >= 55 && Object.values(seekErr).every((e) => Math.abs(e) < 0.05) && Math.abs(pace - 2) < 0.1 && afterEnd === 'forest' && overflow <= 0 && blackLevel <= 14;
process.exitCode = pass ? 0 : 1;
