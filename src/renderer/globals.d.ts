import type { Diagnostics } from '../render/spaceView';
import type { World } from '../sim/world';

declare global {
  interface Window {
    platform?: { kind: 'electron' };
    __GAME__?: { diagnostics: Diagnostics; world: World };
  }
}
export {};
