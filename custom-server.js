const http = require("http");
const path = require("path");
const fs = require("fs");
const os = require("os");
const crypto = require("crypto");
const { pathToFileURL } = require("url");

const origCreate = http.createServer.bind(http);

// Per-process secret proving x-9r-real-ip was stamped below rather than sent by the client.
// A bare `next start` / `next dev` never loads this file, so it cannot produce a matching
// header even though the env var is inherited by child processes. Named like x-9r-cli-token
// so the request-detail header sanitizer redacts it too.
const PEER_TOKEN = crypto.randomBytes(24).toString("hex");
process.env.NINEROUTER_PEER_TOKEN = PEER_TOKEN;

let backgroundRefreshStarted = false;

function startBackgroundTokenRefreshFromCustomServer() {
  if (backgroundRefreshStarted) return;
  backgroundRefreshStarted = true;
  // Prefer source path (repo / standalone that still has src). Fail-open if missing
  // — initializeApp also starts the same scheduler when the Next app boots.
  const modPath = path.join(__dirname, "src", "sse", "services", "backgroundTokenRefresh.js");
  import(pathToFileURL(modPath).href)
    .then((m) => {
      try {
        m.startBackgroundTokenRefresh();
      } catch (e) {
        console.error("[BackgroundTokenRefresh] start failed:", e && e.message ? e.message : e);
      }
      const stop = () => {
        try {
          m.stopBackgroundTokenRefresh();
        } catch {
          /* ignore */
        }
      };
      process.once("SIGINT", stop);
      process.once("SIGTERM", stop);
    })
    .catch((e) => {
      // Expected in published CLI standalone (src/ not on disk). App bootstrap covers it.
      if (process.env.DEBUG_BACKGROUND_TOKEN_REFRESH) {
        console.error("[BackgroundTokenRefresh] import failed:", e && e.message ? e.message : e);
      }
    });
}

function getQuickMitmStatus() {
  let running = false;
  let pid = null;
  const pidFile = path.join(os.homedir(), ".9router", "mitm", ".mitm.pid");
  try {
    if (fs.existsSync(pidFile)) {
      const p = parseInt(fs.readFileSync(pidFile, "utf8").trim(), 10);
      if (p && !isNaN(p)) {
        try {
          process.kill(p, 0);
          running = true;
          pid = p;
        } catch (_) {}
      }
    }
  } catch (_) {}

  let dnsAntigravity = false;
  try {
    const hostsFile = process.platform === "win32"
      ? path.join(process.env.SystemRoot || "C:\\Windows", "System32", "drivers", "etc", "hosts")
      : "/etc/hosts";
    if (fs.existsSync(hostsFile)) {
      const content = fs.readFileSync(hostsFile, "utf8");
      dnsAntigravity = content.includes("cloudcode-pa.googleapis.com") || content.includes("daily-cloudcode-pa.googleapis.com");
    }
  } catch (_) {}

  return {
    running,
    pid,
    certExists: true,
    certTrusted: true,
    dnsStatus: {
      antigravity: dnsAntigravity
    }
  };
}

