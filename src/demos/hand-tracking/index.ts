import { HandLandmarker, loadHandLandmarker, monotonicClock } from '../../core/hands';
import { createLoop } from '../../core/loop';
import { requestCamera, setStreamEnabled, showNotice, stopStream } from '../../core/permissions';
import { createStage2D } from '../../core/stage';
import type { Demo } from '../../core/types';

interface Spark {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  hue: number;
}

export async function create(container: HTMLElement): Promise<Demo> {
  const status = document.createElement('p');
  status.className = 'demo-status';
  status.textContent = '모델을 불러오는 중…';
  container.appendChild(status);

  const cam = await requestCamera();
  if (!cam.ok) {
    status.remove();
    const box = showNotice(container, cam.message);
    return { pause() {}, resume() {}, unmount: () => box.remove() };
  }
  const stream = cam.value;

  let landmarker: HandLandmarker;
  try {
    landmarker = await loadHandLandmarker(2);
  } catch (err) {
    stopStream(stream);
    status.remove();
    // DemoHost 가 '다시 시도' 버튼이 있는 폴백을 그린다
    throw err;
  }

  try {
    return await run(container, stream, landmarker, status);
  } catch (err) {
    landmarker.close();
    stopStream(stream);
    status.remove();
    throw err;
  }
}

async function run(container: HTMLElement, stream: MediaStream, landmarker: HandLandmarker, status: HTMLElement): Promise<Demo> {
  const video = document.createElement('video');
  video.muted = true;
  video.playsInline = true;
  video.srcObject = stream;
  await video.play().catch(() => undefined);
  status.textContent = '손을 카메라 앞에 들어 보세요';

  const stage = createStage2D(container);
  const g = stage.ctx;
  const trails: Array<Array<{ x: number; y: number; t: number }>> = [[], []];
  const sparks: Spark[] = [];
  const pinched = [false, false];
  let lastVideoTime = -1;
  const clock = monotonicClock();
  let hands: Array<Array<{ x: number; y: number }>> = [];

  const loop = createLoop((dt, now) => {
    const w = stage.width;
    const h = stage.height;
    // 영상 좌표 → 화면 좌표 (cover + 거울)
    const vw = video.videoWidth || 1280;
    const vh = video.videoHeight || 720;
    const scale = Math.max(w / vw, h / vh);
    const ox = (w - vw * scale) / 2;
    const oy = (h - vh * scale) / 2;
    const map = (p: { x: number; y: number }) => ({ x: w - (ox + p.x * vw * scale), y: oy + p.y * vh * scale });

    if (video.readyState >= 2 && video.currentTime !== lastVideoTime) {
      lastVideoTime = video.currentTime;
      const r = landmarker.detectForVideo(video, clock());
      hands = r.landmarks.map((hand) => hand.map(map));
      if (hands.length) status.textContent = `${hands.length} hand${hands.length > 1 ? 's' : ''} · 21 landmarks`;
    }

    g.save();
    g.clearRect(0, 0, w, h);
    // 어둡게 깐 거울 영상
    g.globalAlpha = 0.35;
    g.translate(w, 0);
    g.scale(-1, 1);
    g.drawImage(video, ox, oy, vw * scale, vh * scale);
    g.restore();

    hands.forEach((pts, hi) => {
      if (hi > 1) return;
      // 뼈대
      g.strokeStyle = 'rgba(242,242,242,0.55)';
      g.lineWidth = 2;
      for (const c of HandLandmarker.HAND_CONNECTIONS) {
        const a = pts[c.start];
        const b = pts[c.end];
        g.beginPath();
        g.moveTo(a.x, a.y);
        g.lineTo(b.x, b.y);
        g.stroke();
      }
      g.fillStyle = '#c6ff3d';
      for (const p of pts) {
        g.beginPath();
        g.arc(p.x, p.y, 3.5, 0, Math.PI * 2);
        g.fill();
      }
      // 검지 끝(8) 궤적
      const tip = pts[8];
      trails[hi].push({ x: tip.x, y: tip.y, t: now });
      // 핀치: 엄지 끝(4)과 검지 끝(8) 거리를 손 크기(0→9)로 정규화
      const handSize = Math.hypot(pts[0].x - pts[9].x, pts[0].y - pts[9].y) || 1;
      const pinch = Math.hypot(pts[4].x - tip.x, pts[4].y - tip.y) / handSize < 0.28;
      if (pinch && !pinched[hi]) {
        for (let i = 0; i < 60; i++) {
          const a = Math.random() * Math.PI * 2;
          const s = 80 + Math.random() * 380;
          sparks.push({ x: tip.x, y: tip.y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: 1, hue: 70 + Math.random() * 40 });
        }
      }
      pinched[hi] = pinch;
    });

    // 궤적 그리기 (1.4초 동안 남음)
    g.lineCap = 'round';
    g.lineJoin = 'round';
    for (const tr of trails) {
      while (tr.length && now - tr[0].t > 1.4) tr.shift();
      for (let i = 1; i < tr.length; i++) {
        const k = 1 - (now - tr[i].t) / 1.4;
        g.strokeStyle = `rgba(198,255,61,${k})`;
        g.lineWidth = 2 + k * 10;
        g.beginPath();
        g.moveTo(tr[i - 1].x, tr[i - 1].y);
        g.lineTo(tr[i].x, tr[i].y);
        g.stroke();
      }
    }
    g.globalCompositeOperation = 'lighter';
    for (let i = sparks.length - 1; i >= 0; i--) {
      const s = sparks[i];
      s.life -= dt * 1.4;
      if (s.life <= 0) {
        sparks.splice(i, 1);
        continue;
      }
      s.vy += 500 * dt;
      s.x += s.vx * dt;
      s.y += s.vy * dt;
      g.fillStyle = `hsla(${s.hue},100%,60%,${s.life})`;
      g.beginPath();
      g.arc(s.x, s.y, 2 + s.life * 3, 0, Math.PI * 2);
      g.fill();
    }
    g.globalCompositeOperation = 'source-over';
  });
  loop.start();

  return {
    pause: () => {
      loop.stop();
      video.pause();
      setStreamEnabled(stream, false);
    },
    resume: () => {
      setStreamEnabled(stream, true);
      void video.play().catch(() => undefined);
      loop.start();
    },
    unmount: () => {
      loop.stop();
      landmarker.close();
      stopStream(stream);
      video.srcObject = null;
      status.remove();
      stage.dispose();
    },
  };
}
