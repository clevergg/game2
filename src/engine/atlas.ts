/**
 * Атлас спрайтов: картинка + таблица кадров. Имена кадров переводятся в числовые индексы
 * один раз при загрузке; в игровом цикле используются только индексы и типизированные массивы.
 */
export interface AtlasJson {
  readonly w: number;
  readonly h: number;
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
  private readonly index = new Map<string, number>();
  private readonly anims = new Map<string, Anim>();

  constructor(
    readonly image: HTMLImageElement,
    data: AtlasJson,
  ) {
    const names = Object.keys(data.frames);
    const n = names.length;
    this.x = new Int16Array(n);
    this.y = new Int16Array(n);
    this.w = new Int16Array(n);
    this.h = new Int16Array(n);
    this.ax = new Int16Array(n);
    this.ay = new Int16Array(n);
    names.forEach((name, i) => {
      const r = data.frames[name];
      if (!r || r.length !== 6) throw new Error(`Кадр ${name}: неверный формат`);
      this.index.set(name, i);
      this.x[i] = r[0] ?? 0;
      this.y[i] = r[1] ?? 0;
      this.w[i] = r[2] ?? 0;
      this.h[i] = r[3] ?? 0;
      this.ax[i] = r[4] ?? 0;
      this.ay[i] = r[5] ?? 0;
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

export async function loadAtlas(url: string, data: AtlasJson): Promise<Atlas> {
  const img = new Image();
  img.src = url;
  await img.decode();
  return new Atlas(img, data);
}
