import type { DemoMeta } from '../../core/types';

export const meta: DemoMeta = {
  id: 'webcam-shader',
  category: 'sensor',
  title: '웹캠 셰이더 필터',
  description:
    '카메라 영상을 텍스처로 GPU에 올리고, 픽셀마다 실행되는 프래그먼트 셰이더로 다시 그린다. 밝기를 문자로 바꾸면 아스키 아트, 색 지도로 바꾸면 열화상이 된다.',
  apis: ['getUserMedia', 'VideoTexture', 'GLSL', 'Fragment Shader'],
  hint: '오른쪽 위 버튼으로 필터를 바꿔 보세요. 영상은 기기 밖으로 나가지 않습니다.',
  requires: ['webgl', 'camera'],
  cursor: 'view',
};
