/**
 * Атлас спрайтов: несколько листов-картинок + общая таблица кадров. Имена кадров переводятся
 * в числовые индексы один раз при старте; в игровом цикле — только индексы и типизированные массивы.
 * Таблица известна сразу для всех листов, а сами картинки листов этажей грузятся лениво:
 * пока лист не загружен, его кадры просто не рисуются.
 */
export interface AtlasJson {
  readonly sheets: readonly { readonly image: string; readonly w: number; readonly h: number }[];
  readonly ppu: number;
  readonly frames: Readonly<Record<string, readonly number[]>>;
  readonly anims: Readonly<
    Record<
      string,
      { readonly frames: readonly string[]; readonly fps: number; readonly loop: boolean }
    >
  >;
}

export interface Anim {
  readonly frames: Int16Array;
  readonly fps: number;
  readonly loop: boolean;
}

export class Atlas {
  readonly x: Int16Array;
  readonly y: Int16Array;
  readonly w: Int16Array;
  readonly h: Int16Array;
  readonly ax: Int16Array;
  readonly ay: Int16Array;
  /** Номер листа каждого кадра. */
  readonly sheet: Uint8Array;
  /** Картинки листов; null — ещё не загружен. */
  readonly images: (HTMLImageElement | null)[];
  private readonly loading: (Promise<void> | null)[];
  private readonly index = new Map<string, number>();
  private readonly anims = new Map<string, Anim>();

  constructor(
    data: AtlasJson,
    /** Адреса картинок листов (после бандлера — с хешем в имени). */
    private readonly urls: readonly string[],
  ) {
    if (urls.length !== data.sheets.length) throw new Error("Число листов атласа не совпадает");
    this.images = urls.map(() => null);
    this.loading = urls.map(() => null);
    const names = Object.keys(data.frames);
    const n = names.length;
    this.x = new Int16Array(n);
    this.y = new Int16Array(n);
    this.w = new Int16Array(n);
    this.h = new Int16Array(n);
    this.ax = new Int16Array(n);
    this.ay = new Int16Array(n);
    this.sheet = new Uint8Array(n);
    names.forEach((name, i) => {
      const r = data.frames[name];
      if (!r || r.length !== 7) throw new Error(`Кадр ${name}: неверный формат`);
      this.index.set(name, i);
      this.x[i] = r[0] ?? 0;
      this.y[i] = r[1] ?? 0;
      this.w[i] = r[2] ?? 0;
      this.h[i] = r[3] ?? 0;
      this.ax[i] = r[4] ?? 0;
      this.ay[i] = r[5] ?? 0;
      const sheet = r[6] ?? 0;
      if (sheet >= urls.length) throw new Error(`Кадр ${name}: нет листа ${sheet}`);
      this.sheet[i] = sheet;
    });
    for (const [name, a] of Object.entries(data.anims)) {
      this.anims.set(name, {
        frames: Int16Array.from(a.frames, (f) => this.frame(f)),
        fps: a.fps,
        loop: a.loop,
      });
    }
  }

  /** Индекс кадра по имени. Отсутствующий кадр — ошибка сразу при старте, а не тихий пропуск. */
  frame(name: string): number {
    const i = this.index.get(name);
    if (i === undefined) throw new Error(`Нет кадра «${name}» в атласе`);
    return i;
  }

  /** Картинка листа кадра или null, если лист ещё не загружен. */
  imageOf(frame: number): HTMLImageElement | null {
    return this.images[this.sheet[frame] ?? 0] ?? null;
  }

  isLoaded(sheet: number): boolean {
    return (this.images[sheet] ?? null) !== null;
  }

  /** Загружает лист (повторные вызовы возвращают тот же промис). Ошибка сети не роняет игру. */
  load(sheet: number): Promise<void> {
    const existing = this.loading[sheet];
    if (existing) return existing;
    const url = this.urls[sheet];
    if (url === undefined) return Promise.resolve();
    const p = (async () => {
      const img = new Image();
      img.src = url;
      try {
        await img.decode();
        this.images[sheet] = img;
      } catch {
        // Повторим при следующем запросе
        this.loading[sheet] = null;
      }
    })();
    this.loading[sheet] = p;
    return p;
  }

  has(name: string): boolean {
    return this.index.has(name);
  }

  anim(name: string): Anim {
    const a = this.anims.get(name);
    if (!a) throw new Error(`Нет анимации «${name}» в атласе`);
    return a;
  }

  /** Кадр анимации для времени t (секунды). */
  static frameAt(a: Anim, t: number): number {
    const k = Math.floor(t * a.fps);
    const i = a.loop ? k % a.frames.length : Math.min(k, a.frames.length - 1);
    return a.frames[i] ?? 0;
  }
}

/** Создаёт атлас и дожидается основного листа (интерфейс + первый этаж). */
export async function loadAtlas(urls: readonly string[], data: AtlasJson): Promise<Atlas> {
  const atlas = new Atlas(data, urls);
  await atlas.load(0);
  if (!atlas.isLoaded(0)) throw new Error("Не удалось загрузить атлас");
  return atlas;
}
