/** Панели-«листы» снизу: отдел квадров (этаж, Кудесница Алеся, картотека) и поручения Тоси Боси. */
import type { ComponentChildren } from "preact";
import { FLOOR_COUNT } from "../data/floors";
import { PERK_COUNT } from "../data/perks";
import { MAX_RANK } from "../data/ranks";
import type { Atlas } from "../engine/atlas";
import { floorName, fmt, perkText, planText, rankName, t, tf } from "../i18n";
import type { UiActions } from "./actions";
import { Icon, Progress } from "./Icon";
import type { HrTab, HrView, TasksView, UiState } from "./store";

function Sheet(p: { title: string; onClose: () => void; children: ComponentChildren }) {
  return (
    <div class="sheet-backdrop" onClick={p.onClose}>
      <section
        class="sheet"
        role="dialog"
        aria-label={p.title}
        onClick={(e) => {
          e.stopPropagation();
        }}
      >
        <header class="sheet-head">
          <span class="sheet-title">{p.title}</span>
          <button type="button" class="close-btn" aria-label={t("close")} onClick={p.onClose}>
            ✕
          </button>
        </header>
        <div class="sheet-body">{p.children}</div>
      </section>
    </div>
  );
}

function BuyRow(p: {
  atlas: Atlas;
  icon: string;
  title: string;
  desc: string;
  cost: number;
  can: boolean;
  maxed: boolean;
  onBuy: () => void;
  stamps?: boolean;
}) {
  return (
    <div class="buy-row">
      <Icon atlas={p.atlas} frame={p.icon} size={40} />
      <span class="buy-text">
        <span class="buy-title">{p.title}</span>
        <span class="buy-desc">{p.desc}</span>
      </span>
      {p.maxed ? (
        <span class="buy-max">{t("maxed")}</span>
      ) : (
        <button type="button" class={`btn small gold ${p.can ? "" : "disabled"}`} onClick={p.onBuy}>
          <Icon
            atlas={p.atlas}
            frame={p.stamps === true ? "icon_stamp" : "icon_kukish"}
            size={16}
          />
          {fmt(p.cost)}
        </button>
      )}
    </div>
  );
}

const TABS: readonly HrTab[] = ["floor", "alesya", "cards"];
const TAB_KEY = { floor: "tabFloor", alesya: "tabAlesya", cards: "tabCards" } as const;

export function HrPanel(p: { s: UiState; hr: HrView; actions: UiActions; atlas: Atlas }) {
  const { s, hr, actions, atlas } = p;
  const close = (): void => {
    actions.openPanel("none");
  };
  return (
    <Sheet title={t("hrDept")} onClose={close}>
      <nav class="tabs">
        {TABS.map((tab) => (
          <button
            key={tab}
            type="button"
            class={`tab ${s.tab === tab ? "active" : ""}`}
            onClick={() => {
              actions.setTab(tab);
            }}
          >
            {t(TAB_KEY[tab])}
          </button>
        ))}
      </nav>
      {s.tab === "floor" ? <FloorTab s={s} hr={hr} actions={actions} atlas={atlas} /> : null}
      {s.tab === "alesya" ? <AlesyaTab hr={hr} actions={actions} atlas={atlas} /> : null}
      {s.tab === "cards" ? <CardsTab hr={hr} s={s} atlas={atlas} /> : null}
    </Sheet>
  );
}

function FloorTab({
  s,
  hr,
  actions,
  atlas,
}: {
  s: UiState;
  hr: HrView;
  actions: UiActions;
  atlas: Atlas;
}) {
  const qualMaxed = hr.qual >= hr.qualMax;
  const desksMaxed = hr.deskCount >= hr.desksMax;
  return (
    <div class="list">
      <div class="list-caption">{floorName(s.floor)}</div>
      <BuyRow
        atlas={atlas}
        icon="icon_diploma"
        title={t("qual")}
        desc={tf("qualDesc", { rank: rankName(qualMaxed ? hr.qual : hr.qual + 1, s.floor) })}
        cost={hr.qualCost}
        can={s.kukishi >= hr.qualCost}
        maxed={qualMaxed}
        onBuy={actions.buyQual}
      />
      <BuyRow
        atlas={atlas}
        icon="icon_equip"
        title={t("equip")}
        desc={tf("equipDesc", { n: hr.equip + 1, p: hr.equipPct + 50 })}
        cost={hr.equipCost}
        can={s.kukishi >= hr.equipCost}
        maxed={false}
        onBuy={actions.buyEquip}
      />
      <BuyRow
        atlas={atlas}
        icon="icon_hire"
        title={t("desk")}
        desc={tf("deskDesc", { n: hr.deskCount, max: hr.desksMax })}
        cost={hr.deskCost}
        can={s.kukishi >= hr.deskCost}
        maxed={desksMaxed}
        onBuy={actions.buyDesk}
      />
    </div>
  );
}

