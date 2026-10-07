/**
 * Ограничитель межстраничной рекламы: когда её можно показать, не ломая игроку руки.
 * Яндекс сам режет частоту, но мы дополнительно не показываем рекламу в начале сессии,
 * посреди драга и сразу после тапа. Время передаётся извне (секунды), core часов не знает.
 */
import { ADS } from "../data/balance";

export interface AdGuard {
  sessionStart: number;
  /** Когда закончилась последняя реклама (−Infinity — ещё не было). */
  lastAd: number;
  /** Последнее действие игрока (тап, начало или конец драга). */
  lastInput: number;
  dragging: boolean;
}

export function createAdGuard(now: number): AdGuard {
  return { sessionStart: now, lastAd: -Infinity, lastInput: -Infinity, dragging: false };
}

export function noteInput(g: AdGuard, now: number): void {
  g.lastInput = now;
}

export function setDragging(g: AdGuard, dragging: boolean, now: number): void {
  g.dragging = dragging;
  g.lastInput = now;
}

export function noteAdShown(g: AdGuard, now: number): void {
  g.lastAd = now;
}

/** Можно ли показать межстраничную рекламу прямо сейчас. */
export function canShowInterstitial(g: AdGuard, now: number): boolean {
  if (g.dragging) return false;
  if (now - g.sessionStart < ADS.firstAfterSec) return false;
  if (now - g.lastAd < ADS.minGapSec) return false;
  return now - g.lastInput >= ADS.quietSec;
}

/** Rewarded игрок запускает сам — мешает только драг. */
export function canShowRewarded(g: AdGuard): boolean {
  return !g.dragging;
}
