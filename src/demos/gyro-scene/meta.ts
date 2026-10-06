import type { DemoMeta } from '../../core/types';

export const meta: DemoMeta = {
  id: 'gyro-scene',
  category: 'sensor',
  title: '기기 기울기 장면',
  description:
    '휴대폰을 기울이면 중력의 방향이 바뀐다. DeviceOrientation 이벤트의 베타·감마 각도를 물리 엔진의 중력 벡터로 넣으면, 기기 자체가 쟁반이 된다.',
  apis: ['DeviceOrientationEvent', 'Three.js', 'Rigid-body (2D)'],
  hint: '모바일: 기기를 기울이세요. 데스크톱: 커서 위치가 기울기를 대신합니다.',
  requires: ['webgl'],
  cursor: 'view',
};
