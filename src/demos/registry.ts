import type { Registry } from '../core/types';
import { meta as cursorTrail } from './cursor-trail/meta';
import { meta as fluid } from './fluid/meta';
import { meta as magneticDrag } from './magnetic-drag/meta';
import { meta as multitouch } from './multitouch/meta';

/** 데모 id → 메타 + 지연 로드. 순서가 곧 페이지 배치 순서 */
export const registry: Registry = {
  [cursorTrail.id]: { meta: cursorTrail, load: () => import('./cursor-trail') },
  [fluid.id]: { meta: fluid, load: () => import('./fluid') },
  [magneticDrag.id]: { meta: magneticDrag, load: () => import('./magnetic-drag') },
  [multitouch.id]: { meta: multitouch, load: () => import('./multitouch') },
};
