const { PrismaClient } = require('@prisma/client');
const { verify } = require('jsonwebtoken');

const prisma = new PrismaClient();

async function debugAdminUser() {
  try {
    console.log('=== DEBUGGING ADMIN USER FOREIGN KEY ISSUE ===');
    
    // Check all admin users in database
    console.log('\n1. All ADMIN users in database:');
    const adminUsers = await prisma.user.findMany({
      where: { role: 'ADMIN' },
      select: { id: true, email: true, name: true, role: true }
    });
    console.log('Admin users:', adminUsers);
    
    // Check what's in a typical admin JWT token (simulate token verification)
    console.log('\n2. JWT Secret being used:');
    const jwtSecret = process.env.AUTH_SECRET || "whpcodes-secret-key";
    console.log('JWT Secret:', jwtSecret);
    
    // Check if there are any blog posts and their authorIds
    console.log('\n3. Existing blog posts and their authorIds:');
    const existingPosts = await prisma.blogPost.findMany({
      select: { id: true, title: true, authorId: true },
      take: 5
    });
    console.log('Existing posts:', existingPosts);
    
    // Check what user IDs exist in the User table
    console.log('\n4. All user IDs in User table:');
    const allUserIds = await prisma.user.findMany({
      select: { id: true, email: true, role: true }
    });
    console.log('All user IDs:', allUserIds);
    
  } catch (error) {
    console.error('Debug error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

debugAdminUser();