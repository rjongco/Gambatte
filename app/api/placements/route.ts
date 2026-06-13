import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getWindowData, placeBar, boundsForDay, getOutMinute } from "@/lib/store";
import { ResolveError } from "@/lib/resolve";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const from = req.nextUrl.searchParams.get("from");
  const to = req.nextUrl.searchParams.get("to");
  if (!from || !to) {
    return NextResponse.json({ error: "from and to are required" }, { status: 400 });
  }
  const data = await getWindowData(from, to);
  return NextResponse.json(data);
}

const PostBody = z.object({
  cardId: z.string().min(1),
  day: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  startMinute: z.number().int().min(0).max(1440),
  endMinute: z.number().int().min(0).max(1440),
});

export async function POST(req: NextRequest) {
  const parsed = PostBody.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.message }, { status: 400 });
  }
  try {
    await placeBar(parsed.data);
    // Return the affected day's fresh state.
    const { day } = parsed.data;
    const data = await getWindowData(day, day);
    const out = await getOutMinute(day);
    const bounds = await boundsForDay(day);
    return NextResponse.json({ ...data, outByDay: { [day]: out }, bounds });
  } catch (err) {
    const status = err instanceof ResolveError ? 422 : 500;
    return NextResponse.json({ error: (err as Error).message }, { status });
  }
}
