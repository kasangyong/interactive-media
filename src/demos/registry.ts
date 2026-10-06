import type { Registry } from '../core/types';
import { meta as audioSphere } from './audio-sphere/meta';
import { meta as cursorTrail } from './cursor-trail/meta';
import { meta as fluid } from './fluid/meta';
import { meta as gyroScene } from './gyro-scene/meta';
import { meta as handTracking } from './hand-tracking/meta';
import { meta as magneticDrag } from './magnetic-drag/meta';
import { meta as micVisualizer } from './mic-visualizer/meta';
import { meta as multitouch } from './multitouch/meta';
import { meta as noiseField } from './noise-field/meta';
import { meta as parallax } from './parallax/meta';
import { meta as scrollCamera } from './scroll-camera/meta';
import { meta as scrollytelling } from './scrollytelling/meta';
import { meta as spatialAudio } from './spatial-audio/meta';
import { meta as synthPad } from './synth-pad/meta';
import { meta as textMorph } from './text-morph/meta';
import { meta as webcamShader } from './webcam-shader/meta';

/** 데모 id → 메타 + 지연 로드. 순서가 곧 페이지 배치 순서 */
export const registry: Registry = {
  [cursorTrail.id]: { meta: cursorTrail, load: () => import('./cursor-trail') },
  [fluid.id]: { meta: fluid, load: () => import('./fluid') },
  [magneticDrag.id]: { meta: magneticDrag, load: () => import('./magnetic-drag') },
  [multitouch.id]: { meta: multitouch, load: () => import('./multitouch') },
  [scrollCamera.id]: { meta: scrollCamera, load: () => import('./scroll-camera') },
  [parallax.id]: { meta: parallax, load: () => import('./parallax') },
  [scrollytelling.id]: { meta: scrollytelling, load: () => import('./scrollytelling') },
  [textMorph.id]: { meta: textMorph, load: () => import('./text-morph') },
  [synthPad.id]: { meta: synthPad, load: () => import('./synth-pad') },
  [audioSphere.id]: { meta: audioSphere, load: () => import('./audio-sphere') },
  [micVisualizer.id]: { meta: micVisualizer, load: () => import('./mic-visualizer') },
  [spatialAudio.id]: { meta: spatialAudio, load: () => import('./spatial-audio') },
  [webcamShader.id]: { meta: webcamShader, load: () => import('./webcam-shader') },
  [handTracking.id]: { meta: handTracking, load: () => import('./hand-tracking') },
  [gyroScene.id]: { meta: gyroScene, load: () => import('./gyro-scene') },
  [noiseField.id]: { meta: noiseField, load: () => import('./noise-field') },
};
