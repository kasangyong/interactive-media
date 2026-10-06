# Interactive Media Landing — Design Spec

- 작성일: 2026-10-06
- 상태: 사용자 검토 대기

## 1. 목표

인터랙티브 미디어의 주요 기법을 **설명 + 직접 체험 가능한 데모**로 한 페이지에 담은 원페이지 랜딩 사이트.
레퍼런스: https://lusion.co/ (풀스크린 WebGL, 부드러운 스크롤, 섹션 전환 연출).

### 성공 기준
- 단일 페이지를 위→아래로 스크롤하면 히어로부터 푸터까지 모든 섹션과 16개 데모를 체험할 수 있다.
- 모든 데모가 화면 진입 시 동작하고, 이탈 시 정지/해제된다.
- 전체 스크롤 중 콘솔 에러 0, 동시 활성 WebGL 컨텍스트 ≤ 3.
- `pnpm lint`, `pnpm typecheck`, `pnpm build` 통과.
- 데스크톱 Chrome 기준 정상 동작, 모바일(터치/자이로)에서도 깨지지 않음.

### 가정
- 정적 사이트(백엔드·로그인 없음). 배포 대상은 Vercel 또는 GitHub Pages.
- 콘텐츠 언어: 한국어.
- 데스크톱 우선, 모바일 대응.

## 2. 기술 스택

| 영역 | 선택 |
|---|---|
| 빌드 | Vite + TypeScript (strict, `any` 금지) |
| 3D/셰이더 | Three.js (+ 필요 시 raw WebGL/GLSL) |
| 애니메이션 | GSAP + ScrollTrigger |
| 스무스 스크롤 | Lenis |
| 오디오 | Web Audio API |
| 손 추적 | MediaPipe Tasks (지연 로드) |
| 패키지 매니저 | pnpm |
| 검증 | ESLint, `tsc --noEmit`, Playwright 스모크 |

## 3. 페이지 구조 (원페이지)

```
[0] 히어로        풀스크린 WebGL — 커서 반응 3D 오브젝트/파티클 + 대형 타이포 "INTERACTIVE MEDIA"
[1] 인트로        "인터랙티브 미디어란?" — 스크롤에 따라 단어 단위 리빌
[2] 01 포인터/제스처   섹션 타이틀 → 인라인 데모 4개
[3] 02 스크롤/모션     pin 고정된 3D 장면이 스크롤로 진행 + 데모 4개
[4] 03 사운드/오디오   "소리 켜기" 게이트 → 데모 4개
[5] 04 카메라/센서·생성  권한 버튼 기반 데모 + 자동 재생 생성 예술, 총 4개
[6] 타임라인       인터랙티브 미디어 역사 — 가로 스크롤
[7] 아웃트로/푸터   마지막 인터랙티브 장면 + 크레딧
```

### 데모 블록 레이아웃
- 설명 패널(제목, 개념 2~3줄, 사용 API 태그) + 큰 캔버스.
- 좌/우 교차 배치, 섹션당 1개 이상은 풀블리드.

### 공통 UI
- 로딩 화면(초기 에셋 로드 진행률)
- 커스텀 커서(호버 대상에 따라 변형)
- 상단 고정 내비: 섹션 점프 링크 + 현재 섹션 표시
- 섹션 번호 표기 `01`~`04`

## 4. 데모 목록 (1차 16개)

| 카테고리 | id | 데모 | 핵심 기술 |
|---|---|---|---|
| 포인터/제스처 | `cursor-trail` | 커서 파티클 트레일 | Canvas2D/Three Points |
| | `fluid` | 유체 시뮬레이션 | WebGL FBO 셰이더 |
| | `magnetic-drag` | 자석 버튼 / 물리 드래그 | 스프링 물리 |
| | `multitouch` | 멀티터치 제스처(핀치·회전) | Pointer Events |
| 스크롤/모션 | `scroll-camera` | 스크롤 연동 3D 카메라 | ScrollTrigger + Three |
| | `parallax` | 패럴랙스 레이어 | ScrollTrigger |
| | `scrollytelling` | 스크롤텔링 시퀀스 | pin + scrub |
| | `text-morph` | 텍스트 모핑 | SVG/Canvas 보간 |
| 사운드/오디오 | `synth-pad` | 신시사이저 패드 | Web Audio Oscillator |
| | `mic-visualizer` | 마이크 오디오 비주얼라이저 | AnalyserNode |
| | `audio-sphere` | 사운드 반응 3D 구체 | Analyser + 버텍스 셰이더 |
| | `spatial-audio` | 공간 음향 | PannerNode |
| 카메라/센서·생성 | `webcam-shader` | 웹캠 셰이더 필터 | VideoTexture + GLSL |
| | `hand-tracking` | 손 추적 | MediaPipe Hands |
| | `gyro-scene` | 기기 기울기 장면 | DeviceOrientation |
| | `noise-field` | 노이즈 필드 / 셀룰러 오토마타 | Simplex noise, GPGPU |

