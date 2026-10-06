# Interactive Media Landing Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 인터랙티브 미디어 기법 16개를 설명 + 인라인 데모로 담은 Lusion 스타일 원페이지 랜딩 사이트.

**Architecture:** Vite + TS 정적 사이트. 섹션 DOM은 `index.html`에 정적으로 두고, 각 데모 블록(`[data-demo]`)은 `DemoHost`가 IntersectionObserver로 관찰해 동적 import → mount/pause/unmount 한다. 배경색은 고정 레이어 하나를 스크롤 진행도로 보간한다.

**Tech Stack:** Vite 6, TypeScript 5 (strict), three, gsap(+ScrollTrigger), lenis, @mediapipe/tasks-vision, simplex-noise, vitest, @playwright/test, eslint(typescript-eslint).

**Spec:** `docs/superpowers/specs/2026-10-06-interactive-media-landing-design.md`

## Global Constraints

- 패키지 매니저: **npm** (pnpm 미설치 환경 — 스펙의 `pnpm` 명령은 `npm run`으로 대체).
- TypeScript strict, `any` 금지 (불가피 시 `// TODO: type` + 이유).
- 동시 활성 WebGL 데모 ≤ 3 (`MAX_ACTIVE_GL = 3`).
- 카메라/마이크/오디오/모션은 사용자 클릭 전 시작 금지.
- `prefers-reduced-motion: reduce` 시 자동 애니메이션 최소화.
- 섹션 컬러는 스펙 6절 표 값 그대로.
- 콘텐츠 언어 한국어.
- 각 Task 종료 시: `npm run lint && npm run typecheck && npm run test && npm run build` 통과 + 평가 에이전트 "통과".

## Review Focus

1. 빠른 스크롤로 여러 데모를 지나칠 때 → mount 중(비동기 import 대기) unmount 요청이 와도 리소스 누수·에러 없음. (Task 1 `demo-host.test.ts`)
2. 권한 거부(카메라/마이크) → 데모 안에 "권한 필요" 상태, 콘솔 uncaught 에러 없음. (Task 6 `permissions.test.ts`)
3. WebGL 컨텍스트 생성 실패 → 폴백 문구 표시, 다른 데모 정상. (Task 1 `demo-host.test.ts`)
4. 창 리사이즈/모바일 회전 → 모든 캔버스가 컨테이너 크기·DPR(최대 2)에 맞게 갱신. (Task 1 `stage.ts` 공용 헬퍼 + 스모크)
5. 탭 비활성/섹션 이탈 → 오디오·rAF 정지(pause). (Task 1 테스트 + Task 5 스모크)

---

## File Structure

```
index.html                       모든 섹션 마크업 (정적)
src/main.ts                      부트: loader → scroll → background → cursor → nav → sections → DemoHost
src/core/types.ts                Demo, DemoMeta, DemoModule 타입
src/core/demo-host.ts            관찰·라이프사이클·GL 상한
src/core/stage.ts                캔버스/three 렌더러 생성 + 리사이즈 공용 헬퍼
src/core/scroll.ts               Lenis ↔ ScrollTrigger
src/core/background.ts           섹션 컬러 보간 (순수 함수 lerpColor 포함)
src/core/cursor.ts               커스텀 커서
src/core/nav.ts                  고정 내비 + 현재 섹션
src/core/loader.ts               로딩 화면
src/core/permissions.ts          getUserMedia/DeviceOrientation 래퍼 → 결과 union 반환
src/core/reveal.ts               텍스트 단어/줄 리빌
src/demos/registry.ts            id → () => import()
src/demos/<id>/index.ts          DemoModule (meta + create)
src/sections/hero.ts             히어로 WebGL
src/sections/timeline.ts         가로 스크롤 타임라인
src/sections/outro.ts            아웃트로 장면
src/styles/tokens.css, base.css, sections.css
public/img/                      로컬 SD로 생성한 이미지 (timeline, fallback)
tests/unit/*.test.ts             vitest
tests/e2e/smoke.spec.ts          playwright
```

### 핵심 타입 (Task 1에서 생성, 이후 모든 Task가 소비)

```ts
// src/core/types.ts
export type Category = 'pointer' | 'scroll' | 'audio' | 'sensor';
export type Requirement = 'webgl' | 'camera' | 'microphone' | 'motion' | 'audio-gesture';

export interface DemoMeta {
  id: string;
  category: Category;
  title: string;
  description: string;
  apis: string[];
  requires?: Requirement[];
}

export interface Demo {
  pause(): void;
  resume(): void;
  unmount(): void;
}

export interface DemoModule {
  meta: DemoMeta;
  create(container: HTMLElement): Demo | Promise<Demo>;
}
```

---

