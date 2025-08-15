import { NextResponse } from "next/server";
import { verifyAdminToken } from "@/lib/auth-utils";

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const adminUser = await verifyAdminToken();
    
    if (!adminUser || adminUser.role !== "ADMIN") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    return NextResponse.json({
      success: true,
      user: {
        id: adminUser.id,
        email: adminUser.email,
        role: adminUser.role,
      },
    });
  } catch (error) {
    console.error("Admin auth check failed:", error);
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
} 