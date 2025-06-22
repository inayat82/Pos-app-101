// src/app/api/admin/takealot/debug-all-integrations/route.ts
import { NextRequest, NextResponse } from 'next/server';
import admin from 'firebase-admin';
import '@/lib/firebase/firebaseAdmin'; // Initialize Firebase Admin SDK

export async function GET(request: NextRequest) {
  try {
    const db = admin.firestore();
    
    // Get all integrations without filtering
    const snapshot = await db.collection('takealotIntegrations')
      .limit(20)
      .get();
    
    const integrations: any[] = [];
    snapshot.forEach((doc) => {
      integrations.push({
        id: doc.id,
        data: doc.data()
      });
    });
    
    return NextResponse.json({
      success: true,
      totalIntegrations: snapshot.size,
      integrations,
      message: `Found ${snapshot.size} total integrations`
    });

  } catch (error: any) {
    console.error('Debug All Integrations Error:', error);
    return NextResponse.json({ 
      success: false, 
      error: error.message 
    }, { status: 500 });
  }
}
