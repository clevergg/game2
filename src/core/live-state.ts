/**
 * Состояние событий и дневных слоёв: баффы, записки, дебики, кредики, проверка сверху,
 * смена, поручения, аванс. Только данные — логика в live.ts.
 */
export const BUFF = { premia: 0, avral: 1, coloid: 2 } as const;
export const BUFF_COUNT = 3;

/** Таймеры появления событий. */
export const SPAWN = { note: 0, debik: 1, kredik: 2, inspection: 3 } as const;

export const NOTE = { none: 0, avral: 1, shabashka: 2, gift: 3 } as const;

/** Счётчики действий за всю игру — по ним считается прогресс планов смены и поручений. */
export const CNT = { earned: 0, merges: 1, hires: 2, taps: 3, debiks: 4, shifts: 5 } as const;
export const CNT_COUNT = 6;

export const TASK_COUNT = 3;

export interface LiveState {
  /** Секунд до конца каждого баффа (0 — не активен). */
  readonly buffs: Float32Array;
  /** Секунд до появления события каждого типа. */
  readonly spawn: Float32Array;
  /** Таймер автослияния под калоидным ускорителем. */
  coloidTimer: number;
  /** Висящая записка (NOTE) и сколько ей висеть. */
  note: number;
  noteTtl: number;
  /** Дебик на экране: секунд до убегания (0 — нет). */
  debikTtl: number;
  /** Предложение кредика: сумма займа (0 — нет) и сколько висит. */
  kredikOffer: number;
  kredikTtl: number;
  /** Долг кредику, гасится долей выплат. */
  debt: number;
  /** Шабашка: секунд осталось (0 — нет), сколько тапов нужно, база счётчика тапов. */
  shabLeft: number;
  shabNeed: number;
  shabBase: number;
  /** Проверка сверху: секунд осталось (0 — нет), цель заработка, база счётчика. */
  inspLeft: number;
  inspTarget: number;
  inspBase: number;
  readonly counters: Float64Array;
  /** План смены; между сменами — перекур shiftWait секунд (shiftType = −1). */
  shiftType: number;
  shiftWait: number;
  shiftTarget: number;
  shiftBase: number;
  shiftNo: number;
  /** Премия выполненной смены, ожидающая получения (0 — нет). */
  shiftReward: number;
  /** Поручения Тоси Боси. */
  readonly taskType: Int8Array;
  readonly taskTarget: Float64Array;
  readonly taskBase: Float64Array;
  readonly taskClaimed: Uint8Array;
  /** День поручений (номер дня по календарю устройства), −1 — ещё не выдавались. */
  taskDay: number;
  /** Аванс: последний день получения и длина серии. */
  avansDay: number;
  avansStreak: number;
}

export function createLive(): LiveState {
  return {
    buffs: new Float32Array(BUFF_COUNT),
    spawn: Float32Array.from([60, 30, 240, 420]),
    coloidTimer: 0,
    note: NOTE.none,
    noteTtl: 0,
    debikTtl: 0,
    kredikOffer: 0,
    kredikTtl: 0,
    debt: 0,
    shabLeft: 0,
    shabNeed: 0,
    shabBase: 0,
    inspLeft: 0,
    inspTarget: 0,
    inspBase: 0,
    counters: new Float64Array(CNT_COUNT),
    shiftType: -1,
    shiftWait: 45,
    shiftTarget: 0,
    shiftBase: 0,
    shiftNo: 0,
    shiftReward: 0,
    taskType: new Int8Array(TASK_COUNT).fill(-1),
    taskTarget: new Float64Array(TASK_COUNT),
    taskBase: new Float64Array(TASK_COUNT),
    taskClaimed: new Uint8Array(TASK_COUNT),
    taskDay: -1,
    avansDay: -1,
    avansStreak: 0,
  };
}
