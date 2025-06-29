// src/app/api/cron/takealot-robust-weekly/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { retrieveTakealotDataWithDuplicateManagement, cleanupDuplicateRecords } from '@/lib/takealotDataManager';
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

export async function GET(request: NextRequest) {
  const logId = await cronJobLogger.startExecution({
    cronJobName: 'takealot-robust-weekly',
    cronJobType: 'scheduled',
    cronSchedule: '0 2 * * 0', // Weekly at 2 AM Sunday
    triggerType: 'cron',
    triggerSource: 'vercel-cron',
    apiSource: 'Takealot API',
    message: 'Starting weekly comprehensive Takealot data sync',
    details: 'Weekly comprehensive Takealot data sync with cleanup'
  });

  try {
    // Verify this is a cron request
    const authHeader = request.headers.get('authorization');
    if (process.env.CRON_SECRET && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
      await cronJobLogger.completeExecution(logId, {
        status: 'failure',
        message: 'Unauthorized - Invalid cron secret',
        errorDetails: 'Authentication failed'
      });
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    console.log('[Cron] Starting robust weekly Takealot sync');
    await cronJobLogger.updateExecution(logId, {
      status: 'running',
      message: 'Fetching enabled integrations',
      details: 'Starting weekly sync process'
    });

    const integrationsSnapshot = await db.collection('takealotIntegrations')
      .where('cronEnabled', '==', true)
      .get();

    if (integrationsSnapshot.empty) {
      console.log('[Cron] No enabled integrations found');
      await cronJobLogger.completeExecution(logId, {
        status: 'success',
        message: 'No enabled integrations found',
        details: 'No integrations available for processing'
      });
      return NextResponse.json({ 
        success: true, 
        message: 'No enabled integrations found',
        processed: 0
      });
    }

    const results = [];
    const concurrentLimit = 2; // Process 2 integrations at a time for weekly comprehensive sync

    // Process integrations in batches
    const integrations = integrationsSnapshot.docs;
    for (let i = 0; i < integrations.length; i += concurrentLimit) {
      const batch = integrations.slice(i, i + concurrentLimit);
      
      const batchPromises = batch.map(async (integrationDoc) => {
        const integrationData = integrationDoc.data();
        const integrationId = integrationDoc.id;

        try {
          // For weekly sync, do comprehensive sync with no page limits, plus cleanup
          const syncTasks = [
            {
              dataType: 'products' as const,
              maxPages: null // No limit for comprehensive weekly sync
            },
            {
              dataType: 'sales' as const,
              maxPages: null // No limit for comprehensive weekly sync
            }
          ];

          const taskResults = [];
          for (const task of syncTasks) {
            console.log(`[Cron] Comprehensive syncing ${task.dataType} for integration ${integrationId}`);
            
            const result = await retrieveTakealotDataWithDuplicateManagement({
              adminId: integrationData.adminId,
              apiKey: integrationData.apiKey,
              dataType: task.dataType,
              maxPagesToFetch: task.maxPages || undefined,
              batchSize: 100,
              enableDuplicateCheck: true,
              updateExistingRecords: true
            });

            taskResults.push({
              dataType: task.dataType,
              ...result
            });

            // Add delay between tasks for the same integration
            await new Promise(resolve => setTimeout(resolve, 5000));
          }

          // Perform duplicate cleanup after sync
          console.log(`[Cron] Cleaning up duplicates for integration ${integrationId}`);
          const cleanupResults = [];
          
          for (const dataType of ['products', 'sales'] as const) {
            const cleanupResult = await cleanupDuplicateRecords(integrationData.adminId, dataType);
            cleanupResults.push({
              dataType,
              ...cleanupResult
            });
            
            await new Promise(resolve => setTimeout(resolve, 2000));
          }

          // Update last sync timestamp
          await db.collection('takealotIntegrations').doc(integrationId).update({
            lastRobustSync: admin.firestore.Timestamp.now(),
            lastRobustSync_weekly: admin.firestore.Timestamp.now(),
            lastCleanup: admin.firestore.Timestamp.now()
          });

          return {
            integrationId,
            adminId: integrationData.adminId,
            success: true,
            syncTasks: taskResults,
            cleanupTasks: cleanupResults,
            totalNewRecords: taskResults.reduce((sum, task) => sum + (task.newRecordsAdded || 0), 0),
            totalDuplicates: taskResults.reduce((sum, task) => sum + (task.duplicatesFound || 0), 0),
            totalDuplicatesRemoved: cleanupResults.reduce((sum, cleanup) => sum + (cleanup.duplicatesRemoved || 0), 0)
          };

        } catch (error: any) {
          console.error(`[Cron] Error processing integration ${integrationId}:`, error);
          
          // Legacy logging removed - now using centralized logging system

          return {
            integrationId,
            adminId: integrationData.adminId,
            success: false,
            message: error.message,
            syncTasks: [],
            cleanupTasks: []
          };
        }
      });

      const batchResults = await Promise.all(batchPromises);
      results.push(...batchResults);

      // Add longer delay between batches for comprehensive sync
      if (i + concurrentLimit < integrations.length) {
        await new Promise(resolve => setTimeout(resolve, 30000)); // 30 second delay
      }
    }

    const successful = results.filter(r => r.success).length;
    const failed = results.filter(r => !r.success).length;
    const totalNewRecords = results.reduce((sum, r) => sum + ((r as any).totalNewRecords || 0), 0);
    const totalDuplicates = results.reduce((sum, r) => sum + ((r as any).totalDuplicates || 0), 0);
    const totalDuplicatesRemoved = results.reduce((sum, r) => sum + ((r as any).totalDuplicatesRemoved || 0), 0);
    // Legacy logging removed - now using centralized logging system

    // Complete centralized logging
    await cronJobLogger.completeExecution(logId, {
      status: successful === results.length ? 'success' : 'failure',
      totalWrites: totalNewRecords,
      itemsProcessed: totalNewRecords + totalDuplicates,
      message: `Weekly comprehensive sync completed: ${successful} successful, ${failed} failed`,
      details: `Records: ${totalNewRecords} new, ${totalDuplicates} duplicates found, ${totalDuplicatesRemoved} duplicates removed`
    });

    console.log(`[Cron] Weekly comprehensive sync completed: ${successful} successful, ${failed} failed`);
    console.log(`[Cron] Records: ${totalNewRecords} new, ${totalDuplicates} duplicates found, ${totalDuplicatesRemoved} duplicates removed`);

    return NextResponse.json({
      success: true,
      message: `Weekly comprehensive sync completed: ${successful} successful, ${failed} failed`,
      processed: results.length,
      totalNewRecords,
      totalDuplicates,
      totalDuplicatesRemoved,
      results: results.map(r => ({
        integrationId: r.integrationId,
        success: r.success,
        message: r.message || 'Success',
        syncTaskCount: (r as any).syncTasks?.length || 0,
        cleanupTaskCount: (r as any).cleanupTasks?.length || 0,
        newRecords: (r as any).totalNewRecords || 0,
        duplicatesFound: (r as any).totalDuplicates || 0,
        duplicatesRemoved: (r as any).totalDuplicatesRemoved || 0
      }))
    });

  } catch (error: any) {
    console.error('[Cron] Fatal error in weekly sync:', error);
    // Legacy logging removed - now using centralized logging system

    // Complete centralized logging with error
    await cronJobLogger.completeExecution(logId, {
      status: 'failure',
      message: 'Fatal error in weekly sync',
      errorDetails: error.message,
      stackTrace: error.stack
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
