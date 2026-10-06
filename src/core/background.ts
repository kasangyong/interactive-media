export interface ColorStop {
  at: number;
  color: string;
}

function parseHex(hex: string): [number, number, number] {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function toHex(rgb: [number, number, number]): string {
  return '#' + rgb.map((v) => Math.round(v).toString(16).padStart(2, '0')).join('');
}

export function lerpColor(a: string, b: string, t: number): string {
  const k = Math.min(1, Math.max(0, t));
  const ca = parseHex(a);
  const cb = parseHex(b);
  return toHex([0, 1, 2].map((i) => ca[i] + (cb[i] - ca[i]) * k) as [number, number, number]);
}

/** 정렬된 stop 목록에서 위치 x 의 색을 선형 보간 */
export function colorAt(stops: ColorStop[], x: number): string {
  if (x <= stops[0].at) return stops[0].color;
  for (let i = 1; i < stops.length; i++) {
    const prev = stops[i - 1];
    const next = stops[i];
    if (x <= next.at) {
      const span = next.at - prev.at;
      return span <= 0 ? next.color : lerpColor(prev.color, next.color, (x - prev.at) / span);
    }
  }
  return stops[stops.length - 1].color;
}

type Channel = 'bg' | 'fg' | 'accent';
const CHANNELS: Channel[] = ['bg', 'fg', 'accent'];

/**
 * `[data-bg][data-fg][data-accent]` 섹션을 기준으로 스크롤 위치에 따라
 * 루트 CSS 변수(--bg, --fg, --accent)를 보간한다. 섹션 안에서는 색을 유지하고
 * 경계 부근(뷰포트 절반 구간)에서만 전환된다.
 */
export function initBackground(): { update(scrollY: number): void; refresh(): void } {
  const root = document.documentElement;
  let stops: Record<Channel, ColorStop[]> = { bg: [], fg: [], accent: [] };

  function refresh() {
    const vh = window.innerHeight;
    const sections = Array.from(document.querySelectorAll<HTMLElement>('[data-bg]'));
    stops = { bg: [], fg: [], accent: [] };
    for (const s of sections) {
      const rect = s.getBoundingClientRect();
      const top = rect.top + window.scrollY;
      const start = top - vh * 0.3;
      const end = Math.max(start, top + rect.height - vh * 0.8);
      for (const ch of CHANNELS) {
        const color = s.dataset[ch] ?? (ch === 'accent' ? s.dataset.fg : undefined) ?? '#000000';
        stops[ch].push({ at: start, color }, { at: end, color });
      }
    }
    update(window.scrollY);
  }

  function update(scrollY: number) {
    if (stops.bg.length === 0) return;
    for (const ch of CHANNELS) root.style.setProperty(`--${ch}`, colorAt(stops[ch], scrollY));
  }

  return { update, refresh };
}
