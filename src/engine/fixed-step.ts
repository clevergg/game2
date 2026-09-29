/**
 * Накопитель фиксированного шага симуляции.
 *
 * Кадры браузера приходят с плавающим интервалом (16.7 мс, 33 мс, иногда 200 мс),
 * а логике нужен стабильный шаг, чтобы экономика считалась одинаково на любом устройстве.
 * Время кадра копится, и накопитель отвечает, сколько целых шагов симуляции прогнать.
 * Остаток переходит в следующий кадр, а `alpha` нужен рендеру для сглаживания.
 */
export class FixedStep {
  private accumulatedMs = 0;

  constructor(
    readonly stepMs: number,
    /** Потолок одного кадра: после зависания не прогоняем сотни шагов подряд. */
    readonly maxFrameMs: number,
  ) {
    if (stepMs <= 0) throw new RangeError("stepMs должен быть > 0");
    if (maxFrameMs < stepMs) throw new RangeError("maxFrameMs должен быть >= stepMs");
  }

  /** Добавляет время кадра и возвращает число шагов симуляции для этого кадра. */
  advance(frameMs: number): number {
    const clamped = Math.min(Math.max(frameMs, 0), this.maxFrameMs);
    this.accumulatedMs += clamped;
    const steps = Math.floor(this.accumulatedMs / this.stepMs);
    this.accumulatedMs -= steps * this.stepMs;
    return steps;
  }

  /** Доля следующего шага, уже накопленная в остатке (0..1). */
  get alpha(): number {
    return this.accumulatedMs / this.stepMs;
  }

  reset(): void {
    this.accumulatedMs = 0;
  }
}
