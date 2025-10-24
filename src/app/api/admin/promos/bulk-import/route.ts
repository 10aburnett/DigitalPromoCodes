// src/app/api/admin/promos/bulk-import/route.ts
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyAdminToken } from "@/lib/auth-utils";
import { normalizeUrl } from "@/lib/urls";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const EXPECT =
  "whopUrl,code,discountType,discountValue,currency,amountMinor,stacking,expiresAt,capturedAt,provenance";

/** RFC-4180-ish CSV parser (quoted fields, doubled quotes) */
function parseCsv(text: string) {
  const lines = text.replace(/\r/g, "").split("\n").filter(Boolean);
  const header = lines.shift()!;
  if (header.trim() !== EXPECT) {
    const msg = `Bad header. Expected "${EXPECT}" but got "${header.trim()}"`;
    const err: any = new Error(msg);
    err.status = 400;
    throw err;
  }
  const rows: any[] = [];
  for (const line of lines) {
    const cells: string[] = [];
    let cur = "", inQ = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === '"' && line[i + 1] === '"' && inQ) { cur += '"'; i++; continue; }
      if (ch === '"') { inQ = !inQ; continue; }
      if (ch === "," && !inQ) { cells.push(cur); cur = ""; continue; }
      cur += ch;
    }
    cells.push(cur);
    const [whopUrl, code, discountType, discountValue, currency, amountMinor, stacking, expiresAt, capturedAt, provenance] = cells;
    rows.push({
      whopUrl, code, discountType, discountValue, currency, amountMinor, stacking, expiresAt, capturedAt, provenance
    });
  }
  return rows;
}

/** map CSV discountType -> your enum bucket used for `type` field */
function mapPromoType(csvType: string): "DISCOUNT" | "FREE_TRIAL" | "EXCLUSIVE_ACCESS" {
  const t = (csvType || "").toLowerCase();
  if (t === "percent" || t === "amount") return "DISCOUNT";
  if (t === "trial") return "FREE_TRIAL";
  return "EXCLUSIVE_ACCESS";
}

/** format display value for your `value` string field */
function formatValue(csvType: string, discountValue: string, amountMinor: string, currency: string) {
  const t = (csvType || "").toLowerCase();
  if (t === "percent" && discountValue) {
    const n = Number(discountValue);
    return isFinite(n) ? `${n}%` : "Discount";
  }
  if (t === "amount" && amountMinor) {
    const minor = Number(amountMinor);
    const major = isFinite(minor) ? (minor / 100).toFixed(2) : null;
    const cur = (currency || "").toUpperCase();
    const sym = cur === "USD" ? "$" : cur === "GBP" ? "£" : cur === "EUR" ? "€" : "";
    return major ? `${sym}${major}` : "Amount Off";
  }
  if (t === "trial") return "Free Trial";
  return "Exclusive Access";
}

/** parse a display `value` back into comparable units */
function parseDisplay(value: string): { kind: "percent" | "amount" | "other"; n?: number; currency?: string } {
  if (!value) return { kind: "other" };
  const v = value.trim();
  const mPct = v.match(/(\d+(?:\.\d+)?)\s*%/);
  if (mPct) return { kind: "percent", n: Number(mPct[1]) };
  const mUsd = v.match(/^\$\s*(\d+(?:\.\d+)?)/);
  if (mUsd) return { kind: "amount", n: Number(mUsd[1]), currency: "USD" };
  const mGbp = v.match(/^£\s*(\d+(?:\.\d+)?)/);
  if (mGbp) return { kind: "amount", n: Number(mGbp[1]), currency: "GBP" };
  const mEur = v.match(/^€\s*(\d+(?:\.\d+)?)/);
  if (mEur) return { kind: "amount", n: Number(mEur[1]), currency: "EUR" };
  return { kind: "other" };
}

/** decide if incoming value is strictly better than existing (same kind only) */
function isBetter(existingValue: string, incomingValue: string) {
  const a = parseDisplay(existingValue);
  const b = parseDisplay(incomingValue);
  if (a.kind === "percent" && b.kind === "percent") return (b.n ?? 0) > (a.n ?? 0);
  if (a.kind === "amount" && b.kind === "amount") {
    // Only compare if same currency; otherwise keep existing to avoid cross-currency mistakes
    if (a.currency && b.currency && a.currency === b.currency) {
      return (b.n ?? 0) > (a.n ?? 0);
    }
    return false;
  }
  // Different kinds: keep existing. (You can change policy if you want percent to trump "other".)
  return false;
}

/** Generate a unique ID for PromoCode (using timestamp + random) */
function generatePromoId(): string {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 9);
  return `promo_${timestamp}_${random}`;
}

