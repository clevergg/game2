/** Пиксельная иконка из атласа как DOM-элемент (фон из листа атласа). */
import type { Atlas } from "../engine/atlas";

/** crop — какая доля кадра сверху видна (у батракана в картотеке не нужны ноги под столом). */
export function Icon({
  atlas,
  frame,
  size,
  crop = 1,
}: {
  atlas: Atlas;
  frame: string;
  size: number;
  crop?: number;
}) {
  const i = atlas.frame(frame);
  const w = atlas.w[i] ?? 1;
  const h = atlas.h[i] ?? 1;
  const k = size / Math.max(w, h);
  const image = atlas.imageOf(i);
  return (
    <span
      class="atlas-icon"
      aria-hidden="true"
      style={{
        width: `${w * k}px`,
        height: `${h * k * crop}px`,
        ...(image && {
          backgroundImage: `url(${image.src})`,
          backgroundPosition: `${-(atlas.x[i] ?? 0) * k}px ${-(atlas.y[i] ?? 0) * k}px`,
          backgroundSize: `${image.naturalWidth * k}px ${image.naturalHeight * k}px`,
        }),
      }}
    />
  );
}

/** «1:05» — таймеры баффов, перекура и испытаний. */
export function clock(sec: number): string {
  const s = Math.max(0, Math.ceil(sec));
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${m}:${r < 10 ? "0" : ""}${r}`;
}

export function Progress({ value, max }: { value: number; max: number }) {
  const p = max > 0 ? Math.min(1, Math.max(0, value / max)) : 0;
  return (
    <span class="progress" aria-hidden="true">
      <span class="progress-fill" style={{ width: `${(p * 100).toFixed(1)}%` }} />
    </span>
  );
}
