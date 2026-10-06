let ctx: AudioContext | null = null;

/** 페이지 전체가 공유하는 AudioContext */
export function getAudio(): AudioContext {
  if (!ctx) ctx = new AudioContext();
  return ctx;
}

/** 사용자 제스처 안에서 호출해야 소리가 난다 */
export function unlockAudio(): void {
  const c = getAudio();
  // iOS 는 전화/잠금 후 'interrupted' 상태가 된다
  if (c.state !== 'running') void c.resume();
}

export interface Master {
  node: GainNode;
  fadeTo(value: number, seconds?: number): void;
  dispose(): void;
}

/** 데모별 마스터 볼륨. pause 때 0 으로 페이드해 클릭 노이즈 없이 끈다 */
export function createMaster(volume = 0.8): Master {
  const c = getAudio();
  const node = c.createGain();
  node.gain.value = 0;
  node.connect(c.destination);
  const fadeTo = (value: number, seconds = 0.25) => {
    const t = c.currentTime;
    node.gain.cancelScheduledValues(t);
    node.gain.setValueAtTime(node.gain.value, t);
    node.gain.linearRampToValueAtTime(value, t + seconds);
  };
  fadeTo(volume);
  return {
    node,
    fadeTo,
    dispose: () => {
      fadeTo(0, 0.05);
      window.setTimeout(() => node.disconnect(), 80);
    },
  };
}

export interface Scheduler {
  start(): void;
  stop(): void;
}

/**
 * 룩어헤드 스케줄러: 25ms 마다 깨어나 앞으로 0.12초 안에 울릴 16분음표를 예약한다.
 * setInterval 의 지터와 무관하게 오디오 클록 기준으로 정확한 박자를 낸다.
 */
export function createScheduler(bpm: number, onStep: (step: number, time: number) => void): Scheduler {
  const c = getAudio();
  const spb = 60 / bpm / 4;
  let next = 0;
  let step = 0;
  let timer = 0;
  const tick = () => {
    // 백그라운드 탭 스로틀로 밀렸으면 지난 노트를 몰아 치지 않고 현재로 점프
    if (next < c.currentTime) next = c.currentTime + 0.02;
    while (next < c.currentTime + 0.12) {
      onStep(step, next);
      step++;
      next += spb;
    }
  };
  return {
    start() {
      if (timer) return;
      next = c.currentTime + 0.05;
      timer = window.setInterval(tick, 25);
      tick();
    },
    stop() {
      window.clearInterval(timer);
      timer = 0;
    },
  };
}

/** 미디 노트 → 주파수 */
export const mtof = (m: number) => 440 * Math.pow(2, (m - 69) / 12);
