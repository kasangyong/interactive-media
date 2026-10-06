import type { DemoMeta } from '../../core/types';

export const meta: DemoMeta = {
  id: 'hand-brutalism',
  category: 'sensor',
  title: '두 손으로 조각하는 브루탈리즘',
  description:
    '왼손의 엄지와 검지 사이 거리가 디더링 양이 되고, 오른손 두 손가락이 그리는 선의 각도가 콘크리트 덩어리를 돌린다. 두 손이 각각 다른 파라미터를 쥐는 TouchDesigner식 제스처 컨트롤을 브라우저로 옮겼다.',
  apis: ['MediaPipe HandLandmarker', 'Three.js', 'Render Target', 'Ordered Dithering'],
  hint: '오른쪽 위 "카메라로 조작하기" → 왼손 엄지·검지 간격 = 디더, 오른손 두 손가락 기울기 = 회전. 그 전엔 마우스로.',
  requires: ['webgl'],
  layout: 'full',
  cursor: 'view',
};
