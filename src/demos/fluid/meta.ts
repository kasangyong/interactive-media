import type { DemoMeta } from '../../core/types';

export const meta: DemoMeta = {
  id: 'fluid',
  category: 'pointer',
  title: '유체 시뮬레이션',
  description:
    '나비에-스토크스 방정식을 GPU에서 매 프레임 푼다. 이류 → 발산 → 압력 → 기울기 보정의 네 단계를 셰이더로 돌려, 커서가 지나간 자리에 소용돌이와 잉크가 남는다.',
  apis: ['WebGL2', 'GLSL', 'Framebuffer Ping-pong', 'Half Float'],
  hint: '드래그해서 잉크를 밀어 보세요. 빠를수록 소용돌이가 커집니다.',
  requires: ['webgl'],
  layout: 'full',
  cursor: 'drag',
};
