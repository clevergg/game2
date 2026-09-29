/**
 * Операции над палитровыми изображениями: пиксель — индекс цвета, 0 — прозрачный.
 * Чистые функции без DOM — работают и в браузере (генератор), и в Bun (тесты).
 */
export interface IndexedImage {
  readonly w: number;
  readonly h: number;
  readonly data: Uint8Array;
}

export function createImage(w: number, h: number): IndexedImage {
  return { w, h, data: new Uint8Array(w * h) };
}

export function getPx(img: IndexedImage, x: number, y: number): number {
  if (x < 0 || y < 0 || x >= img.w || y >= img.h) return 0;
  return img.data[y * img.w + x] ?? 0;
}

export interface Trimmed {
  readonly img: IndexedImage;
  /** Смещение обрезанного изображения внутри исходного. */
  readonly x: number;
  readonly y: number;
}

/** Обрезает прозрачные поля. Пустое изображение превращается в 1×1 прозрачный пиксель. */
export function trim(img: IndexedImage): Trimmed {
  let minX = img.w;
  let minY = img.h;
  let maxX = -1;
  let maxY = -1;
  for (let y = 0; y < img.h; y++) {
    for (let x = 0; x < img.w; x++) {
      if (img.data[y * img.w + x] !== 0) {
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
  }
  if (maxX < 0) return { img: createImage(1, 1), x: 0, y: 0 };
  const out = createImage(maxX - minX + 1, maxY - minY + 1);
  for (let y = 0; y < out.h; y++) {
    out.data.set(img.data.subarray((minY + y) * img.w + minX, (minY + y) * img.w + maxX + 1), y * out.w);
  }
  return { img: out, x: minX, y: minY };
}

/**
 * Обводка в 1 пиксель по 4-соседству: прозрачный пиксель рядом с непрозрачным
 * становится цветом обводки. Размер изображения не меняется — рендерим с полями.
 */
export function addOutline(img: IndexedImage, outlineIndex: number): IndexedImage {
  const out = { w: img.w, h: img.h, data: img.data.slice() };
  for (let y = 0; y < img.h; y++) {
    for (let x = 0; x < img.w; x++) {
      if (getPx(img, x, y) !== 0) continue;
      if (getPx(img, x - 1, y) || getPx(img, x + 1, y) || getPx(img, x, y - 1) || getPx(img, x, y + 1)) {
        out.data[y * img.w + x] = outlineIndex;
      }
    }
  }
  return out;
}

/** Копирует src в dst; прозрачные пиксели src не перезаписывают dst. */
export function blit(dst: IndexedImage, src: IndexedImage, dx: number, dy: number): void {
  for (let y = 0; y < src.h; y++) {
    const ty = dy + y;
    if (ty < 0 || ty >= dst.h) continue;
    for (let x = 0; x < src.w; x++) {
      const tx = dx + x;
      if (tx < 0 || tx >= dst.w) continue;
      const v = src.data[y * src.w + x] ?? 0;
      if (v !== 0) dst.data[ty * dst.w + tx] = v;
    }
  }
}

/** Увеличение без сглаживания (для превью). */
export function scaleNearest(img: IndexedImage, k: number): IndexedImage {
  const out = createImage(img.w * k, img.h * k);
  for (let y = 0; y < out.h; y++) {
    for (let x = 0; x < out.w; x++) {
      out.data[y * out.w + x] = img.data[Math.floor(y / k) * img.w + Math.floor(x / k)] ?? 0;
    }
  }
  return out;
}

export function flipX(img: IndexedImage): IndexedImage {
  const out = createImage(img.w, img.h);
  for (let y = 0; y < img.h; y++) {
    for (let x = 0; x < img.w; x++) out.data[y * img.w + x] = img.data[y * img.w + (img.w - 1 - x)] ?? 0;
  }
  return out;
}
