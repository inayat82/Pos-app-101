// src/app/api/admin/test-sync/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { createOrResumeSyncJob, processJobChunk } from '@/lib/paginatedSyncService';
import admin from 'firebase-admin';

// Initialize Firebase Admin SDK if not already initialized
if (!admin.apps.length) {
  if (process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON) {
    const serviceAccount = JSON.parse(process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON);
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
    });
  } else if (process.env.FIREBASE_SERVICE_ACCOUNT_PROJECT_ID && process.env.FIREBASE_SERVICE_ACCOUNT_PRIVATE_KEY && process.env.FIREBASE_SERVICE_ACCOUNT_CLIENT_EMAIL) {
    admin.initializeApp({
      credential: admin.credential.cert({
        projectId: process.env.FIREBASE_SERVICE_ACCOUNT_PROJECT_ID,
        privateKey: process.env.FIREBASE_SERVICE_ACCOUNT_PRIVATE_KEY.replace(/\\n/g, '\n'),
        clientEmail: process.env.FIREBASE_SERVICE_ACCOUNT_CLIENT_EMAIL,
      }),
    });
  } else {
    admin.initializeApp();
  }
}

const db = admin.firestore();

export async function POST(request: NextRequest) {
  try {
    console.log('[TestSync] Starting test sync');
    
    const body = await request.json();
    const { dataType = 'sales', maxPages = 2, pagesPerChunk = 2 } = body;
    
    // Get test integration data
    const testIntegration = {
      adminId: 'test-admin',
      apiKey: process.env.TAKEALOT_API_KEY || 'test-key',
      enabled: true
    };
    
    if (!testIntegration.apiKey || testIntegration.apiKey === 'test-key') {
      return NextResponse.json({
        success: false,
        error: 'TAKEALOT_API_KEY not configured'
      }, { status: 400 });
    }
    
    // Create or resume sync job
    const jobResult = await createOrResumeSyncJob(
      testIntegration.adminId,
      dataType,
      'test_sync',
      testIntegration.apiKey,
      maxPages,
      pagesPerChunk,
      '1_month' // Test with 1 month filter
    );
    
    console.log('[TestSync] Created sync job:', jobResult);
    
    // Process one chunk
    const chunkResult = await processJobChunk(jobResult.jobId);
    
    console.log('[TestSync] Chunk processing result:', chunkResult);
    
    return NextResponse.json({
      success: true,
      message: 'Test sync completed',
      jobId: jobResult.jobId,
      chunkResult,
      timestamp: new Date().toISOString()
    });
    
  } catch (error: any) {
    console.error('[TestSync] Error:', error);
    
    // Log error to sync logs
    await db.collection('takealotSyncLogs').add({
      cronLabel: 'test_sync',
      message: `Test sync failed: ${error.message}`,
      timestamp: admin.firestore.Timestamp.now(),
      type: 'error',
      error: error.message,
      stack: error.stack
    });
    
    return NextResponse.json({
      success: false,
      error: error.message,
      timestamp: new Date().toISOString()
    }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  try {
    // Return test sync status
    const recentLogsSnapshot = await db.collection('takealotSyncLogs')
      .where('cronLabel', '==', 'test_sync')
      .orderBy('timestamp', 'desc')
      .limit(10)
      .get();
    
    const logs = recentLogsSnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
      timestamp: doc.data().timestamp?.toDate?.() || doc.data().timestamp
    }));
    
    return NextResponse.json({
      success: true,
      logs,
      message: 'Test sync logs retrieved',
      timestamp: new Date().toISOString()
    });
    
  } catch (error: any) {
    console.error('[TestSync] Error getting logs:', error);
    
    return NextResponse.json({
      success: false,
      error: error.message,
      timestamp: new Date().toISOString()
    }, { status: 500 });
  }
}