/** Fuzzy match Whop by URL variants (handles hyphens, path differences, etc.) */
async function fuzzyFindWhop(rawUrl: string) {
  // Normalize, then create relaxed variants
  let norm = normalizeUrl(rawUrl);
  // tolerate www differences
  norm = norm.replace("://www.", "://");
  const path = (() => {
    try { return new URL(norm).pathname.replace(/\/+$/, ""); } catch { return ""; }
  })();
  const lastSeg = path.split("/").filter(Boolean).pop() || "";
  const lastSegNoDashes = lastSeg.replace(/-/g, "");

  // Try relaxed lookups first (case-insensitive)
  let candidate = await prisma.whop.findFirst({
    where: {
      OR: [
        { affiliateLink: { equals: norm, mode: "insensitive" } },
        { website:       { equals: norm, mode: "insensitive" } },

        // tolerate querystrings after the path
        ...(lastSeg ? [
          { affiliateLink: { contains: `/${lastSeg}`, mode: "insensitive" } },
          { website:       { contains: `/${lastSeg}`, mode: "insensitive" } },
        ] : []),

        // exact slug or close variant
        ...(lastSeg ? [{ slug: { equals: lastSeg.toLowerCase() } }] : []),
      ],
    },
    select: { id: true, name: true, slug: true, affiliateLink: true, website: true },
  });

  if (!candidate && lastSegNoDashes) {
    // final fallback: match slug with hyphens ignored
    // (Prisma can't express REPLACE() natively; safe, parameterized raw SQL)
    const rows = await prisma.$queryRaw<
      Array<{ id: string; name: string; slug: string; affiliateLink: string | null; website: string | null }>
    >`
      SELECT id, name, slug, "affiliateLink", website
      FROM "Whop"
      WHERE REPLACE(slug, '-', '') = ${lastSegNoDashes.toLowerCase()}
      LIMIT 1
    `;
    candidate = rows?.[0] ?? null;
  }

  return candidate;
}

export async function POST(req: Request) {
  try {
    // Auth (verifyAdminToken uses cookies() directly)
    const adminUser = await verifyAdminToken();
    if (!adminUser || adminUser.role !== "ADMIN") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const url = new URL(req.url);
    const dry = url.searchParams.get("dry") === "1";
    const fuzzy = url.searchParams.get("fuzzy") === "1";
    const csv = await req.text();

    let rows: any[];
    try {
      rows = parseCsv(csv);
    } catch (e: any) {
      const status = e?.status ?? 500;
      return NextResponse.json({ error: e?.message || "Invalid CSV" }, { status });
    }

    const summary = {
      created: 0,
      updatedBetter: 0,
      touched: 0,
      missing: 0,
      invalid: 0,
      errors: [] as string[],
    };

    for (let i = 0; i < rows.length; i++) {
      const r = rows[i];
      try {
        if (!r.whopUrl || !r.code) {
          summary.invalid++; summary.errors.push(`Row ${i + 2}: Missing whopUrl or code`); continue;
        }

        const key = normalizeUrl(r.whopUrl);
        let whop = await prisma.whop.findFirst({
          where: { OR: [{ website: key }, { affiliateLink: key }] },
          select: { id: true, name: true, slug: true, affiliateLink: true, website: true }
        });

        if (!whop) {
          const fuzzyMatch = await fuzzyFindWhop(r.whopUrl);
          if (fuzzyMatch) {
            // In dry run, always use fuzzy match for suggestions
            // In write mode, only use if user opted-in with ?fuzzy=1
            if (dry || fuzzy) {
              whop = fuzzyMatch;
              if (dry) {
                summary.errors.push(
                  `Row ${i + 2}: No exact match; using fuzzy -> slug=${fuzzyMatch.slug} url=${fuzzyMatch.affiliateLink ?? fuzzyMatch.website}`
                );
              }
            } else {
              summary.missing++;
              summary.errors.push(`Row ${i + 2}: No exact match. Suggest: slug=${fuzzyMatch.slug} url=${fuzzyMatch.affiliateLink ?? fuzzyMatch.website}`);
              continue;
            }
          } else {
            summary.missing++;
            summary.errors.push(`Row ${i + 2}: No Whop match for URL: ${r.whopUrl}`);
            continue;
          }
        }

        const promoType = mapPromoType(r.discountType);
        const currency = (r.currency || "").toUpperCase();
        const displayValue = formatValue(r.discountType, r.discountValue, r.amountMinor, currency);

        const title =
          (r.discountType || "").toLowerCase() === "percent" && r.discountValue
            ? `${r.code} - ${r.discountValue}% Off`
            : `${r.code} - Discount`;

        const description =
          (r.discountType || "").toLowerCase() === "percent" && r.discountValue
            ? `Get ${r.discountValue}% off ${whop.name} with promo code ${r.code}`
            : `Get a discount on ${whop.name} with promo code ${r.code}`;

        if (dry) { summary.touched++; continue; }

        // Check existing promo by whopId + code
        const existing = await prisma.promoCode.findFirst({
          where: { whopId: whop.id, code: r.code },
          select: { id: true, value: true }
        });

        if (existing) {
          const better = isBetter(existing.value ?? "", displayValue ?? "");
          await prisma.promoCode.update({
            where: { id: existing.id },
            data: better
              ? {
                  type: promoType as any,
                  value: displayValue,
                  title,
                  description,
                  updatedAt: new Date()
                }
              : {
                  // touch metadata only
                  updatedAt: new Date()
                }
          });
          better ? summary.updatedBetter++ : summary.touched++;
        } else {
          await prisma.promoCode.create({
            data: {
              id: generatePromoId(), // Manual ID generation (required for String @id)
              whopId: whop.id,
              code: r.code,
              type: promoType as any,
              value: displayValue,
              title,
              description,
              createdAt: new Date(),
              updatedAt: new Date()
            }
          });
          summary.created++;
        }
      } catch (err: any) {
        summary.invalid++;
        summary.errors.push(`Row ${i + 2}: ${err?.message || String(err)}`);
      }
    }

    return NextResponse.json(summary);
  } catch (err: any) {
    console.error("[PROMO BULK IMPORT] Error:", err);
    return NextResponse.json(
      { error: err?.message || "Import failed" },
      { status: 500 }
    );
  }
}
