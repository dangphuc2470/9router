"use client";

import { useState, useEffect, useCallback } from "react";
import Button from "@/shared/components/Button";
import Modal from "@/shared/components/Modal";
import Input from "@/shared/components/Input";

const STORAGE_KEY_REMOTE_NODE = "9r_monitor_remote_node";

function timeAgo(isoString) {
  if (!isoString) return "";
  const diff = Math.floor((Date.now() - new Date(isoString).getTime()) / 1000);
  if (diff < 60) return "just now";
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

export default function UsageSyncButton({ onSyncSuccess }) {
  const [remoteUrl, setRemoteUrl] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [lastSyncAt, setLastSyncAt] = useState(null);
  const [isSyncing, setIsSyncing] = useState(false);
  const [showConfigModal, setShowConfigModal] = useState(false);
  const [syncStatusMsg, setSyncStatusMsg] = useState("");
  const [errorMessage, setErrorMessage] = useState("");

  // Load initial remote configuration from API or localStorage
  useEffect(() => {
    fetch("/api/usage/sync")
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (data?.remoteUrl) {
          setRemoteUrl(data.remoteUrl);
          setLastSyncAt(data.lastSyncAt);
        } else {
          // Fallback to monitor config in localStorage if present
          try {
            const raw = localStorage.getItem(STORAGE_KEY_REMOTE_NODE);
            if (raw && raw !== "unlinked") {
              const parsed = JSON.parse(raw);
              if (parsed?.url) {
                setRemoteUrl(parsed.url);
                if (parsed.apiKey) setApiKey(parsed.apiKey);
              }
            }
          } catch (_) {}
        }
      })
      .catch(() => {});
  }, []);

  const handleTriggerSync = useCallback(
    async (overrideUrl, overrideKey) => {
      const targetUrl = overrideUrl || remoteUrl;
      const targetKey = overrideKey !== undefined ? overrideKey : apiKey;

      if (!targetUrl) {
        setShowConfigModal(true);
        return;
      }

      setIsSyncing(true);
      setErrorMessage("");
      setSyncStatusMsg("");

      try {
        const res = await fetch("/api/usage/sync", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            remoteUrl: targetUrl,
            apiKey: targetKey,
          }),
        });

        const data = await res.json();
        if (!res.ok || data.error) {
          throw new Error(data.error || "Sync failed");
        }

        setLastSyncAt(data.lastSyncAt);
        setSyncStatusMsg(`Synced! +${data.pulled || 0} pulled, +${data.pushed || 0} pushed`);
        if (showConfigModal) setShowConfigModal(false);

        if (typeof onSyncSuccess === "function") {
          onSyncSuccess();
        }

        setTimeout(() => {
          setSyncStatusMsg("");
        }, 5000);
      } catch (err) {
        setErrorMessage(err.message || "Cannot connect to remote node");
      } finally {
        setIsSyncing(false);
      }
    },
    [remoteUrl, apiKey, showConfigModal, onSyncSuccess]
  );

  return (
    <div className="flex items-center gap-2">
      {syncStatusMsg && (
        <span className="text-xs text-green-500 font-medium animate-fadeIn">
          {syncStatusMsg}
        </span>
      )}
      {errorMessage && !showConfigModal && (
        <span className="text-xs text-red-500 font-medium" title={errorMessage}>
          Sync error
        </span>
      )}

      <div className="inline-flex items-center rounded-lg border border-border bg-surface-1 p-0.5">
        <Button
          variant="ghost"
          size="xs"
          onClick={() => handleTriggerSync()}
          disabled={isSyncing}
          loading={isSyncing}
          className="gap-1.5 px-2 text-xs"
          title={
            remoteUrl
              ? `Sync usage with ${remoteUrl}${lastSyncAt ? ` (Last: ${timeAgo(lastSyncAt)})` : ""}`
              : "Click to configure and sync with secondary machine"
          }
        >
          <span className="material-symbols-outlined text-[15px]">sync</span>
          <span>Sync Node</span>
          {lastSyncAt && (
            <span className="text-[10px] text-text-muted hidden md:inline">
              ({timeAgo(lastSyncAt)})
            </span>
          )}
        </Button>

        <button
          type="button"
          onClick={() => setShowConfigModal(true)}
          className="px-1.5 py-1 text-text-muted hover:text-text-main transition-colors rounded"
          title="Configure Remote Node URL"
        >
          <span className="material-symbols-outlined text-[15px]">settings</span>
        </button>
      </div>

      <Modal
        isOpen={showConfigModal}
        onClose={() => setShowConfigModal(false)}
        title="Sync Usage with Remote 9Router"
        size="md"
      >
        <div className="space-y-4 pt-2">
          <p className="text-xs text-text-muted">
            Connect to a secondary machine running 9Router. Syncing exchanges delta request records between both nodes without duplicate accumulation.
          </p>

          <div className="space-y-1">
            <label className="text-xs font-medium text-text-muted">
              Secondary 9Router Address (LAN IP:Port)
            </label>
            <Input
              value={remoteUrl}
              onChange={(e) => setRemoteUrl(e.target.value)}
              placeholder="e.g. 192.168.1.222:20128"
              fullWidth
            />
          </div>

          <div className="space-y-1">
            <label className="text-xs font-medium text-text-muted">
              Remote API Key (Optional)
            </label>
            <Input
              type="password"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder="Leave blank if requireApiKey is off"
              fullWidth
            />
          </div>

          {errorMessage && (
            <div className="text-xs text-red-500 bg-red-500/10 p-2.5 rounded-lg border border-red-500/20">
              {errorMessage}
            </div>
          )}

          <div className="flex items-center justify-end gap-2 pt-3">
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setShowConfigModal(false)}
              disabled={isSyncing}
            >
              Cancel
            </Button>
            <Button
              variant="primary"
              size="sm"
              onClick={() => handleTriggerSync(remoteUrl, apiKey)}
              loading={isSyncing}
              disabled={!remoteUrl.trim() || isSyncing}
            >
              Save & Sync Now
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
