// src/app/api/cron/takealot-hourly-100-sales/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { SalesSyncService } from '@/lib/salesSyncService';
import { cronJobLogger } from '@/lib/cronJobLogger';
import { dbAdmin as db } from '@/lib/firebase/firebaseAdmin';

export async function GET(request: NextRequest) {
  let logId: string | null = null;
  
  try {
    // Verify this is a cron request
    const authHeader = request.headers.get('authorization');
    if (process.env.CRON_SECRET && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    // Start system-wide logging
    logId = await cronJobLogger.startExecution({
      cronJobName: 'takealot-hourly-100-sales',
      cronJobType: 'scheduled',
      cronSchedule: '0 * * * *', // Every hour
      triggerType: 'cron',
      triggerSource: 'vercel-cron',
      apiSource: 'Takealot API',
      message: 'Starting hourly Last 100 sales sync - System-wide',
      details: 'Automated sync for Last 100 sales strategy across all enabled integrations with order_id-based upsert'
    });

    console.log('[HourlySales100Cron] Starting hourly Last 100 sales sync');
    
    // Get integrations with hourly Last 100 sales sync enabled
    const integrationsSnapshot = await db.collection('takealotIntegrations').get();
    const results = [];
    let totalItemsProcessed = 0;
    
    for (const integrationDoc of integrationsSnapshot.docs) {
      const integrationData = integrationDoc.data();
      const integrationId = integrationDoc.id;
      const adminId = integrationData.adminId;
      const apiKey = integrationData.apiKey;

      if (!apiKey) {
        console.warn(`[HourlySales100Cron] No API key for integration ${integrationId}, skipping`);
        continue;
      }

      // Check if this integration has the hourly Last 100 sales strategy enabled
      try {
        const syncPrefsDoc = await db.collection(`takealotIntegrations/${integrationId}/syncPreferences`).doc('sales').get();
        if (!syncPrefsDoc.exists) continue;
        
        const syncPrefs = syncPrefsDoc.data();
        const strategies = syncPrefs?.strategies || [];
        
        // Find the "Last 100" strategy and check if it's enabled with hourly schedule
        const last100Strategy = strategies.find((s: any) => 
          s.id === 'sls_100' && s.cronEnabled && s.cronLabel === 'Every 1 hr'
        );
        
        if (!last100Strategy) {
          console.log(`[HourlySales100Cron] Last 100 hourly strategy not enabled for integration ${integrationId}`);
          continue;
        }

        console.log(`[HourlySales100Cron] Processing Last 100 sales for integration ${integrationId}`);

        // Use the sales sync service with order_id-based logic
        const syncService = new SalesSyncService(integrationId);
        const result = await syncService.syncSales(apiKey, 'Last 100', 'cron', adminId);
        
        results.push({
          integrationId,
          adminId,
          success: true,
          itemsProcessed: result.totalProcessed,
          newRecords: result.totalNew,
          updatedRecords: result.totalUpdated,
          errors: result.totalErrors
        });

        totalItemsProcessed += result.totalProcessed;

      } catch (integrationError: any) {
        console.error(`[HourlySales100Cron] Error processing integration ${integrationId}:`, integrationError);
        results.push({
          integrationId,
          adminId,
          success: false,
          error: integrationError.message,
          itemsProcessed: 0
        });
      }
    }

    const summaryMessage = `Hourly Last 100 sales sync completed. Processed ${results.length} integrations, ${totalItemsProcessed} total items.`;
    
    // Complete system-wide logging
    if (logId) {
      await cronJobLogger.completeExecution(logId, {
        status: 'success',
        itemsProcessed: totalItemsProcessed,
        message: summaryMessage
      });
    }

    console.log(`[HourlySales100Cron] ${summaryMessage}`);

    return NextResponse.json({
      success: true,
      message: summaryMessage,
      results: results,
      totalItemsProcessed: totalItemsProcessed
    });

  } catch (error: any) {
    console.error('[HourlySales100Cron] System-wide error:', error);
    
    // Complete logging with error
    if (logId) {
      try {
        await cronJobLogger.completeExecution(logId, {
          status: 'failure',
          itemsProcessed: 0,
          message: `Hourly Last 100 sales sync failed: ${error.message}`
        });
      } catch (loggingError) {
        console.error('[HourlySales100Cron] Failed to complete error logging:', loggingError);
      }
    }
    
    return NextResponse.json({
      success: false,
      error: 'Hourly Last 100 sales sync failed',
      message: error.message
    }, { status: 500 });
  }
}
