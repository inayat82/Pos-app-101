// src/app/api/cron/takealot-weekly-6month-sales/route.ts

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
      cronJobName: 'takealot-weekly-6month-sales',
      cronJobType: 'scheduled',
      cronSchedule: '0 3 * * 0', // Every Sunday at 3 AM
      triggerType: 'cron',
      triggerSource: 'vercel-cron',
      apiSource: 'Takealot API',
      message: 'Starting weekly 6-month sales sync - System-wide',
      details: 'Automated sync for Last 6 Months sales strategy across all enabled integrations'
    });

    console.log('[WeeklySalesCron] Starting weekly 6-month sales sync');
    
    // Get integrations with weekly 6-month sales sync enabled
    const integrationsSnapshot = await db.collection('takealotIntegrations').get();
    const results = [];
    let totalItemsProcessed = 0;
    
    for (const integrationDoc of integrationsSnapshot.docs) {
      const integrationData = integrationDoc.data();
      const integrationId = integrationDoc.id;
      const adminId = integrationData.adminId;
      const apiKey = integrationData.apiKey;

      if (!apiKey) {
        console.warn(`[WeeklySalesCron] No API key for integration ${integrationId}, skipping`);
        continue;
      }

      // Check if this integration has the weekly 6-month sales strategy enabled
      try {
        const syncPrefsDoc = await db.collection(`takealotIntegrations/${integrationId}/syncPreferences`).doc('sales').get();
        if (!syncPrefsDoc.exists) continue;
        
        const syncPrefs = syncPrefsDoc.data();
        const strategies = syncPrefs?.strategies || [];
        
        // Find the "Last 6 Months" strategy and check if it's enabled with weekly schedule
        const sixMonthStrategy = strategies.find((s: any) => 
          s.id === 'sls_6m' && s.cronEnabled && s.cronLabel === 'Every Sunday'
        );
        
        if (!sixMonthStrategy) {
          console.log(`[WeeklySalesCron] 6-month weekly strategy not enabled for integration ${integrationId}`);
          continue;
        }

        console.log(`[WeeklySalesCron] Processing 6-month sales for integration ${integrationId}`);

        // Use the new sales sync service
        const syncService = new SalesSyncService(integrationId);
        const result = await syncService.syncSales(apiKey, 'Last 6 Months', 'cron', adminId);
        
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
        console.error(`[WeeklySalesCron] Error processing integration ${integrationId}:`, error);
        results.push({
          integrationId,
          adminId,
          success: false,
          error: error.message
        });
      }

      // Add delay between integrations (longer delay for 6-month sync)
      await new Promise(resolve => setTimeout(resolve, 5000));
    }

    const successful = results.filter(r => r.success).length;
    const failed = results.filter(r => !r.success).length;
    const summaryMessage = `Weekly 6-month sales sync completed: ${successful} successful, ${failed} failed, ${totalItemsProcessed} total items processed`;

    console.log(`[WeeklySalesCron] ${summaryMessage}`);

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
    console.error('[WeeklySalesCron] Fatal error in weekly 6-month sales sync:', error);
    
    // Complete centralized logging with error
    if (logId) {
      await cronJobLogger.completeExecution(logId, {
        status: 'failure',
        message: 'Fatal error in weekly 6-month sales sync',
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
