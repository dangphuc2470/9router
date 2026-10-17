"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import MonitorHeader from "./components/MonitorHeader";
import QuotaCards from "./components/QuotaCards";
import ConsoleLogStream from "./components/ConsoleLogStream";
import { formatResetTime, COLOR_BG } from "./utils/quotaLogic";

const REFRESH_INTERVAL_SEC = 20;

export default function MonitorClient() {
  const [accounts, setAccounts] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState(null);
  const [countdown, setCountdown] = useState(REFRESH_INTERVAL_SEC);
  const [redStates, setRedStates] = useState({});

  // References for PUBG drain animation state
  const accStatesRef = useRef({});
  const weeklyBaselineRef = useRef({});
  const lastActiveIdRef = useRef(null);
  const animFrameRef = useRef(null);

  // Load persisted PUBG states on mount
  useEffect(() => {
    try {
      const s = localStorage.getItem("9r_monitor_acc_states");
      if (s) {
        const parsed = JSON.parse(s);
        for (const [k, v] of Object.entries(parsed)) {
          accStatesRef.current[k] = { ...v, draining: false };
        }
      }
      const w = localStorage.getItem("9r_monitor_weekly_baseline");
      if (w) weeklyBaselineRef.current = JSON.parse(w);
      const l = localStorage.getItem("9r_monitor_last_active_id");
      if (l) lastActiveIdRef.current = l;
    } catch (_) {}
  }, []);

  const savePersistedStates = useCallback(() => {
    try {
      localStorage.setItem("9r_monitor_acc_states", JSON.stringify(accStatesRef.current));
      localStorage.setItem("9r_monitor_weekly_baseline", JSON.stringify(weeklyBaselineRef.current));
      if (lastActiveIdRef.current) {
        localStorage.setItem("9r_monitor_last_active_id", lastActiveIdRef.current);
      }
    } catch (_) {}
  }, []);

  // Animation loop for smooth 2-second red bar drain
  const updateDrainAnimation = useCallback(() => {
    let hasActiveDrain = false;
    const now = performance.now();
    const newRedStates = {};

    for (const [id, st] of Object.entries(accStatesRef.current)) {
      let red5h = st.current_5h;
      if (st.draining) {
        const elapsed = (now - st.drain_start_time) / 1000.0;
        const duration = 2.0; // 2 seconds drain
        const progress = Math.min(1.0, elapsed / duration);
        red5h = st.drain_start_val - (st.drain_start_val - st.drain_target_val) * progress;

        if (progress >= 1.0) {
          st.draining = false;
          st.turn_start_5h = st.drain_target_val;
          red5h = st.drain_target_val;
        } else {
          hasActiveDrain = true;
        }
      } else {
        red5h = Math.max(st.current_5h, st.turn_start_5h ?? st.current_5h);
      }

      // Weekly baseline calculation
      const todayStr = new Date().toISOString().slice(0, 10);
      const base = weeklyBaselineRef.current[id];
      let redWeekly = st.current_weekly;
      if (base && base.day === todayStr) {
        redWeekly = Math.max(st.current_weekly, base.start_weekly ?? st.current_weekly);
      } else {
        weeklyBaselineRef.current[id] = { day: todayStr, start_weekly: st.current_weekly };
      }

      newRedStates[id] = { red_5h: red5h, red_weekly: redWeekly };
    }

    setRedStates(newRedStates);

    if (hasActiveDrain) {
      animFrameRef.current = requestAnimationFrame(updateDrainAnimation);
    }
  }, []);

  const handleAccountStateUpdate = useCallback((newAccounts) => {
    let currentActiveId = null;
    for (const acc of newAccounts) {
      if (acc.isActive) {
        currentActiveId = acc.id;
        break;
      }
    }

    const lastActiveId = lastActiveIdRef.current;

    // Account rotation detected
    if (currentActiveId !== lastActiveId && lastActiveId !== null) {
      // 1. Old account triggers 2-second drain
      if (accStatesRef.current[lastActiveId]) {
        const oldSt = accStatesRef.current[lastActiveId];
        const currVal = oldSt.current_5h ?? oldSt.turn_start_5h ?? 100;
        const startVal = oldSt.turn_start_5h ?? currVal;
        if (startVal > currVal) {
          oldSt.draining = true;
          oldSt.drain_start_val = startVal;
          oldSt.drain_target_val = currVal;
          oldSt.drain_start_time = performance.now();
        } else {
          oldSt.draining = false;
        }
      }

      // 2. New active account captures turn start point
      if (currentActiveId) {
        let curr5h = 0;
        for (const a of newAccounts) {
          if (a.id === currentActiveId) {
            curr5h = a.gemini_5h?.pct ?? 0;
            break;
          }
        }
        if (!accStatesRef.current[currentActiveId]) {
          accStatesRef.current[currentActiveId] = {
            turn_start_5h: curr5h,
            draining: false,
            current_5h: curr5h,
            current_weekly: 0,
            drain_start_val: curr5h,
            drain_target_val: curr5h,
            drain_start_time: 0,
          };
        } else {
          const newSt = accStatesRef.current[currentActiveId];
          newSt.turn_start_5h = curr5h;
          newSt.current_5h = curr5h;
          newSt.draining = false;
        }
      }

      lastActiveIdRef.current = currentActiveId;
    } else if (lastActiveId === null && currentActiveId !== null) {
      lastActiveIdRef.current = currentActiveId;
    }

    // Update current quotas for all accounts
    for (const acc of newAccounts) {
      const id = acc.id;
      const c5 = acc.gemini_5h?.pct ?? 0;
      const cw = acc.gemini_weekly?.pct ?? 0;

      if (!accStatesRef.current[id]) {
        accStatesRef.current[id] = {
          turn_start_5h: c5,
          draining: false,
          current_5h: c5,
          current_weekly: cw,
          drain_start_val: c5,
          drain_target_val: c5,
          drain_start_time: 0,
        };
      } else {
        const st = accStatesRef.current[id];
        st.current_5h = c5;
        st.current_weekly = cw;
        if (id === currentActiveId && c5 > (st.turn_start_5h ?? c5)) {
          st.turn_start_5h = c5;
        }
      }
    }

    savePersistedStates();
    updateDrainAnimation();
  }, [updateDrainAnimation, savePersistedStates]);

  const fetchData = useCallback(async () => {
    setIsRefreshing(true);
    try {
      const res = await fetch("/api/providers/client?pageSize=50");
      if (!res.ok) throw new Error(`HTTP ${res.status}: Failed to fetch connections`);

      const data = await res.json();
      const allConns = data.connections || [];
      const agConns = allConns.filter(
        (c) => c.provider === "antigravity" && c.isActive !== false
      );

      const targetConns = agConns.length > 0 ? agConns : allConns;

      // Fetch usage/quota for each account in parallel
      const accountPromises = targetConns.map(async (conn) => {
        const rawName = conn.name || conn.email || "Account";
        const shortName = rawName.split("@")[0];
        let gemini5hPct = 0;
        let gemini5hReset = "";
        let geminiWeeklyPct = 0;
        let geminiWeeklyReset = "";

        try {
          const qRes = await fetch(`/api/usage/${conn.id}`);
          if (qRes.ok) {
            const qData = await qRes.json();
            const quotas = qData.quotas || {};

            const gSess = quotas.gemini_session;
            if (gSess) {
              gemini5hPct = Math.round(gSess.remainingPercentage ?? 0);
              gemini5hReset = formatResetTime(gSess.resetAt);
            }

            const gWeek = quotas.gemini_weekly;
            if (gWeek) {
              geminiWeeklyPct = Math.round(gWeek.remainingPercentage ?? 0);
              geminiWeeklyReset = formatResetTime(gWeek.resetAt);
            }
          }
        } catch (qErr) {
          console.warn(`Error fetching quota for ${conn.id}:`, qErr);
        }

        return {
          id: conn.id,
          name: shortName,
          full_name: rawName,
          email: conn.email || rawName,
          priority: conn.priority ?? 99,
          lastUsedAt: conn.lastUsedAt || "",
          gemini_5h: {
            pct: gemini5hPct,
            reset: gemini5hReset,
          },
          gemini_weekly: {
            pct: geminiWeeklyPct,
            reset: geminiWeeklyReset,
          },
        };
      });

      const parsedAccounts = await Promise.all(accountPromises);
      parsedAccounts.sort((a, b) => a.priority - b.priority);

      // Determine active account by latest lastUsedAt timestamp
      let activeId = null;
      let latestTs = "";
      for (const acc of parsedAccounts) {
        const ts = acc.lastUsedAt || "";
        if (ts && ts > latestTs) {
          latestTs = ts;
          activeId = acc.id;
        }
      }

      for (const acc of parsedAccounts) {
        acc.isActive = acc.id === activeId && activeId !== null;
      }

      setAccounts(parsedAccounts);
      setError(null);
      handleAccountStateUpdate(parsedAccounts);
    } catch (err) {
      console.error("Monitor fetch error:", err);
      setError(err.message);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [handleAccountStateUpdate]);

  // Initial fetch and auto-refresh countdown
  useEffect(() => {
    fetchData();

    const timer = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          fetchData();
          return REFRESH_INTERVAL_SEC;
        }
        return prev - 1;
      });
    }, 1000);

    return () => {
      clearInterval(timer);
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    };
  }, [fetchData]);

  const activeAccount = accounts.find((a) => a.isActive);

  return (
    <div
      className="flex flex-col h-screen w-screen overflow-hidden text-white"
      style={{
        backgroundColor: COLOR_BG,
        fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'Segoe UI', Roboto, sans-serif",
      }}
    >
      {/* Top Bar Header */}
      <MonitorHeader
        activeAccount={activeAccount}
        accountCount={accounts.length}
        onRefresh={() => {
          setCountdown(REFRESH_INTERVAL_SEC);
          fetchData();
        }}
        isRefreshing={isRefreshing}
        countdown={countdown}
      />

      {/* Main 2-Column Responsive Layout (Tablet 1920x1200 Optimized) */}
      <main className="flex-1 min-h-0 grid grid-cols-1 lg:grid-cols-12 gap-5 px-6 lg:px-8 py-4 lg:pb-6">
        {/* Left Column: Turing Quota Cards (7 of 12 cols = ~58%) */}
        <section className="lg:col-span-7 flex flex-col h-full min-h-0 overflow-hidden">
          <div className="flex items-center justify-between pb-2.5 px-1 shrink-0">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold tracking-wider text-[#989ba6] uppercase">
                Active Provider Quotas
              </span>
              <span className="text-[11px] font-mono px-2 py-0.5 rounded-full bg-white/5 border border-white/10 text-[#707380]">
                {accounts.length} Accounts
              </span>
            </div>
            <div className="text-[11px] text-[#707380] font-medium hidden sm:block">
              Auto-rotated via 9Router
            </div>
          </div>

          <div className="flex-1 min-h-0">
            <QuotaCards
              accounts={accounts}
              error={error}
              isLoading={isLoading}
              redStates={redStates}
            />
          </div>
        </section>

        {/* Right Column: Apple-style Live Console Log Stream (5 of 12 cols = ~42%) */}
        <section className="lg:col-span-5 flex flex-col h-full min-h-0 overflow-hidden">
          <div className="flex items-center justify-between pb-2.5 px-1 shrink-0">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold tracking-wider text-[#989ba6] uppercase">
                Live Event Inspector
              </span>
              <span className="text-[11px] font-mono px-2 py-0.5 rounded-full bg-white/5 border border-white/10 text-[#707380]">
                SSE Stream
              </span>
            </div>
            <div className="text-[11px] text-[#707380] font-medium hidden sm:block">
              Real-time Passthrough
            </div>
          </div>

          <div className="flex-1 min-h-0">
            <ConsoleLogStream />
          </div>
        </section>
      </main>
    </div>
  );
}
