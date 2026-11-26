import type { Diagnostics } from '../render/spaceView';
import type { ViewParams } from '../render/params';
import type { World } from '../sim/world';

declare global {
  interface Window {
    platform?: { kind: 'electron' };
    __GAME__?: { diagnostics: Diagnostics; world: World };
    __LAB__?: { params: ViewParams; apply(): void; setTilt(deg: number): void };
  }
}
export {};
