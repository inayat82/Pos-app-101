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

    // Get all active integrations with product cron enabled
    const integrationsSnapshot = await db.collection('takealotIntegrations')
      .where('cronEnabled', '==', true)
      .where('productCronEnabled', '==', true)
      .get();

    if (integrationsSnapshot.empty) {
      console.log('[Cron] No enabled product integrations found');
      return NextResponse.json({ 
        success: true, 
        message: 'No enabled product integrations found',
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
          // Check sync preferences to determine if any strategy with "Every 1 hr" is enabled
          const syncPrefsRef = db
            .collection(`admins/${integrationData.adminId}/takealotIntegrations/${integrationId}/syncPreferences`)
            .doc('preferences');
          
          const syncPrefsSnap = await syncPrefsRef.get();
          
          let shouldSyncSales = false;
          let shouldSyncProducts = false;
          
          if (syncPrefsSnap.exists) {
            const prefs = syncPrefsSnap.data();
            const salesStrategies = prefs?.salesStrategies || [];
            const productStrategies = prefs?.productStrategies || [];
            
            // Check for sales strategies with "Every 1 hr" cron label (30 days sales)
            shouldSyncSales = salesStrategies.some((s: any) => 
              s.cronEnabled === true && s.cronLabel === 'Every 1 hr'
            );
            
            // Check for product strategies with "Every 1 hr" cron label (all products)
            shouldSyncProducts = productStrategies.some((p: any) => 
              p.cronEnabled === true && p.cronLabel === 'Every 1 hr'
            );
          }

          if (!shouldSyncSales && !shouldSyncProducts) {
            console.log(`[Cron] Skipping integration ${integrationId} - no hourly strategies enabled`);
            return {
              integrationId,
              adminId: integrationData.adminId,
              success: true,
              message: 'No hourly strategies enabled',
              skipped: true
            };
          }

          const results = [];

          // Sync sales if enabled (Last 30 days)
          if (shouldSyncSales) {
            console.log(`[Cron] Syncing last 30 days sales for integration ${integrationId}`);
            const salesResult = await retrieveTakealotDataWithDuplicateManagement({
              adminId: integrationData.adminId,
              apiKey: integrationData.apiKey,
              dataType: 'sales',
              maxPagesToFetch: 30, // 30 days worth of data
              batchSize: 100,
              enableDuplicateCheck: true,
              updateExistingRecords: true
            });
            results.push({ type: 'sales', ...salesResult });
          }

          // Sync products if enabled (All products)
          if (shouldSyncProducts) {
            console.log(`[Cron] Syncing all products for integration ${integrationId}`);
            const productsResult = await retrieveTakealotDataWithDuplicateManagement({
              adminId: integrationData.adminId,
              apiKey: integrationData.apiKey,
              dataType: 'products',
              maxPagesToFetch: undefined, // All products
              batchSize: 100,
              enableDuplicateCheck: true,
              updateExistingRecords: true
            });
            results.push({ type: 'products', ...productsResult });
          }

          // Update last sync timestamp
          await db.collection('takealotIntegrations').doc(integrationId).update({
            lastRobustSync: admin.firestore.Timestamp.now(),
            lastRobustSync_hourly: admin.firestore.Timestamp.now()
          });

          // Aggregate results
          const totalNewRecords = results.reduce((sum, r) => sum + (r.newRecordsAdded || 0), 0);
          const totalDuplicates = results.reduce((sum, r) => sum + (r.duplicatesFound || 0), 0);

          return {
            integrationId,
            adminId: integrationData.adminId,
            success: true,
            message: `Hourly sync completed: ${results.length} data types synced`,
            newRecordsAdded: totalNewRecords,
            duplicatesFound: totalDuplicates,
            syncTasks: results
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
