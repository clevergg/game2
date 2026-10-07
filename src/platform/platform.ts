/**
 * Слой платформы. Игра работает только через этот интерфейс и не знает, запущена ли она
 * на Яндексе. Главное правило: ни один метод не бросает исключений.
 * Сейчас есть только LocalPlatform (с имитацией рекламы для разработки); YandexPlatform — Фаза 7.
 * Паузу игры и звука на время рекламы ставит игра (game/ads.ts), платформа только показывает.
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
  /** Реклама за награду: true — досмотрели, награду выдать. Ошибка или закрытие — false. */
  showRewarded(): Promise<boolean>;
  /** Межстраничная реклама: true — показана. Частоту дополнительно режет game/ads.ts. */
  showInterstitial(): Promise<boolean>;
}
