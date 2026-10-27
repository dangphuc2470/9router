import { NextResponse } from "next/server";
import { importUsageEntries } from "@/lib/db/repos/usageRepo.js";

export const dynamic = "force-dynamic";

export async function OPTIONS() {
  return new Response(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization, x-api-key",
    },
  });
}

export async function POST(request) {
  try {
    const body = await request.json();
    const entries = Array.isArray(body?.entries) ? body.entries : [];

    const imported = await importUsageEntries(entries);
    return NextResponse.json(
      { success: true, count: imported },
      {
        headers: { "Access-Control-Allow-Origin": "*" },
      }
    );
  } catch (error) {
    console.error("[API] Failed to import usage entries:", error);
    return NextResponse.json(
      { error: error?.message || "Failed to import usage entries" },
      {
        status: 500,
        headers: { "Access-Control-Allow-Origin": "*" },
      }
    );
  }
}
