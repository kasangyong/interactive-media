// 작품을 실제 파일로 렌더링: 작품마다 48초 MP4(1920×1080 30fps) + 2막 하이라이트 GIF + 막별 JPG
//   node media-art/check/render.mjs [html 파일, 기본 index.html] [작품 번호들, 기본 0,1,2,3]
// Playwright 의 가상 시계로 1/30초씩 정확히 넘기며 프레임을 찍으므로, 기기 성능과 상관없이 끊김 없는 영상이 나온다.
// 결과: media-art/renders/<작품>/<작품>.mp4, highlight.gif, act1.jpg~act3.jpg  (mp4 는 git 에 올리지 않음)
import { chromium } from '@playwright/test';
import { execFileSync } from 'node:child_process';
import { createServer } from 'node:http';
import { mkdir, readFile, rm } from 'node:fs/promises';
import { dirname, extname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const file = process.argv[2] || 'index.html';
const works = (process.argv[3] || '0,1,2,3').split(',').map(Number);
const FPS = 30, DUR = 48;
const KEYS = ['forest', 'sea', 'space', 'flower'];

const server = createServer(async (req, res) => {
  try {
    const p = join(ROOT, decodeURIComponent(new URL(req.url, 'http://x').pathname));
    if (!p.startsWith(ROOT)) throw new Error('outside');
    res.writeHead(200, { 'content-type': extname(p) === '.html' ? 'text/html; charset=utf-8' : 'application/octet-stream' });
    res.end(await readFile(p));
  } catch {
    res.writeHead(404).end();
  }
}).listen(0, '127.0.0.1');
await new Promise((r) => server.once('listening', r));

// 실제 GPU 로 렌더링(기본 헤드리스는 GPU 없는 SwiftShader 라 느리다)
const browser = await chromium.launch({ args: ['--enable-gpu', '--ignore-gpu-blocklist', '--use-angle=d3d11', '--enable-gpu-rasterization'] });
for (const w of works) {
  const key = KEYS[w];
  const out = join(ROOT, 'renders', key), frames = join(out, 'frames');
  await rm(frames, { recursive: true, force: true });
  await mkdir(frames, { recursive: true });

  // 상영 영역(최대 폭 1180 css px)이 정확히 1920×1080 픽셀로 찍히도록 배율을 맞춘다
  const ctx = await browser.newContext({ viewport: { width: 1212, height: 1100 }, deviceScaleFactor: 1920 / 1180 });
  const page = await ctx.newPage();
  await page.clock.install();
  await page.goto(`http://127.0.0.1:${server.address().port}/${encodeURIComponent(file)}`);
  await page.clock.runFor(1000);
  await page.addStyleTag({ content: '.cap{display:none!important}' });   // 영상에는 캡션 없이
  await page.evaluate((w) => { window.__proto.setWork(w, 0); window.__proto.setPlaying(true); }, w);
  const stage = page.locator('#stage');
  const total = DUR * FPS;
  for (let i = 0; i < total; i++) {
    await page.clock.runFor(1000 / FPS);
    await stage.screenshot({ path: join(frames, `${String(i).padStart(4, '0')}.png`) });
    if (i % 150 === 0) console.log(`${key} ${i}/${total}`);
  }
  await ctx.close();

  const seq = join(frames, '%04d.png');
  const ff = (args) => execFileSync('ffmpeg', ['-loglevel', 'error', '-y', ...args]);
  ff(['-framerate', String(FPS), '-i', seq, '-vf', 'scale=1920:1080:flags=lanczos,format=yuv420p', '-c:v', 'libx264', '-crf', '20', '-preset', 'slow', '-movflags', '+faststart', join(out, `${key}.mp4`)]);
  // 2막 하이라이트 6초 (22~28초), 640px 15fps
  ff(['-framerate', String(FPS), '-start_number', String(22 * FPS), '-i', seq, '-frames:v', String(6 * FPS),
    '-vf', 'fps=15,scale=640:-1:flags=lanczos,split[a][b];[a]palettegen=max_colors=128:stats_mode=diff[p];[b][p]paletteuse=dither=bayer:bayer_scale=4:diff_mode=rectangle',
    '-loop', '0', join(out, 'highlight.gif')]);
  for (const [k, sec] of [[1, 9], [2, 25], [3, 41.5]]) {
    ff(['-i', join(frames, `${String(Math.round(sec * FPS)).padStart(4, '0')}.png`), '-q:v', '3', join(out, `act${k}.jpg`)]);
  }
  await rm(frames, { recursive: true, force: true });
  console.log(`done ${key}`);
}
await browser.close();
server.close();
