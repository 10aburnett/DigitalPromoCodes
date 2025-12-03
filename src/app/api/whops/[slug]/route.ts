import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { revalidatePath, revalidateTag } from "next/cache";
import { randomUUID } from "crypto";
import { PromoType } from "@prisma/client"; // enum

// -- helpers ---------------------------------------------------
const toNullIfEmpty = (v: unknown) =>
  typeof v === "string" ? (v.trim() === "" ? null : v) : v ?? null;

const numOrNull = (v: unknown) => {
  if (v === null || v === undefined || v === "") return null;
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : null;
};

function scrubPrismaCreate<T extends Record<string, any>>(obj: T): T {
  // deep clone without functions
  const clone: any = {};
  for (const [k, v] of Object.entries(obj)) {
    // strip disallowed keys at the root
    if (k === "id" || k === "createdAt" || k === "updatedAt") continue;
    // kill any weird function values (like `String`)
    if (typeof v === "function") continue;
    // recursively scrub nested objects
    if (v && typeof v === "object" && !Array.isArray(v)) {
      clone[k] = scrubPrismaCreate(v);
    } else {
      clone[k] = v;
    }
  }
  return clone;
}

// -- GET: load a whop by slug ---------------------------------
export async function GET(
  _req: Request,
  { params }: { params: { slug: string } }
) {
  const slug = decodeURIComponent(params.slug || "");
  if (!slug) {
    return NextResponse.json({ error: "Missing slug" }, { status: 400 });
  }

  const whop = await prisma.deal.findUnique({
    where: { slug },
    include: {
      PromoCode: true,     // <- return promos unfiltered
    },
  });

  if (!whop) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json(whop, { status: 200 });
}

export async function PUT(req: Request, { params }: { params: { slug: string } }) {
  try {
    const data = await req.json();
    const slug = decodeURIComponent(params.slug);

    // 1) Find the whop by slug (from URL)
    const whop = await prisma.deal.findUnique({
      where: { slug: slug },
      select: { id: true, slug: true },
    });
    if (!whop) {
      return NextResponse.json({ error: "Whop not found" }, { status: 404 });
    }

    // 1) Split promo vs whop fields ONCE
    const {
      promoCodeId,
      promoTitle,
      promoDescription,
      promoCode,
      promoType,
      promoValue,
      ...whopData
    } = data;

    // 2) Update the whop itself
    const updatedWhop = await prisma.deal.update({
      where: { id: whop.id },
      data: { ...whopData, updatedAt: new Date() },
      include: { PromoCode: true },
    });

    // 3) Promo handling (DB-compliant, allows partial input)
    const anyPromoInput = [promoTitle, promoDescription, promoCode, promoType, promoValue]
      .some(v => (v ?? "").toString().trim() !== "");

    if (anyPromoInput) {
      const now = new Date();

      const promoPayload = {
        // DB requires NOT NULL for these:
        title: (promoTitle ?? "").toString().trim() || "Untitled promo",
        description: (promoDescription ?? "").toString().trim() || "Generic promo description",
        type: ((promoType ?? "DISCOUNT") as PromoType),
        value: (() => {
          const v = (promoValue ?? "").toString().trim();
          return v.length ? v : "0"; // DB requires non-null text
        })(),
        whopId: updatedWhop.id,
        updatedAt: now,
        // code is nullable in DB:
        code: (() => {
          const c = (promoCode ?? "").toString().trim();
          return c.length ? c : null;
        })(),
      };

      try {
        if (promoCodeId && String(promoCodeId).trim().length) {
          await prisma.promoCode.update({
            where: { id: String(promoCodeId) },
            data: promoPayload,
          });
          console.log("✅ Promo updated:", promoCodeId);
        } else {
          await prisma.promoCode.create({
            data: { id: randomUUID(), createdAt: now, ...promoPayload },
          });
          console.log("✅ Promo created for whop:", updatedWhop.id);
        }
      } catch (e: any) {
        console.error("❌ Promo upsert failed (whop saved):", e?.message, e?.code, e?.meta);
        // do not throw — keep whop update
      }
    }

    // 4) Invalidate caches so UI refreshes
    revalidatePath(`/whop/${updatedWhop.slug}`);
    revalidatePath("/whops");

    return NextResponse.json(updatedWhop);
  } catch (e: any) {
    console.error("UPDATE WHOP ERROR:", {
      message: e?.message,
      code: e?.code,
      meta: e?.meta,
      stack: e?.stack,
    });
    return NextResponse.json(
      { error: e?.message ?? "Failed to update whop", code: e?.code ?? null, meta: e?.meta ?? null },
      { status: 500 }
    );
  }
}

// -- DELETE (unchanged; optional) ------------------------------
export async function DELETE(
  _req: Request,
  { params }: { params: { slug: string } }
) {
  const slug = decodeURIComponent(params.slug || "");
  if (!slug) {
    return NextResponse.json({ error: "Missing slug" }, { status: 400 });
  }

  const whop = await prisma.deal.findUnique({
    where: { slug },
    select: { id: true, name: true },
  });
  if (!whop) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  await prisma.deal.delete({ where: { id: whop.id } });
  revalidatePath("/whops");
  return NextResponse.json({ ok: true });
}