// src/app/api/admin/test-firebase-connection/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { dbAdmin } from '@/lib/firebase/firebaseAdmin';

export async function GET(request: NextRequest) {
  try {
    // Test Firestore connection
    const testCollection = dbAdmin.collection('test');
    const testDoc = testCollection.doc('connection-test');
    
    // Try to write a test document
    await testDoc.set({
      timestamp: new Date(),
      message: 'Firebase connection test successful',
      environment: process.env.NODE_ENV || 'unknown',
      vercel: process.env.VERCEL ? 'true' : 'false'
    });

    // Try to read it back
    const readResult = await testDoc.get();
    
    if (readResult.exists) {
      // Clean up test document
      await testDoc.delete();
      
      return NextResponse.json({
        success: true,
        message: 'Firebase connection successful',
        environment: process.env.NODE_ENV || 'unknown',
        isVercel: process.env.VERCEL ? true : false,
        projectId: process.env.FIREBASE_PROJECT_ID || process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID
      });
    } else {
      return NextResponse.json({
        success: false,
        error: 'Could not read test document',
        environment: process.env.NODE_ENV || 'unknown'
      }, { status: 500 });
    }

  } catch (error: any) {
    console.error('Firebase connection test failed:', error);
    return NextResponse.json({
      success: false,
      error: 'Firebase connection failed',
      details: error.message,
      environment: process.env.NODE_ENV || 'unknown',
      isVercel: process.env.VERCEL ? true : false
    }, { status: 500 });
  }
}