## 5. 아키텍처

### 디렉터리
```
src/
  main.ts                 진입점: 로더 → 섹션 초기화
  core/
    scroll.ts             Lenis + ScrollTrigger 연동
    background.ts         스크롤 위치 기반 배경색 보간
    cursor.ts             커스텀 커서
    nav.ts                고정 내비
    demo-host.ts          IntersectionObserver 기반 mount/pause/unmount, WebGL 컨텍스트 상한 관리
    permissions.ts        카메라/마이크/모션 권한 요청 헬퍼
  demos/
    registry.ts           데모 id → 동적 import 매핑
    <id>/index.ts         Demo 구현
    <id>/meta.ts          제목·설명·API 태그·카테고리
  sections/
    hero.ts intro.ts category.ts timeline.ts outro.ts
  styles/
    tokens.css            컬러·타이포·간격 토큰
    base.css
index.html
```

### Demo 인터페이스
```ts
interface DemoMeta {
  id: string;
  category: 'pointer' | 'scroll' | 'audio' | 'sensor';
  title: string;
  description: string;
  apis: string[];
  requires?: Array<'webgl' | 'camera' | 'microphone' | 'motion' | 'audio-gesture'>;
}

interface Demo {
  mount(container: HTMLElement): Promise<void> | void;
  pause(): void;
  resume(): void;
  unmount(): void;   // GPU/오디오/미디어 스트림 리소스 전부 해제
}
```

### 라이프사이클
1. `demo-host`가 각 데모 블록을 관찰.
2. 뷰포트 근접(rootMargin 기준) → `registry`에서 동적 import 후 `mount`.
3. 화면 이탈 → `pause`. 일정 거리 이상 멀어지면 `unmount`.
4. 활성 WebGL 데모가 3개를 초과하면 가장 먼 데모부터 `unmount`.
5. `requires`에 권한 항목이 있으면 사용자 클릭 전까지 게이트 UI만 표시.

## 6. 비주얼 & 모션

### 섹션별 컬러 전환
| 섹션 | 배경 | 액센트/텍스트 |
|---|---|---|
| 히어로·인트로 | `#07070a` | `#f2f2f2` |
| 01 포인터 | `#0d1240` | `#5b7cff` |
| 02 스크롤 | `#f0f1f3` | `#0b0b0b` |
| 03 사운드 | `#ff5a1f` | `#0b0b0b` |
| 04 센서·생성 | `#07070a` | `#c6ff3d` |
| 타임라인·푸터 | `#07070a` | `#f2f2f2` |

- 고정 배경 레이어 1개에 스크롤 진행도로 색을 보간(섹션 경계가 끊기지 않게).
- 텍스트 색도 CSS 변수로 함께 전환.

### 타이포
- 디스플레이: 굵은 산세리프 1종(Google Fonts), 본문/라벨: 모노스페이스 1종. 한글은 Pretendard 계열 폴백.

### 모션 규칙
- 이징 `expo.out` 계열로 통일.
- 텍스트: 줄/단어 단위 마스크 리빌.
- `prefers-reduced-motion: reduce` 시 스크롤 스크럽·자동 애니메이션 최소화.

## 7. 예외 처리

| 상황 | 동작 |
|---|---|
| WebGL 미지원 | 해당 데모 자리에 정적 이미지 + 안내 문구 |
| 카메라/마이크 권한 거부 | 데모 내부에 "권한 필요" 상태 표시, 다른 데모 영향 없음 |
| 자이로 미지원(데스크톱) | 마우스 위치로 기울기 대체 |
| MediaPipe 로드 실패 | 에러 메시지 + 재시도 버튼 |
| 오디오 컨텍스트 미시작 | "소리 켜기" 게이트 클릭 시 `AudioContext.resume()` |

## 8. 검증

단계마다:
- `pnpm lint && pnpm typecheck && pnpm build`
- Playwright 스모크: 페이지 끝까지 스크롤 → 콘솔 에러 0, 섹션별 스크린샷, 활성 WebGL 컨텍스트 ≤ 3
- 평가 에이전트의 위험/보통/통과 판정 — 통과 시에만 다음 단계

## 9. 구현 단계

1. 스캐폴드 + 공통 기반 (Vite/TS, Lenis, 배경 전환, 커서, 내비, 레지스트리, demo-host)
2. 히어로 + 인트로
3. 01 포인터/제스처 데모 4개
4. 02 스크롤/모션 데모 4개
5. 03 사운드/오디오 데모 4개
6. 04 카메라/센서·생성 데모 4개
7. 타임라인 + 푸터 + 로딩 화면 + 반응형/성능 마무리

## 10. 범위 밖 (1차)

- CMS·다국어·백엔드
- 데모별 개별 페이지/라우팅
- 사용자 작품 업로드·공유
