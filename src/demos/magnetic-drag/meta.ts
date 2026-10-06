import type { DemoMeta } from '../../core/types';

export const meta: DemoMeta = {
  id: 'magnetic-drag',
  category: 'pointer',
  title: '자석 버튼 & 물리 드래그',
  description:
    '버튼이 커서를 향해 끌려오고, 공은 던진 속도 그대로 날아가 벽과 서로에 부딪힌다. 화면 요소에 질량과 관성을 주면 클릭이 "만지는" 감각으로 바뀐다.',
  apis: ['Pointer Capture', 'Verlet-ish Physics', 'Spring Easing'],
  hint: '버튼 근처에 커서를 가져가고, 공을 잡아 던져 보세요.',
  cursor: 'drag',
};
