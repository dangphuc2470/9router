import { NextResponse } from "next/server";
import { getMeta, setMeta } from "@/lib/db/helpers/metaStore.js";
import { exportUsageSince, importUsageEntries } from "@/lib/db/repos/usageRepo.js";

export const dynamic = "force-dynamic";

function normalizeNodeUrl(input) {
  if (!input) return "";
  let s = input.trim();
  if (!/^https?:\/\//i.test(s)) {
    s = "http://" + s;
  }
  try {
    const u = new URL(s);
    if (!u.port) {
      u.port = "20128";
    }
    return u.origin;
  } catch (_) {
    return s.replace(/\/+$/, "");
  }
}

export async function GET() {
  try {
    const remoteUrl = await getMeta("usage_sync_remote_url", "");
    const apiKey = await getMeta("usage_sync_remote_key", "");
    const lastSyncKey = remoteUrl ? `usage_sync_last_${encodeURIComponent(remoteUrl)}` : null;
    const lastSyncAt = lastSyncKey ? await getMeta(lastSyncKey, null) : null;

    return NextResponse.json({
      remoteUrl,
      hasApiKey: !!apiKey,
      lastSyncAt,
    });
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to get sync status" },
      { status: 500 }
    );
  }
}

export async function POST(request) {
  try {
    let body = {};
    try {
      body = await request.json();
    } catch (_) {}

    let rawUrl = body?.remoteUrl || (await getMeta("usage_sync_remote_url", ""));
    let apiKey = body?.apiKey !== undefined ? body.apiKey : (await getMeta("usage_sync_remote_key", ""));

    const remoteUrl = normalizeNodeUrl(rawUrl);
    if (!remoteUrl) {
      return NextResponse.json(
        { error: "Remote 9Router URL is required" },
        { status: 400 }
      );
    }

    const lastSyncKey = `usage_sync_last_${encodeURIComponent(remoteUrl)}`;
    const lastSyncAt = await getMeta(lastSyncKey, null);

    const headers = {
      "Content-Type": "application/json",
    };
    if (apiKey) {
      headers["Authorization"] = `Bearer ${apiKey}`;
      headers["x-api-key"] = apiKey;
    }

    // 1. PULL: Fetch delta usage entries from remote node
    const exportUrl = `${remoteUrl}/api/usage/sync/export${lastSyncAt ? `?since=${encodeURIComponent(lastSyncAt)}` : ""}`;
    const pullRes = await fetch(exportUrl, {
      method: "GET",
      headers,
      cache: "no-store",
    });

    if (!pullRes.ok) {
      const errText = await pullRes.text().catch(() => "");
      return NextResponse.json(
        { error: `Cannot reach remote node (${pullRes.status}): ${errText || pullRes.statusText}` },
        { status: 502 }
      );
    }

    const pullData = await pullRes.json();
    const remoteEntries = Array.isArray(pullData?.entries) ? pullData.entries : [];
    const pulledCount = await importUsageEntries(remoteEntries);

    // 2. PUSH: Send local delta usage entries to remote node
    let pushedCount = 0;
    const localDeltaEntries = await exportUsageSince(lastSyncAt);

    if (localDeltaEntries.length > 0) {
      try {
        const pushRes = await fetch(`${remoteUrl}/api/usage/sync/import`, {
          method: "POST",
          headers,
          body: JSON.stringify({ entries: localDeltaEntries }),
          cache: "no-store",
        });

        if (pushRes.ok) {
          const pushData = await pushRes.json();
          pushedCount = pushData?.count ?? localDeltaEntries.length;
        } else {
          console.warn("[API /usage/sync] Remote push failed with HTTP", pushRes.status);
        }
      } catch (pushErr) {
        console.warn("[API /usage/sync] Remote push error:", pushErr.message);
      }
    }

    // 3. Mark high watermark timestamp on success
    const now = new Date().toISOString();
    await setMeta(lastSyncKey, now);
    await setMeta("usage_sync_remote_url", remoteUrl);
    if (apiKey !== undefined) {
      await setMeta("usage_sync_remote_key", apiKey);
    }

    return NextResponse.json({
      success: true,
      remoteUrl,
      pulled: pulledCount,
      pushed: pushedCount,
      lastSyncAt: now,
    });
  } catch (error) {
    console.error("[API] Usage sync failed:", error);
    return NextResponse.json(
      { error: error?.message || "Sync operation failed" },
      { status: 500 }
    );
  }
}
