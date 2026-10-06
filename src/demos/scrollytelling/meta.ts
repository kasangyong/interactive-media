import type { DemoMeta } from '../../core/types';

export const meta: DemoMeta = {
  id: 'scrollytelling',
  category: 'scroll',
  title: '스크롤텔링',
  description:
    '화면을 고정해 두고 스크롤을 장면 전환에 쓴다. 진행도를 구간으로 나누고, 구간 사이를 보간하면 도형이 이야기의 흐름에 맞춰 모양을 바꾼다.',
  apis: ['position: sticky', 'SVG Path', 'Shape Interpolation'],
  hint: '스크롤을 멈추면 장면도 멈춥니다. 되돌려도 됩니다.',
  layout: 'scroll',
  scrollLength: 400,
};
