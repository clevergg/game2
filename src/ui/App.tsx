/** Интерфейс поверх канваса: деньги, кнопка найма, штамп повышения, тост нового ранга, подсказки. */
import type { Atlas } from "../engine/atlas";
import { fmt, rankName, t } from "../i18n";
import { type Store, type UiState, useStore } from "./store";

export interface UiActions {
  readonly hire: () => void;
  readonly toggleMute: () => void;
}

interface Props {
  readonly store: Store<UiState>;
  readonly actions: UiActions;
  readonly atlas: Atlas;
}

function Icon({ atlas, frame, size }: { atlas: Atlas; frame: string; size: number }) {
  const i = atlas.frame(frame);
  const w = atlas.w[i] ?? 1;
  const h = atlas.h[i] ?? 1;
  const k = size / Math.max(w, h);
  const image = atlas.imageOf(i);
  return (
    <span
      class="atlas-icon"
      aria-hidden="true"
      style={{
        width: `${w * k}px`,
        height: `${h * k}px`,
        ...(image && {
          backgroundImage: `url(${image.src})`,
          backgroundPosition: `${-(atlas.x[i] ?? 0) * k}px ${-(atlas.y[i] ?? 0) * k}px`,
          backgroundSize: `${image.naturalWidth * k}px ${image.naturalHeight * k}px`,
        }),
      }}
    />
  );
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

export function App({ store, actions, atlas }: Props) {
  const s = useStore(store);
  const hireLabel = s.hasSpace ? t("hire") : t("noSpace");
  return (
    <>
      <header class="hud-top">
        <div class="money">
          <Icon atlas={atlas} frame="icon_kukish" size={34} />
          <div class="money-text">
            <span class="money-value">{fmt(s.kukishi)}</span>
            <span class="money-income">
              +{fmt(s.income)}
              {t("perSec")}
            </span>
          </div>
        </div>
        <button class="icon-btn" type="button" aria-label={t("sound")} onClick={actions.toggleMute}>
          <SoundIcon muted={s.muted} />
        </button>
      </header>

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
          <span class="toast-title">{t("newRank")}</span>
          <span class="toast-rank">{rankName(s.toast.rank)}</span>
        </div>
      ) : null}

      <footer class="hud-bottom">
        <div class={`slop-label ${s.dragging ? "visible" : ""}`}>{t("slop")}</div>
        {s.hint === "hire" ? <div class="hint hint-hire">{t("hintHire")}</div> : null}
        <button
          key={`hire-${s.denyId}`}
          type="button"
          class={`hire ${s.canHire ? "" : "disabled"} ${s.hasSpace ? "" : "full"} ${s.denyId > 0 ? "denied" : ""} ${s.hint === "hire" ? "pulse" : ""}`}
          onClick={actions.hire}
        >
          <Icon atlas={atlas} frame="icon_hire" size={46} />
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
      </footer>
    </>
  );
}
