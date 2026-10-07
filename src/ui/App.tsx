/**
 * Интерфейс поверх канваса: деньги и баффы, план смены, лифт, кнопки отделов и найма,
 * испытания, кредик, тосты, подсказки, панели и модалки.
 */
import { FLOOR_COUNT } from "../data/floors";
import type { Atlas } from "../engine/atlas";
import { floorName, fmt, planText, t, tf } from "../i18n";
import type { UiActions } from "./actions";
import { clock, Icon, Progress } from "./Icon";
import { Modals } from "./Modals";
import { HrPanel, TasksPanel } from "./Panels";
import { type ShiftView, type Store, type UiState, useStore } from "./store";

interface Props {
  readonly store: Store<UiState>;
  readonly actions: UiActions;
  readonly atlas: Atlas;
}

function SoundIcon({ muted }: { muted: boolean }) {
  return (
    <svg viewBox="0 0 24 24" width="26" height="26" aria-hidden="true">
      <path d="M3 9h4l5-4v14l-5-4H3z" fill="currentColor" />
      {muted ? (
        <path
          d="M16 9l5 6M21 9l-5 6"
          stroke="currentColor"
          stroke-width="2.5"
          stroke-linecap="round"
        />
      ) : (
        <path
          d="M16 8.5c1.6 2 1.6 5 0 7M19 6c3 3.5 3 8.5 0 12"
          stroke="currentColor"
          stroke-width="2.2"
          fill="none"
          stroke-linecap="round"
        />
      )}
    </svg>
  );
}

const BUFF_PREMIA = 0;
const BUFF_AVRAL = 1;
const BUFF_COLOID = 2;

/** Кнопка рекламного баффа: иконка, а пока бафф идёт — таймер. */
function BuffButton(p: {
  atlas: Atlas;
  frame: string;
  left: number;
  label: string;
  disabled: boolean;
  onClick: () => void;
}) {
  const active = p.left > 0;
  return (
    <button
      type="button"
      class={`icon-btn buff-btn ${active ? "active" : ""}`}
      aria-label={p.label}
      disabled={active || p.disabled}
      onClick={p.onClick}
    >
      <Icon atlas={p.atlas} frame={p.frame} size={30} />
      {active ? <span class="buff-time">{clock(p.left)}</span> : <span class="ad-mark">▶</span>}
    </button>
  );
}

function ShiftBar({ shift, onOpen }: { shift: ShiftView; onOpen: () => void }) {
  if (shift.type < 0) {
    return (
      <div class="shift-bar resting">
        <span class="shift-title">{t("shiftBreak")}</span>
        <span class="shift-text">{clock(shift.wait)}</span>
      </div>
    );
  }
  if (shift.reward > 0) {
    return (
      <button type="button" class="shift-bar ready" onClick={onOpen}>
        <span class="shift-title">{t("shiftDone")}</span>
        <span class="shift-text">
          {t("claim")} +{fmt(shift.reward)}
        </span>
      </button>
    );
  }
  return (
    <div class="shift-bar">
      <span class="shift-title">{t("shiftPlan")}</span>
      <span class="shift-text">{planText(shift.type, fmt(shift.target))}</span>
      <Progress value={shift.progress} max={shift.target} />
    </div>
  );
}

function Lift({ s, actions }: { s: UiState; actions: UiActions }) {
  const top = Math.min(FLOOR_COUNT - 1, s.floorsUnlocked);
  const nextAffordable = s.floorsUnlocked < FLOOR_COUNT && s.kukishi >= s.unlockCost;
  return (
    <div class="lift" aria-label={t("lift")}>
      <button
        type="button"
        class="lift-btn"
        aria-label="▼"
        disabled={s.floor <= 0}
        onClick={() => {
          actions.setFloor(s.floor - 1);
        }}
      >
        ▼
      </button>
      <span class="lift-floor">
        <span class="lift-n">{s.floor + 1}</span>
        <span class="lift-name">{floorName(s.floor)}</span>
      </span>
      <button
        type="button"
        class={`lift-btn ${nextAffordable && s.floor + 1 === s.floorsUnlocked ? "glow" : ""}`}
        aria-label="▲"
        disabled={s.floor >= top}
        onClick={() => {
          actions.setFloor(s.floor + 1);
        }}
      >
        ▲
      </button>
    </div>
  );
}

