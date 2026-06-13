import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { exportRange } from "@/lib/sheets";

export const dynamic = "force-dynamic";

const Body = z
  .object({
    from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  })
  .refine((d) => d.from <= d.to, { message: "from must be on or before to" });

export async function POST(req: NextRequest) {
  const parsed = Body.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.message }, { status: 400 });
  }
  try {
    const result = await exportRange(parsed.data.from, parsed.data.to);
    return NextResponse.json(result);
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
