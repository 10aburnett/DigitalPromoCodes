import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";

// UUID test (v1–v5)
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function normalizeParam(raw: string) {
  // Next already decodes, but play it safe: if it's still percent-encoded, decode once.
  let val = raw;
  try {
    // Only decode if it *looks* encoded; prevents double-decode on plain strings.
    if (/%[0-9a-f]{2}/i.test(raw)) val = decodeURIComponent(raw);
  } catch {
    // ignore; fall back to raw
  }
  return val;
}

async function findWhopByIdOrSlug(rawParam: string) {
  const key = normalizeParam(rawParam);
  console.log("RAW PARAM:", rawParam);
  console.log("DECODED:", key);

  // 1) Try as primary key first (always unique)
  if (UUID_RE.test(key) || key.length > 20) {
    const byId = await prisma.whop.findUnique({ 
      where: { id: key },
      include: {
        PromoCode: true,
        Review: {
          where: { verified: true }
        }
      }
    });
    console.log("BY ID (UUID/long):", !!byId, byId?.id);
    if (byId) return byId;
  } else {
    // It could still be an old short string id in your mixed dataset
    const byId = await prisma.whop.findUnique({ 
      where: { id: key },
      include: {
        PromoCode: true,
        Review: {
          where: { verified: true }
        }
      }
    });
    console.log("BY ID (short):", !!byId, byId?.id);
    if (byId) return byId;
  }

  // 2) Try as slug (slug is @unique per your schema)
  const bySlug = await prisma.whop.findUnique({ 
    where: { slug: key },
    include: {
      PromoCode: true,
      Review: {
        where: { verified: true }
      }
    }
  });
  console.log("BY SLUG:", !!bySlug, bySlug?.slug);
  if (bySlug) return bySlug;

  // 3) Final safety: if the DB accidentally has the encoded form stored,
  // try the percent-encoded variant once.
  const encoded = encodeURIComponent(key);
  if (encoded !== key) {
    const byEncodedSlug = await prisma.whop.findUnique({
      where: { slug: encoded },
      include: {
        PromoCode: true,
        Review: {
          where: { verified: true }
        }
      }
    });
    console.log("BY ENCODED SLUG:", !!byEncodedSlug, byEncodedSlug?.slug);
    if (byEncodedSlug) return byEncodedSlug;
  }

  return null;
}

export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const raw = params?.id ?? "";
    if (!raw) {
      return NextResponse.json({ ok: false, error: "Missing id" }, { status: 400 });
    }

    console.log(`🔍 GET /api/whops/${raw} - Looking up whop...`);
    const whop = await findWhopByIdOrSlug(raw);
    
    if (!whop) {
      console.log(`❌ Whop not found: ${raw}`);
      return NextResponse.json({ ok: false, error: "Not found" }, { status: 404 });
    }

    console.log(`✅ Found whop: ${whop.name} (ID: ${whop.id})`);
    return NextResponse.json(whop, { status: 200 });
  } catch (err: unknown) {
    console.error("🚨 GET /api/whops/[id] failed:", err);
    if (err instanceof Prisma.PrismaClientKnownRequestError) {
      return NextResponse.json(
        { ok: false, error: `Prisma ${err.code}`, details: err.meta },
        { status: 500 }
      );
    }
    return NextResponse.json({ ok: false, error: "Internal error" }, { status: 500 });
  }
}

