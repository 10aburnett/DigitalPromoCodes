import "server-only";
import { NextResponse } from "next/server";
import { getWhopBySlug } from '@/lib/data';

// Cache for 5 minutes
export const revalidate = 300;

export async function GET(
  _req: Request,
  { params }: { params: { slug: string } }
) {
  const { slug } = params;

  try {
    // Fetch from database using the existing data function
    const whopData = await getWhopBySlug(slug);

    if (!whopData) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    // Transform to only the fields needed for the hero section first paint
    const heroData = {
      id: whopData.id,
      name: whopData.name,
      logo: whopData.logo,
      price: whopData.price,
      category: whopData.category,
      affiliateLink: whopData.affiliateLink,
      // Include first promo code for instant display
      firstPromo: whopData.PromoCode?.[0] ? {
        id: whopData.PromoCode[0].id,
        title: whopData.PromoCode[0].title,
        code: whopData.PromoCode[0].code,
        type: whopData.PromoCode[0].type,
        value: whopData.PromoCode[0].value,
      } : null,
    };

    // Set short-lived cache headers to help CDNs
    return NextResponse.json(heroData, {
      headers: {
        "Cache-Control": "public, s-maxage=300, stale-while-revalidate=60",
      },
    });
  } catch (error) {
    console.error("Error fetching deal:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}