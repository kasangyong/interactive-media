import type { DemoMeta } from '../../core/types';

export const meta: DemoMeta = {
  id: 'parallax',
  category: 'scroll',
  title: '패럴랙스 레이어',
  description:
    '가까운 것은 빨리, 먼 것은 느리게. 레이어마다 스크롤 속도를 다르게 주는 것만으로 평면에 깊이가 생긴다. 포인터 기울기까지 더하면 화면이 창문처럼 느껴진다.',
  apis: ['CSS Transform', 'Scroll Progress', 'Depth Factor'],
  hint: '스크롤하면서 마우스를 좌우로 움직여 보세요.',
  layout: 'scroll',
  scrollLength: 260,
};