### Task 1: 스캐폴드 + 코어 (DemoHost, stage, background, scroll)

**Files:** package.json, tsconfig.json, vite.config.ts, eslint.config.js, index.html(골격), src/core/{types,demo-host,stage,background,scroll}.ts, src/demos/registry.ts, src/styles/*, tests/unit/{demo-host,background}.test.ts

**Produces:** `DemoHost`, `createStage(container, opts): Stage`, `lerpColor(a,b,t)`, `sectionColorAt(progress, stops)`, `registry: Record<string, () => Promise<DemoModule>>`

- [ ] `npm init` + 의존성 설치, scripts: `dev, build, preview, lint, typecheck(tsc --noEmit), test(vitest run), e2e(playwright test)`
- [ ] 실패 테스트 작성 — `background.test.ts`:
```ts
import { lerpColor } from '../../src/core/background';
test('lerp midpoint', () => { expect(lerpColor('#000000', '#ffffff', 0.5)).toBe('#808080'); });
test('clamps', () => { expect(lerpColor('#000000', '#ffffff', 2)).toBe('#ffffff'); });
```
- [ ] 실패 테스트 작성 — `demo-host.test.ts` (jsdom, IntersectionObserver 목):
  - 진입 → create 1회 호출, 이탈 → pause, 원거리 → unmount
  - create가 pending 중 unmount 요청 → resolve 직후 unmount 호출, 활성 목록에 남지 않음
  - `requires: ['webgl']` 데모가 4개 동시 진입 → 활성 3개, 가장 먼 것 unmount
  - create가 throw → 컨테이너에 `.demo-fallback` 렌더, 다른 데모 정상
  - 권한 필요 데모 → 클릭 전 create 호출 안 됨, `.demo-gate` 버튼 클릭 시 create
- [ ] 구현: `DemoHost` — 상태 머신 `idle → loading → active ⇄ paused → disposed`, 토큰으로 stale load 무시, `distanceToViewport`로 GL 상한 eviction
- [ ] `stage.ts`: `createStage({ container, gl: boolean })` → `{ canvas, renderer?, width, height, dpr, onResize(cb), dispose() }`, ResizeObserver, dpr = min(devicePixelRatio, 2), WebGL 생성 실패 시 throw `WebGLUnavailableError`
- [ ] `scroll.ts`: Lenis → `ScrollTrigger.update`, gsap.ticker 연결, reduced-motion이면 Lenis 비활성
- [ ] `background.ts`: `[data-bg][data-fg]` 섹션 기준으로 ScrollTrigger scrub, `--bg`/`--fg`/`--accent` CSS 변수 갱신
- [ ] 테스트 통과 → lint/typecheck/build → 평가

### Task 2: 공통 UI + 히어로 + 인트로

**Files:** src/core/{cursor,nav,loader,reveal}.ts, src/sections/hero.ts, index.html 섹션 0~1, sections.css

- [ ] 커서: 점 + 링(lerp 추적), `[data-cursor="view|drag|sound"]` 호버 시 라벨 변형, 터치 기기에서 숨김
- [ ] 내비: 섹션 링크(01~04, 타임라인), ScrollTrigger로 active 표시, Lenis `scrollTo`
- [ ] 로더: 폰트 + 히어로 준비 Promise 진행률 → GSAP 퇴장
- [ ] reveal: `[data-reveal="words|lines"]` 텍스트를 span 분할, ScrollTrigger로 마스크 리빌, 인트로 문장은 scrub로 단어 opacity 0.15→1
- [ ] 히어로: three — 아이코사헤드론 디스플레이스(노이즈 버텍스 셰이더) + 프레넬 셰이딩 + 주변 파티클 2k, 포인터 위치로 회전·왜곡 강도, 스크롤 시 스케일 다운/페이드, 화면 이탈 시 rAF 정지
- [ ] 대형 타이포 "INTERACTIVE / MEDIA" 줄 리빌
- [ ] 검증 + 평가

### Task 3: 01 포인터/제스처 (4)

각 데모 `src/demos/<id>/index.ts`가 `DemoModule` export, registry 등록, index.html에 블록 추가.

- [ ] `cursor-trail` (Canvas2D): 포인터 이동 속도 비례 파티클 방출, 수명 1.2s, 가산 블렌딩, 최대 1500개 풀
- [ ] `fluid` (WebGL, raw GLSL FBO): 안정 유체(advection → divergence → pressure jacobi 20회 → gradient subtract), 포인터 드래그로 속도/염료 splat, 해상도 sim 128 / dye 512, requires webgl
- [ ] `magnetic-drag` (DOM+스프링): 자석 버튼 3개(반경 120px 끌림) + 드래그 가능한 원 5개(스프링 k=0.08, damping 0.85, 벽 반발, 서로 충돌)
- [ ] `multitouch` (Pointer Events): 카드 하나를 핀치 확대·2손가락 회전·드래그, 데스크톱은 휠=스케일, Shift+휠=회전, 활성 포인터 점 시각화
- [ ] 검증 + 평가

### Task 4: 02 스크롤/모션 (4)

- [ ] `scroll-camera` (three, pin): 300vh pin, 스크롤 진행도로 카메라가 큐브/토러스 회랑을 CatmullRom 경로 따라 이동
- [ ] `parallax`: 5개 레이어(생성 이미지 + 타이포) `yPercent` 차등 scrub, 포인터로 미세 틸트
- [ ] `scrollytelling`: pin + 3단계 스텝 텍스트 전환과 SVG 도형 morph(원→사각→별) scrub
- [ ] `text-morph` (Canvas2D 파티클): 단어 텍스트를 샘플링한 점들이 스크롤 스텝마다 다음 단어로 이동 (INTERACT → SCROLL → MOTION)
- [ ] 검증 + 평가

### Task 5: 03 사운드/오디오 (4)

공통: `src/core/audio.ts` — 공유 `AudioContext` 싱글톤, 섹션 "소리 켜기" 게이트 클릭 시 resume, 데모 pause 시 해당 노드 gain 0.

- [ ] `synth-pad`: 4×4 패드(펜타토닉), 클릭/키보드(QWER…) → Oscillator+ADSR, 필터 컷오프 = 포인터 Y, 시각 리플
- [ ] `mic-visualizer`: getUserMedia(audio) → Analyser, 원형 스펙트럼 + 파형, requires microphone
- [ ] `audio-sphere` (three): 내장 신스 루프(또는 마이크 선택) Analyser 저/중/고 밴드 → 버텍스 디스플레이스 셰이더 uniform
- [ ] `spatial-audio`: PannerNode(HRTF), 2D 평면에서 음원 드래그 → 청취자 기준 좌우/거리 변화, 헤드폰 안내
- [ ] 검증 + 평가

### Task 6: 04 카메라/센서·생성 (4)

**Files:** src/core/permissions.ts, tests/unit/permissions.test.ts

```ts
export type PermissionResult<T> = { ok: true; value: T } | { ok: false; reason: 'denied' | 'unsupported' | 'error'; message: string };
export function requestCamera(): Promise<PermissionResult<MediaStream>>;
export function requestMicrophone(): Promise<PermissionResult<MediaStream>>;
export function requestMotion(): Promise<PermissionResult<true>>;
```
- [ ] 테스트: NotAllowedError → `{ok:false, reason:'denied'}`, mediaDevices 없음 → `unsupported`
- [ ] `webcam-shader`: VideoTexture + 셰이더 4종(픽셀화, 아스키, 열화상, RGB 분리) 버튼 전환
- [ ] `hand-tracking`: 클릭 시 MediaPipe HandLandmarker(CDN wasm+model) 지연 로드, 21개 관절 그리기 + 검지 끝으로 파티클 그리기, 로드 실패 시 재시도 버튼
- [ ] `gyro-scene` (three): 기기 기울기로 중력 방향 변경 → 구슬들이 굴러감, 미지원 시 포인터 위치로 대체
- [ ] `noise-field` (Canvas2D): simplex 흐름장 파티클 3000개 + 토글로 Game of Life 모드, 클릭으로 시드 재생성
- [ ] 검증 + 평가

### Task 7: 타임라인 + 아웃트로 + 마무리

- [ ] 타임라인: 가로 스크롤 pin, 연대 8개 (1963 Sketchpad, 1968 Mother of All Demos, 1974 Videoplace, 1989 WWW, 1996 Flash, 2010 HTML5 Canvas/WebGL, 2016 WebVR/WebAudio 대중화, 2020s AI·WebGPU), 각 카드에 생성 이미지
- [ ] 아웃트로: 포인터 반응 대형 타이포(글자 단위 스프링) + 크레딧/맨위로
- [ ] 반응형: ≤768px 데모 블록 세로 스택, 캔버스 높이 60vh
- [ ] reduced-motion 확인, 메타 태그/OG
- [ ] Playwright 스모크 `tests/e2e/smoke.spec.ts`: 끝까지 스크롤(단계별), 콘솔 에러 0, `window.__demoHost.activeGLCount() <= 3`, 섹션 스크린샷
- [ ] 검증 + 평가

### Task 8: Codex 리뷰 → 수정

- [ ] codex 리뷰 실행, 결과 분류(실제 버그/스타일/오탐)
- [ ] 실제 이슈 수정(Codex 또는 직접), 전체 검증 재실행
