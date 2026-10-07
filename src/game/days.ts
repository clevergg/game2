/**
 * Календарные дни для поручений и аванса: номер дня по времени устройства (полночь — местная).
 * В Фазе 7 время будет браться с сервера Яндекса (serverTime), формула останется той же.
 */
const DAY_MS = 86_400_000;

/** Номер дня с 1970-01-01 по местному времени. tzOffsetMin — как Date#getTimezoneOffset(). */
export function dayNumber(ms: number, tzOffsetMin: number): number {
  return Math.floor((ms - tzOffsetMin * 60_000) / DAY_MS);
}

/** Сколько секунд игрок отсутствовал; часы устройства могут идти назад — тогда 0. */
export function awaySeconds(savedAt: number, nowMs: number): number {
  const s = (nowMs - savedAt) / 1000;
  return Number.isFinite(s) && s > 0 ? s : 0;
}
