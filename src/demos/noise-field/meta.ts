import type { DemoMeta } from '../../core/types';

export const meta: DemoMeta = {
  id: 'noise-field',
  category: 'sensor',
  title: '노이즈 필드 & 셀룰러 오토마타',
  description:
    '생성 예술은 결과가 아니라 규칙을 디자인한다. 심플렉스 노이즈가 만든 흐름장을 따라 수천 개의 입자가 흐르고, 라이프 게임은 이웃 수 하나로 탄생과 소멸을 반복한다.',
  apis: ['Simplex Noise', 'Flow Field', "Conway's Game of Life", 'Canvas 2D'],
  hint: '클릭: 흐름장에선 시드 변경, 라이프 게임에선 세포 그리기. 오른쪽 위에서 모드 전환.',
  layout: 'full',
  cursor: 'click',
};
