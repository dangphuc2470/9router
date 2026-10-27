import { NextResponse } from "next/server";
import { exportUsageSince } from "@/lib/db/repos/usageRepo.js";

export const dynamic = "force-dynamic";

export async function OPTIONS() {
  return new Response(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization, x-api-key",
    },
  });
}

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const since = searchParams.get("since") || null;

    const entries = await exportUsageSince(since);
    return NextResponse.json(
      { entries },
      {
        headers: { "Access-Control-Allow-Origin": "*" },
      }
    );
  } catch (error) {
    console.error("[API] Failed to export usage entries:", error);
    return NextResponse.json(
      { error: "Failed to export usage entries", entries: [] },
      {
        status: 500,
        headers: { "Access-Control-Allow-Origin": "*" },
      }
    );
  }
}
