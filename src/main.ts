import { startLoop } from "./engine/loop";

const MAX_DPR = 2;

function getCanvas(): HTMLCanvasElement {
  const el = document.getElementById("stage");
  if (!(el instanceof HTMLCanvasElement)) throw new Error("#stage canvas не найден");
  return el;
}

const canvas = getCanvas();
const ctx = canvas.getContext("2d", { alpha: false });
if (!ctx) throw new Error("Canvas2D недоступен");

function resize(): void {
  const dpr = Math.min(window.devicePixelRatio || 1, MAX_DPR);
  canvas.width = Math.round(canvas.clientWidth * dpr);
  canvas.height = Math.round(canvas.clientHeight * dpr);
}
window.addEventListener("resize", resize);
resize();

const loop = startLoop({
  update() {
    // Симуляция появится в Фазе 5 (src/core).
  },
  render() {
    ctx.fillStyle = "#cfc8a8";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  },
});

document.addEventListener("visibilitychange", () => {
  if (document.hidden) loop.pause();
  else loop.resume();
});
