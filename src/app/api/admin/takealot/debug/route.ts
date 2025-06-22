// src/app/api/admin/takealot/debug/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';
import '@/lib/firebase/firebaseAdmin'; // Initialize Firebase Admin

export async function GET(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const idToken = authHeader.split('Bearer ')[1];
    let decodedToken;
    
    try {
      decodedToken = await getAuth().verifyIdToken(idToken);
    } catch (error) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
    }

    const db = getFirestore();
    
    // Get user's integrations
    const integrationsSnapshot = await db.collection('takealotIntegrations')
      .where('adminId', '==', decodedToken.uid)
      .get();

    const integrations = integrationsSnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
      // Don't expose API key in debug info
      apiKey: doc.data().apiKey ? '[REDACTED]' : null
    }));

    // Get recent job logs
    const jobLogsSnapshot = await db.collection('takealotJobLogs')
      .where('adminId', '==', decodedToken.uid)
      .orderBy('startTime', 'desc')
      .limit(10)
      .get();

    const jobLogs = jobLogsSnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));

    return NextResponse.json({
      success: true,
      user: {
        uid: decodedToken.uid,
        email: decodedToken.email
      },
      integrations: {
        count: integrations.length,
        data: integrations
      },
      jobLogs: {
        count: jobLogs.length,
        data: jobLogs
      },
      systemInfo: {
        timestamp: new Date().toISOString(),
        environment: process.env.NODE_ENV || 'unknown'
      }
    });

  } catch (error: any) {
    console.error('Debug API error:', error);
    return NextResponse.json({ 
      error: error.message || 'Internal server error',
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    }, { status: 500 });
  }
}
