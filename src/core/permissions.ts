export type PermissionResult<T> =
  | { ok: true; value: T }
  | { ok: false; reason: 'denied' | 'unsupported' | 'error'; message: string };

const MESSAGE = {
  denied: '권한이 거부되었습니다. 브라우저 주소창의 권한 설정에서 허용한 뒤 다시 시도해 주세요.',
  unsupported: '이 브라우저 또는 기기에서는 지원되지 않습니다. (HTTPS 또는 localhost 에서만 동작합니다)',
  error: '장치를 시작하지 못했습니다. 다른 앱이 사용 중인지 확인해 주세요.',
};

function fail<T>(reason: 'denied' | 'unsupported' | 'error'): PermissionResult<T> {
  return { ok: false, reason, message: MESSAGE[reason] };
}

async function media(constraints: MediaStreamConstraints): Promise<PermissionResult<MediaStream>> {
  if (!navigator.mediaDevices?.getUserMedia) return fail('unsupported');
  try {
    return { ok: true, value: await navigator.mediaDevices.getUserMedia(constraints) };
  } catch (err) {
    const name = err instanceof Error ? err.name : '';
    if (name === 'NotAllowedError' || name === 'SecurityError') return fail('denied');
    if (name === 'NotFoundError' || name === 'OverconstrainedError') return fail('unsupported');
    return fail('error');
  }
}

export const requestCamera = () =>
  media({ video: { facingMode: 'user', width: { ideal: 1280 }, height: { ideal: 720 } }, audio: false });

export const requestMicrophone = () =>
  media({ audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false }, video: false });

interface OrientationEventWithPermission {
  requestPermission?: () => Promise<'granted' | 'denied'>;
}

/** iOS 13+ 는 사용자 제스처 안에서 requestPermission 을 불러야 한다 */
export async function requestMotion(): Promise<PermissionResult<true>> {
  if (typeof DeviceOrientationEvent === 'undefined') return fail('unsupported');
  const req = (DeviceOrientationEvent as unknown as OrientationEventWithPermission).requestPermission;
  if (!req) return { ok: true, value: true };
  try {
    return (await req()) === 'granted' ? { ok: true, value: true } : fail('denied');
  } catch {
    return fail('denied');
  }
}

let motionPromise: Promise<PermissionResult<true>> | null = null;

/** 게이트 클릭 핸들러 안에서 호출 — iOS 권한 팝업은 제스처 안에서만 뜬다 */
export function primeMotion(): void {
  motionPromise = requestMotion();
}

/** primeMotion 이 이미 요청했으면 그 결과를, 아니면 새로 요청 */
export function getMotionPermission(): Promise<PermissionResult<true>> {
  return motionPromise ?? requestMotion();
}

export function stopStream(stream: MediaStream | null | undefined): void {
  stream?.getTracks().forEach((t) => t.stop());
}

/** 데모 영역 안에 권한/오류 메시지를 표시 */
export function showNotice(container: HTMLElement, message: string, retry?: () => void): HTMLElement {
  const box = document.createElement('div');
  box.className = 'demo-fallback';
  const p = document.createElement('p');
  p.textContent = message;
  box.appendChild(p);
  if (retry) {
    const b = document.createElement('button');
    b.type = 'button';
    b.textContent = '다시 시도';
    b.addEventListener('click', () => {
      box.remove();
      retry();
    });
    box.appendChild(b);
  }
  container.appendChild(box);
  return box;
}
