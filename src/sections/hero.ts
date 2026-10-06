import * as THREE from 'three';
import { DISPLACE_VERT, IRIDESCENT_FRAG } from '../core/glsl';
import { createLoop, prefersReducedMotion } from '../core/loop';
import type { ScrollController } from '../core/scroll';
import { createStageThree } from '../core/stage';

/**
 * 히어로: 노이즈로 일렁이는 이리데슨트 구 + 파티클 셸.
 * 포인터 방향으로 표면이 부풀고, 스크롤하면 위로 빠지며 흐려진다.
 */
export function initHero(scroll: ScrollController): Promise<void> {
  const container = document.querySelector<HTMLElement>('[data-hero]');
  if (!container) return Promise.resolve();

  let stage;
  try {
    stage = createStageThree(container, { alpha: true });
  } catch {
    container.classList.add('is-fallback');
    return Promise.resolve();
  }
  const { renderer } = stage;
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(35, 1, 0.1, 100);
  camera.position.set(0, 0, 7);

  const uniforms = {
    uTime: { value: 0 },
    uAmp: { value: 0.22 },
    uFreq: { value: 0.9 },
    uPointer: { value: new THREE.Vector3(0, 0, 1) },
    uPointerForce: { value: 0 },
    uColorA: { value: new THREE.Color('#0b1660') },
    uColorB: { value: new THREE.Color('#5b7cff') },
    uRim: { value: new THREE.Color('#dfe5ff') },
    uOpacity: { value: 1 },
  };
  const blob = new THREE.Mesh(
    new THREE.IcosahedronGeometry(1.35, 64),
    new THREE.ShaderMaterial({ vertexShader: DISPLACE_VERT, fragmentShader: IRIDESCENT_FRAG, uniforms, transparent: true }),
  );
  const group = new THREE.Group();
  group.add(blob);
  scene.add(group);

  // 파티클 셸
  const COUNT = 2400;
  const pos = new Float32Array(COUNT * 3);
  for (let i = 0; i < COUNT; i++) {
    const r = 2.2 + Math.random() * 2.6;
    const th = Math.random() * Math.PI * 2;
    const ph = Math.acos(2 * Math.random() - 1);
    pos.set([r * Math.sin(ph) * Math.cos(th), r * Math.cos(ph) * 0.7, r * Math.sin(ph) * Math.sin(th)], i * 3);
  }
  const pGeo = new THREE.BufferGeometry();
  pGeo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const pMat = new THREE.PointsMaterial({
    size: 0.018,
    color: '#cfd8ff',
    transparent: true,
    opacity: 0.7,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });
  const points = new THREE.Points(pGeo, pMat);
  scene.add(points);

  stage.onResize((w, h) => {
    camera.aspect = w / h;
    // 세로 화면에서는 구가 잘리지 않도록 뒤로 뺀다
    camera.position.z = w / h < 1 ? 7 / Math.max(w / h, 0.55) : 7;
    camera.updateProjectionMatrix();
  });

  const target = { x: 0, y: 0 };
  const smooth = { x: 0, y: 0, force: 0 };
  let lastMove = 0;
  let px = 0;
  let py = 0;
  window.addEventListener('pointermove', (e) => {
    const nx = (e.clientX / window.innerWidth) * 2 - 1;
    const ny = -((e.clientY / window.innerHeight) * 2 - 1);
    const speed = Math.hypot(nx - px, ny - py);
    px = nx;
    py = ny;
    target.x = nx;
    target.y = ny;
    lastMove = Math.min(1, lastMove + speed * 6);
  });

  let progress = 0;
  scroll.onScroll((y) => (progress = Math.min(1, y / window.innerHeight)));

  const reduced = prefersReducedMotion();
  const dir = new THREE.Vector3();
  const loop = createLoop((dt, t) => {
    uniforms.uTime.value = reduced ? 0 : t;
    smooth.x += (target.x - smooth.x) * 0.06;
    smooth.y += (target.y - smooth.y) * 0.06;
    lastMove *= 0.94;
    smooth.force += (0.25 + lastMove * 0.6 - smooth.force) * 0.08;

    dir.set(smooth.x * 1.2, smooth.y * 1.2, 1).normalize();
    // 그룹 회전을 상쇄해 포인터 방향이 화면 기준이 되도록
    dir.applyQuaternion(group.quaternion.clone().invert());
    uniforms.uPointer.value.copy(dir);
    uniforms.uPointerForce.value = smooth.force;

    if (!reduced) group.rotation.y += dt * 0.12;
    group.rotation.x = smooth.y * 0.25;
    points.rotation.y -= dt * 0.03;
    points.rotation.x = smooth.y * 0.1;
    points.position.x = smooth.x * 0.15;

    group.position.y = progress * 1.6;
    group.scale.setScalar(1 - progress * 0.35);
    uniforms.uOpacity.value = 1 - progress * 0.85;
    pMat.opacity = 0.7 * (1 - progress);

    renderer.render(scene, camera);
  });

  new IntersectionObserver(([e]) => (e.isIntersecting ? loop.start() : loop.stop())).observe(container);

  // 첫 프레임을 그린 뒤 준비 완료
  return new Promise((resolve) => {
    renderer.render(scene, camera);
    requestAnimationFrame(() => resolve());
  });
}
