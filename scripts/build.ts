/** Продакшн-сборка: index.html + бандл в dist/. Кроссплатформенно (Windows/macOS/Linux). */
import { rm } from "node:fs/promises";
import { relative } from "node:path";

await rm("dist", { recursive: true, force: true });

const result = await Bun.build({
  entrypoints: ["./index.html"],
  outdir: "dist",
  minify: true,
  sourcemap: "none",
  target: "browser",
});

if (!result.success) {
  for (const log of result.logs) console.error(log);
  process.exit(1);
}
for (const out of result.outputs)
  console.log(`${relative(process.cwd(), out.path)}  ${out.size} B`);
