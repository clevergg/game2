/**
 * Частицы (кукиши, зелёные циферки) и всплывающие числа («+12,4 тыс.»).
 * Пулы фиксированного размера в формате struct-of-arrays: в кадре ничего не выделяется,
 * при переполнении переиспользуется самая старая частица.
 */
import { compactParts, type CompactParts, type NumberLocale } from "../i18n/format";
import type { Atlas } from "./atlas";
import type { Renderer } from "./renderer";

export class Particles {
  private readonly x: Float32Array;
  private readonly y: Float32Array;
  private readonly vx: Float32Array;
  private readonly vy: Float32Array;
  private readonly life: Float32Array;
  private readonly maxLife: Float32Array;
  private readonly gravity: Float32Array;
  private readonly scale: Float32Array;
  private readonly frame: Int16Array;
  private next = 0;

  constructor(readonly capacity = 256) {
    this.x = new Float32Array(capacity);
    this.y = new Float32Array(capacity);
    this.vx = new Float32Array(capacity);
    this.vy = new Float32Array(capacity);
    this.life = new Float32Array(capacity);
    this.maxLife = new Float32Array(capacity);
    this.gravity = new Float32Array(capacity);
    this.scale = new Float32Array(capacity);
    this.frame = new Int16Array(capacity);
  }

  spawn(
    frame: number,
    x: number,
    y: number,
    vx: number,
    vy: number,
    life: number,
    gravity: number,
    scale: number,
  ): void {
    const i = this.next;
    this.next = (this.next + 1) % this.capacity;
    this.frame[i] = frame;
    this.x[i] = x;
    this.y[i] = y;
    this.vx[i] = vx;
    this.vy[i] = vy;
    this.life[i] = life;
    this.maxLife[i] = life;
    this.gravity[i] = gravity;
    this.scale[i] = scale;
  }

  update(dt: number): void {
    for (let i = 0; i < this.capacity; i++) {
      const l = this.life[i] ?? 0;
      if (l <= 0) continue;
      this.life[i] = l - dt;
      this.vy[i] = (this.vy[i] ?? 0) + (this.gravity[i] ?? 0) * dt;
      this.x[i] = (this.x[i] ?? 0) + (this.vx[i] ?? 0) * dt;
      this.y[i] = (this.y[i] ?? 0) + (this.vy[i] ?? 0) * dt;
    }
  }

  draw(r: Renderer): void {
    for (let i = 0; i < this.capacity; i++) {
      const l = this.life[i] ?? 0;
      if (l <= 0) continue;
      const k = l / (this.maxLife[i] ?? 1);
      const s = this.scale[i] ?? 1;
      r.sprite(this.frame[i] ?? 0, this.x[i] ?? 0, this.y[i] ?? 0, s, s, k < 0.3 ? k / 0.3 : 1);
    }
  }
}

const MAX_CHARS = 16;

/** Всплывающие числа пиксельным шрифтом. Текст пишется кодами символов в предвыделенный буфер. */
export class FloatingNumbers {
  private readonly codes: Uint16Array;
  private readonly len: Uint8Array;
  private readonly x: Float32Array;
  private readonly y: Float32Array;
  private readonly life: Float32Array;
  private readonly scale: Float32Array;
  private readonly style: Uint8Array;
  private next = 0;
  private readonly parts: CompactParts = { int: 0, frac: -1, suffix: 0 };
  private readonly digits = new Uint8Array(20);
  private decimal = 0;
  private suffixes: Uint16Array[] = [];
  /** glyph[style] — отображение кода символа в кадр атласа. */
  private readonly glyphs: Map<number, number>[];
  private readonly glyphW: Int16Array;

  static readonly LIFE = 0.9;

  constructor(
    atlas: Atlas,
    styles: readonly string[],
    readonly capacity = 64,
  ) {
    this.codes = new Uint16Array(capacity * MAX_CHARS);
    this.len = new Uint8Array(capacity);
    this.x = new Float32Array(capacity);
    this.y = new Float32Array(capacity);
    this.life = new Float32Array(capacity);
    this.scale = new Float32Array(capacity);
    this.style = new Uint8Array(capacity);
    this.glyphW = atlas.w;
    this.glyphs = styles.map((st) => {
      const m = new Map<number, number>();
      for (let code = 32; code < 0x500; code++) {
        const name = `font_${st}_${code.toString(16)}`;
        if (atlas.has(name)) m.set(code, atlas.frame(name));
      }
      return m;
    });
  }

