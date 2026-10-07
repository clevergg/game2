/**
 * Проверки архива перед загрузкой в консоль Яндекс Игр (требования — docs/phase7.md):
 * index.html в корне, имена без пробелов и кириллицы, ≤ 100 МБ без сжатия,
 * никаких обращений к сторонним доменам, SDK подключается с относительного /sdk.js.
 */
export const MAX_TOTAL_BYTES = 100 * 1024 * 1024;

/** URL, которые встречаются в коде, но не являются запросами (пространства имён XML/SVG). */
const ALLOWED_URLS = [/^http:\/\/www\.w3\.org\//];

export interface PackFile {
  readonly name: string;
  readonly data: Uint8Array;
}

export function checkPack(files: readonly PackFile[]): string[] {
  const problems: string[] = [];
  if (!files.some((f) => f.name === "index.html")) problems.push("нет index.html в корне архива");
  let total = 0;
  for (const f of files) {
    total += f.data.length;
    if (!/^[A-Za-z0-9._/-]+$/.test(f.name)) {
      problems.push(`недопустимое имя файла «${f.name}» (только латиница, цифры, . _ - /)`);
    }
    if (/\.(html|js|css)$/.test(f.name)) {
      const text = new TextDecoder().decode(f.data);
      for (const m of text.matchAll(/(?:https?:)?\/\/[a-z0-9.-]+\.[a-z]{2,}[^\s"'`)]*/gi)) {
        const url = m[0];
        if (!ALLOWED_URLS.some((re) => re.test(url))) {
          problems.push(`внешний адрес в ${f.name}: ${url}`);
        }
      }
    }
  }
  if (total > MAX_TOTAL_BYTES) problems.push(`размер ${total} Б больше 100 МБ`);
  const code = files
    .filter((f) => f.name.endsWith(".js"))
    .map((f) => new TextDecoder().decode(f.data))
    .join("\n");
  if (!code.includes('"/sdk.js"')) problems.push("в коде нет подключения SDK по пути /sdk.js");
  return problems;
}
