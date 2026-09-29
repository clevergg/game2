/**
 * Слой платформы. Игра работает только через этот интерфейс и не знает, запущена ли она
 * на Яндексе. Главное правило: ни один метод не бросает исключений.
 * В срезе (Фаза 5) есть только LocalPlatform; YandexPlatform, реклама и лидерборд — Фаза 7.
 */
export interface Platform {
  readonly kind: "yandex" | "local";
  /** Язык интерфейса платформы, ISO 639-1. */
  readonly lang: string;
  loadSave(): Promise<string | null>;
  writeSave(data: string, flush: boolean): Promise<void>;
  /** Мелкие настройки устройства (звук, пройденный туториал). */
  getPref(key: string): string | null;
  setPref(key: string, value: string): void;
  /** Игра загружена и готова (LoadingAPI.ready). */
  gameReady(): void;
  /** Начало и конец активного геймплея (GameplayAPI.start/stop). */
  gameplayStart(): void;
  gameplayStop(): void;
}
