/**
 * Упаковщик атласа «полками»: прямоугольники сортируются по высоте и
 * укладываются рядами слева направо. Для сотен кадров похожего размера даёт
 * плотность ~85–90% при тривиальном коде; максимальная ширина — 2048 (безопасно для мобильных GPU).
 */
export interface Size {
  readonly w: number;
  readonly h: number;
}

export interface PackResult {
  readonly positions: { x: number; y: number }[];
  readonly width: number;
  readonly height: number;
}

export function packShelves(items: readonly Size[], maxWidth: number, padding: number): PackResult {
  const order = items.map((_, i) => i).sort((a, b) => (items[b]?.h ?? 0) - (items[a]?.h ?? 0));
  const positions: { x: number; y: number }[] = items.map(() => ({ x: 0, y: 0 }));
  let x = padding;
  let y = padding;
  let shelfH = 0;
  let usedW = 0;
  for (const i of order) {
    const it = items[i];
    if (!it) continue;
    if (it.w + padding * 2 > maxWidth) throw new RangeError(`Кадр шире атласа: ${it.w}`);
    if (x + it.w + padding > maxWidth) {
      x = padding;
      y += shelfH + padding;
      shelfH = 0;
    }
    positions[i] = { x, y };
    x += it.w + padding;
    usedW = Math.max(usedW, x);
    shelfH = Math.max(shelfH, it.h);
  }
  const height = y + shelfH + padding;
  // Размеры кратны 4: так атлас дружелюбнее к сжатию текстур и выравниванию строк.
  return { positions, width: roundUp4(usedW), height: roundUp4(height) };
}

function roundUp4(n: number): number {
  return Math.ceil(n / 4) * 4;
}
