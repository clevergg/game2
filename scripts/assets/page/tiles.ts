/** Тайлы пола и стены рисуются прямо в индексах палитры, без 3D. Бесшовные по краям. */
import { paletteIndex } from "../../../src/data/palette";
import { createImage, type IndexedImage } from "../lib/raster";

/** Детерминированный шум: одинаковый результат на любой машине. */
function hash(x: number, y: number, seed: number): number {
  let n = Math.imul(x, 374761393) + Math.imul(y, 668265263) + Math.imul(seed, 2246822519);
  n = Math.imul(n ^ (n >>> 13), 1274126177);
  return ((n ^ (n >>> 16)) >>> 0) / 4294967295;
}

/** Ковролин офисной плиткой 32×32 с лёгким ворсом. */
export function carpetTile(): IndexedImage {
  const img = createImage(64, 64);
  for (let y = 0; y < 64; y++) {
    for (let x = 0; x < 64; x++) {
      const h = hash(x, y, 1);
      let shade = 1;
      if (h > 0.84) shade = 2;
      else if (h < 0.06) shade = 0;
      if ((x + y) % 4 === 0 && hash(x, y, 2) > 0.55) shade = 2;
      if (x % 32 === 0 || y % 32 === 0) shade = 2;
      if (x % 32 === 1 || y % 32 === 1) shade = Math.min(shade, 1);
      img.data[y * 64 + x] = paletteIndex("carpet", shade);
    }
  }
  return img;
}

/** Стеновая панель: шов, молдинг сверху, деревянный плинтус снизу. */
export function wallTile(): IndexedImage {
  const w = 64;
  const h = 96;
  const img = createImage(w, h);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      let idx: number;
      if (y < 4) idx = paletteIndex("wood", y === 0 ? 0 : y === 3 ? 3 : 1);
      else if (y >= h - 12) idx = paletteIndex("wood", y === h - 12 ? 0 : y >= h - 2 ? 3 : 2);
      else if (x === 0) idx = paletteIndex("wall", 3);
      else if (x === 1) idx = paletteIndex("wall", 0);
      else {
        const n = hash(x, y, 3);
        idx = paletteIndex("wall", n > 0.92 ? 2 : y > h - 20 && n > 0.6 ? 2 : 1);
      }
      img.data[y * w + x] = idx;
    }
  }
  return img;
}
