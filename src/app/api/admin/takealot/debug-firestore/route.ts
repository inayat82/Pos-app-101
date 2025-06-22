// src/app/api/admin/takealot/debug-firestore/route.ts
import { NextRequest, NextResponse } from 'next/server';
import admin from 'firebase-admin';
import '@/lib/firebase/firebaseAdmin'; // Initialize Firebase Admin SDK

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const integrationId = searchParams.get('integrationId');
    const collection = searchParams.get('collection') || 'takealot_offers';
    
    if (!integrationId) {
      return NextResponse.json({ 
        error: 'Missing integrationId parameter' 
      }, { status: 400 });
    }

    const db = admin.firestore();
    
    // Query the collection for this integration
    const snapshot = await db.collection(collection)
      .where('integrationId', '==', integrationId)
      .limit(10)
      .get();
    
    const documents: any[] = [];
    snapshot.forEach((doc) => {
      documents.push({
        id: doc.id,
        data: doc.data()
      });
    });
    
    // Also get collection stats
    const totalSnapshot = await db.collection(collection)
      .where('integrationId', '==', integrationId)
      .get();
    
    return NextResponse.json({
      success: true,
      collection,
      integrationId,
      totalDocuments: totalSnapshot.size,
      sampleDocuments: documents,
      message: `Found ${totalSnapshot.size} documents in ${collection} for integration ${integrationId}`
    });

  } catch (error: any) {
    console.error('Debug Firestore Error:', error);
    return NextResponse.json({ 
      error: error.message || 'Internal server error',
      details: error.toString()
    }, { status: 500 });
  }
}