export async function PUT(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const data = await request.json();
    
    // Decode URL-encoded parameters
    const idOrSlug = decodeURIComponent(params.id);
    console.log(`🔧 PUT /api/whops/${idOrSlug} - Updating whop...`);
    
    // First find the actual whop to get its real ID
    let whop = await prisma.whop.findUnique({
      where: { id: idOrSlug },
      select: { id: true }
    });
    
    // If not found by ID, try by slug (for legacy whops)
    if (!whop) {
      whop = await prisma.whop.findUnique({
        where: { slug: idOrSlug },
        select: { id: true }
      });
    }
    
    if (!whop) {
      return NextResponse.json(
        { error: "Whop not found" },
        { status: 404 }
      );
    }
    
    const actualWhopId = whop.id;
    
    // Extract promo code data from the request
    const {
      promoCodeId,
      promoTitle,
      promoDescription,
      promoCode,
      promoType,
      promoValue,
      ...whopData
    } = data;

    // Update the whop using the actual ID
    const updatedWhop = await prisma.whop.update({
      where: { id: actualWhopId },
      data: whopData,
      include: {
        PromoCode: true,
        Review: {
          where: { verified: true }
        }
      }
    });

    // Update or create promo code if provided
    if (promoTitle && promoDescription && promoValue) {
      if (promoCodeId) {
        // Update existing promo code
        await prisma.promoCode.update({
          where: { id: promoCodeId },
          data: {
            title: promoTitle,
            description: promoDescription,
            code: promoCode || null,
            type: promoType,
            value: promoValue
          }
        });
      } else {
        // Create new promo code
        const promoCodeId = crypto.randomUUID();
        await prisma.promoCode.create({
          data: {
            id: promoCodeId,
            title: promoTitle,
            description: promoDescription,
            code: promoCode || null,
            type: promoType,
            value: promoValue,
            whopId: actualWhopId,
            updatedAt: new Date()
          }
        });
      }
    }

    return NextResponse.json(updatedWhop);
  } catch (error) {
    console.error("Error updating whop:", error);
    return NextResponse.json(
      { error: "Failed to update whop" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    // Decode URL-encoded parameters
    const idOrSlug = decodeURIComponent(params.id);
    console.log(`🗑️ Deleting whop with ID/slug: ${idOrSlug}`);
    
    // First find the actual whop to get its real ID
    let whop = await prisma.whop.findUnique({
      where: { id: idOrSlug },
      select: { id: true, name: true }
    });
    
    // If not found by ID, try by slug (for legacy whops)
    if (!whop) {
      whop = await prisma.whop.findUnique({
        where: { slug: idOrSlug },
        select: { id: true, name: true }
      });
    }
    
    if (!whop) {
      console.log(`🚨 Whop not found: ${params.id}`);
      return NextResponse.json(
        { error: "Whop not found" },
        { status: 404 }
      );
    }
    
    const actualWhopId = whop.id;
    console.log(`🗑️ Found whop: ${whop.name} (ID: ${actualWhopId})`);
    
    // Delete associated promo codes first
    console.log("🗑️ Deleting associated promo codes...");
    const deletedPromoCodes = await prisma.promoCode.deleteMany({
      where: { whopId: actualWhopId }
    });
    console.log(`🗑️ Deleted ${deletedPromoCodes.count} promo codes`);

    // Delete associated reviews
    console.log("🗑️ Deleting associated reviews...");
    const deletedReviews = await prisma.review.deleteMany({
      where: { whopId: actualWhopId }
    });
    console.log(`🗑️ Deleted ${deletedReviews.count} reviews`);

    // Delete associated tracking data
    console.log("🗑️ Deleting associated tracking data...");
    const deletedTracking = await prisma.offerTracking.deleteMany({
      where: { whopId: actualWhopId }
    });
    console.log(`🗑️ Deleted ${deletedTracking.count} tracking records`);

    // Delete the whop
    console.log("🗑️ Deleting whop...");
    await prisma.whop.delete({
      where: { id: actualWhopId }
    });
    console.log("✅ Whop deleted successfully");

    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    console.error("🚨 Error deleting whop:", err);
    console.error("🚨 Error stack:", err instanceof Error ? err.stack : "No stack trace");

    // Prisma-known errors (schema/constraint)
    if (err instanceof Prisma.PrismaClientKnownRequestError) {
      const code = err.code;
      const meta = (err as any).meta;
      console.error(`🚨 Prisma error code: ${code}`, meta);
      
      if (code === "P2025") {
        return NextResponse.json(
          { error: "Whop not found" },
          { status: 404 }
        );
      }
      if (code === "P2003") {
        return NextResponse.json(
          { error: "Cannot delete whop due to foreign key constraints", details: meta },
          { status: 400 }
        );
      }
      return NextResponse.json(
        { error: `Database error ${code}`, details: meta },
        { status: 500 }
      );
    }

    // Generic error fallback
    const errorMessage = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json(
      { error: "Failed to delete whop", details: errorMessage },
      { status: 500 }
    );
  }
} 