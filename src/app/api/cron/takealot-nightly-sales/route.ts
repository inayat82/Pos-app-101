// src/app/api/cron/takealot-nightly-sales/route.ts

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
      cronJobName: 'takealot-nightly-sales',
      cronJobType: 'scheduled',
      cronSchedule: '0 2 * * *', // Every night at 2 AM
      triggerType: 'cron',
      triggerSource: 'vercel-cron',
      apiSource: 'Takealot API',
      message: 'Starting nightly 30-day sales sync - System-wide',
      details: 'Automated sync for Last 30 Days sales strategy across all enabled integrations'
    });

    console.log('[NightlySalesCron] Starting nightly 30-day sales sync');
    
    // Get integrations with nightly sales sync enabled
    const integrationsSnapshot = await db.collection('takealotIntegrations').get();
    const results = [];
    let totalItemsProcessed = 0;
    
    for (const integrationDoc of integrationsSnapshot.docs) {
      const integrationData = integrationDoc.data();
      const integrationId = integrationDoc.id;
      const adminId = integrationData.adminId;
      const apiKey = integrationData.apiKey;

      if (!apiKey) {
        console.warn(`[NightlySalesCron] No API key for integration ${integrationId}, skipping`);
        continue;
      }

      // Check if this integration has the nightly 30-day sales strategy enabled
      try {
        const syncPrefsDoc = await db.collection(`takealotIntegrations/${integrationId}/syncPreferences`).doc('sales').get();
        if (!syncPrefsDoc.exists) continue;
        
        const syncPrefs = syncPrefsDoc.data();
        const strategies = syncPrefs?.strategies || [];
        
        // Find the "Last 30 Days" strategy and check if it's enabled with nightly schedule
        const thirtyDayStrategy = strategies.find((s: any) => 
          s.id === 'sls_30d' && s.cronEnabled && s.cronLabel === 'Every Night'
        );
        
        if (!thirtyDayStrategy) {
          console.log(`[NightlySalesCron] 30-day nightly strategy not enabled for integration ${integrationId}`);
          continue;
        }

        console.log(`[NightlySalesCron] Processing 30-day sales for integration ${integrationId}`);

        // Use the new sales sync service
        const syncService = new SalesSyncService(integrationId);
        const result = await syncService.syncSales(apiKey, 'Last 30 Days', 'cron', adminId);
        
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
        
      } catch (error: any) {
        console.error(`[NightlySalesCron] Error processing integration ${integrationId}:`, error);
        results.push({
          integrationId,
          adminId,
          success: false,
          error: error.message
        });
      }

      // Add delay between integrations
      await new Promise(resolve => setTimeout(resolve, 2000));
    }

    const successful = results.filter(r => r.success).length;
    const failed = results.filter(r => !r.success).length;
    const summaryMessage = `Nightly 30-day sales sync completed: ${successful} successful, ${failed} failed, ${totalItemsProcessed} total items processed`;

    console.log(`[NightlySalesCron] ${summaryMessage}`);

    // Complete centralized logging
    if (logId) {
      await cronJobLogger.completeExecution(logId, {
        status: failed > 0 && successful === 0 ? 'failure' : 'success',
        message: summaryMessage,
        totalReads: totalItemsProcessed,
        totalWrites: totalItemsProcessed,
        itemsProcessed: totalItemsProcessed,
        details: `Processed ${results.length} integrations: ${successful} successful, ${failed} failed`
      });
    }

    return NextResponse.json({
      success: true,
      message: summaryMessage,
      processed: results.length,
      totalItemsProcessed,
      results: results.map(r => ({
        integrationId: r.integrationId,
        success: r.success,
        itemsProcessed: r.itemsProcessed || 0,
        newRecords: r.newRecords || 0,
        updatedRecords: r.updatedRecords || 0
      }))
    });

  } catch (error: any) {
    console.error('[NightlySalesCron] Fatal error in nightly 30-day sales sync:', error);
    
    // Complete centralized logging with error
    if (logId) {
      await cronJobLogger.completeExecution(logId, {
        status: 'failure',
        message: 'Fatal error in nightly 30-day sales sync',
        errorDetails: error.message,
        stackTrace: error.stack
      });
    }

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
