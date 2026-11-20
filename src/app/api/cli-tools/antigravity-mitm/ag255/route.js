import { NextResponse } from "next/server";
import { checkAg255Health, startAg255Proxy, stopAg255Proxy } from "@/lib/ag255Manager";

export async function GET() {
  const status = await checkAg255Health();
  return NextResponse.json(status);
}

export async function POST(request) {
  try {
    const { action } = await request.json();

    if (action === "stop") {
      return NextResponse.json(await stopAg255Proxy());
    }

    if (action === "start") {
      return NextResponse.json(await startAg255Proxy());
    }

    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  } catch (error) {
    return NextResponse.json({ error: error.message || "Failed" }, { status: 500 });
  }
}
