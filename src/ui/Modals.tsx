/** Модальные окна: смена отшабашена, отгул, аванс, реорганизация, реклама за премию и калоид. */
import type { ComponentChildren } from "preact";
import type { Atlas } from "../engine/atlas";
import { fmt, t, tf } from "../i18n";
import type { UiActions } from "./actions";
import { Icon } from "./Icon";
import type { Modal } from "./store";

function Box(p: { title: string; children: ComponentChildren; onClose?: () => void }) {
  return (
    <div class="modal-backdrop">
      <section class="modal" role="dialog" aria-label={p.title}>
        <span class="modal-title">{p.title}</span>
        {p.children}
        {p.onClose ? (
          <button
            type="button"
            class="close-btn modal-close"
            aria-label={t("close")}
            onClick={p.onClose}
          >
            ✕
          </button>
        ) : null}
      </section>
    </div>
  );
}

function Reward({ atlas, amount }: { atlas: Atlas; amount: number }) {
  return (
    <span class="modal-reward">
      <Icon atlas={atlas} frame="icon_kukish" size={34} />+{fmt(amount)}
    </span>
  );
}

export function Modals(p: { modal: Modal; adBusy: boolean; actions: UiActions; atlas: Atlas }) {
  const { modal, actions, atlas } = p;
  switch (modal.kind) {
    case "shift":
      return (
        <Box title={t("shiftDone")}>
          <Icon atlas={atlas} frame="icon_clock" size={64} />
          <span class="modal-text">{t("shiftReward")}</span>
          <Reward atlas={atlas} amount={modal.reward} />
          <div class="modal-buttons">
            <button
              type="button"
              class="btn gold big"
              disabled={p.adBusy}
              onClick={() => {
                actions.claimShift(true);
              }}
            >
              <span class="ad-mark">▶</span> {t("double")}
            </button>
            <button
              type="button"
              class="btn"
              onClick={() => {
                actions.claimShift(false);
              }}
            >
              {t("claim")}
            </button>
          </div>
        </Box>
      );
    case "otgul":
      return (
        <Box title={t("otgul")}>
          <Icon atlas={atlas} frame="f0_b1_joy_0" size={80} />
          <span class="modal-text">{t("otgulText")}</span>
          <Reward atlas={atlas} amount={modal.amount} />
          <div class="modal-buttons">
            <button
              type="button"
              class="btn gold big"
              disabled={p.adBusy}
              onClick={() => {
                actions.claimOtgul(true);
              }}
            >
              <span class="ad-mark">▶</span> {t("double")}
            </button>
            <button
              type="button"
              class="btn"
              onClick={() => {
                actions.claimOtgul(false);
              }}
            >
              {t("claim")}
            </button>
          </div>
        </Box>
      );
    case "avans":
      return (
        <Box title={t("avans")}>
          <Icon atlas={atlas} frame="portrait_tosya" size={96} />
          <span class="modal-text">{tf("avansDay", { n: modal.streak })}</span>
          <span class="modal-small">{t("avansText")}</span>
          <Reward atlas={atlas} amount={modal.reward} />
          <div class="modal-buttons">
            <button type="button" class="btn gold big" onClick={actions.claimAvans}>
              {t("claim")}
            </button>
          </div>
        </Box>
      );
    case "reorg":
      return (
        <Box title={t("reorgConfirm")} onClose={actions.closeModal}>
          <Icon atlas={atlas} frame="portrait_alesya" size={96} />
          <span class="modal-small">{t("reorgDesc")}</span>
          <span class="modal-text">{tf("reorgGain", { n: fmt(modal.gain) })}</span>
          <div class="modal-buttons">
            <button type="button" class="btn gold big" onClick={actions.reorganize}>
              {t("reorgYes")}
            </button>
            <button type="button" class="btn" onClick={actions.closeModal}>
              {t("cancel")}
            </button>
          </div>
        </Box>
      );
    case "premia":
      return (
        <Box title={t("premia")} onClose={actions.closeModal}>
          <Icon atlas={atlas} frame="envelope" size={72} />
          <span class="modal-text">{tf("premiaDesc", { n: modal.mult })}</span>
          <div class="modal-buttons">
            <button
              type="button"
              class="btn gold big"
              disabled={p.adBusy}
              onClick={actions.watchPremia}
            >
              <span class="ad-mark">▶</span> {t("watchAd")}
            </button>
          </div>
        </Box>
      );
    case "coloid":
      return (
        <Box title={t("coloid")} onClose={actions.closeModal}>
          <Icon atlas={atlas} frame="coloid_0" size={72} />
          <span class="modal-text">{t("coloidDesc")}</span>
          <div class="modal-buttons">
            <button
              type="button"
              class="btn gold big"
              disabled={p.adBusy}
              onClick={actions.watchColoid}
            >
              <span class="ad-mark">▶</span> {t("watchAd")}
            </button>
          </div>
        </Box>
      );
  }
}
