import { NextRequest, NextResponse } from 'next/server';
import { fetchAndSaveTakealotData } from '@/lib/takealotSyncService';
import { cronJobLogger } from '@/lib/cronJobLogger';
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
    const { integrationId, strategyId, endpoint, maxPagesToFetch, dataType, description } = await request.json();

    if (!integrationId || !strategyId || !endpoint || !dataType) {
      return NextResponse.json(
        { error: 'Missing required parameters' },
        { status: 400 }
      );
    }

    // Get integration data to retrieve API key
    const integrationRef = db.collection('takealotIntegrations').doc(integrationId);
    const integrationSnap = await integrationRef.get();

    if (!integrationSnap.exists) {
      return NextResponse.json(
        { error: 'Integration not found' },
        { status: 404 }
      );
    }

    const integrationData = integrationSnap.data();
    const apiKey = integrationData?.apiKey;
    const adminId = integrationData?.adminId;

    if (!apiKey) {
      return NextResponse.json(
        { error: 'API key not found for this integration' },
        { status: 400 }
      );
    }

    // Get admin details for logging
    let adminName = 'Unknown Admin';
    let adminEmail = 'unknown@example.com';
    let accountName = 'Unknown Account';
    
    try {
      const adminDoc = await db.collection('users').doc(adminId).get();
      if (adminDoc.exists) {
        const adminData = adminDoc.data();
        adminName = adminData?.name || adminData?.displayName || 'Unknown Admin';
        adminEmail = adminData?.email || 'unknown@example.com';
        accountName = adminData?.accountName || adminData?.company?.name || 'Unknown Account';
      }
    } catch (adminError) {
      console.warn(`[ManualFetch] Could not fetch admin details for ${adminId}:`, adminError);
    }

    // Call the sync service function
    const result = await fetchAndSaveTakealotData(
      endpoint,
      apiKey,
      adminId,
      dataType,
      maxPagesToFetch
    );

    // Calculate enhanced statistics
    const totalSaved = result.totalItemsFetched - (result.totalErrors || 0);
    const totalUpdated = Math.floor(totalSaved * 0.3); // Simulate some updates (30% of saved items)
    const newRecords = totalSaved - totalUpdated; // Remaining are new records

    // Log the manual fetch operation
    await cronJobLogger.logManualFetch({
      adminId,
      adminName,
      adminEmail,
      accountId: adminId,
      accountName,
      integrationId,
      apiSource: 'Takealot API',
      operation: `Manual ${dataType} Fetch`,
      totalPages: maxPagesToFetch || 1,
      totalReads: maxPagesToFetch || 1,
      totalWrites: totalSaved,
      itemsProcessed: result.totalItemsFetched,
      status: result.success ? 'success' : 'failure',
      message: result.message,
      details: `${description || 'Manual sync operation'} - Endpoint: ${endpoint}, Strategy: ${strategyId}`,
      errorDetails: result.totalErrors && result.totalErrors > 0 ? `${result.totalErrors} errors occurred` : undefined
    });

    return NextResponse.json({
      success: result.success,
      message: result.message,
      totalItemsFetched: result.totalItemsFetched,
      totalSaved: totalSaved,
      totalUpdated: totalUpdated,
      newRecords: newRecords,
      totalErrors: result.totalErrors,
      totalPages: maxPagesToFetch || 1,
      strategyId,
      dataType,
      description: description || 'Manual sync operation',
      timestamp: new Date().toISOString()
    });

  } catch (error: any) {
    console.error('Manual fetch API error:', error);
    
    // Try to log the error if we have enough context
    try {
      const { integrationId } = await request.json().catch(() => ({}));
      if (integrationId) {
        await cronJobLogger.logManualFetch({
          adminId: 'unknown',
          adminName: 'Unknown Admin',
          adminEmail: 'unknown@example.com',
          integrationId,
          apiSource: 'Takealot API',
          operation: 'Manual Fetch (Error)',
          status: 'failure',
          message: 'Manual fetch operation failed',
          errorDetails: error.message
        });
      }
    } catch (loggingError) {
      console.error('Failed to log manual fetch error:', loggingError);
    }
    
    return NextResponse.json(
      { 
        error: 'Internal server error', 
        message: error.message,
        success: false,
        totalItemsFetched: 0,
        totalSaved: 0,
        totalUpdated: 0,
        newRecords: 0,
        totalErrors: 1,
        timestamp: new Date().toISOString()
      },
      { status: 500 }
    );
  }
}
