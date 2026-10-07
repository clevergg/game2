/**
 * `bun run pack` — архив для загрузки в консоль Яндекс Игр: собирает dist/, проверяет
 * требования (scripts/pack/rules.ts) и пишет release/kontorka-<версия>.zip.
 */
import { mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import { join, relative, sep } from "node:path";
import pkg from "../../package.json";
import { checkPack, MAX_TOTAL_BYTES, type PackFile } from "./rules";
import { zip } from "./zip";

const DIST = "dist";
const OUT = "release";

async function walk(dir: string): Promise<string[]> {
  const out: string[] = [];
  for (const e of await readdir(dir, { withFileTypes: true })) {
    const p = join(dir, e.name);
    if (e.isDirectory()) out.push(...(await walk(p)));
    else out.push(p);
  }
  return out;
}

const paths = (await walk(DIST)).sort();
const files: PackFile[] = [];
for (const p of paths) {
  files.push({ name: relative(DIST, p).split(sep).join("/"), data: await readFile(p) });
}
const problems = checkPack(files);
if (problems.length > 0) {
  console.error("❌ Архив не соответствует требованиям:");
  for (const p of problems) console.error(`  - ${p}`);
  process.exit(1);
}
const archive = zip(files);
await mkdir(OUT, { recursive: true });
const name = join(OUT, `kontorka-${pkg.version}.zip`);
await writeFile(name, archive);
const total = files.reduce((s, f) => s + f.data.length, 0);
const kb = (n: number): string => `${(n / 1024).toFixed(1)} КБ`;
console.log(
  `✅ ${name}: ${files.length} файлов, ${kb(total)} без сжатия (лимит ${kb(MAX_TOTAL_BYTES)}), архив ${kb(archive.length)}`,
);
for (const f of files) console.log(`   ${f.name.padEnd(28)} ${kb(f.data.length)}`);
