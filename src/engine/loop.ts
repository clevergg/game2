import { FixedStep } from "./fixed-step";

export interface LoopHooks {
  /** Шаг симуляции фиксированной длины, в секундах. */
  update(stepSec: number): void;
  /** Отрисовка кадра; alpha — доля до следующего шага симуляции (для сглаживания). */
  render(alpha: number, frameSec: number): void;
}

export interface Loop {
  pause(): void;
  resume(): void;
  readonly paused: boolean;
}

/**
 * Игровой цикл на requestAnimationFrame с фиксированным шагом симуляции.
 * На паузе (реклама, скрытая вкладка) rAF полностью останавливается:
 * ни симуляция, ни рендер не тратят батарею.
 */
export function startLoop(hooks: LoopHooks, stepMs = 50, maxFrameMs = 250): Loop {
  const fixed = new FixedStep(stepMs, maxFrameMs);
  const stepSec = stepMs / 1000;
  let lastMs = 0;
  let rafId = 0;
  let paused = false;

  const frame = (nowMs: number): void => {
    const frameMs = lastMs === 0 ? 0 : nowMs - lastMs;
    lastMs = nowMs;
    const steps = fixed.advance(frameMs);
    for (let i = 0; i < steps; i++) hooks.update(stepSec);
    hooks.render(fixed.alpha, frameMs / 1000);
    rafId = requestAnimationFrame(frame);
  };

  rafId = requestAnimationFrame(frame);

  return {
    pause() {
      if (paused) return;
      paused = true;
      cancelAnimationFrame(rafId);
    },
    resume() {
      if (!paused) return;
      paused = false;
      lastMs = 0;
      fixed.reset();
      rafId = requestAnimationFrame(frame);
    },
    get paused() {
      return paused;
    },
  };
}
