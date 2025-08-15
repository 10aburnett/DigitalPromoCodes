import { NextResponse } from "next/server";
import { sign } from "jsonwebtoken";
import { cookies } from "next/headers";
import { JWT_SECRET } from "@/lib/auth-utils";

export const dynamic = 'force-dynamic';

// Hardcoded admin credentials - only these will work
const ADMIN_EMAIL = process.env.ADMIN_EMAIL || "alexburnett21@icloud.com";
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "Grizedale12£";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { email, password } = body;

    // Basic validation
    if (!email || !password) {
      return NextResponse.json(
        { error: "Email and password are required" },
        { status: 400 }
      );
    }

    // Check credentials against hardcoded values
    if (email !== ADMIN_EMAIL || password !== ADMIN_PASSWORD) {
      return NextResponse.json(
        { error: "Invalid credentials" },
        { status: 401 }
      );
    }

    console.log("Admin login successful for:", email);

    // Create JWT token
    const token = sign(
      {
        id: "admin-user",
        email: ADMIN_EMAIL,
        role: "ADMIN",
      },
      JWT_SECRET,
      { expiresIn: "24h" }
    );

    // Set the token in a HTTP-only cookie
    cookies().set({
      name: "admin-token",
      value: token,
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      path: "/",
      maxAge: 60 * 60 * 24, // 24 hours
    });

    // Return success with user info
    return NextResponse.json({
      success: true,
      user: {
        id: "admin-user",
        email: ADMIN_EMAIL,
        role: "ADMIN",
      },
    });
  } catch (error) {
    console.error("Login error:", error);
    return NextResponse.json(
      { error: "An unexpected error occurred" },
      { status: 500 }
    );
  }
} 