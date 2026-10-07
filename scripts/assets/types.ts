/** Данные, которые страница-генератор возвращает скрипту сборки ассетов. */
export interface GenImage {
  readonly w: number;
  readonly h: number;
  /** Индексы палитры, base64. */
  readonly b64: string;
}

/** Кадр в атласе: x, y, w, h, ax, ay (якорь внутри кадра, в пикселях), номер листа. */
export type FrameRect = readonly [number, number, number, number, number, number, number];

export interface AnimMeta {
  readonly frames: readonly string[];
  readonly fps: number;
  readonly loop: boolean;
}

export interface GenResult {
  /** Листы атласа: 0 — общий + этаж 1, дальше — по этажу на лист. */
  readonly atlases: readonly GenImage[];
  readonly ppu: number;
  readonly frames: Record<string, FrameRect>;
  readonly anims: Record<string, AnimMeta>;
  readonly sheet: GenImage;
  /** Раскадровка анимаций для проверки поз. */
  readonly animSheet: GenImage;
  readonly office: { readonly w: number; readonly h: number; readonly frames: readonly string[]; readonly delayMs: number };
  /** Три этажа рядом и NPC с иконками — превью Фазы 6. */
  readonly floors: GenImage;
  readonly cast: GenImage;
  readonly stats: { readonly renderMs: number; readonly frameCount: number };
}
