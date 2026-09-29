/**
 * Компактная запись чисел: 999 → «999», 1250 → «1,2 тыс.» / «1.2K», 123456 → «123 тыс.» / «123K».
 * Алгоритм один на всю игру: строки для интерфейса и глифы пиксельного шрифта строятся из одних «частей».
 */
export interface CompactParts {
  /** Целая часть мантиссы. */
  int: number;
  /** Одна цифра после запятой или −1, если её не показываем. */
  frac: number;
  /** Индекс суффикса: 0 — единицы, 1 — тысячи, 2 — миллионы, 3 — миллиарды, 4 — триллионы. */
  suffix: number;
}

const MAX_SUFFIX = 4;

/** Пишет результат в out, чтобы в игровом цикле не создавать объекты. */
export function compactParts(value: number, out: CompactParts): CompactParts {
  const v = Math.max(0, Math.floor(value));
  if (v < 1000) {
    out.int = v;
    out.frac = -1;
    out.suffix = 0;
    return out;
  }
  let k = Math.min(MAX_SUFFIX, Math.floor(Math.log10(v) / 3));
  // log10 на границах степеней бывает неточен — проверяем честно
  while (k < MAX_SUFFIX && v >= 1000 ** (k + 1)) k++;
  while (k > 1 && v < 1000 ** k) k--;
  const m = v / 1000 ** k;
  if (m < 100) {
    const tenths = Math.floor(m * 10 + 1e-9);
    out.int = Math.floor(tenths / 10);
    out.frac = tenths % 10 === 0 ? -1 : tenths % 10;
  } else {
    out.int = Math.floor(m);
    out.frac = -1;
  }
  out.suffix = k;
  return out;
}

export interface NumberLocale {
  readonly decimal: string;
  readonly suffixes: readonly string[];
}

const scratch: CompactParts = { int: 0, frac: -1, suffix: 0 };

export function formatCompact(value: number, loc: NumberLocale): string {
  const p = compactParts(value, scratch);
  const frac = p.frac >= 0 ? `${loc.decimal}${p.frac}` : "";
  return `${p.int}${frac}${loc.suffixes[p.suffix] ?? ""}`;
}
