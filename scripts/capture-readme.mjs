// README 용 GIF/썸네일 캡처: `npm run build && npx vite preview --port 4173` 실행 후
//   node scripts/capture-readme.mjs
// 프레임은 .readme-capture/frames/<name>/ 에, 결과물은 docs/media/ 에 저장한다.
import { chromium } from '@playwright/test';
import { execFileSync } from 'node:child_process';
import { mkdirSync, rmSync } from 'node:fs';
import { resolve } from 'node:path';

const BASE = 'http://localhost:4173/';
const ROOT = resolve(import.meta.dirname, '..');
const CAP = resolve(ROOT, '.readme-capture');
const OUT = resolve(ROOT, 'docs/media');
const VIEW = { width: 1280, height: 720 };
mkdirSync(resolve(OUT, 'demos'), { recursive: true });

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
// 일부만 다시 찍기: node scripts/capture-readme.mjs [main|person|hands ...]
const only = new Set(process.argv.slice(2));
const want = (name) => only.size === 0 || only.has(name);

async function open(fakeVideo) {
  const args = ['--use-fake-device-for-media-stream', '--use-fake-ui-for-media-stream', '--autoplay-policy=no-user-gesture-required'];
  if (fakeVideo) args.push(`--use-file-for-fake-video-capture=${resolve(CAP, fakeVideo)}`);
  const browser = await chromium.launch({ args });
  const ctx = await browser.newContext({ viewport: VIEW, deviceScaleFactor: 1, permissions: ['camera', 'microphone'] });
  const page = await ctx.newPage();
  await page.goto(BASE);
  await page.waitForSelector('.loader', { state: 'detached', timeout: 20000 });
  // 커스텀 커서 원이 캡처에 찍히지 않게
  await page.addStyleTag({ content: '.cursor{display:none!important}' });
  return { browser, page };
}

/** 블록의 스크롤 진행도 p 위치로 이동 */
async function scrollBlock(page, id, p) {
  await page.evaluate(
    ([id, p]) => {
      const b = document.getElementById(id);
      const top = b.getBoundingClientRect().top + window.scrollY;
      window.scrollTo(0, top + Math.max(0, b.offsetHeight - window.innerHeight) * p);
    },
    [id, p],
  );
}

async function stageBox(page, id) {
  return page.locator(`[data-demo="${id}"]`).boundingBox();
}

/** frames 개 프레임을 찍고 GIF 로 합친다. step(i) 에서 상호작용 */
async function gif(page, name, frames, step, { fps = 15, width = 720, clip } = {}) {
  const dir = resolve(CAP, 'frames', name);
  rmSync(dir, { recursive: true, force: true });
  mkdirSync(dir, { recursive: true });
  for (let i = 0; i < frames; i++) {
    await step(i);
    await page.screenshot({ path: resolve(dir, `${String(i).padStart(3, '0')}.png`), clip });
  }
  const vf = `scale=${width}:-1:flags=lanczos,split[a][b];[a]palettegen=max_colors=96:stats_mode=diff[p];[b][p]paletteuse=dither=bayer:bayer_scale=4:diff_mode=rectangle`;
  execFileSync('ffmpeg', ['-loglevel', 'error', '-y', '-framerate', String(fps), '-i', resolve(dir, '%03d.png'), '-vf', vf, '-loop', '0', resolve(OUT, `${name}.gif`)]);
  console.log('gif', name);
}

async function still(page, id, file = id) {
  const box = await stageBox(page, id);
  const clip = box && box.height < VIEW.height + 2 && box.y >= 0 ? box : undefined;
  const png = resolve(CAP, `${file}.png`);
  await page.screenshot({ path: png, clip });
  execFileSync('ffmpeg', ['-loglevel', 'error', '-y', '-i', png, '-vf', 'scale=640:-1:flags=lanczos', '-q:v', '4', resolve(OUT, 'demos', `${file}.jpg`)]);
  console.log('still', file);
}

async function visit(page, id, { center = true, gate = false, wait = 1600 } = {}) {
  await page.evaluate(
    ([id, center]) => document.getElementById(`demo-${id}`).scrollIntoView({ block: center ? 'center' : 'start' }),
    [id, center],
  );
  await sleep(500);
  if (gate) {
    const g = page.locator(`#demo-${id} .demo-gate`);
    if (await g.count()) await g.click();
  }
  await sleep(wait);
}

/** 원을 그리며 마우스 이동 */
const circle = (box, i, n, r = 0.28) => {
  const a = (i / n) * Math.PI * 2;
  return [box.x + box.width * (0.5 + Math.cos(a) * r), box.y + box.height * (0.5 + Math.sin(a) * r * 1.2)];
};

