/** Что интерфейс может попросить у игры. Реализация — в game/app.ts (команды core, реклама, окна). */
import type { HrTab, PanelKind } from "./store";

export interface UiActions {
  readonly hire: () => void;
  /** Найм «по блату» за рекламу, когда не хватает кукишей. */
  readonly hireBlat: () => void;
  readonly toggleMute: () => void;
  // Лифт
  readonly setFloor: (floor: number) => void;
  readonly unlockFloor: () => void;
  // Окна
  readonly openPanel: (panel: PanelKind) => void;
  readonly setTab: (tab: HrTab) => void;
  readonly closeModal: () => void;
  // Отдел квадров
  readonly buyQual: () => void;
  readonly buyEquip: () => void;
  readonly buyDesk: () => void;
  readonly buyPerk: (i: number) => void;
  readonly askReorg: () => void;
  readonly reorganize: () => void;
  // Поручения и аванс
  readonly claimTask: (i: number) => void;
  readonly claimAvans: () => void;
  // Смена и отгул
  readonly openShift: () => void;
  readonly claimShift: (doubled: boolean) => void;
  readonly claimOtgul: (doubled: boolean) => void;
  // Реклама за баффы
  readonly askPremia: () => void;
  readonly askColoid: () => void;
  readonly watchPremia: () => void;
  readonly watchColoid: () => void;
  // Кредик
  readonly acceptKredik: () => void;
  readonly declineKredik: () => void;
}
