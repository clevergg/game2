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
  readonly toast: { readonly id: number; readonly rank: number } | null;
  readonly denyId: number;
  readonly dragging: boolean;
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
};
