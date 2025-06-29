// src/app/api/takealot/robust-sync/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { retrieveTakealotDataWithDuplicateManagement, cleanupDuplicateRecords } from '@/lib/takealotDataManager';
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
    const body = await request.json();
    const { 
      adminId, 
      integrationId, 
      dataType, 
      maxPages, 
      enableDuplicateCheck = true,
      updateExistingRecords = true,
      action = 'sync' // 'sync' or 'cleanup'
    } = body;

    // Validate required fields
    if (!adminId || !dataType) {
      return NextResponse.json(
        { error: 'Missing required fields: adminId and dataType are required' },
        { status: 400 }
      );
    }

    if (!['products', 'sales'].includes(dataType)) {
      return NextResponse.json(
        { error: 'Invalid dataType. Must be "products" or "sales"' },
        { status: 400 }
      );
    }

    // Handle cleanup action
    if (action === 'cleanup') {
      console.log(`[API] Starting cleanup for ${dataType} - Admin: ${adminId}`);
      
      const cleanupResult = await cleanupDuplicateRecords(adminId, dataType);
      
      return NextResponse.json({
        success: cleanupResult.success,
        message: cleanupResult.message,
        duplicatesRemoved: cleanupResult.duplicatesRemoved,
        action: 'cleanup'
      });
    }

    // Get API key from integration
    let apiKey: string;
    
    if (integrationId) {
      const integrationDoc = await db.collection('takealotIntegrations').doc(integrationId).get();
      if (!integrationDoc.exists) {
        return NextResponse.json(
          { error: 'Integration not found' },
          { status: 404 }
        );
      }
        const integrationData = integrationDoc.data();
      if (!integrationData || integrationData.adminId !== adminId) {
        return NextResponse.json(
          { error: 'Unauthorized: Integration does not belong to this admin' },
          { status: 403 }
        );
      }
      
      apiKey = integrationData.apiKey;
    } else {
      // Look for default integration for this admin
      const integrationsSnapshot = await db.collection('takealotIntegrations')
        .where('adminId', '==', adminId)
        .limit(1)
        .get();
      
      if (integrationsSnapshot.empty) {
        return NextResponse.json(
          { error: 'No Takealot integration found for this admin' },
          { status: 404 }
        );
      }
      
      apiKey = integrationsSnapshot.docs[0].data().apiKey;
    }

    if (!apiKey) {
      return NextResponse.json(
        { error: 'No API key found in integration' },
        { status: 400 }
      );
    }

    console.log(`[API] Starting robust sync for ${dataType} - Admin: ${adminId}`);
    
    // Call the robust data retrieval function
    const result = await retrieveTakealotDataWithDuplicateManagement({
      adminId,
      apiKey,
      dataType,
      maxPagesToFetch: maxPages ? parseInt(maxPages) : undefined,
      batchSize: 100,
      enableDuplicateCheck,
      updateExistingRecords
    });

    // Log the result for monitoring
    console.log(`[API] Robust sync completed for ${dataType} - Admin: ${adminId}`, {
      success: result.success,
      totalItemsFetched: result.totalItemsFetched,
      totalItemsProcessed: result.totalItemsProcessed,
      duplicatesFound: result.duplicatesFound,
      duplicatesUpdated: result.duplicatesUpdated,
      newRecordsAdded: result.newRecordsAdded,
      totalErrors: result.totalErrors,
      processingTimeMs: result.processingTime
    });

    return NextResponse.json({
      ...result,
      action: 'sync'
    });

  } catch (error: any) {
    console.error('[API] Error in robust sync endpoint:', error);
    
    return NextResponse.json(
      { 
        error: 'Internal server error', 
        message: error.message,
        success: false
      },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const adminId = searchParams.get('adminId');
    const dataType = searchParams.get('dataType');

    if (!adminId || !dataType) {
      return NextResponse.json(
        { error: 'Missing required parameters: adminId and dataType' },
        { status: 400 }
      );
    }

    if (!['products', 'sales'].includes(dataType)) {
      return NextResponse.json(
        { error: 'Invalid dataType. Must be "products" or "sales"' },
        { status: 400 }
      );
    }

    // Get statistics about the data for this admin
    const collectionName = dataType === 'products' ? 'takealot_offers' : 'takealot_sales';
    
    const totalSnapshot = await db.collection(collectionName)
      .where('integrationId', '==', adminId)
      .get();    const records = totalSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as any[];
    
    // Analyze for potential duplicates
    const uniqueKeys = new Set<string>();
    const potentialDuplicates: Array<{ id: string; field: string; value: any }> = [];
    const keyField = dataType === 'products' ? ['tsin_id', 'offer_id', 'sku'] : ['order_id', 'sale_id'];
    
    records.forEach((record: any) => {
      keyField.forEach(field => {
        if (record[field]) {
          const key = `${field}:${record[field]}`;
          if (uniqueKeys.has(key)) {
            potentialDuplicates.push({ id: record.id, field, value: record[field] });
          } else {
            uniqueKeys.add(key);
          }
        }
      });
    });

    // Get last sync information
    const lastSyncRecord = records
      .filter((record: any) => record.lastUpdated)
      .sort((a: any, b: any) => b.lastUpdated.toMillis() - a.lastUpdated.toMillis())[0];

    return NextResponse.json({
      success: true,
      statistics: {
        totalRecords: records.length,
        potentialDuplicates: potentialDuplicates.length,        duplicateDetails: potentialDuplicates.slice(0, 10), // Show first 10 potential duplicates
        lastSyncDate: lastSyncRecord?.lastUpdated?.toDate()?.toISOString() || null,
        oldestRecord: records
          .filter((record: any) => record.firstFetchedAt)
          .sort((a: any, b: any) => a.firstFetchedAt.toMillis() - b.firstFetchedAt.toMillis())[0]
          ?.firstFetchedAt?.toDate()?.toISOString() || null,
        recordsAddedLast24h: records.filter((record: any) => 
          record.firstFetchedAt && 
          (Date.now() - record.firstFetchedAt.toMillis()) < 24 * 60 * 60 * 1000
        ).length
      }
    });

  } catch (error: any) {
    console.error('[API] Error in robust sync GET endpoint:', error);
    
    return NextResponse.json(
      { 
        error: 'Internal server error', 
        message: error.message,
        success: false
      },
      { status: 500 }
    );
  }
}
