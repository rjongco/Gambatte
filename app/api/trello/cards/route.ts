import { NextResponse } from "next/server";
import { fetchInProgressCards } from "@/lib/trello";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const cards = await fetchInProgressCards();
    return NextResponse.json({ cards });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
