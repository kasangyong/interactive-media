import type { DemoMeta } from '../../core/types';

export const meta: DemoMeta = {
  id: 'mic-visualizer',
  category: 'audio',
  title: '마이크 오디오 비주얼라이저',
  description:
    '고속 푸리에 변환(FFT)이 목소리를 주파수 대역별 에너지로 쪼갠다. 낮은 음은 원의 왼쪽, 높은 음은 오른쪽으로 돌아가며 막대가 된다. 소리는 녹음되거나 전송되지 않는다.',
  apis: ['getUserMedia', 'AnalyserNode', 'FFT', 'Canvas 2D'],
  hint: '말하거나, 휘파람을 불거나, 손뼉을 쳐 보세요.',
  requires: ['microphone'],
  cursor: 'sound',
};
