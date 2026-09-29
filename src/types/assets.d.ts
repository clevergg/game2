/** Бандлер Bun превращает импорт картинки в URL файла в сборке. */
declare module "*.png" {
  const url: string;
  export default url;
}
