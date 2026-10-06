import type { DemoMeta } from '../../core/types';

export const meta: DemoMeta = {
  id: 'spatial-audio',
  category: 'audio',
  title: '공간 음향',
  description:
    '머리전달함수(HRTF)는 소리가 양쪽 귀에 도착하는 시간차와 음색 차이를 흉내 낸다. 위에서 내려다본 평면에서 음원을 옮기면, 헤드폰 속 소리도 그 자리로 이동한다.',
  apis: ['PannerNode', 'HRTF', 'AudioListener', 'Distance Model'],
  hint: '헤드폰을 쓰고 음원(주황 점)을 끌어 보세요. 놓으면 다시 궤도를 돕니다.',
  requires: ['audio-gesture'],
  cursor: 'drag',
};
