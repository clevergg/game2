/** Продакшн-сборка: index.html + бандл в dist/. Кроссплатформенно, без rm -rf. */
import { rm } from "node:fs/promises";

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
  console.log(`${out.path.replace(process.cwd() + "/", "")}  ${out.size} B`);
