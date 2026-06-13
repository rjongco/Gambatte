import { NextResponse } from "next/server";
import { fetchBoardMeta } from "@/lib/trello";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const meta = await fetchBoardMeta();
    return NextResponse.json(meta);
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
