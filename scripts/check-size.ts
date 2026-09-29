/**
 * Проверка бюджета сборки: считает gzip-размер каждого файла в dist/
 * и падает, если сумма больше бюджета. Бюджет — в package.json → "budget".
 */
import { readdir, readFile } from "node:fs/promises";
import { join, relative } from "node:path";
import pkg from "../package.json";

const DIST = "dist";
const budgetKb = pkg.budget.totalGzipKB;

async function walk(dir: string): Promise<string[]> {
  const entries = await readdir(dir, { withFileTypes: true });
  const nested = await Promise.all(
    entries.map((e) =>
      e.isDirectory() ? walk(join(dir, e.name)) : Promise.resolve([join(dir, e.name)]),
    ),
  );
  return nested.flat();
}

const files = await walk(DIST);
let totalGzip = 0;
const rows: [string, number, number][] = [];
for (const file of files) {
  const data = await readFile(file);
  const gz = Bun.gzipSync(data, { level: 9 }).byteLength;
  totalGzip += gz;
  rows.push([relative(DIST, file), data.byteLength, gz]);
}

rows.sort((a, b) => b[2] - a[2]);
for (const [name, raw, gz] of rows) {
  console.log(
    `${name.padEnd(40)} ${(raw / 1024).toFixed(1).padStart(8)} КБ  gzip ${(gz / 1024).toFixed(1).padStart(8)} КБ`,
  );
}
const totalKb = totalGzip / 1024;
console.log(
  `\nИтого gzip: ${totalKb.toFixed(1)} КБ из ${budgetKb} КБ бюджета (${((totalKb / budgetKb) * 100).toFixed(1)}%)`,
);

if (totalKb > budgetKb) {
  console.error("❌ Бюджет сборки превышен");
  process.exit(1);
}
