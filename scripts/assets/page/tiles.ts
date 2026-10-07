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

/** Склад: бетонный пол с крапом и швами между плитами 64×64. */
export function concreteTile(): IndexedImage {
  const img = createImage(64, 64);
  for (let y = 0; y < 64; y++) {
    for (let x = 0; x < 64; x++) {
      const h = hash(x, y, 11);
      let shade = 1;
      if (h > 0.9) shade = 2;
      else if (h < 0.05) shade = 0;
      else if (hash(x >> 2, y >> 2, 12) > 0.8 && h > 0.5) shade = 2;
      if (x === 0 || y === 0) shade = 3;
      else if (x === 1 || y === 1) shade = 0;
      img.data[y * 64 + x] = paletteIndex("concrete", shade);
    }
  }
  return img;
}

/** Склад: профнастил с вертикальными рёбрами, снизу — жёлто-чёрная предупредительная полоса. */
export function steelWallTile(): IndexedImage {
  const w = 64;
  const h = 96;
  const img = createImage(w, h);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      let idx: number;
      if (y >= h - 14) {
        const stripe = Math.floor((x + y) / 6) % 2 === 0;
        idx = y === h - 14 || y >= h - 2 ? paletteIndex("fabric", 2) : stripe ? paletteIndex("hazard", 1) : paletteIndex("fabric", 1);
      } else {
        const rib = x % 16;
        const shade = rib < 2 ? 0 : rib < 8 ? 1 : rib < 10 ? 2 : 1;
        idx = paletteIndex("steel", hash(x, y, 13) > 0.97 ? Math.min(3, shade + 1) : shade);
      }
      img.data[y * w + x] = idx;
    }
  }
  return img;
}

/** Конторка дизайнеров: паркет из светлой берёзы, доски 16×64 со сдвигом. */
export function parquetTile(): IndexedImage {
  const img = createImage(64, 64);
  for (let y = 0; y < 64; y++) {
    for (let x = 0; x < 64; x++) {
      const col = x >> 4;
      const yy = (y + col * 24) % 64;
      let shade = hash(col, yy >> 5, 21) > 0.5 ? 1 : 0;
      if (hash(x, y >> 1, 22) > 0.85) shade = Math.min(2, shade + 1);
      if (x % 16 === 0 || yy % 32 === 0) shade = 3;
      else if (x % 16 === 1) shade = 2;
      img.data[y * 64 + x] = paletteIndex("birch", shade);
    }
  }
  return img;
}

/** Конторка дизайнеров: белая кирпичная стена, мятный плинтус. */
export function brickWallTile(): IndexedImage {
  const w = 64;
  const h = 96;
  const img = createImage(w, h);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      let idx: number;
      if (y >= h - 10) idx = paletteIndex("mint", y === h - 10 ? 0 : y >= h - 2 ? 3 : 1);
      else {
        const row = Math.floor(y / 8);
        const bx = (x + (row % 2) * 8) % 16;
        if (y % 8 === 7 || bx === 15) idx = paletteIndex("studio", 2);
        else idx = paletteIndex("studio", hash(x, y, 23) > 0.9 ? 1 : y % 8 === 0 ? 0 : hash(row, (x + (row % 2) * 8) >> 4, 24) > 0.7 ? 1 : 0);
      }
      img.data[y * w + x] = idx;
    }
  }
  return img;
}
