import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { cookies } from 'next/headers';
import { verify } from 'jsonwebtoken';
import { JWT_SECRET } from '@/lib/auth-utils';
import { revalidateTag, revalidatePath } from 'next/cache';

// Define a type for decoded JWT token
interface DecodedToken {
  id: string;
  email: string;
  role: string;
}

// GET /api/settings - Fetch site settings
export async function GET() {
  try {
    // Find the first settings record or create one if it doesn't exist
    // Run prisma generate to update types after schema changes
    let settings = await prisma.settings.findFirst();
    
    if (!settings) {
      settings = await prisma.settings.create({
        data: {
          id: require('crypto').randomUUID(),
          faviconUrl: '/favicon.ico', // Default favicon
          updatedAt: new Date()
        }
      });
    }
    
    return NextResponse.json(settings);
  } catch (error) {
    console.error('Error fetching settings:', error);
    return NextResponse.json(
      { error: 'Failed to fetch settings' },
      { status: 500 }
    );
  }
}

// PUT /api/settings - Update site settings
export async function PUT(request: Request) {
  try {
    // First try JWT token authentication
    let isAuthorized = false;
    
    // Check JWT token in cookies
    try {
      const cookieStore = cookies();
      const token = cookieStore.get('admin-token')?.value;
      
      if (token) {
        const decoded = verify(token, JWT_SECRET) as DecodedToken;
        if (decoded.role === "ADMIN") {
          isAuthorized = true;
        }
      }
    } catch (error) {
      console.error("JWT verification error:", error);
    }
    
    // Also try NextAuth session as fallback
    if (!isAuthorized) {
      const session = await getServerSession(authOptions);
      if (session?.user?.role === "ADMIN") {
        isAuthorized = true;
      }
    }

    // Return 401 if not authorized
    if (!isAuthorized) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    
    const data = await request.json();
    
    // Find the first settings record or create one if it doesn't exist
    let settings = await prisma.settings.findFirst();
    
    if (settings) {
      // Update existing settings
      settings = await prisma.settings.update({
        where: { id: settings.id },
        data: {
          faviconUrl: data.faviconUrl,
          updatedAt: new Date()
        }
      });
    } else {
      // Create new settings
      settings = await prisma.settings.create({
        data: {
          id: require('crypto').randomUUID(),
          faviconUrl: data.faviconUrl,
          updatedAt: new Date()
        }
      });
    }
    
    // Aggressively invalidate caches so new favicon is picked up immediately
    revalidateTag('favicon');
    revalidatePath('/');
    revalidatePath('/admin');
    
    // Return response with cache control headers
    return NextResponse.json(settings, {
      headers: {
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0'
      }
    });
  } catch (error) {
    console.error('Error updating settings:', error);
    return NextResponse.json(
      { error: 'Failed to update settings' },
      { status: 500 }
    );
  }
} 