// src/app/api/cron/takealot-robust-hourly/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { retrieveTakealotDataWithDuplicateManagement } from '@/lib/takealotDataManager';
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

export async function GET(request: NextRequest) {
  try {
    // Verify this is a cron request (in production, you should verify the cron secret)
    const authHeader = request.headers.get('authorization');
    if (process.env.CRON_SECRET && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    console.log('[Cron] Starting robust hourly Takealot sync');

    // Get all active integrations
    const integrationsSnapshot = await db.collection('takealotIntegrations')
      .where('cronEnabled', '==', true)
      .get();

    if (integrationsSnapshot.empty) {
      console.log('[Cron] No enabled integrations found');
      return NextResponse.json({ 
        success: true, 
        message: 'No enabled integrations found',
        processed: 0
      });
    }

    const results = [];
    const concurrentLimit = 2; // Process 2 integrations at a time for hourly sync

    // Process integrations in batches
    const integrations = integrationsSnapshot.docs;
    for (let i = 0; i < integrations.length; i += concurrentLimit) {
      const batch = integrations.slice(i, i + concurrentLimit);
      
      const batchPromises = batch.map(async (integrationDoc) => {
        const integrationData = integrationDoc.data();
        const integrationId = integrationDoc.id;

        try {
          // For hourly sync, only sync sales data with limited pages
          const result = await retrieveTakealotDataWithDuplicateManagement({
            adminId: integrationData.adminId,
            apiKey: integrationData.apiKey,
            dataType: 'sales',
            maxPagesToFetch: 5, // Limit to 5 pages for hourly sync
            batchSize: 100,
            enableDuplicateCheck: true,
            updateExistingRecords: true
          });

          // Update last sync timestamp
          await db.collection('takealotIntegrations').doc(integrationId).update({
            lastRobustSync: admin.firestore.Timestamp.now(),
            lastRobustSync_hourly: admin.firestore.Timestamp.now()
          });          return {
            integrationId,
            adminId: integrationData.adminId,
            ...result
          };

        } catch (error: any) {
          console.error(`[Cron] Error processing integration ${integrationId}:`, error);
          
          // Log error to Firestore
          await db.collection('takealotSyncLogs').add({
            integrationId,
            adminId: integrationData.adminId,
            cronLabel: 'hourly',
            error: error.message,
            timestamp: admin.firestore.Timestamp.now(),
            type: 'robust_sync_error'
          });

          return {
            integrationId,
            adminId: integrationData.adminId,
            success: false,
            message: error.message
          };
        }
      });

      const batchResults = await Promise.all(batchPromises);
      results.push(...batchResults);

      // Add delay between batches
      if (i + concurrentLimit < integrations.length) {
        await new Promise(resolve => setTimeout(resolve, 10000)); // 10 second delay
      }
    }

    const successful = results.filter(r => r.success).length;
    const failed = results.filter(r => !r.success).length;

    // Log summary
    await db.collection('takealotSyncLogs').add({
      cronLabel: 'hourly',
      totalIntegrations: results.length,
      successfulIntegrations: successful,
      failedIntegrations: failed,
      timestamp: admin.firestore.Timestamp.now(),
      type: 'robust_sync_summary'
    });

    console.log(`[Cron] Hourly sync completed: ${successful} successful, ${failed} failed`);

    return NextResponse.json({
      success: true,
      message: `Hourly sync completed: ${successful} successful, ${failed} failed`,
      processed: results.length,      results: results.map(r => ({
        integrationId: r.integrationId,
        success: r.success,
        message: r.message,
        newRecords: (r as any).newRecordsAdded || 0,
        duplicatesFound: (r as any).duplicatesFound || 0
      }))
    });

  } catch (error: any) {
    console.error('[Cron] Fatal error in hourly sync:', error);
    
    // Log fatal error
    await db.collection('takealotSyncLogs').add({
      cronLabel: 'hourly',
      error: error.message,
      timestamp: admin.firestore.Timestamp.now(),
      type: 'robust_sync_fatal_error'
    });

    return NextResponse.json(
      { 
        success: false, 
        error: 'Internal server error',
        message: error.message
      },
      { status: 500 }
    );
  }
}
