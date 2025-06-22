// src/app/api/cron/takealot-robust-daily/route.ts

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
    // Verify this is a cron request
    const authHeader = request.headers.get('authorization');
    if (process.env.CRON_SECRET && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    console.log('[Cron] Starting robust daily Takealot sync');

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
    const concurrentLimit = 3; // Process 3 integrations at a time for daily sync

    // Process integrations in batches
    const integrations = integrationsSnapshot.docs;
    for (let i = 0; i < integrations.length; i += concurrentLimit) {
      const batch = integrations.slice(i, i + concurrentLimit);
      
      const batchPromises = batch.map(async (integrationDoc) => {
        const integrationData = integrationDoc.data();
        const integrationId = integrationDoc.id;

        try {
          // For daily sync, sync both products and sales with moderate limits
          const syncTasks = [
            {
              dataType: 'products' as const,
              maxPages: 20
            },
            {
              dataType: 'sales' as const,
              maxPages: 50
            }
          ];

          const taskResults = [];
          for (const task of syncTasks) {
            console.log(`[Cron] Syncing ${task.dataType} for integration ${integrationId}`);
            
            const result = await retrieveTakealotDataWithDuplicateManagement({
              adminId: integrationData.adminId,
              apiKey: integrationData.apiKey,
              dataType: task.dataType,
              maxPagesToFetch: task.maxPages,
              batchSize: 100,
              enableDuplicateCheck: true,
              updateExistingRecords: true
            });

            taskResults.push({
              dataType: task.dataType,
              ...result
            });

            // Add delay between tasks for the same integration
            await new Promise(resolve => setTimeout(resolve, 3000));
          }

          // Update last sync timestamp
          await db.collection('takealotIntegrations').doc(integrationId).update({
            lastRobustSync: admin.firestore.Timestamp.now(),
            lastRobustSync_daily: admin.firestore.Timestamp.now()
          });

          return {
            integrationId,
            adminId: integrationData.adminId,
            success: true,
            tasks: taskResults,
            totalNewRecords: taskResults.reduce((sum, task) => sum + (task.newRecordsAdded || 0), 0),
            totalDuplicates: taskResults.reduce((sum, task) => sum + (task.duplicatesFound || 0), 0)
          };

        } catch (error: any) {
          console.error(`[Cron] Error processing integration ${integrationId}:`, error);
          
          await db.collection('takealotSyncLogs').add({
            integrationId,
            adminId: integrationData.adminId,
            cronLabel: 'daily',
            error: error.message,
            timestamp: admin.firestore.Timestamp.now(),
            type: 'robust_sync_error'
          });

          return {
            integrationId,
            adminId: integrationData.adminId,
            success: false,
            message: error.message,
            tasks: []
          };
        }
      });

      const batchResults = await Promise.all(batchPromises);
      results.push(...batchResults);

      // Add delay between batches
      if (i + concurrentLimit < integrations.length) {
        await new Promise(resolve => setTimeout(resolve, 15000)); // 15 second delay
      }
    }

    const successful = results.filter(r => r.success).length;
    const failed = results.filter(r => !r.success).length;
    const totalNewRecords = results.reduce((sum, r) => sum + ((r as any).totalNewRecords || 0), 0);
    const totalDuplicates = results.reduce((sum, r) => sum + ((r as any).totalDuplicates || 0), 0);

    // Log summary
    await db.collection('takealotSyncLogs').add({
      cronLabel: 'daily',
      totalIntegrations: results.length,
      successfulIntegrations: successful,
      failedIntegrations: failed,
      totalNewRecords,
      totalDuplicates,
      timestamp: admin.firestore.Timestamp.now(),
      type: 'robust_sync_summary'
    });

    console.log(`[Cron] Daily sync completed: ${successful} successful, ${failed} failed, ${totalNewRecords} new records, ${totalDuplicates} duplicates`);

    return NextResponse.json({
      success: true,
      message: `Daily sync completed: ${successful} successful, ${failed} failed`,
      processed: results.length,
      totalNewRecords,
      totalDuplicates,
      results: results.map(r => ({
        integrationId: r.integrationId,
        success: r.success,
        message: r.message || 'Success',
        taskCount: (r as any).tasks?.length || 0,
        newRecords: (r as any).totalNewRecords || 0,
        duplicatesFound: (r as any).totalDuplicates || 0
      }))
    });

  } catch (error: any) {
    console.error('[Cron] Fatal error in daily sync:', error);
    
    await db.collection('takealotSyncLogs').add({
      cronLabel: 'daily',
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
