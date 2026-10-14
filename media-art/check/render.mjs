// 작품을 실제 파일로 렌더링: 작품마다 48초 MP4(1920×1080 30fps) + 2막 하이라이트 GIF + 막별 JPG
//   node media-art/check/render.mjs [html 파일, 기본 index.html] [작품 번호들, 기본 0,1,2,3]
// 페이지 시계를 가상으로 바꿔 1/30초씩 정확히 넘기며 프레임을 찍으므로, 기기 성능과 상관없이 끊김 없는 영상이 나온다.
// 결과: media-art/renders/<작품>/<작품>.mp4(48초 원본, git 제외), preview.mp4(6초), highlight.gif(4초), act1.jpg~act3.jpg
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
  // 가상 시계: performance.now()·requestAnimationFrame 을 직접 통제해 1/FPS 초씩 정확히 한 프레임 진행
  await page.addInitScript(() => {
    let vt = 0, queue = [];
    performance.now = () => vt;
    window.requestAnimationFrame = (cb) => { queue.push(cb); return queue.length; };
    window.cancelAnimationFrame = () => {};
    window.__advance = (ms) => { vt += ms; const q = queue; queue = []; for (const cb of q) cb(vt); };
  });
  await page.goto(`http://127.0.0.1:${server.address().port}/${encodeURIComponent(file)}`);
  for (let k = 0; k < 10; k++) await page.evaluate(() => window.__advance(100));   // 초기화
  // 영상에는 글자 없이: 캡션과 "가상 손" 표시를 숨긴다(손 위치 원은 남김)
  await page.addStyleTag({ content: '.cap,.caption,#caption,.hand em,.ring span{display:none!important}' });
  await page.evaluate((w) => { window.__proto.setWork(w, 0); window.__proto.setPlaying(true); }, w);
  const stage = page.locator('#stage');
  // 48초 정각 프레임은 다음 작품의 시작이므로 찍지 않는다(0 ~ 47.97초, 1439프레임). RENDER_FRAMES 로 짧게 시험 가능
  const total = Number(process.env.RENDER_FRAMES || DUR * FPS - 1);
  for (let i = 0; i < total; i++) {
    await page.evaluate((ms) => window.__advance(ms), 1000 / FPS);
    // 자가 검사: 이 작품의 시각 (i+1)/FPS 근처여야 한다
    const st = await page.evaluate(() => ({ t: window.__proto.t, work: window.__proto.work }));
    if (st.work !== key || Math.abs(st.t - (i + 1) / FPS) > 0.1) throw new Error(`${key} 프레임 ${i}: 작품=${st.work} t=${st.t.toFixed(2)} (기대 ${((i + 1) / FPS).toFixed(2)})`);
    await stage.screenshot({ path: join(frames, `${String(i).padStart(4, '0')}.png`) });
    if (i % 150 === 0) console.log(`${key} ${i}/${total}`);
  }
  await ctx.close();

  const seq = join(frames, '%04d.png');
  const ff = (args) => execFileSync('ffmpeg', ['-loglevel', 'error', '-y', ...args]);
  ff(['-framerate', String(FPS), '-i', seq, '-vf', 'scale=1920:1080:flags=lanczos,format=yuv420p', '-c:v', 'libx264', '-crf', '20', '-preset', 'slow', '-movflags', '+faststart', join(out, `${key}.mp4`)]);
  if (total < DUR * FPS - 1) { console.log(`${key}: 짧은 시험 렌더 — GIF·스틸 생략`); await rm(frames, { recursive: true, force: true }); continue; }
  // 2막 하이라이트: GIF 4초(22~26초, 480px 10fps 48색 ≈3MB) + MP4 미리보기 6초(22~28초, 640px ≈1MB)
  // 가는 선이 화면 가득 움직이는 장면은 GIF 압축이 잘 안 돼서 크기를 강하게 제한한다
  const full = join(out, `${key}.mp4`);
  ff(['-ss', '22', '-t', '4', '-i', full, '-vf', 'fps=10,scale=480:-1:flags=lanczos,split[a][b];[a]palettegen=max_colors=48:stats_mode=diff[p];[b][p]paletteuse=dither=none:diff_mode=rectangle', '-loop', '0', join(out, 'highlight.gif')]);
  ff(['-ss', '22', '-t', '6', '-i', full, '-an', '-vf', 'scale=640:-1', '-c:v', 'libx264', '-crf', '28', '-preset', 'slow', '-movflags', '+faststart', join(out, 'preview.mp4')]);
  for (const [k, sec] of [[1, 9], [2, 25], [3, 41.5]]) {
    ff(['-i', join(frames, `${String(Math.round(sec * FPS)).padStart(4, '0')}.png`), '-q:v', '3', join(out, `act${k}.jpg`)]);
  }
  await rm(frames, { recursive: true, force: true });
  console.log(`done ${key}`);
}
await browser.close();
server.close();
