import type { DemoMeta } from '../../core/types';

export const meta: DemoMeta = {
  id: 'audio-sphere',
  category: 'audio',
  title: '사운드 반응 3D 구체',
  description:
    '브라우저가 직접 연주하는 루프(킥, 베이스, 아르페지오)를 분석해 저음은 부피로, 중음은 주름으로, 고음은 표면의 떨림으로 바꾼다. 소리가 모양을 가진다.',
  apis: ['Web Audio Scheduler', 'AnalyserNode', 'Three.js', 'Vertex Shader'],
  hint: '구체를 누르면 패턴이 바뀝니다. 커서 쪽으로 표면이 부풀어요.',
  requires: ['webgl', 'audio-gesture'],
  layout: 'full',
  cursor: 'click',
};
