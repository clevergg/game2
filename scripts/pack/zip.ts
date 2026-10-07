/**
 * Минимальный ZIP-архиватор (deflate) без внешних зависимостей и системных утилит:
 * одинаково работает на Windows, macOS и Linux. Формат — PKWARE APPNOTE, без ZIP64
 * (архив игры на порядки меньше 4 ГБ).
 */
import { deflateRawSync } from "node:zlib";
import { crc32 } from "../assets/lib/png";

export { crc32 };

export interface ZipEntry {
  /** Путь внутри архива через «/». */
  readonly name: string;
  readonly data: Uint8Array;
}

/** Фиксированная дата файлов (1980-01-01): архив побайтно одинаков от сборки к сборке. */
const DOS_TIME = 0;
const DOS_DATE = (0 << 9) | (1 << 5) | 1;

export function zip(entries: readonly ZipEntry[]): Uint8Array {
  const local: Uint8Array[] = [];
  const central: Uint8Array[] = [];
  let offset = 0;
  for (const e of entries) {
    const name = new TextEncoder().encode(e.name);
    const packed = deflateRawSync(e.data, { level: 9 });
    const crc = crc32(e.data);
    const head = new Uint8Array(30 + name.length);
    const h = new DataView(head.buffer);
    h.setUint32(0, 0x04034b50, true);
    h.setUint16(4, 20, true); // версия для распаковки
    h.setUint16(6, 0x0800, true); // имена в UTF-8
    h.setUint16(8, 8, true); // deflate
    h.setUint16(10, DOS_TIME, true);
    h.setUint16(12, DOS_DATE, true);
    h.setUint32(14, crc, true);
    h.setUint32(18, packed.length, true);
    h.setUint32(22, e.data.length, true);
    h.setUint16(26, name.length, true);
    head.set(name, 30);
    local.push(head, packed);

    const dir = new Uint8Array(46 + name.length);
    const d = new DataView(dir.buffer);
    d.setUint32(0, 0x02014b50, true);
    d.setUint16(4, 20, true);
    d.setUint16(6, 20, true);
    d.setUint16(8, 0x0800, true);
    d.setUint16(10, 8, true);
    d.setUint16(12, DOS_TIME, true);
    d.setUint16(14, DOS_DATE, true);
    d.setUint32(16, crc, true);
    d.setUint32(20, packed.length, true);
    d.setUint32(24, e.data.length, true);
    d.setUint16(28, name.length, true);
    d.setUint32(42, offset, true);
    dir.set(name, 46);
    central.push(dir);
    offset += head.length + packed.length;
  }
  const dirSize = central.reduce((s, c) => s + c.length, 0);
  const end = new Uint8Array(22);
  const v = new DataView(end.buffer);
  v.setUint32(0, 0x06054b50, true);
  v.setUint16(8, entries.length, true);
  v.setUint16(10, entries.length, true);
  v.setUint32(12, dirSize, true);
  v.setUint32(16, offset, true);
  const parts = [...local, ...central, end];
  const out = new Uint8Array(parts.reduce((s, p) => s + p.length, 0));
  let at = 0;
  for (const p of parts) {
    out.set(p, at);
    at += p.length;
  }
  return out;
}
