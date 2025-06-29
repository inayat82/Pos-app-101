import { NextResponse } from 'next/server';

export async function GET() {
  return NextResponse.json({
    message: 'Simple API test successful',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'unknown'
  });
}
