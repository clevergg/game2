/**
 * Раскладка экрана: где стоят столы, какой масштаб у спрайтов, где слоповина.
 * Чистая функция от размера экрана — пересчитывается при повороте и ресайзе, покрыта тестами.
 * Портрет — основной режим; на широком экране игра занимает центральную колонку.
 */
export const HUD_TOP = 64;
export const HUD_BOTTOM = 104;
const MAX_CONTENT_W = 520;

export interface Layout {
  readonly w: number;
  readonly h: number;
  readonly cols: number;
  readonly rows: number;
  /** Масштаб спрайтов (CSS-пикселей на пиксель атласа). */
  readonly scale: number;
  /** Якоря столов (точка на полу перед столом). */
  readonly deskX: Float32Array;
  readonly deskY: Float32Array;
  readonly slopX: number;
  readonly slopY: number;
  readonly contentLeft: number;
  readonly contentW: number;
}

export interface SpriteMetrics {
  /** Ширина стола в пикселях атласа. */
  readonly deskW: number;
  /** Высота стола над якорем в пикселях атласа. */
  readonly deskTop: number;
  /** Высота типичного батракана над якорем стола (с креслом и усиками). */
  readonly charTop: number;
}

/** Доля высоты ряда, которую занимает стол; остальное — проход между рядами. */
const ROW_FILL = 0.92;

export function columnsFor(deskCount: number): number {
  return deskCount <= 8 ? 2 : 3;
}

export function computeLayout(
  w: number,
  h: number,
  deskCount: number,
  deskMax: number,
  m: SpriteMetrics,
): Layout {
  const contentW = Math.min(w, MAX_CONTENT_W);
  const contentLeft = (w - contentW) / 2;
  const cols = columnsFor(deskCount);
  const rows = Math.ceil(deskCount / cols);
  const available = Math.max(1, h - HUD_TOP - HUD_BOTTOM);
  const cellW = contentW / cols;
  // Над первым рядом нужен запас под рост батракана, иначе головы уходят под верхнюю панель.
  // Остальные ряды могут перекрываться головами — это «глубина» офиса.
  const extra = Math.max(0, m.charTop - m.deskTop);
  const byHeight = available / ((rows * m.deskTop) / ROW_FILL + extra);
  const byWidth = (cellW * 0.8) / m.deskW;
  const scale = Math.min(2.4, Math.max(0.5, Math.min(byHeight, byWidth)));
  const headroom = extra * scale;
  const areaTop = HUD_TOP + headroom;
  const rowH = (available - headroom) / rows;
  const deskX = new Float32Array(deskMax);
  const deskY = new Float32Array(deskMax);
  // Свободный зазор ряда делится поровну сверху и снизу стола
  const gap = Math.max(0, rowH - m.deskTop * scale);
  for (let i = 0; i < deskMax; i++) {
    const c = i % cols;
    const r = Math.floor(i / cols);
    deskX[i] = contentLeft + (c + 0.5) * cellW;
    deskY[i] = areaTop + r * rowH + m.deskTop * scale + gap / 2;
  }
  return {
    w,
    h,
    cols,
    rows,
    scale,
    deskX,
    deskY,
    slopX: contentLeft + 46,
    slopY: h - 18,
    contentLeft,
    contentW,
  };
}
