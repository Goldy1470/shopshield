import { readFile, unlink } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

/** Serves one freshly-written export file; name must match our pattern exactly. */
export async function GET(req: Request): Promise<Response> {
  const file = new URL(req.url).searchParams.get("file") ?? "";
  if (!/^shopshield-export-[0-9a-f-]{36}\.json$/.test(file)) {
    return new NextResponse("Not found", { status: 404 });
  }
  const full = path.join(tmpdir(), file);
  try {
    const body = await readFile(full, "utf8");
    await unlink(full).catch(() => undefined);
    return new NextResponse(body, {
      status: 200,
      headers: {
        "content-type": "application/json; charset=utf-8",
        "content-disposition": `attachment; filename="${file}"`,
      },
    });
  } catch {
    return new NextResponse("Export expired or missing", { status: 410 });
  }
}
