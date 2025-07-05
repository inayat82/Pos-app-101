// Simple endpoint to recreate logs collection
import { NextRequest, NextResponse } from 'next/server';
import { dbAdmin as db } from '@/lib/firebase/firebaseAdmin';

export async function POST(request: NextRequest) {
  try {
    console.log('🔧 Creating logs collection...');
    
    // Create initial log entry to establish the collection
    const initLog = {
      id: `init-${Date.now()}`,
      timestamp: new Date(),
      adminId: 'system',
      adminName: 'System',
      adminEmail: 'system@app.com',
      cronJobName: 'collection-initialization',
      cronJobType: 'system',
      triggerType: 'manual',
      status: 'success',
      message: 'logs collection recreated after deletion',
      duration: 0,
      itemsProcessed: 0,
      metadata: {
        reason: 'Collection was accidentally deleted',
        recreatedAt: new Date().toISOString()
      }
    };
    
    // Add the document to create the collection
    const docRef = await db.collection('logs').add(initLog);
    console.log('✅ logs collection created with document ID:', docRef.id);
    
    // Verify it was created
    const verifyDoc = await db.collection('logs').doc(docRef.id).get();
    const collectionExists = verifyDoc.exists;
    
    return NextResponse.json({
      success: true,
      message: 'logs collection successfully recreated',
      documentId: docRef.id,
      collectionExists,
      details: 'You can now run manual syncs and they will be logged properly'
    });
    
  } catch (error: any) {
    console.error('❌ Error creating logs collection:', error);
    return NextResponse.json({
      success: false,
      error: error.message,
      details: 'Failed to recreate logs collection'
    }, { status: 500 });
  }
}
