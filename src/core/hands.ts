import { FilesetResolver, HandLandmarker } from '@mediapipe/tasks-vision';

// 패키지 버전과 반드시 같은 wasm 을 써야 한다
const WASM = 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@1.0.1/wasm';
const MODEL = 'https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task';

export { HandLandmarker };

/** 손 관절 21개 검출기. GPU 델리게이트가 안 되는 환경이면 CPU 로 한 번 더 시도 */
export async function loadHandLandmarker(numHands = 2): Promise<HandLandmarker> {
  const fileset = await FilesetResolver.forVisionTasks(WASM);
  const make = (delegate: 'GPU' | 'CPU') =>
    HandLandmarker.createFromOptions(fileset, {
      baseOptions: { modelAssetPath: MODEL, delegate },
      runningMode: 'VIDEO',
      numHands,
    });
  return make('GPU').catch(() => make('CPU'));
}

/** detectForVideo 는 타임스탬프가 단조 증가해야 한다 */
export function monotonicClock(): () => number {
  let last = 0;
  return () => (last = Math.max(last + 1, Math.round(performance.now())));
}
