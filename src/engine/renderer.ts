/**
 * Рендер на Canvas2D. Координаты — CSS-пиксели; плотность экрана ограничена 2
 * (на экранах 3× разница почти незаметна, а пикселей на 44% меньше).
 * Пиксель-арт рисуется без сглаживания, позиции округляются до физических пикселей.
 */
import type { Atlas } from "./atlas";

export const MAX_DPR = 2;

export interface Renderer {
  resize(cssW: number, cssH: number, dpr: number): void;
  begin(shakeX: number, shakeY: number): void;
  /** Кадр атласа: якорь кадра попадает в (x, y); sx/sy — масштаб по осям. */
  sprite(frame: number, x: number, y: number, sx: number, sy: number, alpha: number): void;
  /** Заливка прямоугольника тайлом из атласа (пол, стена). */
  tile(frame: number, x: number, y: number, w: number, h: number, scale: number): void;
  ellipse(x: number, y: number, rx: number, ry: number, color: string, alpha: number): void;
}

export class CanvasRenderer implements Renderer {
  private readonly ctx: CanvasRenderingContext2D;
  private dpr = 1;
  private readonly patterns = new Map<number, CanvasPattern>();
  private readonly matrix = new DOMMatrix();

  constructor(
    private readonly canvas: HTMLCanvasElement,
    private readonly atlas: Atlas,
  ) {
    const ctx = canvas.getContext("2d", { alpha: false });
    if (!ctx) throw new Error("Canvas2D недоступен");
    this.ctx = ctx;
  }

  resize(cssW: number, cssH: number, dpr: number): void {
    this.dpr = Math.min(dpr, MAX_DPR);
    this.canvas.width = Math.round(cssW * this.dpr);
    this.canvas.height = Math.round(cssH * this.dpr);
    // После смены размера канваса настройки контекста сбрасываются
    this.ctx.imageSmoothingEnabled = false;
  }

  begin(shakeX: number, shakeY: number): void {
    const d = this.dpr;
    this.ctx.setTransform(d, 0, 0, d, Math.round(shakeX * d), Math.round(shakeY * d));
    this.ctx.globalAlpha = 1;
  }

  private snap(v: number): number {
    return Math.round(v * this.dpr) / this.dpr;
  }

  sprite(frame: number, x: number, y: number, sx: number, sy: number, alpha: number): void {
    const a = this.atlas;
    const w = a.w[frame] ?? 0;
    const h = a.h[frame] ?? 0;
    const image = a.imageOf(frame);
    if (w === 0 || alpha <= 0 || !image) return;
    const ax = a.ax[frame] ?? 0;
    const ay = a.ay[frame] ?? 0;
    const flip = sx < 0;
    const asx = flip ? -sx : sx;
    const dw = w * asx;
    const dh = h * sy;
    const dy = this.snap(y - ay * sy);
    this.ctx.globalAlpha = alpha;
    if (flip) {
      this.ctx.save();
      this.ctx.translate(this.snap(x), 0);
      this.ctx.scale(-1, 1);
      this.ctx.drawImage(image, a.x[frame] ?? 0, a.y[frame] ?? 0, w, h, -ax * asx, dy, dw, dh);
      this.ctx.restore();
    } else {
      this.ctx.drawImage(
        image,
        a.x[frame] ?? 0,
        a.y[frame] ?? 0,
        w,
        h,
        this.snap(x - ax * asx),
        dy,
        dw,
        dh,
      );
    }
    this.ctx.globalAlpha = 1;
  }

  private pattern(frame: number): CanvasPattern | null {
    let p = this.patterns.get(frame);
    if (!p) {
      const a = this.atlas;
      const image = a.imageOf(frame);
      if (!image) return null;
      const c = document.createElement("canvas");
      c.width = a.w[frame] ?? 1;
      c.height = a.h[frame] ?? 1;
      const cctx = c.getContext("2d");
      if (!cctx) return null;
      cctx.drawImage(
        image,
        a.x[frame] ?? 0,
        a.y[frame] ?? 0,
        c.width,
        c.height,
        0,
        0,
        c.width,
        c.height,
      );
      const created = this.ctx.createPattern(c, "repeat");
      if (!created) return null;
      p = created;
      this.patterns.set(frame, p);
    }
    return p;
  }

  tile(frame: number, x: number, y: number, w: number, h: number, scale: number): void {
    const p = this.pattern(frame);
    if (!p) return;
    this.matrix.a = scale;
    this.matrix.d = scale;
    this.matrix.e = x;
    this.matrix.f = y;
    p.setTransform(this.matrix);
    this.ctx.fillStyle = p;
    this.ctx.fillRect(x, y, w, h);
  }

  ellipse(x: number, y: number, rx: number, ry: number, color: string, alpha: number): void {
    this.ctx.globalAlpha = alpha;
    this.ctx.fillStyle = color;
    this.ctx.beginPath();
    this.ctx.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2);
    this.ctx.fill();
    this.ctx.globalAlpha = 1;
  }
}
