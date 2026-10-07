/**
 * Мост игра → UI. Игра публикует лёгкий снимок раз в 100 мс; компоненты подписываются хуком
 * и перерисовываются только если значение изменилось. Состояние игры в Preact не живёт.
 */
import { useEffect, useState } from "preact/hooks";

export class Store<T extends object> {
  private state: T;
  private readonly listeners = new Set<() => void>();

  constructor(initial: T) {
    this.state = initial;
  }

  get(): T {
    return this.state;
  }

  set(patch: Partial<T>): void {
    let changed = false;
    for (const k of Object.keys(patch) as (keyof T)[]) {
      if (!Object.is(this.state[k], patch[k])) {
        changed = true;
        break;
      }
    }
    if (!changed) return;
    this.state = { ...this.state, ...patch };
    for (const fn of this.listeners) fn();
  }

  subscribe(fn: () => void): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }
}

export function useStore<T extends object>(store: Store<T>): T {
  const [, force] = useState(0);
  const snapshot = store.get();
  useEffect(() => {
    const unsubscribe = store.subscribe(() => {
      force((n) => n + 1);
    });
    // Эффект запускается после отрисовки: если снимок успел смениться до подписки,
    // без этой проверки UI застрял бы на старом значении до следующего изменения.
    if (store.get() !== snapshot) force((n) => n + 1);
    return unsubscribe;
  }, [store]);
  return snapshot;
}

export type HintKind = "tap" | "hire" | "merge";

export type PanelKind = "none" | "hr" | "tasks";
export type HrTab = "floor" | "alesya" | "cards" | "board";

export interface BoardView {
  readonly status: "loading" | "ready" | "none";
  readonly entries: readonly {
    readonly rank: number;
    readonly name: string;
    readonly score: number;
    readonly me: boolean;
  }[];
  readonly myRank: number;
  readonly myScore: number;
  readonly canLogin: boolean;
}

export type Modal =
  | { readonly kind: "shift"; readonly reward: number }
  | { readonly kind: "otgul"; readonly amount: number }
  | { readonly kind: "avans"; readonly reward: number; readonly streak: number }
  | { readonly kind: "reorg"; readonly gain: number }
  | { readonly kind: "premia"; readonly mult: number }
  | { readonly kind: "coloid" };

export interface Toast {
  readonly id: number;
  readonly title: string;
  readonly text: string;
}

export interface ShiftView {
  /** Тип плана (PLAN) или −1 — перекур. */
  readonly type: number;
  readonly target: number;
  readonly progress: number;
  readonly reward: number;
  readonly wait: number;
}

export interface ChallengeView {
  readonly kind: "shabashka" | "inspection";
  readonly left: number;
  readonly have: number;
  readonly need: number;
}

export interface HrView {
  readonly qual: number;
  readonly qualMax: number;
  readonly qualCost: number;
  readonly equip: number;
  readonly equipCost: number;
  readonly equipPct: number;
  readonly deskCount: number;
  readonly desksMax: number;
  readonly deskCost: number;
  readonly seniority: number;
  readonly seniorityPct: number;
  readonly stamps: number;
  readonly reorgGain: number;
  /** Сколько ещё заработать за забег до первой выслуги (0 — уже можно). */
  readonly reorgNeed: number;
  readonly perks: readonly {
    readonly level: number;
    readonly max: number;
    readonly cost: number;
  }[];
  /** Картотека: битовые маски открытых карточек по этажам. */
  readonly cards: readonly number[];
  readonly rareCards: readonly number[];
}

export interface TasksView {
  readonly items: readonly {
    readonly type: number;
    readonly target: number;
    readonly progress: number;
    readonly claimed: boolean;
  }[];
  readonly avansReward: number;
  readonly avansStreak: number;
}

export interface UiState {
  readonly kukishi: number;
  readonly income: number;
  readonly hireCost: number;
  readonly canHire: boolean;
  readonly hasSpace: boolean;
  readonly muted: boolean;
  readonly hint: HintKind | null;
  readonly hintX: number;
  readonly hintY: number;
  readonly stamp: { readonly id: number; readonly x: number; readonly y: number } | null;
  readonly toast: Toast | null;
  readonly denyId: number;
  readonly dragging: boolean;
  // Этажи и лифт
  readonly floor: number;
  readonly floorsUnlocked: number;
  readonly floorReady: boolean;
  readonly unlockCost: number;
  // Слой событий
  readonly buffs: readonly number[];
  readonly debt: number;
  readonly shift: ShiftView;
  readonly challenge: ChallengeView | null;
  readonly kredikOffer: number;
  /** Сколько поручений можно забрать + готов ли аванс — для бейджа на кнопке. */
  readonly tasksBadge: number;
  readonly hrBadge: boolean;
  // Окна
  readonly panel: PanelKind;
  readonly tab: HrTab;
  readonly modal: Modal | null;
  readonly hr: HrView | null;
  readonly tasks: TasksView | null;
  /** Показывается реклама — кнопки рекламы недоступны. */
  readonly adBusy: boolean;
  readonly board: BoardView | null;
}

export const INITIAL_UI: UiState = {
  kukishi: 0,
  income: 0,
  hireCost: 0,
  canHire: false,
  hasSpace: true,
  muted: false,
  hint: null,
  hintX: 0,
  hintY: 0,
  stamp: null,
  toast: null,
  denyId: 0,
  dragging: false,
  floor: 0,
  floorsUnlocked: 1,
  floorReady: true,
  unlockCost: 0,
  buffs: [0, 0, 0],
  debt: 0,
  shift: { type: -1, target: 0, progress: 0, reward: 0, wait: 0 },
  challenge: null,
  kredikOffer: 0,
  tasksBadge: 0,
  hrBadge: false,
  panel: "none",
  tab: "floor",
  modal: null,
  hr: null,
  tasks: null,
  adBusy: false,
  board: null,
};
