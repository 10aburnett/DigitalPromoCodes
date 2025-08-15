import { NextResponse } from "next/server";
import { cookies } from "next/headers";

export const dynamic = 'force-dynamic';

export async function POST() {
  try {
    const cookieStore = cookies();
    
    // Clear the admin token cookie with proper settings
    const response = NextResponse.json({ success: true, message: "Logged out successfully" });
    
    // Set the cookie to expire immediately
    response.cookies.set("admin-token", "", {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      expires: new Date(0), // Set to past date to delete
    });
    
    return response;
  } catch (error) {
    console.error("Logout error:", error);
    return NextResponse.json({ error: "Logout failed" }, { status: 500 });
  }
} 