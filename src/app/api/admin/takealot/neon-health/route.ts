import { NextRequest, NextResponse } from 'next/server';
import { dbAdmin as db } from '@/lib/firebase/firebaseAdmin';
import { neon } from '@neondatabase/serverless';

const NEON_DATABASE_URL = process.env.NEON_DATABASE_URL;

export async function GET(request: NextRequest) {
  try {
    const adminUid = request.headers.get('admin-uid');
    if (!adminUid) {
      return NextResponse.json({ error: 'Admin UID required' }, { status: 401 });
    }

    // Test Neon connection
    const neonStartTime = Date.now();
    let neonStatus = 'healthy';
    let neonResponseTime = 0;
    
    try {
      if (!NEON_DATABASE_URL) {
        throw new Error('Neon database URL not configured');
      }
      
      const sql = neon(NEON_DATABASE_URL);
      await sql`SELECT 1`;
      neonResponseTime = Date.now() - neonStartTime;
      
      if (neonResponseTime > 5000) {
        neonStatus = 'degraded';
      }
    } catch (error) {
      console.error('Neon health check failed:', error);
      neonStatus = 'down';
      neonResponseTime = Date.now() - neonStartTime;
    }

    // Test Firebase connection
    const firebaseStartTime = Date.now();
    let firebaseStatus = 'healthy';
    let firebaseResponseTime = 0;
    
    try {
      await db.collection('admins').doc(adminUid).get();
      firebaseResponseTime = Date.now() - firebaseStartTime;
      
      if (firebaseResponseTime > 3000) {
        firebaseStatus = 'degraded';
      }
    } catch (error) {
      console.error('Firebase health check failed:', error);
      firebaseStatus = 'down';
      firebaseResponseTime = Date.now() - firebaseStartTime;
    }

    return NextResponse.json({
      neon: {
        status: neonStatus,
        responseTime: neonResponseTime,
        lastCheck: new Date()
      },
      firebase: {
        status: firebaseStatus,
        responseTime: firebaseResponseTime,
        lastCheck: new Date()
      }
    });

  } catch (error) {
    console.error('Health check error:', error);
    return NextResponse.json({ 
      error: 'Failed to check database health',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}
