import type { DemoMeta } from '../../core/types';

export const meta: DemoMeta = {
  id: 'cursor-trail',
  category: 'pointer',
  title: '커서 파티클 트레일',
  description:
    '포인터가 빠르게 움직일수록 더 많은 입자가 튀어나온다. 속도라는 보이지 않는 값이 밀도와 색으로 번역되는 가장 단순한 형태의 피드백 루프다.',
  apis: ['Pointer Events', 'Canvas 2D', 'Object Pool'],
  hint: '영역 위에서 빠르게 휘저어 보세요. 가만히 두면 스스로 춤춥니다.',
  cursor: 'view',
};
