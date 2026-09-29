/**
 * Кольцевой буфер событий core → рендер, звук, UI. Память выделяется один раз:
 * события пишутся в типизированные массивы, в игровом цикле объекты не создаются.
 */
export const EV = {
  /** a — стол, value — сколько кукишей выплачено. */
  payout: 1,
  /** a — стол, value — кукиши за тап. */
  tap: 2,
  /** a — стол, b — ранг, value — цена. */
  hired: 3,
  /** a — стол-результат, b — новый ранг. */
  merged: 4,
  /** a — откуда, b — куда. */
  moved: 5,
  /** a, b — столы, которые поменялись. */
  swapped: 6,
  /** a — стол, value — возврат кукишей. */
  trashed: 7,
  /** b — ранг, открытый впервые. */
  rankUnlocked: 8,
  /** b — причина из DENY. */
  denied: 9,
} as const;

export type EvKind = (typeof EV)[keyof typeof EV];

export const DENY = {
  noMoney: 1,
  noSpace: 2,
  invalid: 3,
} as const;

export type DenyReason = (typeof DENY)[keyof typeof DENY];

export class EventQueue {
  readonly kind: Uint8Array;
  readonly a: Int16Array;
  readonly b: Int16Array;
  readonly value: Float64Array;
  private count = 0;
  /** Сколько событий потеряно из-за переполнения (для отладки; в норме 0). */
  dropped = 0;

  constructor(readonly capacity = 256) {
    this.kind = new Uint8Array(capacity);
    this.a = new Int16Array(capacity);
    this.b = new Int16Array(capacity);
    this.value = new Float64Array(capacity);
  }

  get length(): number {
    return this.count;
  }

  push(kind: EvKind, a = 0, b = 0, value = 0): void {
    if (this.count >= this.capacity) {
      this.dropped++;
      return;
    }
    const i = this.count++;
    this.kind[i] = kind;
    this.a[i] = a;
    this.b[i] = b;
    this.value[i] = value;
  }

  clear(): void {
    this.count = 0;
  }
}
