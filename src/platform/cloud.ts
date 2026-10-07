/**
 * Чистые помощники облачных сохранений: выбор свежего сохранения из локального и облачного
 * и ограничитель частоты записи в облако. Без DOM — покрыты тестами.
 */

/** Время сохранения из JSON (поле savedAt) или −1, если данные не читаются. */
export function savedAtOf(raw: string | null): number {
  if (raw === null || raw === "") return -1;
  try {
    const data = JSON.parse(raw) as unknown;
    if (typeof data === "object" && data !== null && "savedAt" in data) {
      const t = data.savedAt;
      if (typeof t === "number" && Number.isFinite(t)) return t;
    }
    return 0;
  } catch {
    return -1;
  }
}

/** Из двух сохранений берём более свежее; битое проигрывает любому читаемому. */
export function pickNewest(local: string | null, cloud: string | null): string | null {
  const a = savedAtOf(local);
  const b = savedAtOf(cloud);
  if (a < 0 && b < 0) return null;
  return b > a ? cloud : local;
}

/** Не чаще одного раза в minGapMs; flush пишет сразу, но не чаще hardGapMs (защита от спама). */
export class Throttle {
  private last = -Infinity;

  constructor(
    private readonly minGapMs: number,
    private readonly hardGapMs = 0,
  ) {}

  ready(now: number, flush: boolean): boolean {
    if (this.wait(now, flush) > 0) return false;
    this.last = now;
    return true;
  }

  /** Сколько мс ждать до разрешённой записи (0 — можно сейчас). */
  wait(now: number, flush: boolean): number {
    const gap = now - this.last;
    return Math.max(0, (flush ? this.hardGapMs : this.minGapMs) - gap);
  }
}
