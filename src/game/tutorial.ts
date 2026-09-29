/**
 * Подсказки первой сессии без экрана обучения: «тапай» → «найми» → «перетащи одного на другого».
 * Каждая подсказка исчезает, как только игрок сделал действие. Чистая логика, покрыта тестами.
 */
export const TUTORIAL = {
  tap: 0,
  hire: 1,
  merge: 2,
  done: 3,
} as const;

export type TutorialStage = (typeof TUTORIAL)[keyof typeof TUTORIAL];

export interface TutorialFacts {
  readonly taps: number;
  readonly hires: number;
  readonly merges: number;
}

/** Тапов для перехода к подсказке найма: успевает понять, что тап приносит кукиши. */
const TAPS_TO_LEARN = 3;

export function nextStage(stage: TutorialStage, f: TutorialFacts): TutorialStage {
  if (f.merges > 0) return TUTORIAL.done;
  if (stage === TUTORIAL.tap && f.taps >= TAPS_TO_LEARN) return TUTORIAL.hire;
  if (stage === TUTORIAL.hire && f.hires > 0) return TUTORIAL.merge;
  return stage;
}

export function parseStage(raw: string | null): TutorialStage {
  const n = Number(raw);
  return n === TUTORIAL.hire || n === TUTORIAL.merge || n === TUTORIAL.done ? n : TUTORIAL.tap;
}
