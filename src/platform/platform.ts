/**
 * Слой платформы. Игра работает только через этот интерфейс и не знает, запущена ли она
 * на Яндексе. Главное правило: ни один метод не бросает исключений — при любой ошибке
 * платформы игра продолжает работать (локальное сохранение, без рекламы, без лидерборда).
 * Паузу игры и звука на время рекламы ставит игра (game/ads.ts), платформа только показывает.
 */
export interface LeaderEntry {
  readonly rank: number;
  /** Публичное имя игрока; пустое — аноним (подпись берёт UI из словаря). */
  readonly name: string;
  readonly score: number;
  readonly me: boolean;
}

export interface Leaderboard {
  readonly entries: readonly LeaderEntry[];
  /** Место игрока или 0, если его нет в таблице. */
  readonly myRank: number;
}

export interface Platform {
  readonly kind: "yandex" | "local";
  /** Язык интерфейса платформы, ISO 639-1. */
  readonly lang: string;
  /** Текущее время, мс: серверное на Яндексе (не зависит от часов устройства), иначе Date.now(). */
  now(): number;
  loadSave(): Promise<string | null>;
  /** Сохранение: локально — всегда, в облако — с ограничением частоты (flush — сразу). */
  writeSave(data: string, flush: boolean): Promise<void>;
  /** Мелкие настройки устройства (звук, пройденный туториал). */
  getPref(key: string): string | null;
  setPref(key: string, value: string): void;
  /** Игра загружена и готова (LoadingAPI.ready). */
  gameReady(): void;
  /** Начало и конец активного геймплея (GameplayAPI.start/stop). */
  gameplayStart(): void;
  gameplayStop(): void;
  /** Внешняя пауза от платформы (game_api_pause/resume): реклама, покупки, сворачивание. */
  onPause(handler: (paused: boolean) => void): void;
  /** Реклама за награду: true — досмотрели, награду выдать. Ошибка или закрытие — false. */
  showRewarded(): Promise<boolean>;
  /** Межстраничная реклама: true — показана. Частоту дополнительно режет game/ads.ts. */
  showInterstitial(): Promise<boolean>;
  /** Счёт доски почёта; платформа сама ограничивает частоту и пропускает повторы. */
  submitScore(score: number): void;
  /** Доска почёта или null, если недоступна (локальный запуск, нет входа, ошибка). */
  getLeaderboard(): Promise<Leaderboard | null>;
  /** Вход через Яндекс ID (опционально). true — игрок авторизован после диалога. */
  login(): Promise<boolean>;
  readonly canLogin: boolean;
}
