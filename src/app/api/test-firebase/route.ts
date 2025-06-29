import { NextResponse } from 'next/server';
import { dbAdmin, firebaseAdmin } from '../../../lib/firebase/firebaseAdmin';

export async function GET() {
  try {
    console.log('🧪 Testing Firebase Admin connection...');
    
    // Test connection
    const testRef = dbAdmin.collection('system-test').doc('connection-test');
    
    await testRef.set({
      timestamp: firebaseAdmin.firestore.FieldValue.serverTimestamp(),
      status: 'connected',
      environment: process.env.NODE_ENV || 'unknown',
      authMethod: process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON ? 'full_json' : 'individual_vars',
      projectId: firebaseAdmin.app().options.projectId
    });
    
    const testDoc = await testRef.get();
    const data = testDoc.data();
    
    console.log('✅ Firebase Admin test successful');
    
    return NextResponse.json({
      success: true,
      message: 'Firebase Admin connection successful',
      projectId: firebaseAdmin.app().options.projectId,
      authMethod: process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON ? 'full_json' : 'individual_vars',
      environment: process.env.NODE_ENV || 'unknown',
      timestamp: new Date().toISOString(),
      testData: data
    });
    
  } catch (error) {
    console.error('❌ Firebase Admin test failed:', error);
    
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString()
    }, { status: 500 });
  }
}
