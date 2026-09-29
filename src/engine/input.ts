/**
 * Ввод: один код для пальца, мыши и стилуса (Pointer Events).
 * Распознаёт тап и перетаскивание: палец сдвинулся больше чем на порог — это драг, иначе тап.
 * Активен один указатель: второй палец игнорируется, чтобы случайный мультитач не ломал драг.
 */
export interface GestureHandler {
  tap(x: number, y: number): void;
  /** Можно ли начать драг из этой точки (есть ли что тащить). */
  dragStart(x: number, y: number): boolean;
  dragMove(x: number, y: number): void;
  dragEnd(x: number, y: number): void;
  dragCancel(): void;
}

const DRAG_THRESHOLD = 10;

export function attachInput(el: HTMLElement, h: GestureHandler): () => void {
  let pointerId: number | null = null;
  let startX = 0;
  let startY = 0;
  let dragging = false;
  let dragRefused = false;

  const local = (e: PointerEvent): [number, number] => {
    const r = el.getBoundingClientRect();
    return [e.clientX - r.left, e.clientY - r.top];
  };

  const down = (e: PointerEvent): void => {
    if (pointerId !== null) return;
    pointerId = e.pointerId;
    [startX, startY] = local(e);
    dragging = false;
    dragRefused = false;
    el.setPointerCapture(e.pointerId);
  };

  const move = (e: PointerEvent): void => {
    if (e.pointerId !== pointerId) return;
    const [x, y] = local(e);
    if (!dragging && !dragRefused && Math.hypot(x - startX, y - startY) > DRAG_THRESHOLD) {
      dragging = h.dragStart(startX, startY);
      dragRefused = !dragging;
    }
    if (dragging) h.dragMove(x, y);
  };

  const up = (e: PointerEvent): void => {
    if (e.pointerId !== pointerId) return;
    const [x, y] = local(e);
    if (dragging) h.dragEnd(x, y);
    else if (!dragRefused) h.tap(x, y);
    pointerId = null;
    dragging = false;
  };

  const cancel = (e: PointerEvent): void => {
    if (e.pointerId !== pointerId) return;
    if (dragging) h.dragCancel();
    pointerId = null;
    dragging = false;
  };

  const noMenu = (e: Event): void => {
    e.preventDefault();
  };

  el.addEventListener("pointerdown", down);
  el.addEventListener("pointermove", move);
  el.addEventListener("pointerup", up);
  el.addEventListener("pointercancel", cancel);
  el.addEventListener("contextmenu", noMenu);
  return () => {
    el.removeEventListener("pointerdown", down);
    el.removeEventListener("pointermove", move);
    el.removeEventListener("pointerup", up);
    el.removeEventListener("pointercancel", cancel);
    el.removeEventListener("contextmenu", noMenu);
  };
}