// Wrap Next standalone HTTP server: derive client IP from the TCP socket
// (unspoofable) and strip client-supplied forwarding headers so downstream
// rate-limiting keys on the real peer address instead of attacker-controlled XFF.
http.createServer = (...args) => {
  const handler = args.find((a) => typeof a === "function");
  const rest = args.filter((a) => typeof a !== "function");
  if (!handler) return origCreate(...args);
  const wrapped = (req, res) => {
    const rawUrl = req.url || "/";
    if (rawUrl === "/monitor" || rawUrl === "/monitor/" || rawUrl.startsWith("/monitor?")) {
      const monitorPaths = [
        path.join(__dirname, "public", "monitor", "index.html"),
        path.join(process.cwd(), "public", "monitor", "index.html"),
        path.join(__dirname, "..", "public", "monitor", "index.html"),
      ];
      for (const p of monitorPaths) {
        if (fs.existsSync(p)) {
          res.writeHead(200, {
            "Content-Type": "text/html; charset=utf-8",
            "Cache-Control": "no-cache, no-store, must-revalidate",
            "Pragma": "no-cache",
            "Expires": "0",
          });
          fs.createReadStream(p).pipe(res);
          return;
        }
      }
    }
    if (rawUrl === "/monitor-launcher.js" || rawUrl.startsWith("/monitor-launcher.js?")) {
      const launcherPaths = [
        path.join(__dirname, "public", "monitor-launcher.js"),
        path.join(process.cwd(), "public", "monitor-launcher.js"),
        path.join(__dirname, "..", "public", "monitor-launcher.js"),
      ];
      for (const p of launcherPaths) {
        if (fs.existsSync(p)) {
          res.writeHead(200, { "Content-Type": "application/javascript; charset=utf-8" });
          fs.createReadStream(p).pipe(res);
          return;
        }
      }
    }
    if (rawUrl === "/api/monitor/states" || rawUrl.startsWith("/api/monitor/states?")) {
      const stateFile = path.join(os.homedir(), ".9router", "monitor-quota-states.json");
      if (req.method === "GET") {
        if (fs.existsSync(stateFile)) {
          res.writeHead(200, { "Content-Type": "application/json; charset=utf-8" });
          fs.createReadStream(stateFile).pipe(res);
        } else {
          res.writeHead(200, { "Content-Type": "application/json; charset=utf-8" });
          res.end(JSON.stringify({ accStates: {}, weeklyBaseline: {}, lastActiveId: null }));
        }
        return;
      }
      if (req.method === "POST" || req.method === "PUT") {
        let body = "";
        req.on("data", (chunk) => (body += chunk));
        req.on("end", () => {
          try {
            const parsed = JSON.parse(body);
            fs.writeFileSync(stateFile, JSON.stringify(parsed, null, 2), "utf8");
            res.writeHead(200, { "Content-Type": "application/json; charset=utf-8" });
            res.end(JSON.stringify({ success: true }));
          } catch (e) {
            res.writeHead(400, { "Content-Type": "application/json; charset=utf-8" });
            res.end(JSON.stringify({ error: e && e.message ? e.message : "Invalid JSON" }));
          }
        });
        return;
      }
    }
    if (
      (rawUrl === "/api/cli-tools/antigravity-mitm" ||
       rawUrl.startsWith("/api/cli-tools/antigravity-mitm?") ||
       rawUrl === "/api/monitor/mitm-status" ||
       rawUrl.startsWith("/api/monitor/mitm-status?"))
    ) {
      if (req.method === "OPTIONS") {
        res.writeHead(204, {
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Methods": "GET, OPTIONS",
          "Access-Control-Allow-Headers": "*",
        });
        res.end();
        return;
      }
      if (req.method === "GET") {
        res.writeHead(200, {
          "Content-Type": "application/json; charset=utf-8",
          "Access-Control-Allow-Origin": "*",
          "Cache-Control": "no-store",
        });
        res.end(JSON.stringify(getQuickMitmStatus()));
        return;
      }
    }
    if (rawUrl.startsWith("/api/monitor/proxy")) {
      if (req.method === "OPTIONS") {
        res.writeHead(204, {
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Methods": "GET, OPTIONS",
          "Access-Control-Allow-Headers": "*",
        });
        res.end();
        return;
      }
      const u = new URL(rawUrl, "http://127.0.0.1:20128");
      const targetUrl = u.searchParams.get("url");
      if (!targetUrl) {
        res.writeHead(400, { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" });
        res.end(JSON.stringify({ error: "Missing url parameter" }));
        return;
      }
      try {
        const parsedTarget = new URL(targetUrl);
        const mod = parsedTarget.protocol === "https:" ? require("https") : require("http");
        const headers = {};
        const key = req.headers["x-target-api-key"] || req.headers["x-api-key"] || u.searchParams.get("key");
        if (key) {
          headers["Authorization"] = "Bearer " + key;
          headers["x-api-key"] = key;
        }
        const preq = mod.request(targetUrl, { method: "GET", headers, timeout: 6000 }, (pres) => {
          if (res.headersSent) return;
          res.writeHead(pres.statusCode || 200, {
            "Content-Type": "application/json; charset=utf-8",
            "Access-Control-Allow-Origin": "*",
            "Cache-Control": "no-store",
          });
          pres.pipe(res);
          pres.on("error", () => {
            if (!res.headersSent) {
              res.writeHead(502, { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" });
              res.end(JSON.stringify({ error: "Remote stream error" }));
            } else {
              try { res.destroy(); } catch (_) {}
            }
          });
        });

        req.on("close", () => {
          try { preq.destroy(); } catch (_) {}
        });

        preq.on("timeout", () => {
          try { preq.destroy(); } catch (_) {}
          if (!res.headersSent) {
            res.writeHead(504, { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" });
            res.end(JSON.stringify({ error: "Connection to remote machine timed out" }));
          }
        });

        preq.on("error", (err) => {
          if (!res.headersSent) {
            res.writeHead(502, { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" });
            res.end(JSON.stringify({ error: err && err.message ? err.message : "Failed to reach remote instance" }));
          } else {
            try { res.destroy(); } catch (_) {}
          }
        });

        preq.end();
      } catch (err) {
        if (!res.headersSent) {
          res.writeHead(400, { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" });
          res.end(JSON.stringify({ error: "Invalid target URL" }));
        }
      }
      return;
    }
    const socketIp = req.socket && req.socket.remoteAddress ? req.socket.remoteAddress : "";
    const xff = req.headers["x-forwarded-for"];
    const xRealIp = req.headers["x-real-ip"];
    const viaProxy = !!(xff || xRealIp);
    const isLoopbackProxy = socketIp === "127.0.0.1" || socketIp === "::1" || socketIp === "::ffff:127.0.0.1";
    // Trust forwarding headers only when the TCP peer is a local reverse proxy.
    // Direct/public sockets remain keyed by the unspoofable peer address.
    const proxyIp = xRealIp || (xff ? String(xff).split(",")[0].trim() : "");
    const ip = isLoopbackProxy && proxyIp ? proxyIp : socketIp;
    delete req.headers["x-9r-real-ip"];
    delete req.headers["x-forwarded-for"];
    delete req.headers["x-9r-via-proxy"];
    delete req.headers["x-9r-peer-token"];
    req.headers["x-9r-real-ip"] = ip;
    req.headers["x-9r-peer-token"] = PEER_TOKEN;
    if (viaProxy) req.headers["x-9r-via-proxy"] = "1";
    return handler(req, res);
  };
  const server = origCreate(...rest, wrapped);
  server.once("listening", () => {
    startBackgroundTokenRefreshFromCustomServer();
  });
  const origEmit = server.emit;
  // JBR 25 sends h2c upgrades that the HTTP/1.1 server would otherwise close.
  server.emit = function (event, ...eventArgs) {
    const [req, socket, head] = eventArgs;
    if (event !== "upgrade" || String(req.headers.upgrade || "").toLowerCase() !== "h2c") {
      return origEmit.call(this, event, ...eventArgs);
    }

    const contentLength = Number(req.headers["content-length"] || 0);
    if (!Number.isSafeInteger(contentLength) || contentLength < 0) {
      socket.destroy();
      return true;
    }
    const chunks = [head];
    let received = head.length;
    const serve = () => {
      // Replay the upgraded request through the existing HTTP/1.1 handler.
      const replay = new http.IncomingMessage(socket);
      Object.assign(replay, { method: req.method, url: req.url, headers: req.headers, complete: true });
      if (received) replay.push(Buffer.concat(chunks, received).subarray(0, contentLength));
      replay.push(null);
      const res = new http.ServerResponse(replay);
      res.shouldKeepAlive = false;
      res.assignSocket(socket);
      res.once("finish", () => socket.end());
      Promise.resolve().then(() => wrapped(replay, res)).catch((error) => {
        console.error("Failed to downgrade h2c request", error);
        socket.destroy();
      });
    };
    if (received >= contentLength) serve();
    else {
      socket.on("data", function readBody(chunk) {
        chunks.push(chunk);
        received += chunk.length;
        if (received < contentLength) return;
        socket.off("data", readBody);
        serve();
      });
      socket.resume();
    }
    delete req.headers.upgrade;
    delete req.headers["http2-settings"];
    req.headers.connection = "close";
    return true;
  };
  return server;
};

if (require.main === module) {
  const standalone = path.join(__dirname, "server.js");
  if (fs.existsSync(standalone)) {
    require(standalone);
  } else {
    // Repo checkout has no standalone build next to us. `next start` builds its HTTP
    // server in-process, so the wrapper above still sanitizes every request.
    const nextBin = require.resolve("next/dist/bin/next");
    process.argv = [process.argv[0], nextBin, "start", ...process.argv.slice(2)];
    require(nextBin);
  }
}
