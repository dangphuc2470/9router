"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import {
  COLOR_CARD_BG,
  COLOR_CARD_BORDER,
  COLOR_TEXT_PRIMARY,
  COLOR_TEXT_SECONDARY,
  COLOR_TEXT_TERTIARY,
  COLOR_APPLE_GREEN,
  COLOR_APPLE_TEAL,
} from "../utils/quotaLogic";

export default function MonitorHeader({
  activeAccount,
  accountCount,
  onRefresh,
  isRefreshing,
  countdown,
}) {
  const [timeStr, setTimeStr] = useState("");
  const [isFullscreen, setIsFullscreen] = useState(false);

  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      const time = now.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false });
      const date = now.toLocaleDateString([], { month: "short", day: "numeric" });
      setTimeStr(`${time}  •  ${date}`);
    };
    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const handleFsChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener("fullscreenchange", handleFsChange);
    return () => document.removeEventListener("fullscreenchange", handleFsChange);
  }, []);

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {});
    } else {
      document.exitFullscreen().catch(() => {});
    }
  };

  return (
    <header
      className="shrink-0 flex items-center justify-between px-5 py-3 border-b select-none transition-colors"
      style={{
        backgroundColor: "#0c0d11",
        borderColor: COLOR_CARD_BORDER,
      }}
    >
      {/* Left: Apple Brand + Title + Badge */}
      <div className="flex items-center gap-3">
        {/* Apple Logo SVG */}
        <svg
          className="w-5 h-5 fill-current text-white"
          viewBox="0 0 170 170"
          xmlns="http://www.w3.org/2000/svg"
        >
          <path d="M150.37 130.25c-2.45 5.66-5.35 10.87-8.71 15.66-4.58 6.53-8.33 11.05-11.22 13.56-4.48 4.12-9.28 6.23-14.42 6.35-3.69 0-8.14-1.05-13.32-3.18-5.19-2.12-9.97-3.17-14.34-3.17-4.58 0-9.49 1.05-14.75 3.17-5.26 2.13-9.5 3.24-12.74 3.35-4.35.13-9.16-1.9-14.42-6.08-3.7-3.04-7.66-7.85-11.89-14.44-6.3-9.86-11.33-21.2-15.09-34.02-3.76-12.82-5.64-24.64-5.64-35.46 0-14.44 3.65-26.43 10.96-35.98 7.3-9.55 16.48-14.44 27.53-14.67 4.9.11 10.15 1.34 15.76 3.68 5.61 2.34 9.3 3.59 11.07 3.75 1.52-.22 5.38-1.57 11.59-4.06 6.21-2.49 11.66-3.6 16.36-3.34 12.3.65 22.37 5.37 30.2 14.16-10.78 6.53-16.06 15.54-15.84 27.04.22 9.04 3.76 16.66 10.63 22.86 6.87 6.2 14.88 9.68 24.03 10.45-2.39 7.18-5.32 14.54-8.8 22.09zM119.22 31.86c0-7.39 2.65-14.28 7.95-20.67 5.3-6.39 11.95-10.48 19.95-12.27.32 1.3.49 2.65.49 4.04 0 7.39-2.82 14.61-8.47 21.67-5.65 7.07-12.28 11.23-19.92 12.49-.01-1.74-.0-3.5-.0-5.26z" />
        </svg>

        <h1
          className="text-base font-bold tracking-tight text-white"
          style={{ fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Display', sans-serif" }}
        >
          Quota Monitor
        </h1>

        <div
          className="px-2.5 py-0.5 rounded-full text-[10px] font-bold tracking-wider uppercase border"
          style={{
            backgroundColor: "#1c1e27",
            borderColor: COLOR_CARD_BORDER,
            color: COLOR_APPLE_TEAL,
          }}
        >
          9ROUTER
        </div>

        {/* Live indicator dot */}
        <div className="hidden sm:flex items-center gap-1.5 ml-2 px-2.5 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-[11px] font-medium">
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
          <span>LIVE</span>
        </div>
      </div>

      {/* Center: Active Account indicator */}
      {activeAccount && (
        <div className="hidden md:flex items-center gap-2 px-3 py-1 rounded-full bg-[#16181e] border border-[#262934] text-xs">
          <span className="text-[#989ba6]">Active Account:</span>
          <span className="font-semibold text-[#64D2FF]">
            {activeAccount.name || activeAccount.email || "Account"}
          </span>
          <span className="w-1.5 h-1.5 rounded-full bg-[#30D158]" />
        </div>
      )}

      {/* Right: Clock + Actions */}
      <div className="flex items-center gap-2.5">
        {/* Clock Capsule */}
        <div
          className="flex items-center gap-2 px-3.5 py-1.5 rounded-full border text-xs font-medium"
          style={{
            backgroundColor: COLOR_CARD_BG,
            borderColor: COLOR_CARD_BORDER,
            color: COLOR_TEXT_SECONDARY,
          }}
        >
          <span
            className="w-2 h-2 rounded-full animate-pulse"
            style={{ backgroundColor: COLOR_APPLE_GREEN }}
          />
          <span className="font-mono tracking-tight">{timeStr || "Loading..."}</span>
        </div>

        {/* Refresh button with countdown */}
        <button
          onClick={onRefresh}
          disabled={isRefreshing}
          title="Manual refresh"
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-xs font-medium transition-all hover:bg-white/5 active:scale-95"
          style={{
            backgroundColor: COLOR_CARD_BG,
            borderColor: COLOR_CARD_BORDER,
            color: COLOR_TEXT_SECONDARY,
          }}
        >
          <span
            className={`material-symbols-outlined text-[16px] ${isRefreshing ? "animate-spin text-[#64D2FF]" : ""}`}
          >
            refresh
          </span>
          <span className="font-mono text-[11px] text-[#707380]">{countdown}s</span>
        </button>

        {/* Fullscreen Button */}
        <button
          onClick={toggleFullscreen}
          title={isFullscreen ? "Exit Fullscreen" : "Enter Fullscreen (Tablet Display)"}
          className="flex items-center justify-center w-8 h-8 rounded-full border text-white transition-all hover:bg-white/10 active:scale-95"
          style={{
            backgroundColor: COLOR_CARD_BG,
            borderColor: COLOR_CARD_BORDER,
          }}
        >
          <span className="material-symbols-outlined text-[18px]">
            {isFullscreen ? "fullscreen_exit" : "fullscreen"}
          </span>
        </button>

        {/* Return to Dashboard */}
        <Link
          href="/dashboard"
          title="Return to 9Router Dashboard"
          className="flex items-center justify-center w-8 h-8 rounded-full border text-[#989ba6] hover:text-white transition-all hover:bg-white/10"
          style={{
            backgroundColor: COLOR_CARD_BG,
            borderColor: COLOR_CARD_BORDER,
          }}
        >
          <span className="material-symbols-outlined text-[18px]">close</span>
        </Link>
      </div>
    </header>
  );
}