function AlesyaTab({ hr, actions, atlas }: { hr: HrView; actions: UiActions; atlas: Atlas }) {
  const perks = [];
  for (let i = 0; i < PERK_COUNT; i++) {
    const perk = hr.perks[i];
    if (!perk) continue;
    const text = perkText(i);
    perks.push(
      <BuyRow
        key={i}
        atlas={atlas}
        icon="icon_stamp"
        title={`${text.name} · ${tf("perkLevel", { n: perk.level, max: perk.max })}`}
        desc={text.desc}
        cost={perk.cost}
        can={hr.stamps >= perk.cost}
        maxed={perk.level >= perk.max}
        stamps
        onBuy={() => {
          actions.buyPerk(i);
        }}
      />,
    );
  }
  return (
    <div class="list">
      <div class="npc">
        <Icon atlas={atlas} frame="portrait_alesya" size={92} />
        <div class="npc-say">{t("alesyaSays")}</div>
      </div>
      <div class="stats">
        <span class="stat">
          <span class="stat-label">{t("seniority")}</span>
          <span class="stat-value">{fmt(hr.seniority)}</span>
          <span class="stat-desc">{tf("seniorityDesc", { p: fmt(hr.seniorityPct) })}</span>
        </span>
        <span class="stat">
          <span class="stat-label">{t("stamps")}</span>
          <span class="stat-value">
            <Icon atlas={atlas} frame="icon_stamp" size={20} /> {fmt(hr.stamps)}
          </span>
        </span>
      </div>
      <div class="reorg">
        <span class="buy-title">{t("reorg")}</span>
        <span class="buy-desc">{t("reorgDesc")}</span>
        {hr.reorgGain >= 1 ? (
          <button type="button" class="btn gold" onClick={actions.askReorg}>
            {tf("reorgGain", { n: fmt(hr.reorgGain) })}
          </button>
        ) : (
          <span class="buy-desc strong">{tf("reorgNotYet", { n: fmt(hr.reorgNeed) })}</span>
        )}
      </div>
      {perks}
    </div>
  );
}

function CardsTab({ hr, s, atlas }: { hr: HrView; s: UiState; atlas: Atlas }) {
  const floors = [];
  for (let fi = 0; fi < FLOOR_COUNT; fi++) {
    const mask = hr.cards[fi] ?? 0;
    const rare = hr.rareCards[fi] ?? 0;
    const cells = [];
    for (let r = 1; r <= MAX_RANK; r++) {
      const open = (mask & (1 << (r - 1))) !== 0;
      const star = (rare & (1 << (r - 1))) !== 0;
      cells.push(
        <span
          key={r}
          class={`card ${open ? "open" : ""} ${star ? "rare" : ""}`}
          title={open ? rankName(r, fi) : "?"}
        >
          {open && fi < s.floorsUnlocked ? (
            <Icon atlas={atlas} frame={`f${fi}_b${r}_idle_0`} size={52} crop={0.72} />
          ) : null}
          <span class="card-n">{open ? r : "?"}</span>
          {star ? <span class="card-star">★</span> : null}
        </span>,
      );
    }
    floors.push(
      <div key={fi} class="cards-floor">
        <span class="list-caption">{floorName(fi)}</span>
        <div class="cards">{cells}</div>
      </div>,
    );
  }
  return (
    <div class="list">
      <span class="buy-desc">{t("cardsDesc")}</span>
      {floors}
    </div>
  );
}

export function TasksPanel(p: { tasks: TasksView; actions: UiActions; atlas: Atlas }) {
  const { tasks, actions, atlas } = p;
  return (
    <Sheet
      title={t("tasks")}
      onClose={() => {
        actions.openPanel("none");
      }}
    >
      <div class="list">
        <div class="npc">
          <Icon atlas={atlas} frame="portrait_tosya" size={92} />
          <div class="npc-say">{t("tosyaSays")}</div>
        </div>
        {tasks.items.map((item, i) => {
          const done = item.progress >= item.target && item.type >= 0;
          return (
            <div key={i} class={`task ${item.claimed ? "claimed" : ""}`}>
              <span class="buy-text">
                <span class="buy-title">{planText(item.type, fmt(item.target))}</span>
                <Progress value={item.progress} max={item.target} />
              </span>
              {item.claimed ? (
                <span class="buy-max">{t("done")}</span>
              ) : (
                <button
                  type="button"
                  class={`btn small gold ${done ? "" : "disabled"}`}
                  onClick={() => {
                    actions.claimTask(i);
                  }}
                >
                  {t("claim")}
                </button>
              )}
            </div>
          );
        })}
        <span class="buy-desc strong">
          <Icon atlas={atlas} frame="icon_stamp" size={18} /> {t("tasksBonus")}
        </span>
        <div class="avans">
          <Icon atlas={atlas} frame="envelope" size={40} />
          <span class="buy-text">
            <span class="buy-title">
              {t("avans")} · {tf("avansDay", { n: tasks.avansStreak })}
            </span>
            <span class="buy-desc">{tasks.avansReward > 0 ? t("avansText") : t("avansTaken")}</span>
          </span>
          {tasks.avansReward > 0 ? (
            <button type="button" class="btn small gold" onClick={actions.claimAvans}>
              +{fmt(tasks.avansReward)}
            </button>
          ) : null}
        </div>
      </div>
    </Sheet>
  );
}
