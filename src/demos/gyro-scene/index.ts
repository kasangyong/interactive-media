import * as THREE from 'three';
import { createLoop } from '../../core/loop';
import { getMotionPermission } from '../../core/permissions';
import { trackPointer } from '../../core/pointer';
import { createStageThree } from '../../core/stage';
import type { Demo } from '../../core/types';

const W = 6;
const H = 4;
const COUNT = 26;

interface Marble {
  mesh: THREE.Mesh;
  x: number;
  y: number;
  vx: number;
  vy: number;
  r: number;
}

export function create(container: HTMLElement): Demo {
  const stage = createStageThree(container, { alpha: true });
  const { renderer } = stage;
  renderer.shadowMap.enabled = true;
  const pointer = trackPointer(container);
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(32, 1, 0.1, 50);
  camera.position.set(0, -6.5, 9);
  camera.lookAt(0, 0, 0);
  stage.onResize((w, h) => {
    camera.aspect = w / h;
    // 좁은 화면에서도 쟁반이 다 보이게
    camera.position.set(0, -6.5, 9).multiplyScalar(w / h < 1.2 ? 1.35 / Math.max(w / h, 0.6) : 1);
    camera.lookAt(0, 0, 0);
    camera.updateProjectionMatrix();
  });

  scene.add(new THREE.HemisphereLight('#ffffff', '#20202a', 1.2));
  const key = new THREE.DirectionalLight('#ffffff', 2.4);
  key.position.set(3, -2, 8);
  key.castShadow = true;
  key.shadow.mapSize.set(1024, 1024);
  Object.assign(key.shadow.camera, { left: -5, right: 5, top: 5, bottom: -5 });
  scene.add(key);

  const tray = new THREE.Group();
  scene.add(tray);
  const disposables: Array<{ dispose(): void }> = [];
  const floorGeo = new THREE.PlaneGeometry(W, H);
  const floorMat = new THREE.MeshStandardMaterial({ color: '#111116', roughness: 0.9 });
  const floor = new THREE.Mesh(floorGeo, floorMat);
  floor.receiveShadow = true;
  tray.add(floor);
  const grid = new THREE.GridHelper(W, 12, '#c6ff3d', '#2a2a33');
  grid.rotation.x = Math.PI / 2;
  grid.scale.set(1, 1, H / W);
  grid.position.z = 0.001;
  tray.add(grid);
  const wallMat = new THREE.MeshStandardMaterial({ color: '#c6ff3d', roughness: 0.4 });
  const wallGeoX = new THREE.BoxGeometry(W + 0.2, 0.1, 0.3);
  const wallGeoY = new THREE.BoxGeometry(0.1, H, 0.3);
  disposables.push(floorGeo, floorMat, wallMat, wallGeoX, wallGeoY, grid.geometry, grid.material as THREE.Material);
  for (const [geo, x, y] of [
    [wallGeoX, 0, H / 2 + 0.05],
    [wallGeoX, 0, -H / 2 - 0.05],
    [wallGeoY, W / 2 + 0.05, 0],
    [wallGeoY, -W / 2 - 0.05, 0],
  ] as const) {
    const m = new THREE.Mesh(geo, wallMat);
    m.position.set(x, y, 0.15);
    tray.add(m);
  }

  const sphere = new THREE.SphereGeometry(1, 32, 16);
  disposables.push(sphere);
  const mats = ['#f2f2f2', '#c6ff3d', '#6b6b78'].map((c, i) => {
    const m = new THREE.MeshStandardMaterial({ color: c, roughness: i === 0 ? 0.15 : 0.35, metalness: i === 0 ? 0.6 : 0.1 });
    disposables.push(m);
    return m;
  });
  const marbles: Marble[] = Array.from({ length: COUNT }, (_, i) => {
    const r = 0.14 + Math.random() * 0.14;
    const mesh = new THREE.Mesh(sphere, mats[i % 3]);
    mesh.scale.setScalar(r);
    mesh.castShadow = true;
    tray.add(mesh);
    return { mesh, r, x: (Math.random() - 0.5) * (W - 1), y: (Math.random() - 0.5) * (H - 1), vx: 0, vy: 0 };
  });

  // 기울기 입력: 센서 우선, 없으면 포인터
  const tilt = { x: 0, y: 0 };
  let sensor = false;
  const onOrient = (e: DeviceOrientationEvent) => {
    if (e.beta === null || e.gamma === null) return;
    sensor = true;
    tilt.x = Math.max(-1, Math.min(1, e.gamma / 35));
    tilt.y = Math.max(-1, Math.min(1, (e.beta - 35) / 35));
  };
  let ui: HTMLElement | null = null;
  const enableSensor = () => window.addEventListener('deviceorientation', onOrient);
  const touchDevice = window.matchMedia('(pointer: coarse)').matches;
  if (touchDevice && typeof DeviceOrientationEvent !== 'undefined') {
    ui = document.createElement('div');
    ui.className = 'demo-ui';
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.textContent = '기울기 센서 켜기';
    btn.addEventListener('click', async () => {
      const res = await getMotionPermission();
      btn.textContent = res.ok ? '센서 사용 중' : '센서 권한 거부됨';
      btn.setAttribute('aria-pressed', String(res.ok));
      if (res.ok) enableSensor();
    });
    ui.appendChild(btn);
    container.appendChild(ui);
  }

  const loop = createLoop((dt) => {
    if (!sensor) {
      const tx = pointer.inside ? (pointer.nx - 0.5) * 2 : Math.sin(performance.now() / 1400) * 0.5;
      const ty = pointer.inside ? -(pointer.ny - 0.5) * 2 : Math.cos(performance.now() / 1700) * 0.4;
      tilt.x += (tx - tilt.x) * 0.1;
      tilt.y += (ty - tilt.y) * 0.1;
    }
    tray.rotation.y = tilt.x * 0.25;
    tray.rotation.x = -tilt.y * 0.25;
    const gx = tilt.x * 14;
    const gy = -tilt.y * 14;
    // 2단계 서브스텝으로 안정성 확보
    const sub = 2;
    const h = dt / sub;
    for (let s = 0; s < sub; s++) {
      for (const m of marbles) {
        m.vx = (m.vx + gx * h) * Math.pow(0.6, h);
        m.vy = (m.vy + gy * h) * Math.pow(0.6, h);
        m.x += m.vx * h;
        m.y += m.vy * h;
        const lx = W / 2 - m.r;
        const ly = H / 2 - m.r;
        if (m.x < -lx) [m.x, m.vx] = [-lx, Math.abs(m.vx) * 0.5];
        if (m.x > lx) [m.x, m.vx] = [lx, -Math.abs(m.vx) * 0.5];
        if (m.y < -ly) [m.y, m.vy] = [-ly, Math.abs(m.vy) * 0.5];
        if (m.y > ly) [m.y, m.vy] = [ly, -Math.abs(m.vy) * 0.5];
      }
      for (let i = 0; i < COUNT; i++) {
        for (let j = i + 1; j < COUNT; j++) {
          const a = marbles[i];
          const b = marbles[j];
          const dx = b.x - a.x;
          const dy = b.y - a.y;
          const d = Math.hypot(dx, dy) || 1e-4;
          const o = a.r + b.r - d;
          if (o <= 0) continue;
          const nx = dx / d;
          const ny = dy / d;
          a.x -= nx * o * 0.5;
          a.y -= ny * o * 0.5;
          b.x += nx * o * 0.5;
          b.y += ny * o * 0.5;
          const rel = (b.vx - a.vx) * nx + (b.vy - a.vy) * ny;
          if (rel < 0) {
            const imp = rel * 0.85;
            a.vx += nx * imp;
            a.vy += ny * imp;
            b.vx -= nx * imp;
            b.vy -= ny * imp;
          }
        }
      }
    }
    for (const m of marbles) {
      m.mesh.position.set(m.x, m.y, m.r);
      // 굴러가는 회전
      m.mesh.rotation.x -= (m.vy * dt) / m.r;
      m.mesh.rotation.y += (m.vx * dt) / m.r;
    }
    renderer.render(scene, camera);
  });
  loop.start();

  return {
    pause: () => loop.stop(),
    resume: () => loop.start(),
    unmount: () => {
      loop.stop();
      window.removeEventListener('deviceorientation', onOrient);
      pointer.dispose();
      ui?.remove();
      disposables.forEach((d) => d.dispose());
      stage.dispose();
    },
  };
}
