/**
 * Константы экономики v2 (GDD §0.3–0.4). Числа подобраны симулятором `bun run balance`
 * под целевой темп из docs/progression.md §5.2; инварианты закреплены тестами в src/core.
 */
export const BALANCE = {
  /** Доход батракана ранга 1 на первом этаже, кукишей в секунду. */
  incomeBase: 1,
  /** Во сколько раз доход следующего ранга больше (> 2, иначе слияние невыгодно). */
  incomeRankMult: 2.6,
  /** Выплата раз в столько секунд. */
  payoutPeriod: 1,
  /** Множители дохода и цен этажей: следующий этаж на порядки богаче и дороже. */
  floorIncome: [1, 300, 90_000],
  floorCost: [1, 400, 120_000_000],
  /** Разовая цена открытия этажа. */
  floorUnlock: [0, 1.7e8, 3e11],

  /** Найм: base · floorCost · 2^(q−1) · growth^n (n — сколько нанято на этаже за забег). */
  hireBase: 80,
  hireGrowth: 1.12,
  /** Квалификация найма: максимальный уровень и цена base · floorCost · mult^(q−1). */
  qualMax: 7,
  qualBase: 1500,
  qualMult: 7,
  /** Оснащение: +step дохода этажа за уровень, цена base · floorCost · mult^e. */
  equipStep: 0.5,
  equipBase: 120,
  equipMult: 4,
  /** Докупка стола: base · floorCost · mult^k. */
  deskBase: 2_000,
  deskMult: 9,

  /** Тап: max(1, fraction · доход в секунду). */
  tapFraction: 0.06,
  /** Слоповина возвращает эту долю базовой цены батракана. */
  trashRefund: 0.25,
  desksStart: 8,
  /** «Подъёмные»: кукиши на старте забега, чтобы первый найм случился за секунды. */
  startKukishi: 75,
  desksMax: 12,

  /** Реорганизация: выслуга = floor((заработано за забег / reorgBase)^reorgExp). */
  reorgBase: 7.5e7,
  reorgExp: 0.33,
  /** Каждое очко выслуги — столько к доходу навсегда. */
  seniorityBonus: 0.1,

  /** Картотека: бонус дохода этажа за каждую открытую карточку. */
  cardBonus: 0.02,
  /** Премированный батракан: шанс при найме/слиянии и множитель дохода. */
  rareChance: 0.01,
  rareMult: 2,
  /** Бережливость: скидка на найм за уровень перка. */
  thriftStep: 0.06,
  /** Автослияние: раз в столько секунд. */
  autoMergePeriod: 6,
} as const;

/**
 * События и дневные слои (GDD §0.5–0.6). Награды задаются в секундах базового дохода:
 * так они остаются ощутимыми на любом этапе игры.
 */
export const LIVE = {
  /** Записки Хозяина: интервал (с), сколько висит неоткрытой. */
  noteMin: 90,
  noteMax: 150,
  noteTtl: 12,
  avralMult: 2,
  avralSec: 30,
  giftSec: 20,
  /** Шабашка: столько тапов за столько секунд; награда — секунд дохода. */
  shabSec: 20,
  shabTapsBase: 30,
  shabTapsPerRank: 4,
  shabRewardSec: 30,

  /** Дебики: интервал (перк делает чаще), время на экране, награда. */
  debikMin: 45,
  debikMax: 90,
  debikTtl: 6,
  debikRewardSec: 8,
  debikPerkStep: 0.2,

  /** Кредики: заём N секунд дохода, вернуть ×repay, гасится долей выплат. */
  kredikMin: 200,
  kredikMax: 300,
  kredikTtl: 12,
  kredikLoanSec: 600,
  kredikRepay: 1.5,
  kredikShare: 0.3,

  /** Проверка сверху: каждые ~10 мин, 60 с, цель — секунд дохода, награда — ×bonus цели. */
  inspMin: 480,
  inspMax: 720,
  inspSec: 60,
  inspTargetSec: 40,
  inspBonus: 1,

  /** Баффы. */
  premiaSec: 180,
  premiaMult: 2,
  coloidSec: 60,
  coloidMult: 1.5,
  coloidMergePeriod: 1.5,

  /** Смена: награда — секунд дохода; цели планов. */
  shiftRewardSec: 45,
  /** Перекур между сменами, секунд. */
  shiftBreakSec: 120,
  shiftEarnSec: 240,
  shiftMerges: [5, 8],
  shiftHires: [5, 8],
  shiftTaps: [100, 150],
  shiftDebiks: [2, 3],

  /** Поручения Тоси Боси: 3 в день. */
  taskRewardSec: 300,
  taskEarnSec: 900,
  taskMerges: [10, 14],
  taskHires: [10, 14],
  taskTaps: [150, 200],
  taskDebiks: [3, 4],
  taskShifts: [2, 3],
  tasksBonusStamps: 1,

  /** Аванс: серия до 7 дней, награда — день серии × секунд дохода. */
  avansSecPerDay: 60,
  avansMin: 50,
  avansMaxStreak: 7,

  /** Отгул: доля дохода и базовый предел часов (+perk). */
  offlineRate: 0.5,
  offlineBaseHours: 2,
  offlineHoursPerPerk: 2,
} as const;

/** Ограничитель межстраничной рекламы поверх лимитов Яндекса (GDD §0.8). */
export const ADS = {
  /** Не раньше, чем через столько секунд после старта сессии. */
  firstAfterSec: 60,
  /** Не чаще одного раза за столько секунд. */
  minGapSec: 120,
  /** Не сразу после действия игрока: пауза после последнего тапа или драга. */
  quietSec: 3,
} as const;
