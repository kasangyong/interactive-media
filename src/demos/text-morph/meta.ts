import type { DemoMeta } from '../../core/types';

export const meta: DemoMeta = {
  id: 'text-morph',
  category: 'scroll',
  title: '텍스트 모핑',
  description:
    '글자를 픽셀로 샘플링해 수천 개의 점으로 만든 뒤, 스크롤 진행도에 따라 다음 단어의 자리로 날려 보낸다. 점마다 출발 시간을 조금씩 어긋나게 해 물결처럼 흐른다.',
  apis: ['Canvas 2D', 'getImageData', 'Staggered Interpolation'],
  hint: '스크롤로 단어를 바꾸고, 커서로 점들을 흩트려 보세요.',
  layout: 'scroll',
  scrollLength: 320,
};
