import type { DemoMeta } from '../../core/types';

export const meta: DemoMeta = {
  id: 'multitouch',
  category: 'pointer',
  title: '멀티터치 제스처',
  description:
    '두 손가락 사이의 거리는 확대, 각도는 회전, 중점은 이동이 된다. 포인터 여러 개를 동시에 추적해 하나의 변환 행렬로 합치는 것이 핀치 줌의 정체다.',
  apis: ['Pointer Events', 'setPointerCapture', 'CSS Transform', 'WheelEvent'],
  hint: '터치: 두 손가락으로 핀치·회전 / 마우스: 드래그, 휠=확대, Shift+휠=회전',
  cursor: 'drag',
};
