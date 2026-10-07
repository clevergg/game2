/**
 * Кольцевой буфер событий core → рендер, звук, UI. Память выделяется один раз:
 * события пишутся в типизированные массивы, в игровом цикле объекты не создаются.
 */
export const EV = {
  /** f, a — стол, b — ранг, value — сколько выплачено. */
  payout: 1,
  /** f, a — стол, value — кукиши за тап. */
  tap: 2,
  /** f, a — стол, b — ранг, value — цена. */
  hired: 3,
  /** f, a — стол-результат, b — новый ранг. */
  merged: 4,
  /** f, a — откуда, b — куда. */
  moved: 5,
  /** f, a, b — столы, которые поменялись. */
  swapped: 6,
  /** f, a — стол, b — ранг, value — возврат. */
  trashed: 7,
  /** f, b — ранг, впервые открытый на этаже. */
  rankUnlocked: 8,
  /** b — причина из DENY. */
  denied: 9,
  /** f, a — стол, b — ранг: появился премированный батракан. */
  rareAppeared: 10,
  /** f, b — новый уровень квалификации. */
  qualBought: 11,
  /** f, b — новый уровень оснащения. */
  equipBought: 12,
  /** f, b — новое число столов. */
  deskBought: 13,
  /** f — открытый этаж. */
  floorUnlocked: 14,
  /** b — сколько выслуги получено. */
  reorganized: 15,
  /** a — индекс перка, b — новый уровень. */
  perkBought: 16,
} as const;

export type EvKind = (typeof EV)[keyof typeof EV];

export const DENY = {
  noMoney: 1,
  noSpace: 2,
  invalid: 3,
  maxed: 4,
  locked: 5,
} as const;

export type DenyReason = (typeof DENY)[keyof typeof DENY];

export class EventQueue {
  readonly kind: Uint8Array;
  readonly f: Int8Array;
  readonly a: Int16Array;
  readonly b: Int16Array;
  readonly value: Float64Array;
  private count = 0;
  /** Сколько событий потеряно из-за переполнения (для отладки; в норме 0). */
  dropped = 0;

  constructor(readonly capacity = 256) {
    this.kind = new Uint8Array(capacity);
    this.f = new Int8Array(capacity);
    this.a = new Int16Array(capacity);
    this.b = new Int16Array(capacity);
    this.value = new Float64Array(capacity);
  }

  get length(): number {
    return this.count;
  }

  push(kind: EvKind, f = 0, a = 0, b = 0, value = 0): void {
    if (this.count >= this.capacity) {
      this.dropped++;
      return;
    }
    const i = this.count++;
    this.kind[i] = kind;
    this.f[i] = f;
    this.a[i] = a;
    this.b[i] = b;
    this.value[i] = value;
  }

  clear(): void {
    this.count = 0;
  }
}
