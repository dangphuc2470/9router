import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function OPTIONS() {
  return new Response(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization, x-api-key, x-target-api-key",
    },
  });
}

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const targetUrl = searchParams.get("url");

    if (!targetUrl) {
      return NextResponse.json(
        { error: "Missing url parameter" },
        { status: 400, headers: { "Access-Control-Allow-Origin": "*" } }
      );
    }

    let parsed;
    try {
      parsed = new URL(targetUrl);
    } catch {
      return NextResponse.json(
        { error: "Invalid target URL format" },
        { status: 400, headers: { "Access-Control-Allow-Origin": "*" } }
      );
    }

    if (!["http:", "https:"].includes(parsed.protocol)) {
      return NextResponse.json(
        { error: "Only HTTP and HTTPS protocols are permitted" },
        { status: 400, headers: { "Access-Control-Allow-Origin": "*" } }
      );
    }

    const headers = {};
    const apiKey =
      request.headers.get("x-target-api-key") ||
      request.headers.get("x-api-key") ||
      searchParams.get("key");

    if (apiKey) {
      headers["Authorization"] = `Bearer ${apiKey}`;
      headers["x-api-key"] = apiKey;
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 6000);

    const res = await fetch(targetUrl, {
      headers,
      signal: controller.signal,
      cache: "no-store",
    });
    clearTimeout(timeout);

    if (!res.ok) {
      return NextResponse.json(
        { error: `Remote instance responded with HTTP ${res.status}` },
        {
          status: res.status,
          headers: { "Access-Control-Allow-Origin": "*" },
        }
      );
    }

    const data = await res.json();
    return NextResponse.json(data, {
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Cache-Control": "no-store",
      },
    });
  } catch (err) {
    const isTimeout = err.name === "AbortError";
    return NextResponse.json(
      {
        error: isTimeout
          ? "Connection timed out (remote machine took longer than 6s to respond)"
          : err.message || "Failed to reach remote 9router instance",
      },
      {
        status: isTimeout ? 504 : 502,
        headers: { "Access-Control-Allow-Origin": "*" },
      }
    );
  }
}
