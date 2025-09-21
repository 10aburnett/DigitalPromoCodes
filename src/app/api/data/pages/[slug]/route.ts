import { join } from "path";
import { NextResponse, type NextRequest } from "next/server";
import { readFile } from "fs/promises";

export async function GET(
  _req: NextRequest,
  { params }: { params: { slug: string } }
) {
  try {
    // The route param already includes ".json" and is URL-encoded by the client.
    const filename = params.slug;

    // 1) Security: only allow safe filename chars and percent-escapes, plus the .json suffix.
    //    Allow A–Z in percent-hex; we'll normalize to lowercase before reading.
    if (!/^[a-z0-9._\-:%]+\.json$/i.test(filename)) {
      console.log("Invalid filename rejected:", filename);
      return NextResponse.json({ error: "Invalid file name" }, { status: 400 });
    }

    // 2) Prepare candidates: (a) normalized %XX => lowercase; (b) original as fallback
    const base = join(process.cwd(), "public", "data", "pages");
    const normalized = filename.replace(/%[0-9A-F]{2}/g, (m) => m.toLowerCase());
    const candidates = [normalized, filename];

    // 3) Try candidates in order
    for (const name of candidates) {
      try {
        const filePath = join(base, name);
        const json = await readFile(filePath, "utf8");
        console.log('[API] serving file', name, 'size=', json.length);
        return new NextResponse(json, {
          headers: {
            "content-type": "application/json; charset=utf-8",
            // Kill all caching at the edge and browser to fix stale data issue
            "Cache-Control": "no-store",
          },
        });
      } catch {
        // keep trying next candidate
      }
    }

    // 4) Not found
    return NextResponse.json({ error: "File not found" }, { status: 404 });
  } catch (err) {
    console.error("Error serving verification data:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}