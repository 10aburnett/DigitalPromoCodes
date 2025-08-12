import { NextResponse } from 'next/server';

export async function GET() {
  // This endpoint will be called client-side to test if debug features work
  const debugInfo = {
    timestamp: new Date().toISOString(),
    message: 'Debug endpoint working - latest code deployed',
    environment: process.env.NODE_ENV,
    vercelEnv: process.env.VERCEL_ENV,
    consoleTest: 'This should appear in browser console when called'
  };
  
  return NextResponse.json(debugInfo);
}