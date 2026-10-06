import { getAudio } from '../../core/audio';
import { createLoop } from '../../core/loop';
import { requestMicrophone, showNotice, stopStream } from '../../core/permissions';
import { createStage2D } from '../../core/stage';
import type { Demo } from '../../core/types';

const BARS = 96;

export async function create(container: HTMLElement): Promise<Demo> {
  const res = await requestMicrophone();
  if (!res.ok) {
    const box = showNotice(container, res.message);
    return { pause() {}, resume() {}, unmount: () => box.remove() };
  }
  const stream = res.value;
  const ctx = getAudio();
  if (ctx.state === 'suspended') await ctx.resume().catch(() => undefined);
  const source = ctx.createMediaStreamSource(stream);
  const analyser = ctx.createAnalyser();
  analyser.fftSize = 2048;
  analyser.smoothingTimeConstant = 0.78;
  // 스피커로 내보내지 않는다 (하울링 방지)
  source.connect(analyser);

  const stage = createStage2D(container);
  const { ctx: g } = stage;
  const freq = new Uint8Array(analyser.frequencyBinCount);
  const wave = new Uint8Array(analyser.fftSize);
  const smooth = new Float32Array(BARS);
  let level = 0;
  let peakHold = 0;

  // 로그 스케일로 막대에 주파수 구간 배정 (60Hz ~ 12kHz)
  const nyquist = ctx.sampleRate / 2;
  const edges = Array.from({ length: BARS + 1 }, (_, i) =>
    Math.round((60 * Math.pow(12000 / 60, i / BARS) / nyquist) * analyser.frequencyBinCount),
  );

  const loop = createLoop((dt, t) => {
    analyser.getByteFrequencyData(freq);
    analyser.getByteTimeDomainData(wave);
    const w = stage.width;
    const h = stage.height;
    const cx = w / 2;
    const cy = h / 2;
    const R = Math.min(w, h) * 0.22;
    g.clearRect(0, 0, w, h);

    let sum = 0;
    for (let i = 0; i < wave.length; i++) {
      const v = (wave[i] - 128) / 128;
      sum += v * v;
    }
    const rms = Math.sqrt(sum / wave.length);
    level += (rms - level) * 0.3;
    peakHold = Math.max(level, peakHold - dt * 0.3);

    // 중앙 원: 음량에 따라 숨쉬기
    g.fillStyle = '#0b0b0b';
    g.beginPath();
    g.arc(cx, cy, R * (0.55 + level * 2.2), 0, Math.PI * 2);
    g.fill();

    // 원형 스펙트럼 막대 (좌우 대칭)
    g.lineCap = 'round';
    for (let i = 0; i < BARS; i++) {
      let m = 0;
      for (let k = edges[i]; k <= Math.max(edges[i], edges[i + 1] - 1); k++) m = Math.max(m, freq[k] ?? 0);
      smooth[i] += (m / 255 - smooth[i]) * 0.35;
      const len = 6 + smooth[i] * R * 1.3;
      for (const side of [-1, 1]) {
        const a = -Math.PI / 2 + side * (i / BARS) * Math.PI + t * 0.05;
        const r0 = R * 1.05;
        g.strokeStyle = `rgba(11,11,11,${0.35 + smooth[i] * 0.65})`;
        g.lineWidth = Math.max(1.5, (Math.PI * R * 2) / BARS / 2.6);
        g.beginPath();
        g.moveTo(cx + Math.cos(a) * r0, cy + Math.sin(a) * r0);
        g.lineTo(cx + Math.cos(a) * (r0 + len), cy + Math.sin(a) * (r0 + len));
        g.stroke();
      }
    }

    // 파형 (원 안쪽)
    g.strokeStyle = '#ff5a1f';
    g.lineWidth = 2;
    g.beginPath();
    const inner = R * 0.45;
    for (let i = 0; i < wave.length; i += 4) {
      const x = cx - inner + (i / wave.length) * inner * 2;
      const y = cy + ((wave[i] - 128) / 128) * inner * 1.2;
      if (i) g.lineTo(x, y);
      else g.moveTo(x, y);
    }
    g.stroke();

    // 레벨 미터
    g.fillStyle = 'rgba(11,11,11,0.6)';
    g.font = '11px JetBrains Mono, monospace';
    g.fillText(`LEVEL ${(20 * Math.log10(Math.max(peakHold, 1e-4))).toFixed(1)} dB`, 16, h - 16);
  });
  loop.start();

  return {
    pause: () => loop.stop(),
    resume: () => loop.start(),
    unmount: () => {
      loop.stop();
      source.disconnect();
      stopStream(stream);
      stage.dispose();
    },
  };
}
