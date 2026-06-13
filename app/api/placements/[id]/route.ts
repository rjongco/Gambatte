import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { editBar, deleteBar } from "@/lib/store";
import { ResolveError } from "@/lib/resolve";

export const dynamic = "force-dynamic";

const PatchBody = z.object({
  startMinute: z.number().int().min(0).max(1440),
  endMinute: z.number().int().min(0).max(1440),
});

export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const parsed = PatchBody.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.message }, { status: 400 });
  }
  try {
    await editBar(id, parsed.data);
    return NextResponse.json({ ok: true });
  } catch (err) {
    const status = err instanceof ResolveError ? 422 : 500;
    return NextResponse.json({ error: (err as Error).message }, { status });
  }
}

export async function DELETE(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  await deleteBar(id);
  return NextResponse.json({ ok: true });
}
