/**
 * Пауза по причинам: скрытая вкладка, наша реклама, внешняя пауза платформы (game_api_pause).
 * Игра идёт, только когда нет ни одной причины — так причины не «размораживают» друг друга
 * (например, конец рекламы при свёрнутой вкладке не запускает звук).
 */
export const PAUSE = { hidden: 1, ad: 2, external: 4 } as const;

export class Pauser {
  private reasons = 0;

  constructor(private readonly apply: (paused: boolean) => void) {}

  set(reason: number, on: boolean): void {
    const was = this.reasons !== 0;
    this.reasons = on ? this.reasons | reason : this.reasons & ~reason;
    const now = this.reasons !== 0;
    if (was !== now) this.apply(now);
  }

  get paused(): boolean {
    return this.reasons !== 0;
  }
}
