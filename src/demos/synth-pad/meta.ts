import type { DemoMeta } from '../../core/types';

export const meta: DemoMeta = {
  id: 'synth-pad',
  category: 'audio',
  title: '신시사이저 패드',
  description:
    '오실레이터가 파형을 만들고, 필터가 깎고, 엔벨로프가 시간 축의 모양을 잡는다. 펜타토닉 음계만 쓰기 때문에 아무렇게나 눌러도 음악이 된다.',
  apis: ['OscillatorNode', 'BiquadFilterNode', 'ADSR Envelope', 'DelayNode'],
  hint: '패드를 누르거나 키보드 1–4 / Q–R / A–F / Z–V. 커서 높이가 필터를 엽니다.',
  requires: ['audio-gesture'],
  cursor: 'sound',
};
