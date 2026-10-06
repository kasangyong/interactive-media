import type { DemoMeta } from '../../core/types';

export const meta: DemoMeta = {
  id: 'hand-tracking',
  category: 'sensor',
  title: '손 추적',
  description:
    '브라우저 안에서 도는 머신러닝 모델이 카메라 영상 속 손의 관절 21개를 매 프레임 찾아낸다. 검지 끝은 붓이 되고, 엄지와 검지를 맞대면 불꽃이 터진다. 모든 계산은 기기 안에서 끝난다.',
  apis: ['MediaPipe HandLandmarker', 'WebAssembly', 'getUserMedia', 'Canvas 2D'],
  hint: '카메라 앞에 손을 들고 검지로 허공에 그려 보세요. 핀치하면 터집니다.',
  requires: ['camera'],
  layout: 'full',
  cursor: 'view',
};
