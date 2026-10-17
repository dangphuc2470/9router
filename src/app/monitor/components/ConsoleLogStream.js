"use client";

import { useState, useEffect, useRef } from "react";
import {
  COLOR_CARD_BG,
  COLOR_CARD_BORDER,
  COLOR_TEXT_SECONDARY,
  COLOR_TEXT_TERTIARY,
  COLOR_APPLE_GREEN,
  COLOR_APPLE_RED,
  COLOR_APPLE_BLUE,
  COLOR_APPLE_ORANGE,
  COLOR_APPLE_PURPLE,
  COLOR_APPLE_TEAL,
} from "../utils/quotaLogic";

function parseLogLine(rawLine) {
  if (typeof rawLine !== "string") return <span>{String(rawLine)}</span>;

  // Error lines
  if (rawLine.includes("❌") || rawLine.includes("[ERROR]") || rawLine.includes("failed")) {
    return <span style={{ color: COLOR_APPLE_RED }}>{rawLine}</span>;
  }

  // Token refresh lines
  if (rawLine.includes("[TOKEN_REFRESH]") || rawLine.includes("[BG_TOKEN_REFRESH]")) {
    return <span style={{ color: COLOR_APPLE_PURPLE }}>{rawLine}</span>;
  }

  // Highlight structured parts: [HH:mm:ss] 🔵 ▶ POST ... or 🔵 📊 DONE ...
  const parts = [];
  let remaining = rawLine;

  // Extract timestamp [HH:mm:ss]
  const tsMatch = remaining.match(/^(\[\d{2}:\d{2}:\d{2}\])\s*/);
  if (tsMatch) {
    parts.push(
      <span key="ts" style={{ color: COLOR_TEXT_TERTIARY }} className="font-semibold mr-1.5 select-none">
        {tsMatch[1]}
      </span>
    );
    remaining = remaining.slice(tsMatch[0].length);
  }

  // Check if DONE line
  if (remaining.includes("DONE")) {
    return (
      <span>
        {parts}
        <span style={{ color: COLOR_APPLE_GREEN }} className="font-medium">
          {remaining}
        </span>
      </span>
    );
  }

  // Check if POST request line
  if (remaining.includes("POST")) {
    return (
      <span>
        {parts}
        <span style={{ color: COLOR_APPLE_BLUE }} className="font-medium">
          {remaining}
        </span>
      </span>
    );
  }

  // Fallback
  return (
    <span>
      {parts}
      <span style={{ color: "#d1d5db" }}>{remaining}</span>
    </span>
  );
}

