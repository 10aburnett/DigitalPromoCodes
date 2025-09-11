import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { FaqArraySchema, FaqItem } from "@/lib/faq-types";

// CUID pattern (what your database actually uses)
const CUID = /^c[a-z0-9]{24}$/i;

// Add GET method for testing
export async function GET(
  _req: Request,
  { params }: { params: { id: string } }
) {
  return NextResponse.json({ ok: true, path: `/api/whops/${params.id}/content`, method: 'GET' });
}

export async function PUT(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const key = decodeURIComponent(params.id);
    const whop = await prisma.whop.findFirst({ 
      where: { 
        OR: [
          { id: key },
          { slug: key }
        ]
      }, 
      select: { id: true, slug: true }
    });
    if (!whop) {
      return NextResponse.json({ error: "Whop not found" }, { status: 404 });
    }
    
    const data = await request.json();
    
    // Validate and sanitize FAQ content if it's structured JSON
    let processedFaqContent = data.faqContent;
    
    if (data.faqContent && data.faqContent.trim().startsWith('[')) {
      try {
        const faqArray = JSON.parse(data.faqContent);
        
        if (Array.isArray(faqArray)) {
          // Validate the structure
          const validationResult = FaqArraySchema.safeParse(faqArray);
          
          if (validationResult.success) {
            // Now handling plain text content - just trim whitespace
            const processedFaqs = validationResult.data.map((faq: FaqItem) => ({
              question: faq.question.trim(),
              answerHtml: faq.answerHtml.trim() // Plain text content, just trim
            }));
            
            processedFaqContent = JSON.stringify(processedFaqs);
          } else {
            return NextResponse.json(
              { error: "Invalid FAQ structure", details: validationResult.error.issues },
              { status: 400 }
            );
          }
        }
      } catch (jsonError) {
        // If JSON parsing fails, treat as legacy text content
        console.log("FAQ content is not valid JSON, treating as legacy text");
      }
    }
    
    // Update by UUID only - this is the key fix!
    const updatedWhop = await prisma.whop.update({
      where: { id: whop.id },
      data: {
        aboutContent: data.aboutContent,
        howToRedeemContent: data.howToRedeemContent,
        promoDetailsContent: data.promoDetailsContent,
        featuresContent: data.featuresContent,
        termsContent: data.termsContent,
        faqContent: processedFaqContent,
      }
    });

    // Revalidate the whop page cache to show updates immediately
    revalidatePath(`/whop/${whop.slug}`);
    
    return NextResponse.json(updatedWhop);
  } catch (error) {
    console.error("Error updating whop content:", error);
    return NextResponse.json(
      { error: "Failed to update whop content" },
      { status: 500 }
    );
  }
} 