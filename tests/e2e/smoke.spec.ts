import { expect, test } from '@playwright/test';

// window.__demoHost 타입은 src/main.ts 의 전역 선언을 그대로 쓴다

/** 외부 네트워크 사정으로 생길 수 있는 리소스 로드 실패는 제외 */
const IGNORED = [/Failed to load resource/i, /net::ERR_/i];

test('scroll the whole page: no errors, GL cap holds, every demo starts', async ({ page }, info) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
  page.on('console', (m) => {
    if (m.type() === 'error' && !IGNORED.some((r) => r.test(m.text()))) errors.push(`console: ${m.text()}`);
  });

  await page.goto('/');
  await expect(page.locator('.loader')).toHaveCount(0, { timeout: 15_000 });

  const ids = await page.$$eval('[data-demo]', (els) => els.map((e) => (e as HTMLElement).dataset.demo!));
  expect(ids).toHaveLength(16);

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
      if (await gate.isVisible()) await gate.click({ trial: false }).catch(() => undefined);
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
    for (const [id, s] of snap.seen) if (s && (states[id] === undefined || s === 'active' || s === 'failed')) states[id] = s;
  }

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
