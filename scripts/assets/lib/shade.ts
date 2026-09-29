/**
 * Перевод освещённости пикселя в один из 4 оттенков рампы материала.
 * Между ступенями — упорядоченный дизеринг Байера 4×4: на плоских гранях
 * цвет чистый, а на плавных переходах появляется ретро-«сетка» как в играх начала 2000-х.
 */
const BAYER4 = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5] as const;

export function bayer(x: number, y: number): number {
  return ((BAYER4[(y & 3) * 4 + (x & 3)] ?? 0) + 0.5) / 16;
}

export interface ShadeParams {
  /** Освещённость, при которой оттенок самый светлый (0). */
  readonly bright: number;
  /** Освещённость, при которой оттенок самый тёмный (3). */
  readonly dark: number;
  /** 0 — чистая постеризация, 1 — полный дизеринг между ступенями. */
  readonly dither: number;
}

export const DEFAULT_SHADE: ShadeParams = { bright: 1.15, dark: 0.35, dither: 0.55 };

/** Возвращает оттенок 0..3; bias сдвигает материал светлее (<0) или темнее (>0). */
export function shadeLevel(intensity: number, x: number, y: number, bias: number, p: ShadeParams = DEFAULT_SHADE): number {
  const t = (p.bright - intensity) / (p.bright - p.dark);
  const v = Math.min(Math.max(t, 0), 1) * 3 + bias;
  const s = Math.floor(v + (bayer(x, y) - 0.5) * p.dither + 0.5);
  return Math.min(Math.max(s, 0), 3);
}