export default function ConsoleLogStream() {
  const [logs, setLogs] = useState([]);
  const [connected, setConnected] = useState(false);
  const [filter, setFilter] = useState("all"); // "all", "requests", "done", "errors"
  const [autoScroll, setAutoScroll] = useState(true);
  const logContainerRef = useRef(null);

  useEffect(() => {
    let es;
    try {
      es = new EventSource("/api/translator/console-logs/stream");

      es.onopen = () => setConnected(true);

      es.onmessage = (e) => {
        try {
          const msg = JSON.parse(e.data);
          if (msg.type === "init") {
            setLogs((msg.logs || []).slice(-300));
          } else if (msg.type === "line") {
            setLogs((prev) => [...prev.slice(-299), msg.line]);
          } else if (msg.type === "lines") {
            setLogs((prev) => [...prev, ...msg.lines].slice(-300));
          } else if (msg.type === "clear") {
            setLogs([]);
          }
        } catch (err) {
          console.error("SSE parse error:", err);
        }
      };

      es.onerror = () => setConnected(false);
    } catch (err) {
      console.error("EventSource failed:", err);
    }

    return () => {
      if (es) es.close();
    };
  }, []);

  // Auto-scroll on new log lines
  useEffect(() => {
    if (autoScroll && logContainerRef.current) {
      logContainerRef.current.scrollTop = logContainerRef.current.scrollHeight;
    }
  }, [logs, autoScroll]);

  const handleClear = async () => {
    try {
      await fetch("/api/translator/console-logs", { method: "DELETE" });
      setLogs([]);
    } catch (err) {
      console.error("Failed to clear logs:", err);
    }
  };

  const filteredLogs = logs.filter((line) => {
    if (filter === "requests") return line.includes("POST") || line.includes("▶");
    if (filter === "done") return line.includes("DONE") || line.includes("📊");
    if (filter === "errors") return line.includes("❌") || line.includes("ERROR") || line.includes("failed");
    return true;
  });

  return (
    <div
      className="flex flex-col h-full rounded-2xl border overflow-hidden shadow-2xl transition-all"
      style={{
        backgroundColor: "#111318",
        borderColor: COLOR_CARD_BORDER,
      }}
    >
      {/* Console Top Bar (Apple Window Style) */}
      <div
        className="shrink-0 flex items-center justify-between px-4 py-2.5 border-b select-none"
        style={{
          backgroundColor: "#16181e",
          borderColor: COLOR_CARD_BORDER,
        }}
      >
        {/* Left: Terminal Icon & Title */}
        <div className="flex items-center gap-2">
          <span className="material-symbols-outlined text-[16px]" style={{ color: COLOR_APPLE_BLUE }}>
            terminal
          </span>
          <span
            className="text-xs font-semibold text-white tracking-tight flex items-center gap-1.5"
            style={{ fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Text', sans-serif" }}
          >
            Console Stream
            <span
              className="text-[10px] font-mono px-1.5 py-0.5 rounded-full bg-white/5 border border-white/10"
              style={{ color: COLOR_TEXT_TERTIARY }}
            >
              {filteredLogs.length}
            </span>
          </span>
        </div>

        {/* Center: Filter Pills */}
        <div className="hidden sm:flex items-center gap-1 bg-black/40 p-0.5 rounded-lg border border-white/5 text-[11px]">
          {[
            { id: "all", label: "All" },
            { id: "requests", label: "Requests" },
            { id: "done", label: "Done" },
            { id: "errors", label: "Errors" },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setFilter(tab.id)}
              className={`px-2 py-0.5 rounded-md font-medium transition-colors ${
                filter === tab.id
                  ? "bg-white/15 text-white shadow-sm"
                  : "text-[#707380] hover:text-white"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Right: Auto-scroll & Clear */}
        <div className="flex items-center gap-1.5">
          {/* Connection pulse badge */}
          <div
            className="flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium border"
            style={{
              backgroundColor: connected ? "rgba(48, 209, 88, 0.1)" : "rgba(255, 69, 58, 0.1)",
              borderColor: connected ? "rgba(48, 209, 88, 0.25)" : "rgba(255, 69, 58, 0.25)",
              color: connected ? COLOR_APPLE_GREEN : COLOR_APPLE_RED,
            }}
          >
            <span
              className={`w-1.5 h-1.5 rounded-full ${connected ? "bg-[#30D158] animate-pulse" : "bg-[#FF453A]"}`}
            />
            <span className="hidden xl:inline">{connected ? "LIVE" : "DISCONNECTED"}</span>
          </div>

          {/* Auto-scroll toggle */}
          <button
            onClick={() => setAutoScroll(!autoScroll)}
            title={autoScroll ? "Auto-scroll ON (click to pause)" : "Auto-scroll PAUSED (click to resume)"}
            className={`p-1 rounded-md transition-colors ${
              autoScroll ? "text-[#64D2FF] bg-[#64D2FF]/10" : "text-[#707380] hover:text-white"
            }`}
          >
            <span className="material-symbols-outlined text-[16px]">
              {autoScroll ? "vertical_align_bottom" : "pause"}
            </span>
          </button>

          {/* Clear button */}
          <button
            onClick={handleClear}
            title="Clear Console"
            className="p-1 rounded-md text-[#707380] hover:text-[#FF453A] transition-colors"
          >
            <span className="material-symbols-outlined text-[16px]">delete</span>
          </button>
        </div>
      </div>

      {/* Console Content Window */}
      <div
        ref={logContainerRef}
        onWheel={() => {
          // If user scrolls up, turn off autoScroll temporarily
          if (logContainerRef.current) {
            const { scrollTop, scrollHeight, clientHeight } = logContainerRef.current;
            if (scrollHeight - scrollTop - clientHeight > 40) {
              setAutoScroll(false);
            }
          }
        }}
        className="flex-1 p-3.5 overflow-y-auto text-[11px] leading-[1.6] space-y-1 select-text custom-scrollbar"
        style={{
          fontFamily: "'SF Mono', Monaco, Menlo, 'JetBrains Mono', Consolas, monospace",
          backgroundColor: "#0d0e12",
        }}
      >
        {filteredLogs.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center py-10">
            <span className="material-symbols-outlined text-3xl mb-2 text-[#262934]">terminal</span>
            <span className="text-xs text-[#707380]">No console logs captured yet.</span>
            <span className="text-[10px] text-[#4b4e5a] mt-1">
              Requests routed through 9Router will stream here in real time.
            </span>
          </div>
        ) : (
          filteredLogs.map((line, idx) => (
            <div
              key={idx}
              className="hover:bg-white/[0.03] px-1 py-0.5 rounded transition-colors break-words whitespace-pre-wrap"
            >
              {parseLogLine(line)}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
