import { describe, expect, test } from "bun:test";
import { inflateRawSync } from "node:zlib";
import { checkPack } from "./rules";
import { crc32, zip } from "./zip";

const enc = (s: string): Uint8Array => new TextEncoder().encode(s);

describe("архив для Яндекс Игр", () => {
  test("crc32 совпадает с эталоном", () => {
    expect(crc32(enc("123456789"))).toBe(0xcbf43926);
  });

  test("zip: правильные сигнатуры и данные распаковываются обратно", () => {
    const data = enc("<!doctype html>".repeat(50));
    const z = zip([{ name: "index.html", data }]);
    const v = new DataView(z.buffer);
    expect(v.getUint32(0, true)).toBe(0x04034b50);
    expect(v.getUint32(z.length - 22, true)).toBe(0x06054b50);
    const nameLen = v.getUint16(26, true);
    const size = v.getUint32(18, true);
    const packed = z.subarray(30 + nameLen, 30 + nameLen + size);
    expect(Array.from(inflateRawSync(packed))).toEqual(Array.from(data));
    // Одинаковый вход — побайтно одинаковый архив
    expect(zip([{ name: "index.html", data }])).toEqual(z);
  });

  test("проверки: корень, имена, внешние домены, SDK", () => {
    const ok = [
      { name: "index.html", data: enc("<html>") },
      { name: "a.js", data: enc('load("/sdk.js");"http://www.w3.org/2000/svg"') },
    ];
    expect(checkPack(ok)).toEqual([]);
    expect(checkPack([{ name: "a.js", data: enc('"/sdk.js"') }])).toContain(
      "нет index.html в корне архива",
    );
    const bad = checkPack([
      ...ok,
      { name: "b c.js", data: enc('fetch("https://evil.example.com/x")') },
    ]);
    expect(bad.some((p) => p.includes("недопустимое имя"))).toBe(true);
    expect(bad.some((p) => p.includes("evil.example.com"))).toBe(true);
    expect(checkPack([{ name: "index.html", data: enc("") }])).toContain(
      "в коде нет подключения SDK по пути /sdk.js",
    );
  });
});
