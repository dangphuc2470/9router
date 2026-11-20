import fs from "fs";
import path from "path";
import { spawn } from "child_process";
import { getApiKeys, getSettings } from "@/lib/localDb";
import { DATA_DIR, MITM_DIR } from "@/mitm/paths";

export const AG255_PORT = Number(process.env.AG255_PROXY_PORT || 20443);
const AG255_PID_FILE = path.join(MITM_DIR, ".ag255.pid");
const AG255_LOG_FILE = path.join(DATA_DIR, "ag255.log");

export async function checkAg255Health() {
  try {
    const res = await fetch(`http://127.0.0.1:${AG255_PORT}/_ag255_health`, {
      signal: AbortSignal.timeout(800),
    });
    if (!res.ok) return { running: false, port: AG255_PORT };
    const data = await res.json();
    return { running: !!data?.ok, pid: data?.pid || null, port: AG255_PORT };
  } catch {
    return { running: false, port: AG255_PORT };
  }
}

function resolveProxyScriptPath() {
  const candidates = [
    path.join(process.cwd(), "src", "mitm", "ag255Proxy.js"),
    path.join(process.cwd(), "cli", "app", "src", "mitm", "ag255Proxy.js"),
  ];
  return candidates.find((p) => fs.existsSync(p)) || candidates[0];
}

export async function startAg255Proxy() {
  const current = await checkAg255Health();
  if (current.running) return current;

  const scriptPath = resolveProxyScriptPath();
  if (!fs.existsSync(scriptPath)) {
    throw new Error(`Proxy script not found: ${scriptPath}`);
  }

  const settings = await getSettings();
  const keys = await getApiKeys();
  const apiKey = keys?.[0]?.key || process.env.ROUTER_API_KEY || "";
  const routerBase = settings?.mitmRouterBaseUrl || `http://localhost:${process.env.PORT || 20128}`;

  fs.mkdirSync(path.dirname(AG255_LOG_FILE), { recursive: true });
  fs.mkdirSync(MITM_DIR, { recursive: true });
  const logFd = fs.openSync(AG255_LOG_FILE, "a");

  const child = spawn(process.execPath, [scriptPath], {
    detached: true,
    stdio: ["ignore", logFd, logFd],
    env: {
      ...process.env,
      ROUTER_API_KEY: apiKey,
      MITM_ROUTER_BASE: routerBase,
      AG255_PROXY_PORT: String(AG255_PORT),
    },
  });
  child.unref();
  try { fs.closeSync(logFd); } catch {}

  try {
    if (child.pid) fs.writeFileSync(AG255_PID_FILE, String(child.pid));
  } catch {}

  await new Promise((r) => setTimeout(r, 500));
  return await checkAg255Health();
}

export async function stopAg255Proxy() {
  const health = await checkAg255Health();
  const pids = new Set();
  if (health.pid) pids.add(Number(health.pid));
  try {
    if (fs.existsSync(AG255_PID_FILE)) {
      const filePid = Number(fs.readFileSync(AG255_PID_FILE, "utf8").trim());
      if (filePid) pids.add(filePid);
    }
  } catch {}

  for (const pid of pids) {
    try { process.kill(pid, "SIGTERM"); } catch {}
  }
  try { if (fs.existsSync(AG255_PID_FILE)) fs.unlinkSync(AG255_PID_FILE); } catch {}
  await new Promise((r) => setTimeout(r, 250));
  return await checkAg255Health();
}

export async function autoStartAg255Proxy() {
  try {
    const status = await startAg255Proxy();
    if (status.running) {
      console.log(`[InitApp] ag255Proxy running on 127.0.0.1:${status.port} (pid=${status.pid})`);
    }
  } catch (err) {
    console.log("[InitApp] ag255Proxy auto-start failed:", err.message);
  }
}
