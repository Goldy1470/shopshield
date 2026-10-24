import { NextResponse } from "next/server";
import { sql } from "drizzle-orm";
import { db } from "@/db/index";

export const dynamic = "force-dynamic";

export async function GET() {
  const health: { ok: boolean; db?: string; error?: string } = { ok: true };
  if (process.env.DATABASE_URL) {
    try {
      await db.execute(sql`select 1`);
      health.db = "ok";
    } catch (err) {
      return NextResponse.json(
        { ok: true, db: "error", error: err instanceof Error ? err.message : String(err) },
        { status: 200 },
      );
    }
  } else {
    health.db = "unconfigured";
  }
  return NextResponse.json(health);
}