export function App({ store, actions, atlas }: Props) {
  const s = useStore(store);
  const locked = s.floor >= s.floorsUnlocked;
  const hireLabel = s.hasSpace ? t("hire") : t("noSpace");
  const blat = !locked && s.hasSpace && !s.canHire && s.hint === null;
  return (
    <>
      <header class="hud-top">
        <div class="hud-row">
          <div class="money">
            <Icon atlas={atlas} frame="icon_kukish" size={34} />
            <div class="money-text">
              <span class="money-value">{fmt(s.kukishi)}</span>
              <span class={`money-income ${(s.buffs[BUFF_AVRAL] ?? 0) > 0 ? "avral" : ""}`}>
                +{fmt(s.income)}
                {t("perSec")}
              </span>
            </div>
          </div>
          <div class="hud-buttons">
            <BuffButton
              atlas={atlas}
              frame="envelope"
              left={s.buffs[BUFF_PREMIA] ?? 0}
              label={t("premia")}
              disabled={s.adBusy}
              onClick={actions.askPremia}
            />
            <BuffButton
              atlas={atlas}
              frame="coloid_0"
              left={s.buffs[BUFF_COLOID] ?? 0}
              label={t("coloid")}
              disabled={s.adBusy}
              onClick={actions.askColoid}
            />
            <button
              class="icon-btn"
              type="button"
              aria-label={t("sound")}
              onClick={actions.toggleMute}
            >
              <SoundIcon muted={s.muted} />
            </button>
          </div>
        </div>
        <div class="hud-row">
          <ShiftBar shift={s.shift} onOpen={actions.openShift} />
          <Lift s={s} actions={actions} />
        </div>
      </header>

      {s.debt > 0 ? (
        <div class="debt-chip">
          {t("debt")}: {fmt(s.debt)}
        </div>
      ) : null}

      {s.challenge ? (
        <div class={`challenge ${s.challenge.kind}`}>
          <span class="challenge-title">
            {t(s.challenge.kind === "shabashka" ? "shabashka" : "inspection")}{" "}
            {clock(s.challenge.left)}
          </span>
          <span class="challenge-text">
            {s.challenge.kind === "shabashka"
              ? tf("shabashkaDesc", { n: s.challenge.need })
              : tf("inspectionDesc", { n: fmt(s.challenge.need) })}
          </span>
          <Progress value={s.challenge.have} max={s.challenge.need} />
        </div>
      ) : null}

      {s.kredikOffer > 0 && s.modal === null && s.panel === "none" ? (
        <div class="kredik-bubble">
          <span class="kredik-title">{t("kredik")}</span>
          <span class="kredik-text">{tf("kredikOffer", { n: fmt(s.kredikOffer) })}</span>
          <span class="row">
            <button type="button" class="btn small gold" onClick={actions.acceptKredik}>
              {t("take")}
            </button>
            <button type="button" class="btn small" onClick={actions.declineKredik}>
              {t("decline")}
            </button>
          </span>
        </div>
      ) : null}

      {locked ? (
        <div class="floor-locked">
          <span class="floor-locked-title">
            {tf("floorN", { n: s.floor + 1 })} · {floorName(s.floor)}
          </span>
          <span class="floor-locked-sub">{t("floorLocked")}</span>
          <span class="floor-locked-text">{t("floorLockedText")}</span>
          <button
            type="button"
            class={`btn gold big ${s.kukishi >= s.unlockCost ? "" : "disabled"}`}
            onClick={actions.unlockFloor}
          >
            <Icon atlas={atlas} frame="icon_kukish" size={22} />
            {tf("unlockFor", { n: fmt(s.unlockCost) })}
          </button>
        </div>
      ) : !s.floorReady ? (
        <div class="floor-loading">{t("floorLoading")}</div>
      ) : null}

      {s.hint === "tap" || s.hint === "merge" ? (
        <div class="hint" style={{ left: `${s.hintX}px`, top: `${s.hintY}px` }}>
          {t(s.hint === "tap" ? "hintTap" : "hintMerge")}
        </div>
      ) : null}

      {s.stamp ? (
        <div
          key={s.stamp.id}
          class="stamp"
          style={{ left: `${s.stamp.x}px`, top: `${s.stamp.y}px` }}
        >
          {t("promotion")}
        </div>
      ) : null}

      {s.toast ? (
        <div key={s.toast.id} class="toast">
          <span class="toast-title">{s.toast.title}</span>
          {s.toast.text ? <span class="toast-rank">{s.toast.text}</span> : null}
        </div>
      ) : null}

      <footer class="hud-bottom">
        <div class={`slop-label ${s.dragging ? "visible" : ""}`}>{t("slop")}</div>
        {s.hint === "hire" ? <div class="hint hint-hire">{t("hintHire")}</div> : null}
        {blat ? (
          <button type="button" class="blat" disabled={s.adBusy} onClick={actions.hireBlat}>
            <span class="ad-mark">▶</span> {t("hire")}
          </button>
        ) : null}
        <button
          type="button"
          class="side-btn"
          aria-label={t("hrDept")}
          onClick={() => {
            actions.openPanel("hr");
          }}
        >
          <Icon atlas={atlas} frame="icon_stamp" size={34} />
          {s.hrBadge ? <span class="badge">!</span> : null}
        </button>
        <button
          key={`hire-${s.denyId}`}
          type="button"
          class={`hire ${s.canHire ? "" : "disabled"} ${s.hasSpace ? "" : "full"} ${s.denyId > 0 ? "denied" : ""} ${s.hint === "hire" ? "pulse" : ""} ${locked ? "hidden" : ""}`}
          onClick={actions.hire}
        >
          <Icon atlas={atlas} frame="icon_hire" size={40} />
          <span class="hire-text">
            <span class="hire-label">{hireLabel}</span>
            {s.hasSpace ? (
              <span class="hire-cost">
                <Icon atlas={atlas} frame="icon_kukish" size={18} />
                {fmt(s.hireCost)}
              </span>
            ) : null}
          </span>
        </button>
        <button
          type="button"
          class="side-btn"
          aria-label={t("tasks")}
          onClick={() => {
            actions.openPanel("tasks");
          }}
        >
          <Icon atlas={atlas} frame="icon_tasks" size={34} />
          {s.tasksBadge > 0 ? <span class="badge">{s.tasksBadge}</span> : null}
        </button>
      </footer>

      {s.panel === "hr" && s.hr ? (
        <HrPanel s={s} hr={s.hr} actions={actions} atlas={atlas} />
      ) : null}
      {s.panel === "tasks" && s.tasks ? (
        <TasksPanel tasks={s.tasks} actions={actions} atlas={atlas} />
      ) : null}
      {s.modal ? (
        <Modals modal={s.modal} adBusy={s.adBusy} actions={actions} atlas={atlas} />
      ) : null}
    </>
  );
}
