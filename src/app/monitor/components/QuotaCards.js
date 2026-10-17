"use client";

import {
  COLOR_CARD_BG,
  COLOR_CARD_BORDER,
  COLOR_CARD_ACTIVE_BG,
  COLOR_CARD_ACTIVE_BORDER,
  COLOR_TRACK_BG,
  COLOR_TEXT_PRIMARY,
  COLOR_TEXT_SECONDARY,
  COLOR_TEXT_TERTIARY,
  COLOR_APPLE_GREEN,
  COLOR_APPLE_ORANGE,
  COLOR_APPLE_RED,
  COLOR_APPLE_TEAL,
  COLOR_PUBG_RED,
  AVATAR_PALETTE,
  getStatusColor,
  truncateMiddle,
} from "../utils/quotaLogic";

function CapsuleBar({ currentPct, redPct, color }) {
  const clampedCurr = Math.max(0, Math.min(100, currentPct || 0));
  const clampedRed = Math.max(0, Math.min(100, redPct !== undefined && redPct !== null ? redPct : clampedCurr));
  const showRed = clampedRed > clampedCurr;

  return (
    <div
      className="relative w-full h-[8px] rounded-full overflow-hidden"
      style={{ backgroundColor: COLOR_TRACK_BG }}
    >
      {/* Layer 2: PUBG Red damage drain bar */}
      {showRed && (
        <div
          className="absolute top-0 left-0 bottom-0 rounded-full transition-all duration-500 ease-out"
          style={{
            width: `${clampedRed}%`,
            backgroundColor: COLOR_PUBG_RED,
          }}
        />
      )}

      {/* Layer 3: Active quota bar */}
      <div
        className="absolute top-0 left-0 bottom-0 rounded-full transition-all duration-700 ease-out"
        style={{
          width: `${clampedCurr}%`,
          backgroundColor: color,
        }}
      />
    </div>
  );
}

