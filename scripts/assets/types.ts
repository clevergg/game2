/** Данные, которые страница-генератор возвращает скрипту сборки ассетов. */
export interface GenImage {
  readonly w: number;
  readonly h: number;
  /** Индексы палитры, base64. */
  readonly b64: string;
}

/** Кадр в атласе: x, y, w, h, ax, ay (якорь внутри кадра, в пикселях). */
export type FrameRect = readonly [number, number, number, number, number, number];

export interface AnimMeta {
  readonly frames: readonly string[];
  readonly fps: number;
  readonly loop: boolean;
}

export interface GenResult {
  readonly atlas: GenImage;
  readonly ppu: number;
  readonly frames: Record<string, FrameRect>;
  readonly anims: Record<string, AnimMeta>;
  readonly sheet: GenImage;
  /** Раскадровка анимаций для проверки поз. */
  readonly animSheet: GenImage;
  readonly office: { readonly w: number; readonly h: number; readonly frames: readonly string[]; readonly delayMs: number };
  readonly stats: { readonly renderMs: number; readonly frameCount: number };
}
