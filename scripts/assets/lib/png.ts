/**
 * Кодировщик PNG с палитрой (8 бит на пиксель) и анимированного APNG.
 * Палитровый PNG для нашей графики в разы меньше полноцветного:
 * пиксель — один байт-индекс вместо четырёх байт RGBA.
 */
import { deflateSync, inflateSync } from "node:zlib";

export type Rgb = readonly [number, number, number];

const SIGNATURE = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]);

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c >>> 0;
  }
  return table;
})();

export function crc32(bytes: Uint8Array): number {
  let c = 0xffffffff;
  for (const b of bytes) c = (CRC_TABLE[(c ^ b) & 0xff] ?? 0) ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function u32(n: number): Uint8Array {
  return new Uint8Array([(n >>> 24) & 255, (n >>> 16) & 255, (n >>> 8) & 255, n & 255]);
}

function u16(n: number): Uint8Array {
  return new Uint8Array([(n >>> 8) & 255, n & 255]);
}

function concat(parts: readonly Uint8Array[]): Uint8Array<ArrayBuffer> {
  const total = parts.reduce((s, p) => s + p.length, 0);
  const out = new Uint8Array(total);
  let off = 0;
  for (const p of parts) {
    out.set(p, off);
    off += p.length;
  }
  return out;
}

function chunk(type: string, data: Uint8Array): Uint8Array {
  const typeBytes = new TextEncoder().encode(type);
  const body = concat([typeBytes, data]);
  return concat([u32(data.length), body, u32(crc32(body))]);
}

function ihdr(width: number, height: number): Uint8Array {
  // 8 бит, тип цвета 3 (палитра), сжатие 0, фильтр 0, без чересстрочности
  return chunk("IHDR", concat([u32(width), u32(height), new Uint8Array([8, 3, 0, 0, 0])]));
}

function paletteChunks(palette: readonly Rgb[], transparentIndex: number | null): Uint8Array[] {
  if (palette.length === 0 || palette.length > 256) throw new RangeError("Палитра: 1..256 цветов");
  const plte = new Uint8Array(palette.length * 3);
  palette.forEach(([r, g, b], i) => {
    plte.set([r, g, b], i * 3);
  });
  const chunks = [chunk("PLTE", plte)];
  if (transparentIndex !== null) {
    // tRNS: альфа для индексов 0..transparentIndex, остальные непрозрачные
    const trns = new Uint8Array(transparentIndex + 1).fill(255);
    trns[transparentIndex] = 0;
    chunks.push(chunk("tRNS", trns));
  }
  return chunks;
}

/**
 * Строки со служебным байтом фильтра. Для палитровых изображений спецификация PNG
 * советует фильтр «None»: индексы — не яркости, предсказание соседями не помогает.
 */
function rawRows(width: number, height: number, data: Uint8Array): Uint8Array {
  if (data.length !== width * height) throw new RangeError("Размер данных не совпадает с изображением");
  const out = new Uint8Array((width + 1) * height);
  for (let y = 0; y < height; y++) {
    out[y * (width + 1)] = 0;
    out.set(data.subarray(y * width, (y + 1) * width), y * (width + 1) + 1);
  }
  return out;
}

export interface IndexedPngInput {
  readonly width: number;
  readonly height: number;
  readonly data: Uint8Array;
  readonly palette: readonly Rgb[];
  readonly transparentIndex: number | null;
}

export function encodeIndexedPng(img: IndexedPngInput): Uint8Array<ArrayBuffer> {
  const idat = deflateSync(rawRows(img.width, img.height, img.data), { level: 9 });
  return concat([
    SIGNATURE,
    ihdr(img.width, img.height),
    ...paletteChunks(img.palette, img.transparentIndex),
    chunk("IDAT", idat),
    chunk("IEND", new Uint8Array(0)),
  ]);
}

export interface ApngInput {
  readonly width: number;
  readonly height: number;
  readonly frames: readonly Uint8Array[];
  readonly delayMs: number;
  readonly palette: readonly Rgb[];
  readonly transparentIndex: number | null;
}

/** Анимированный PNG: кадры полного размера, бесконечный повтор. Для превью ассетов. */
export function encodeApng(anim: ApngInput): Uint8Array<ArrayBuffer> {
  const { width, height, frames } = anim;
  if (frames.length === 0) throw new RangeError("APNG без кадров");
  const parts: Uint8Array[] = [SIGNATURE, ihdr(width, height)];
  parts.push(chunk("acTL", concat([u32(frames.length), u32(0)])));
  parts.push(...paletteChunks(anim.palette, anim.transparentIndex));
  let seq = 0;
  frames.forEach((frame, i) => {
    const fctl = concat([
      u32(seq++),
      u32(width),
      u32(height),
      u32(0),
      u32(0),
      u16(anim.delayMs),
      u16(1000),
      new Uint8Array([0, 0]), // dispose: none, blend: source
    ]);
    parts.push(chunk("fcTL", fctl));
    const compressed = deflateSync(rawRows(width, height, frame), { level: 9 });
    if (i === 0) parts.push(chunk("IDAT", compressed));
    else parts.push(chunk("fdAT", concat([u32(seq++), compressed])));
  });
  parts.push(chunk("IEND", new Uint8Array(0)));
  return concat(parts);
}

export interface DecodedPng {
  readonly width: number;
  readonly height: number;
  readonly data: Uint8Array;
  readonly palette: Rgb[];
  readonly chunkTypes: string[];
}

/** Декодер только для нашего формата (палитра, 8 бит, фильтр None). Нужен тестам. */
export function decodeIndexedPng(png: Uint8Array): DecodedPng {
  for (let i = 0; i < SIGNATURE.length; i++) {
    if (png[i] !== SIGNATURE[i]) throw new Error("Не PNG");
  }
  const view = new DataView(png.buffer, png.byteOffset, png.byteLength);
  let off = 8;
  let width = 0;
  let height = 0;
  const palette: Rgb[] = [];
  const idat: Uint8Array[] = [];
  const chunkTypes: string[] = [];
  while (off < png.length) {
    const len = view.getUint32(off);
    const type = new TextDecoder().decode(png.subarray(off + 4, off + 8));
    const data = png.subarray(off + 8, off + 8 + len);
    const crc = view.getUint32(off + 8 + len);
    if (crc !== crc32(png.subarray(off + 4, off + 8 + len))) throw new Error(`Битый CRC в ${type}`);
    chunkTypes.push(type);
    if (type === "IHDR") {
      width = view.getUint32(off + 8);
      height = view.getUint32(off + 12);
    } else if (type === "PLTE") {
      for (let i = 0; i < data.length; i += 3) palette.push([data[i] ?? 0, data[i + 1] ?? 0, data[i + 2] ?? 0]);
    } else if (type === "IDAT") {
      idat.push(data);
    }
    off += 12 + len;
  }
  const raw = inflateSync(concat(idat));
  const out = new Uint8Array(width * height);
  for (let y = 0; y < height; y++) {
    if (raw[y * (width + 1)] !== 0) throw new Error("Ожидался фильтр None");
    out.set(raw.subarray(y * (width + 1) + 1, (y + 1) * (width + 1)), y * width);
  }
  return { width, height, data: out, palette, chunkTypes };
}

export function hexToRgb(hex: string): Rgb {
  const n = Number.parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
