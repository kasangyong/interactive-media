import * as THREE from 'three';
import { createLoop } from '../../core/loop';
import { scrollProgress, trackPointer } from '../../core/pointer';
import { createStageThree } from '../../core/stage';
import type { Demo } from '../../core/types';

const BG = '#f0f1f3';
const INK = '#0b0b0b';
const BLUE = '#1a3cff';

export function create(container: HTMLElement): Demo {
  const block = container.closest<HTMLElement>('.demo-block') ?? container;
  const stage = createStageThree(container, { alpha: true });
  const { renderer } = stage;
  const pointer = trackPointer(container);
  const scene = new THREE.Scene();
  scene.fog = new THREE.Fog(BG, 6, 34);
  const camera = new THREE.PerspectiveCamera(55, 1, 0.1, 80);
  stage.onResize((w, h) => {
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  });

  // 카메라가 지나갈 경로
  const path = new THREE.CatmullRomCurve3(
    [
      new THREE.Vector3(0, 0, 10),
      new THREE.Vector3(2.5, 1, -8),
      new THREE.Vector3(-3, -1, -26),
      new THREE.Vector3(1, 2, -44),
      new THREE.Vector3(0, 0, -62),
      new THREE.Vector3(0, 0, -80),
    ],
    false,
    'catmullrom',
    0.4,
  );

  scene.add(new THREE.HemisphereLight('#ffffff', '#b8bcc8', 2.2));
  const sun = new THREE.DirectionalLight('#ffffff', 2.5);
  sun.position.set(4, 8, 6);
  scene.add(sun);

  const disposables: Array<{ dispose(): void }> = [];
  const mat = (color: string, opts: THREE.MeshStandardMaterialParameters = {}) => {
    const m = new THREE.MeshStandardMaterial({ color, roughness: 0.35, metalness: 0.1, ...opts });
    disposables.push(m);
    return m;
  };
  const geoRing = new THREE.TorusGeometry(3.4, 0.05, 12, 120);
  const geoBox = new THREE.BoxGeometry(1, 1, 1);
  const geoSphere = new THREE.IcosahedronGeometry(0.6, 3);
  disposables.push(geoRing, geoBox, geoSphere);
  const inkMat = mat(INK);
  const blueMat = mat(BLUE, { emissive: BLUE, emissiveIntensity: 0.25 });
  const whiteMat = mat('#ffffff', { roughness: 0.15 });

  // 경로를 따라 링 게이트
  const rings: THREE.Mesh[] = [];
  for (let i = 0; i <= 24; i++) {
    const t = i / 24;
    const p = path.getPointAt(t);
    const tan = path.getTangentAt(t);
    const ring = new THREE.Mesh(geoRing, i % 4 === 0 ? blueMat : inkMat);
    ring.position.copy(p);
    ring.lookAt(p.clone().add(tan));
    rings.push(ring);
    scene.add(ring);
  }

  // 주변 오브젝트
  const floaters: Array<{ mesh: THREE.Mesh; spin: THREE.Vector3 }> = [];
  const rnd = mulberry(7);
  for (let i = 0; i < 90; i++) {
    const t = rnd();
    const p = path.getPointAt(t);
    const ang = rnd() * Math.PI * 2;
    const rad = 4.5 + rnd() * 6;
    const isBox = rnd() > 0.45;
    const m = new THREE.Mesh(isBox ? geoBox : geoSphere, rnd() > 0.82 ? blueMat : rnd() > 0.5 ? whiteMat : inkMat);
    m.position.set(p.x + Math.cos(ang) * rad, p.y + Math.sin(ang) * rad * 0.7, p.z + (rnd() - 0.5) * 4);
    const s = 0.3 + rnd() * 1.4;
    m.scale.setScalar(s);
    m.rotation.set(rnd() * 6, rnd() * 6, rnd() * 6);
    floaters.push({ mesh: m, spin: new THREE.Vector3(rnd() - 0.5, rnd() - 0.5, 0).multiplyScalar(0.6) });
    scene.add(m);
  }

  let p = 0;
  const look = new THREE.Vector3();
  const pos = new THREE.Vector3();
  const loop = createLoop((dt) => {
    const target = scrollProgress(block) * 0.96;
    p = Math.min(0.96, Math.max(0, p + (target - p) * Math.min(1, dt * 5)));
    path.getPointAt(p, pos);
    path.getPointAt(Math.min(1, p + 0.03), look);
    camera.position.copy(pos);
    // 포인터로 살짝 둘러보기
    look.x += (pointer.nx - 0.5) * 3;
    look.y -= (pointer.ny - 0.5) * 2;
    camera.lookAt(look);
    for (const f of floaters) {
      f.mesh.rotation.x += f.spin.x * dt;
      f.mesh.rotation.y += f.spin.y * dt;
    }
    renderer.render(scene, camera);
  });
  loop.start();

  return {
    pause: () => loop.stop(),
    resume: () => loop.start(),
    unmount: () => {
      loop.stop();
      pointer.dispose();
      disposables.forEach((d) => d.dispose());
      stage.dispose();
    },
  };
}

/** 재현 가능한 의사난수 */
function mulberry(seed: number) {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
