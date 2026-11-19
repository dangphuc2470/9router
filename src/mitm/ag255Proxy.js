"use strict";

// Dedicated HTTP proxy on 127.0.0.1:20443 for Antigravity IDE 2.5.5 only (--cloud_code_endpoint).
// Avoids touching /etc/hosts so newer Antigravity apps on the same machine are unaffected.

const http = require("http");
const https = require("https");
const zlib = require("zlib");
const { log, err } = require("./logger");
const { MODEL_SYNONYMS, MODEL_PATTERNS, MODEL_NO_MAP, isChatRequest, extractModel } = require("./config");
const { getMitmAlias } = require("./dbReader");
const { applyAntigravityIdeVersionOverride } = require("./antigravityIdeVersion");
const { patchFetchAvailableModelsResponse } = require("./antigravityCatalogMock");
const antigravityHandler = require("./handlers/antigravity");

const LISTEN_HOST = "127.0.0.1";
const LISTEN_PORT = Number(process.env.AG255_PROXY_PORT || 20443);

function collectBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on("data", (c) => chunks.push(c));
    req.on("end", () => resolve(Buffer.concat(chunks)));
    req.on("error", reject);
  });
}

function getMappedModel(model) {
  if (!model) return null;
  try {
    const aliases = getMitmAlias("antigravity");
    if (!aliases) return null;
    const normalized = String(model).replace(/^models\//, "");
    const lookup = MODEL_SYNONYMS?.antigravity?.[normalized] || normalized;
    if (aliases[lookup]) return aliases[lookup];
    const prefixKey = Object.keys(aliases).find((k) => k && aliases[k] && (lookup.startsWith(k) || k.startsWith(lookup)));
    if (prefixKey) return aliases[prefixKey];
    for (const { match, alias } of (MODEL_PATTERNS?.antigravity || [])) {
      if (match.test(lookup) && aliases[alias]) return aliases[alias];
    }
    return null;
  } catch {
    return null;
  }
}

function pickTargetHost(url) {
  if (url.includes(":generateContent") || url.includes(":streamGenerateContent") || url.includes(":fetchAvailableModels")) {
    return "daily-cloudcode-pa.googleapis.com";
  }
  return "cloudcode-pa.googleapis.com";
}

function forwardUpstream(req, res, bodyBuffer, transformResponse) {
  const targetHost = pickTargetHost(req.url || "");
  const override = applyAntigravityIdeVersionOverride(bodyBuffer, req.headers, req.url);
  const forwardBody = override.bodyBuffer;
  const headers = { ...override.headers, host: targetHost };
  delete headers["connection"];
  delete headers["keep-alive"];
  delete headers["transfer-encoding"];
  if (forwardBody.length > 0) {
    headers["content-length"] = String(forwardBody.length);
  }

  return new Promise((resolve) => {
    const upReq = https.request({
      hostname: targetHost,
      port: 443,
      path: req.url,
      method: req.method,
      headers,
      timeout: 30000,
    }, (upRes) => {
      if (!transformResponse) {
        res.writeHead(upRes.statusCode, upRes.headers);
        upRes.pipe(res);
        upRes.on("end", resolve);
        return;
      }

      const chunks = [];
      upRes.on("data", (c) => chunks.push(c));
      upRes.on("end", () => {
        let raw = Buffer.concat(chunks);
        const outHeaders = { ...upRes.headers };
        const enc = String(outHeaders["content-encoding"] || "").toLowerCase();
        try {
          if (enc.includes("gzip")) raw = zlib.gunzipSync(raw);
          else if (enc.includes("br")) raw = zlib.brotliDecompressSync(raw);
          else if (enc.includes("deflate")) raw = zlib.inflateSync(raw);
        } catch {}
        const transformed = transformResponse(raw);
        delete outHeaders["content-encoding"];
        delete outHeaders["transfer-encoding"];
        outHeaders["content-length"] = String(transformed.length);
        res.writeHead(upRes.statusCode, outHeaders);
        res.end(transformed);
        resolve();
      });
    });

    upReq.on("error", (e) => {
      err(`[ag255] upstream error (${targetHost}${req.url}): ${e.message}`);
      if (!res.headersSent) res.writeHead(502, { "Content-Type": "application/json" });
      if (!res.writableEnded) res.end(JSON.stringify({ error: { message: e.message } }));
      resolve();
    });

    if (forwardBody.length > 0) upReq.write(forwardBody);
    upReq.end();
  });
}

const server = http.createServer(async (req, res) => {
  try {
    if (req.url === "/_ag255_health") {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ ok: true, pid: process.pid, port: LISTEN_PORT }));
      return;
    }

    const bodyBuffer = await collectBody(req);
    log(`[ag255] REQ ${req.method} ${req.url} (${bodyBuffer.length}b)`);

    if ((req.url || "").includes(":fetchAvailableModels")) {
      return await forwardUpstream(req, res, bodyBuffer, (raw) => {
        const patched = patchFetchAvailableModelsResponse(raw);
        log(`[ag255] Patched :fetchAvailableModels (${raw.length} -> ${patched.length} bytes)`);
        return patched;
      });
    }

    if (isChatRequest("antigravity", req)) {
      const model = extractModel(req.url || "", bodyBuffer);
      if (model && (MODEL_NO_MAP.antigravity || []).some((re) => re.test(model))) {
        return await forwardUpstream(req, res, bodyBuffer);
      }
      const mapped = getMappedModel(model);
      if (mapped) {
        log(`[ag255] ${model} -> ${mapped}`);
        return await antigravityHandler.intercept(req, res, bodyBuffer, mapped, (r, s, b) => forwardUpstream(r, s, b));
      }
    }

    return await forwardUpstream(req, res, bodyBuffer);
  } catch (e) {
    err(`[ag255] unhandled: ${e.message}`);
    if (!res.headersSent) res.writeHead(500, { "Content-Type": "application/json" });
    if (!res.writableEnded) res.end(JSON.stringify({ error: { message: e.message } }));
  }
});

server.listen(LISTEN_PORT, LISTEN_HOST, () => {
  log(`🚀 [ag255] Dedicated proxy listening on http://${LISTEN_HOST}:${LISTEN_PORT}`);
});
