import { describe, expect, test } from "bun:test";
import { FONT_CHARS, glyphFrameName, glyphImage } from "./font";
import { packShelves } from "./pack";
import { crc32, decodeIndexedPng, encodeApng, encodeIndexedPng, hexToRgb, type Rgb } from "./png";
import { addOutline, blit, createImage, flipX, scaleNearest, trim } from "./raster";
import { bayer, shadeLevel } from "./shade";

const PALETTE: Rgb[] = [
  [0, 0, 0],
  [28, 22, 32],
  [255, 250, 240],
];

describe("png", () => {
  test("crc32 совпадает с эталоном", () => {
    expect(crc32(new TextEncoder().encode("IEND"))).toBe(0xae426082);
  });

  test("палитровый PNG: кодирование → декодирование без потерь", () => {
    const w = 7;
    const h = 5;
    const data = new Uint8Array(w * h).map((_, i) => i % 3);
    const png = encodeIndexedPng({ width: w, height: h, data, palette: PALETTE, transparentIndex: 0 });
    const back = decodeIndexedPng(png);
    expect(back.width).toBe(w);
    expect(back.height).toBe(h);
    expect(Array.from(back.data)).toEqual(Array.from(data));
    expect(back.palette).toEqual(PALETTE);
    expect(back.chunkTypes).toEqual(["IHDR", "PLTE", "tRNS", "IDAT", "IEND"]);
  });

  test("APNG содержит acTL, fcTL на каждый кадр и fdAT для кадров после первого", () => {
    const frame = new Uint8Array(4).fill(2);
    const png = encodeApng({
      width: 2,
      height: 2,
      frames: [frame, frame, frame],
      delayMs: 100,
      palette: PALETTE,
      transparentIndex: 0,
    });
    const types = decodeIndexedPng(png).chunkTypes;
    expect(types.filter((t) => t === "fcTL")).toHaveLength(3);
    expect(types.filter((t) => t === "fdAT")).toHaveLength(2);
    expect(types[1]).toBe("acTL");
  });

  test("отклоняет несоответствие размера данных", () => {
    expect(() =>
      encodeIndexedPng({ width: 3, height: 3, data: new Uint8Array(5), palette: PALETTE, transparentIndex: 0 }),
    ).toThrow(RangeError);
  });

  test("hexToRgb", () => {
    expect(hexToRgb("#1c1620")).toEqual([28, 22, 32]);
  });
});

describe("raster", () => {
  test("trim находит рамку непрозрачных пикселей", () => {
    const img = createImage(6, 6);
    img.data[2 * 6 + 3] = 5;
    img.data[4 * 6 + 1] = 5;
    const t = trim(img);
    expect([t.x, t.y, t.img.w, t.img.h]).toEqual([1, 2, 3, 3]);
  });

  test("trim пустого изображения даёт 1×1", () => {
    const t = trim(createImage(4, 4));
    expect([t.img.w, t.img.h]).toEqual([1, 1]);
  });

  test("обводка ставится только по 4-соседству вокруг непрозрачного", () => {
    const img = createImage(3, 3);
    img.data[4] = 7;
    const out = addOutline(img, 1);
    expect(Array.from(out.data)).toEqual([0, 1, 0, 1, 7, 1, 0, 1, 0]);
  });

  test("blit не затирает фон прозрачными пикселями", () => {
    const dst = createImage(2, 1);
    dst.data.fill(3);
    const src = createImage(2, 1);
    src.data[1] = 9;
    blit(dst, src, 0, 0);
    expect(Array.from(dst.data)).toEqual([3, 9]);
  });

  test("scaleNearest и flipX", () => {
    const img = createImage(2, 1);
    img.data.set([1, 2]);
    expect(Array.from(scaleNearest(img, 2).data)).toEqual([1, 1, 2, 2, 1, 1, 2, 2]);
    expect(Array.from(flipX(img).data)).toEqual([2, 1]);
  });
});

describe("pack", () => {
  test("прямоугольники не пересекаются и помещаются в атлас", () => {
    const items = Array.from({ length: 60 }, (_, i) => ({ w: 10 + ((i * 7) % 40), h: 12 + ((i * 11) % 50) }));
    const res = packShelves(items, 256, 1);
    items.forEach((a, i) => {
      const pa = res.positions[i];
      expect(pa).toBeDefined();
      if (!pa) return;
      expect(pa.x + a.w).toBeLessThanOrEqual(res.width);
      expect(pa.y + a.h).toBeLessThanOrEqual(res.height);
      items.forEach((b, j) => {
        const pb = res.positions[j];
        if (j <= i || !pb) return;
        const overlap = pa.x < pb.x + b.w && pb.x < pa.x + a.w && pa.y < pb.y + b.h && pb.y < pa.y + a.h;
        expect(overlap).toBe(false);
      });
    });
    expect(res.width % 4).toBe(0);
    expect(res.height % 4).toBe(0);
  });

  test("слишком широкий кадр — ошибка", () => {
    expect(() => packShelves([{ w: 300, h: 10 }], 256, 1)).toThrow(RangeError);
  });
});

describe("shade", () => {
  test("яркий свет → светлый оттенок, тень → тёмный", () => {
    expect(shadeLevel(2, 0, 0, 0)).toBe(0);
    expect(shadeLevel(0, 0, 0, 0)).toBe(3);
  });

  test("bias сдвигает оттенок, результат всегда в 0..3", () => {
    for (let i = 0; i <= 20; i++) {
      const s = shadeLevel(i / 10, i, i * 3, 1.5);
      expect(s).toBeGreaterThanOrEqual(0);
      expect(s).toBeLessThanOrEqual(3);
    }
  });

  test("матрица Байера даёт 16 разных порогов в (0,1)", () => {
    const v = new Set<number>();
    for (let y = 0; y < 4; y++) for (let x = 0; x < 4; x++) v.add(bayer(x, y));
    expect(v.size).toBe(16);
    for (const t of v) expect(t > 0 && t < 1).toBe(true);
  });
});

describe("font", () => {
  test("все глифы строятся, у всех одинаковая высота", () => {
    for (const ch of FONT_CHARS) {
      const g = glyphImage(ch, 2, 1);
      expect(g.h).toBe(9);
      if (ch !== " ") expect(g.data.some((v) => v === 1)).toBe(true);
    }
  });

  test("имя кадра не зависит от кириллицы", () => {
    expect(glyphFrameName("gold", "т")).toBe("font_gold_442");
  });
});