export default function QuotaCards({ accounts, error, isLoading, redStates }) {
  if (error) {
    return (
      <div
        className="p-6 rounded-2xl border text-center my-auto"
        style={{
          backgroundColor: COLOR_CARD_BG,
          borderColor: COLOR_APPLE_RED,
        }}
      >
        <span className="material-symbols-outlined text-4xl text-[#FF453A] mb-2">error</span>
        <h3 className="text-base font-semibold text-white">Connection Error</h3>
        <p className="text-sm text-[#989ba6] mt-1">{error}</p>
      </div>
    );
  }

  if (isLoading && (!accounts || accounts.length === 0)) {
    return (
      <div className="flex flex-col gap-3">
        {[1, 2, 3, 4, 5].map((i) => (
          <div
            key={i}
            className="h-[74px] rounded-2xl border animate-pulse flex items-center px-4 gap-4"
            style={{
              backgroundColor: COLOR_CARD_BG,
              borderColor: COLOR_CARD_BORDER,
            }}
          >
            <div className="w-10 h-10 rounded-full bg-white/5" />
            <div className="flex-1 space-y-2">
              <div className="w-28 h-4 bg-white/5 rounded" />
              <div className="w-16 h-3 bg-white/5 rounded" />
            </div>
            <div className="w-40 h-8 bg-white/5 rounded" />
            <div className="w-40 h-8 bg-white/5 rounded" />
          </div>
        ))}
      </div>
    );
  }

  if (!accounts || accounts.length === 0) {
    return (
      <div
        className="p-8 rounded-2xl border text-center my-auto"
        style={{
          backgroundColor: COLOR_CARD_BG,
          borderColor: COLOR_CARD_BORDER,
        }}
      >
        <span className="material-symbols-outlined text-4xl text-[#707380] mb-2">account_circle</span>
        <h3 className="text-base font-semibold text-white">No Antigravity Accounts Found</h3>
        <p className="text-sm text-[#989ba6] mt-1">Please add Antigravity provider connections in 9Router.</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2.5 h-full overflow-y-auto pr-1 custom-scrollbar">
      {accounts.map((acc, index) => {
        const rawName = acc.name || acc.email || "Account";
        const firstChar = (rawName[0] || "A").toUpperCase();
        const avatarColor = AVATAR_PALETTE[index % AVATAR_PALETTE.length];

        const g5Pct = Math.round(acc.gemini_5h?.pct ?? 0);
        const gwPct = Math.round(acc.gemini_weekly?.pct ?? 0);

        // Account health status dot
        let dotColor = COLOR_APPLE_GREEN;
        if (g5Pct <= 0 || gwPct <= 0) dotColor = COLOR_APPLE_RED;
        else if (g5Pct <= 20 || gwPct <= 20) dotColor = COLOR_APPLE_ORANGE;

        const c5 = getStatusColor(g5Pct);
        const cw = getStatusColor(gwPct);

        const isActive = !!acc.isActive;
        const cardBg = isActive ? COLOR_CARD_ACTIVE_BG : COLOR_CARD_BG;
        const cardBorder = isActive ? COLOR_CARD_ACTIVE_BORDER : COLOR_CARD_BORDER;

        // Red damage percentage from PUBG state tracker
        const red5h = redStates?.[acc.id]?.red_5h ?? g5Pct;
        const redWeekly = redStates?.[acc.id]?.red_weekly ?? gwPct;

        return (
          <div
            key={acc.id || index}
            className={`relative rounded-2xl border px-4 py-3 transition-all duration-300 ${
              isActive ? "shadow-[0_0_20px_rgba(10,132,255,0.12)] ring-1 ring-blue-500/30" : ""
            }`}
            style={{
              backgroundColor: cardBg,
              borderColor: cardBorder,
            }}
          >
            <div className="grid grid-cols-12 items-center gap-3">
              {/* Column 1: Avatar + Name (cols: 4) */}
              <div className="col-span-12 sm:col-span-4 flex items-center gap-3 min-w-0">
                {/* Monogram Avatar with Status Dot */}
                <div className="relative shrink-0">
                  <div
                    className="w-10 h-10 rounded-full flex items-center justify-center font-bold text-white text-base select-none shadow-sm"
                    style={{ backgroundColor: avatarColor }}
                  >
                    {firstChar}
                  </div>
                  {/* Status dot */}
                  <div
                    className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full border-2"
                    style={{
                      backgroundColor: dotColor,
                      borderColor: cardBg,
                    }}
                  />
                </div>

                {/* Account Name & Tier */}
                <div className="min-w-0 flex-1">
                  <div
                    className="text-sm font-semibold text-white truncate"
                    title={rawName}
                    style={{ fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Text', sans-serif" }}
                  >
                    {rawName}
                  </div>
                  <div className="flex items-center gap-1.5 mt-0.5">
                    <span className="text-[11px] font-normal" style={{ color: COLOR_TEXT_TERTIARY }}>
                      Antigravity
                    </span>
                    {isActive && (
                      <span
                        className="text-[10px] font-bold tracking-wider uppercase px-1.5 py-0.2 rounded"
                        style={{
                          color: COLOR_APPLE_TEAL,
                          backgroundColor: "rgba(100, 210, 255, 0.12)",
                        }}
                      >
                        • ACTIVE
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* Column 2: Gemini 5H Session (cols: 4) */}
              <div className="col-span-6 sm:col-span-4 flex flex-col justify-center min-w-0 px-1">
                <div className="flex items-baseline justify-between gap-1 mb-1.5">
                  <div className="flex items-center gap-1.5 truncate">
                    <span
                      className="text-[10px] font-bold tracking-wider uppercase"
                      style={{ color: COLOR_TEXT_SECONDARY }}
                    >
                      5H SESSION
                    </span>
                    {acc.gemini_5h?.reset && (
                      <span className="text-[11px] font-mono" style={{ color: COLOR_TEXT_TERTIARY }}>
                        {acc.gemini_5h.reset}
                      </span>
                    )}
                  </div>
                  <span
                    className="text-base font-bold font-mono tracking-tight shrink-0"
                    style={{ color: c5 }}
                  >
                    {g5Pct}%
                  </span>
                </div>
                {/* 3-Layer Capsule Progress Bar */}
                <CapsuleBar currentPct={g5Pct} redPct={red5h} color={c5} />
              </div>

              {/* Column 3: Gemini Weekly (cols: 4) */}
              <div className="col-span-6 sm:col-span-4 flex flex-col justify-center min-w-0 px-1">
                <div className="flex items-baseline justify-between gap-1 mb-1.5">
                  <div className="flex items-center gap-1.5 truncate">
                    <span
                      className="text-[10px] font-bold tracking-wider uppercase"
                      style={{ color: COLOR_TEXT_SECONDARY }}
                    >
                      WEEKLY
                    </span>
                    {acc.gemini_weekly?.reset && (
                      <span className="text-[11px] font-mono" style={{ color: COLOR_TEXT_TERTIARY }}>
                        {acc.gemini_weekly.reset}
                      </span>
                    )}
                  </div>
                  <span
                    className="text-base font-bold font-mono tracking-tight shrink-0"
                    style={{ color: cw }}
                  >
                    {gwPct}%
                  </span>
                </div>
                {/* 3-Layer Capsule Progress Bar */}
                <CapsuleBar currentPct={gwPct} redPct={redWeekly} color={cw} />
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