// ---------------- 1) 메인 브라우저: 카메라가 필요 없는 데모 ----------------
if (want('main')) {
  const { browser, page } = await open(null);

  await gif(page, 'hero', 36, async (i) => {
    await page.mouse.move(VIEW.width * (0.3 + 0.4 * (i / 36)), VIEW.height * (0.35 + 0.2 * Math.sin(i / 5)));
    await sleep(60);
  });
  await page.screenshot({ path: resolve(CAP, 'hero.png') });
  execFileSync('ffmpeg', ['-loglevel', 'error', '-y', '-i', resolve(CAP, 'hero.png'), '-q:v', '3', resolve(OUT, 'hero.jpg')]);

  // 포인터
  await visit(page, 'cursor-trail');
  let box = await stageBox(page, 'cursor-trail');
  for (let i = 0; i < 24; i++) await page.mouse.move(...circle(box, i, 24));
  await still(page, 'cursor-trail');

  await visit(page, 'fluid', { center: false });
  box = await stageBox(page, 'fluid');
  await gif(
    page,
    'fluid',
    40,
    async (i) => {
      for (let k = 0; k < 3; k++) await page.mouse.move(...circle(box, i * 3 + k, 60, 0.3));
      await sleep(25);
    },
    { width: 720 },
  );
  await still(page, 'fluid');

  await visit(page, 'magnetic-drag');
  box = await stageBox(page, 'magnetic-drag');
  await page.mouse.move(box.x + box.width * 0.5, box.y + box.height * 0.3);
  await sleep(500);
  await still(page, 'magnetic-drag');

  await visit(page, 'multitouch');
  box = await stageBox(page, 'multitouch');
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  for (let i = 0; i < 4; i++) await page.mouse.wheel(0, -120);
  await page.keyboard.down('Shift');
  await page.mouse.wheel(0, -160);
  await page.keyboard.up('Shift');
  await sleep(800);
  await still(page, 'multitouch');

  // 스크롤
  await gif(page, 'scroll-camera', 40, async (i) => {
    await scrollBlock(page, 'demo-scroll-camera', 0.05 + (i / 40) * 0.85);
    await sleep(70);
  });
  await scrollBlock(page, 'demo-scroll-camera', 0.4);
  await sleep(1200);
  await still(page, 'scroll-camera');

  await scrollBlock(page, 'demo-parallax', 0.5);
  await sleep(1500);
  await still(page, 'parallax');

  await scrollBlock(page, 'demo-scrollytelling', 0.62);
  await sleep(1500);
  await still(page, 'scrollytelling');

  await gif(page, 'text-morph', 44, async (i) => {
    await scrollBlock(page, 'demo-text-morph', Math.min(1, (i / 44) * 1.1));
    await sleep(80);
  });
  await scrollBlock(page, 'demo-text-morph', 0.02);
  await sleep(1500);
  await still(page, 'text-morph');

  // 사운드 (게이트 클릭 = 오디오 잠금 해제)
  await visit(page, 'synth-pad', { gate: true });
  const pads = page.locator('#demo-synth-pad .synth__pad');
  for (const n of [5, 10, 2]) await pads.nth(n).click();
  await sleep(120);
  await still(page, 'synth-pad');

  await visit(page, 'audio-sphere', { center: false, wait: 2500 });
  box = await stageBox(page, 'audio-sphere');
  await gif(page, 'audio-sphere', 36, async (i) => {
    await page.mouse.move(...circle(box, i, 36, 0.15));
    await sleep(60);
  });
  await still(page, 'audio-sphere');

  await visit(page, 'mic-visualizer', { gate: true, wait: 2500 });
  await still(page, 'mic-visualizer');

  await visit(page, 'spatial-audio', { wait: 2500 });
  await still(page, 'spatial-audio');

  // 생성
  await visit(page, 'gyro-scene');
  box = await stageBox(page, 'gyro-scene');
  await page.mouse.move(box.x + box.width * 0.85, box.y + box.height * 0.3);
  await sleep(1500);
  await still(page, 'gyro-scene');

  await visit(page, 'noise-field', { center: false, wait: 4000 });
  await still(page, 'noise-field');

  // 타임라인
  await scrollBlock(page, 'timeline', 0.35);
  await sleep(1500);
  await page.screenshot({ path: resolve(CAP, 'timeline.png') });
  execFileSync('ffmpeg', ['-loglevel', 'error', '-y', '-i', resolve(CAP, 'timeline.png'), '-q:v', '3', resolve(OUT, 'timeline.jpg')]);

  await browser.close();
}

// ---------------- 2) 가짜 카메라: 인물 영상 ----------------
if (want('person')) {
  const { browser, page } = await open('person.y4m');
  await visit(page, 'webcam-shader', { gate: true, wait: 3000 });
  await still(page, 'webcam-shader');
  await page.locator('#demo-webcam-shader .demo-ui button', { hasText: 'Thermal' }).click();
  await sleep(800);
  await still(page, 'webcam-shader', 'webcam-shader-thermal');
  await browser.close();
}

// ---------------- 3) 가짜 카메라: 두 손 영상 (손가락 5개 확인한 한 손을 좌우 반전해 합성) ----------------
if (want('hands')) {
  const { browser, page } = await open('hands.y4m');
  await visit(page, 'hand-tracking', { center: false, gate: true, wait: 15000 });
  await still(page, 'hand-tracking');

  await visit(page, 'hand-brutalism', { center: false, wait: 1500 });
  await page.locator('#demo-hand-brutalism .demo-ui button').click();
  await page.waitForFunction(() => document.querySelector('.hb-readout')?.textContent?.includes('CAMERA'), null, { timeout: 60000 });
  await page.mouse.move(5, 5);
  await sleep(2500);
  await gif(page, 'hand-brutalism', 48, async () => sleep(90), { width: 720 });
  await still(page, 'hand-brutalism');
  const readout = await page.locator('.hb-readout').textContent();
  console.log('brutalism readout:', readout);
  await browser.close();
}
