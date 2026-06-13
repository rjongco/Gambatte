import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getSettings, updateSettings } from "@/lib/store";

export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json(await getSettings());
}

const Body = z
  .object({
    dayStartMinute: z.number().int().min(0).max(1410),
    dayEndMinute: z.number().int().min(30).max(1440),
  })
  .refine((d) => d.dayEndMinute > d.dayStartMinute, {
    message: "dayEndMinute must be greater than dayStartMinute",
  });

export async function PUT(req: NextRequest) {
  const parsed = Body.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.message }, { status: 400 });
  }
  return NextResponse.json(await updateSettings(parsed.data));
}