  /** Вызывается при смене языка: суффиксы и десятичный знак переводятся в коды заранее. */
  setLocale(loc: NumberLocale): void {
    this.decimal = loc.decimal.charCodeAt(0);
    this.suffixes = loc.suffixes.map((s) => Uint16Array.from(s, (ch) => ch.charCodeAt(0)));
  }

  private put(base: number, n: number, code: number): number {
    if (n >= MAX_CHARS) return n;
    this.codes[base + n] = code;
    return n + 1;
  }

  spawn(value: number, x: number, y: number, style: number, scale: number): void {
    const i = this.next;
    this.next = (this.next + 1) % this.capacity;
    const base = i * MAX_CHARS;
    let n = this.put(base, 0, 43); // «+»
    const p = compactParts(value, this.parts);
    let d = 0;
    let v = p.int;
    do {
      this.digits[d++] = v % 10;
      v = Math.floor(v / 10);
    } while (v > 0 && d < this.digits.length);
    while (d > 0) n = this.put(base, n, 48 + (this.digits[--d] ?? 0));
    if (p.frac >= 0) {
      n = this.put(base, n, this.decimal);
      n = this.put(base, n, 48 + p.frac);
    }
    const suf = this.suffixes[p.suffix];
    if (suf) for (let k = 0; k < suf.length; k++) n = this.put(base, n, suf[k] ?? 32);
    this.len[i] = n;
    this.x[i] = x;
    this.y[i] = y;
    this.life[i] = FloatingNumbers.LIFE;
    this.scale[i] = scale;
    this.style[i] = style;
  }

  update(dt: number): void {
    for (let i = 0; i < this.capacity; i++) {
      const l = this.life[i] ?? 0;
      if (l <= 0) continue;
      this.life[i] = l - dt;
      this.y[i] = (this.y[i] ?? 0) - 38 * dt;
    }
  }

  /** Статичное целое число (цифра ранга у стола): (x, y) — левый верхний угол. */
  drawInt(r: Renderer, value: number, x: number, y: number, scale: number, style: number): void {
    const map = this.glyphs[style];
    if (!map) return;
    let d = 0;
    let v = Math.max(0, Math.floor(value));
    do {
      this.digits[d++] = v % 10;
      v = Math.floor(v / 10);
    } while (v > 0 && d < this.digits.length);
    let cx = x;
    while (d > 0) {
      const f = map.get(48 + (this.digits[--d] ?? 0));
      if (f === undefined) continue;
      r.sprite(f, cx, y, scale, scale, 1);
      cx += ((this.glyphW[f] ?? 0) - 1) * scale;
    }
  }

  draw(r: Renderer): void {
    for (let i = 0; i < this.capacity; i++) {
      const l = this.life[i] ?? 0;
      if (l <= 0) continue;
      const map = this.glyphs[this.style[i] ?? 0];
      if (!map) continue;
      const s = this.scale[i] ?? 1;
      const n = this.len[i] ?? 0;
      const base = i * MAX_CHARS;
      let width = 0;
      for (let k = 0; k < n; k++)
        width += (this.glyphW[map.get(this.codes[base + k] ?? 0) ?? 0] ?? 0) - 1;
      let cx = (this.x[i] ?? 0) - (width * s) / 2;
      const alpha = l < 0.3 ? l / 0.3 : 1;
      // Первые 0.12 с число «выпрыгивает» чуть крупнее
      const pop = l > FloatingNumbers.LIFE - 0.12 ? 1.25 : 1;
      for (let k = 0; k < n; k++) {
        const f = map.get(this.codes[base + k] ?? 0);
        if (f === undefined) continue;
        r.sprite(f, cx, this.y[i] ?? 0, s * pop, s * pop, alpha);
        cx += ((this.glyphW[f] ?? 0) - 1) * s * pop;
      }
    }
  }
}
