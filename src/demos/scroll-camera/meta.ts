import type { DemoMeta } from '../../core/types';

export const meta: DemoMeta = {
  id: 'scroll-camera',
  category: 'scroll',
  title: '스크롤 연동 3D 카메라',
  description:
    '스크롤 진행도 0→1이 3D 공간 속 곡선 위의 위치가 된다. 사용자는 페이지를 내리는 것이 아니라 카메라를 밀고 있다. 속도는 스크롤이, 연출은 경로가 정한다.',
  apis: ['Three.js', 'CatmullRomCurve3', 'position: sticky', 'Scroll Progress'],
  hint: '천천히 스크롤하며 통로를 지나가 보세요.',
  requires: ['webgl'],
  layout: 'scroll',
  scrollLength: 420,
};
