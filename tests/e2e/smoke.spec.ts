import { expect, test } from '@playwright/test';

// window.__demoHost 타입은 src/main.ts 의 전역 선언을 그대로 쓴다

/** 외부(CDN) 네트워크 사정으로 생기는 로드 실패 메시지는 제외 — 같은 출처 실패는 response 로 따로 잡는다 */
const IGNORED = [
  /Failed to load resource/i,
  /net::ERR_/i,
  // 헤드리스 실행 시 호스트 오디오 장치가 점유되어 있으면 Chrome 이 내는 환경 메시지 (앱 오류 아님)
  /AudioContext encountered an error from the audio device/i,
];

test('scroll the whole page: no errors, GL cap holds, every demo starts', async ({ page }, info) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
  page.on('console', (m) => {
    if (m.type() === 'error' && !IGNORED.some((r) => r.test(m.text()))) errors.push(`console: ${m.text()}`);
  });
  page.on('response', (r) => {
    if (r.url().startsWith('http://localhost:4173') && r.status() >= 400) errors.push(`http ${r.status()}: ${r.url()}`);
  });

  await page.goto('/');
  await expect(page.locator('.loader')).toHaveCount(0, { timeout: 15_000 });

  const ids = await page.$$eval('[data-demo]', (els) => els.map((e) => (e as HTMLElement).dataset.demo!));
  expect(ids).toHaveLength(17);

  const states: Record<string, string> = {};
  let maxGL = 0;
  const total = await page.evaluate(() => document.documentElement.scrollHeight);
  const vh = await page.evaluate(() => window.innerHeight);

  for (let y = 0; y < total; y += vh * 0.5) {
    await page.evaluate((top) => window.scrollTo(0, top), y);
    await page.waitForTimeout(220);
    // 화면 안의 게이트 버튼은 사용자처럼 누른다
    const gates = page.locator('.demo-gate:visible');
    for (let i = 0; i < (await gates.count()); i++) {
      const gate = gates.nth(i);
      // 스크롤 도중 사라질 수 있으므로 보이는 것만 누른다
      if (await gate.isVisible()) await gate.click();
    }
    await page.waitForTimeout(400);
    const snap = await page.evaluate((list) => {
      const h = window.__demoHost!;
      const inView = list.filter((id) => {
        const r = document.querySelector(`[data-demo="${id}"]`)!.getBoundingClientRect();
        return r.bottom > 0 && r.top < window.innerHeight;
      });
      return { gl: h.activeGLCount(), seen: inView.map((id) => [id, h.stateOf(id)] as const) };
    }, ids);
    maxGL = Math.max(maxGL, snap.gl);
    for (const [id, s] of snap.seen) {
      // 한 번이라도 failed 였으면 그대로 남긴다
      if (!s || states[id] === 'failed') continue;
      if (states[id] === undefined || s === 'active' || s === 'failed') states[id] = s;
    }
  }

  // 화면을 벗어난 데모는 멈춰 있어야 한다 (끝까지 내려온 상태에서 첫 데모 확인)
  const firstState = await page.evaluate(() => window.__demoHost!.stateOf('cursor-trail'));
  expect(['paused', 'idle']).toContain(firstState);

  // 타임라인: 섹션 중간에서 트랙이 실제로 가로 이동했는지
  const shift = await page.evaluate(async () => {
    const s = document.getElementById('timeline')!;
    const top = s.getBoundingClientRect().top + window.scrollY;
    window.scrollTo(0, top + (s.offsetHeight - window.innerHeight) * 0.6);
    await new Promise((r) => setTimeout(r, 1200));
    return new DOMMatrix(getComputedStyle(document.querySelector('[data-timeline]')!).transform).m41;
  });
  expect(shift).toBeLessThan(-100);

  await page.screenshot({ path: info.outputPath('end.png') });

  expect(errors, errors.join('\n')).toEqual([]);
  expect(maxGL).toBeLessThanOrEqual(3);
  const failed = Object.entries(states).filter(([, s]) => s === 'failed');
  expect(failed, JSON.stringify(states)).toEqual([]);
  // 손 추적은 모델 다운로드 때문에 loading 일 수 있다
  const notStarted = ids.filter((id) => id !== 'hand-tracking' && states[id] !== 'active' && states[id] !== 'paused');
  expect(notStarted, JSON.stringify(states)).toEqual([]);
});

test('no horizontal overflow', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('.loader')).toHaveCount(0, { timeout: 15_000 });
  const over = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(over).toBeLessThanOrEqual(0);
});

test('hand-brutalism switches to camera control without errors', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('/');
  await expect(page.locator('.loader')).toHaveCount(0, { timeout: 15_000 });
  await page.locator('#demo-hand-brutalism').scrollIntoViewIfNeeded();
  const btn = page.locator('#demo-hand-brutalism .demo-ui button');
  await btn.click();
  // 모델(CDN)을 받아 카메라 모드로 전환될 때까지
  const status = page.locator('#demo-hand-brutalism .hb-pip__status');
  await expect(page.locator('#demo-hand-brutalism .hb-readout'), `status: ${await status.textContent()}`).toContainText(
    'INPUT CAMERA',
    { timeout: 90_000 },
  );
  await page.waitForTimeout(1500);
  expect(errors).toEqual([]);
});
