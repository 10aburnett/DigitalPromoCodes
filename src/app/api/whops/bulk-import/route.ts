import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { prisma } from "@/lib/prisma";
import { authOptions } from "@/lib/auth";
import { cookies } from "next/headers";
import { verify } from "jsonwebtoken";
import { JWT_SECRET } from "@/lib/auth-utils";
import { writeFile, mkdir } from "fs/promises";
import { existsSync } from "fs";
import path from "path";
import { v4 as uuidv4 } from "uuid";

// Define a type for decoded JWT token
interface DecodedToken {
  id: string;
  email: string;
  role: string;
}

interface WhopImportData {
  name: string;
  description?: string;
  logo?: string;
  affiliateLink: string;
  price?: string;
}

// Function to download and store image
async function downloadAndStoreImage(imageUrl: string, whopName: string): Promise<string> {
  try {
    console.log(`Downloading image from: ${imageUrl}`);
    
    const response = await fetch(imageUrl);
    if (!response.ok) {
      throw new Error(`Failed to fetch image: ${response.statusText}`);
    }
    
    const buffer = await response.arrayBuffer();
    const uint8Array = new Uint8Array(buffer);
    
    // Get file extension from URL or default to png
    const urlParts = imageUrl.split('.');
    const extension = urlParts.length > 1 ? urlParts.pop()?.toLowerCase() : 'png';
    
    // Generate unique filename
    const fileName = `${uuidv4()}.${extension}`;
    
    // Ensure uploads directory exists
    const uploadsDir = path.join(process.cwd(), 'public', 'uploads');
    if (!existsSync(uploadsDir)) {
      await mkdir(uploadsDir, { recursive: true });
    }
    
    // Save file to uploads directory
    const filePath = path.join(uploadsDir, fileName);
    await writeFile(filePath, uint8Array);
    
    console.log(`Image saved to: ${filePath}`);
    return `/uploads/${fileName}`;
  } catch (error) {
    console.error(`Error downloading image for ${whopName}:`, error);
    return '/images/default-logo.png';
  }
}

// Function to parse CSV line properly handling quoted fields
function parseCSVLine(line: string): string[] {
  const result = [];
  let current = '';
  let inQuotes = false;
  
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    
    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        // Escaped quote
        current += '"';
        i++; // Skip next quote
      } else {
        // Toggle quote state
        inQuotes = !inQuotes;
      }
    } else if (char === ',' && !inQuotes) {
      // End of field
      result.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }
  
  // Add the last field
  result.push(current.trim());
  
  return result;
}

export async function POST(request: Request) {
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

  try {
    const formData = await request.formData();
    const file = formData.get('file') as File;
    
    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    const csvContent = await file.text();
    const lines = csvContent.split('\n').filter(line => line.trim());
    
    if (lines.length < 2) {
      return NextResponse.json({ error: "CSV must have at least a header and one data row" }, { status: 400 });
    }

    // Parse CSV header
    const header = parseCSVLine(lines[0]).map(h => h.trim().toLowerCase());
    const requiredFields = ['name', 'affiliatelink'];
    const optionalFields = ['description', 'logo', 'price'];
    const expectedFields = [...requiredFields, ...optionalFields];
    
    // Validate required fields
    for (const field of requiredFields) {
      if (!header.includes(field)) {
        return NextResponse.json({ 
          error: `Missing required field: ${field}. Required fields: ${requiredFields.join(', ')}. Optional fields: ${optionalFields.join(', ')}` 
        }, { status: 400 });
      }
    }

    // Create bulk import record
    const bulkImport = await prisma.bulkImport.create({
      data: {
        id: require('crypto').randomUUID(),
        filename: file.name,
        totalRows: lines.length - 1,
        successRows: 0,
        failedRows: 0,
        status: 'PROCESSING',
        updatedAt: new Date()
      }
    });

    const results = {
      success: 0,
      failed: 0,
      errors: [] as string[]
    };

    // Process each data row
    for (let i = 1; i < lines.length; i++) {
      try {
        const values = parseCSVLine(lines[i]);
        const rowData: any = {};
        
        header.forEach((field, index) => {
          rowData[field] = values[index] || '';
        });

        // Validate required fields
        if (!rowData.name || !rowData.affiliatelink) {
          results.errors.push(`Row ${i}: Missing required fields (name, affiliatelink)`);
          results.failed++;
          continue;
        }

        // Generate slug
        const slug = rowData.name.toLowerCase()
          .replace(/[^a-z0-9\s-]/g, '')
          .replace(/\s+/g, '-')
          .replace(/-+/g, '-')
          .trim('-');

        // Check if whop already exists
        const existingWhop = await prisma.whop.findFirst({
          where: { 
            OR: [
              { slug: slug },
              { name: rowData.name }
            ]
          }
        });

        if (existingWhop) {
          results.errors.push(`Row ${i}: Whop "${rowData.name}" already exists`);
          results.failed++;
          continue;
        }

        // Download and store logo image only if provided and valid
        let logoPath = null;
        if (rowData.logo && rowData.logo.trim() && rowData.logo.startsWith('http')) {
          logoPath = await downloadAndStoreImage(rowData.logo, rowData.name);
        }

        // Get highest display order
        const highestOrderWhop = await prisma.whop.findFirst({
          orderBy: { displayOrder: 'desc' }
        });
        const displayOrder = highestOrderWhop ? highestOrderWhop.displayOrder + 1 : 0;

        // Process price field - clean up and handle various formats
        let processedPrice = null;
        if (rowData.price && rowData.price.trim()) {
          const priceValue = rowData.price.trim();
          // Only set price if it's not empty and not just whitespace
          if (priceValue && priceValue.toLowerCase() !== 'null' && priceValue !== '') {
            processedPrice = priceValue;
          }
        }

        // Create whop
        const whop = await prisma.whop.create({
          data: {
            id: require('crypto').randomUUID(),
            name: rowData.name,
            slug: slug,
            description: rowData.description || null,
            logo: logoPath,
            rating: 0,
            displayOrder: displayOrder,
            affiliateLink: rowData.affiliatelink,
            website: null,
            price: processedPrice,
            category: null,
            updatedAt: new Date()
          }
        });

        results.success++;
      } catch (error) {
        console.error(`Error processing row ${i}:`, error);
        results.errors.push(`Row ${i}: ${error instanceof Error ? error.message : 'Unknown error'}`);
        results.failed++;
      }
    }

    // Update bulk import record
    await prisma.bulkImport.update({
      where: { id: bulkImport.id },
      data: {
        successRows: results.success,
        failedRows: results.failed,
        status: results.failed > 0 ? 'COMPLETED' : 'COMPLETED',
        errors: results.errors
      }
    });

    return NextResponse.json({
      message: `Import completed. ${results.success} successful, ${results.failed} failed.`,
      bulkImportId: bulkImport.id,
      results
    });

  } catch (error) {
    console.error("Error in bulk import:", error);
    return NextResponse.json(
      { error: "Failed to process bulk import" },
      { status: 500 }
    );
  }
} 