import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { applyOut } from "@/lib/store";

export const dynamic = "force-dynamic";

const Body = z.object({
  outMinute: z.number().int().min(0).max(1440).nullable(),
});

export async function PUT(req: NextRequest, ctx: { params: Promise<{ date: string }> }) {
  const { date } = await ctx.params;
  const parsed = Body.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.message }, { status: 400 });
  }
  await applyOut(date, parsed.data.outMinute);
  return NextResponse.json({ ok: true });
}
