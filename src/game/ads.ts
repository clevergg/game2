/**
 * Реклама глазами игры: ограничитель частоты (core/ad-guard) + пауза игры и звука на время показа.
 * Платформа только показывает рекламу; когда её можно показать и что остановить — решается здесь.
 */
import {
  type AdGuard,
  canShowInterstitial,
  canShowRewarded,
  createAdGuard,
  noteAdShown,
  noteInput,
  setDragging,
} from "../core/ad-guard";
import type { Platform } from "../platform/platform";

export interface AdHooks {
  /** Остановить цикл, звук и геймплей платформы. */
  pause(): void;
  resume(): void;
}

const now = (): number => performance.now() / 1000;

export class Ads {
  private readonly guard: AdGuard = createAdGuard(now());
  private busy = false;

  constructor(
    private readonly platform: Platform,
    private readonly hooks: AdHooks,
  ) {}

  input(): void {
    noteInput(this.guard, now());
  }

  dragging(d: boolean): void {
    setDragging(this.guard, d, now());
  }

  get showing(): boolean {
    return this.busy;
  }

  /** Реклама за награду. true — награду выдать. */
  async rewarded(): Promise<boolean> {
    if (this.busy || !canShowRewarded(this.guard)) return false;
    return this.show(() => this.platform.showRewarded());
  }

  /** Межстраничная реклама в естественной паузе игры (если ограничитель разрешает). */
  async interstitial(): Promise<void> {
    if (this.busy || !canShowInterstitial(this.guard, now())) return;
    await this.show(() => this.platform.showInterstitial());
  }

  private async show(fn: () => Promise<boolean>): Promise<boolean> {
    this.busy = true;
    this.hooks.pause();
    try {
      return await fn();
    } catch {
      return false;
    } finally {
      noteAdShown(this.guard, now());
      this.hooks.resume();
      this.busy = false;
    }
  }
}
