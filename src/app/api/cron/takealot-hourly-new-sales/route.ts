// src/app/api/cron/takealot-hourly-new-sales/route.ts
/**
 * New Sales Sync - Hourly Cron Job
 * Replaces "Last 100 Sales" with incremental sync from last order_id
 * Created: July 6, 2025
 */

import { NextRequest, NextResponse } from 'next/server';
import { NewSalesSyncService } from '@/lib/newSalesSyncService';
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
      cronJobName: 'takealot-hourly-new-sales',
      cronJobType: 'scheduled',
      cronSchedule: '0 * * * *', // Every hour
      triggerType: 'cron',
      triggerSource: 'vercel-cron',
      apiSource: 'Takealot API',
      message: 'Starting hourly New Sales sync - Incremental from last order_id',
      details: 'Enhanced sync strategy that fetches only NEW sales from last recorded order_id with detailed metrics'
    });

    console.log('[HourlyNewSalesCron] Starting incremental New Sales sync');
    
    // Get integrations with hourly New Sales sync enabled
    const integrationsSnapshot = await db.collection('takealotIntegrations').get();
    const results = [];
    let totalApiRecordsRead = 0;
    let totalRecordsSkipped = 0;
    let totalRecordsUpdated = 0;
    let totalRecordsCreated = 0;
    let integrationsProcessed = 0;
    let integrationsWithNewData = 0;
    
    const newSalesSyncService = new NewSalesSyncService();
    
    for (const integrationDoc of integrationsSnapshot.docs) {
      const integrationData = integrationDoc.data();
      const integrationId = integrationDoc.id;
      const adminId = integrationData.adminId;
      const apiKey = integrationData.apiKey;

      if (!apiKey) {
        console.warn(`[HourlyNewSalesCron] No API key for integration ${integrationId}, skipping`);
        continue;
      }

      // Check if this integration has the hourly New Sales strategy enabled
      try {
        const syncPrefsDoc = await db.collection(`takealotIntegrations/${integrationId}/syncPreferences`).doc('sales').get();
        const syncPrefs = syncPrefsDoc.data();
        
        // Check if hourly new sales sync is enabled (default to true for backward compatibility)
        const isHourlyNewSalesEnabled = syncPrefs?.strategies?.hourlyNewSales?.enabled !== false;
        
        if (!isHourlyNewSalesEnabled) {
          console.log(`[HourlyNewSalesCron] Hourly New Sales sync disabled for integration ${integrationId}`);
          continue;
        }

        console.log(`[HourlyNewSalesCron] Processing integration ${integrationId}`);
        
        // Perform New Sales sync
        const syncResult = await newSalesSyncService.syncNewSalesFromLastOrderId(
          integrationId,
          apiKey,
          adminId
        );
        
        // Accumulate totals
        totalApiRecordsRead += syncResult.apiRecordsRead;
        totalRecordsSkipped += syncResult.recordsSkipped;
        totalRecordsUpdated += syncResult.recordsUpdated;
        totalRecordsCreated += syncResult.recordsCreated;
        integrationsProcessed++;
        
        if (syncResult.recordsCreated > 0 || syncResult.recordsUpdated > 0) {
          integrationsWithNewData++;
        }
        
        results.push({
          integrationId,
          adminId,
          success: syncResult.success,
          message: syncResult.message,
          apiRecordsRead: syncResult.apiRecordsRead,
          recordsSkipped: syncResult.recordsSkipped,
          recordsUpdated: syncResult.recordsUpdated,
          recordsCreated: syncResult.recordsCreated,
          lastOrderId: syncResult.lastOrderId,
          newLastOrderId: syncResult.newLastOrderId,
          executionTime: syncResult.executionTime,
          optimizationFeatures: syncResult.enhancedFeatures
        });

      } catch (error) {
        console.error(`[HourlyNewSalesCron] Error processing integration ${integrationId}:`, error);
        
        results.push({
          integrationId,
          adminId,
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
          apiRecordsRead: 0,
          recordsSkipped: 0,
          recordsUpdated: 0,
          recordsCreated: 0
        });
      }
    }

    // Generate comprehensive summary message
    const summaryMessage = generateSummaryMessage(
      integrationsProcessed,
      integrationsWithNewData,
      totalApiRecordsRead,
      totalRecordsCreated,
      totalRecordsUpdated,
      totalRecordsSkipped
    );

    // Complete logging
    await cronJobLogger.completeExecution(logId!, {
      status: 'success',
      message: summaryMessage,
      itemsProcessed: totalRecordsCreated + totalRecordsUpdated,
      details: `API reads: ${totalApiRecordsRead}, Created: ${totalRecordsCreated}, Updated: ${totalRecordsUpdated}, Skipped: ${totalRecordsSkipped}`
    });

    console.log(`[HourlyNewSalesCron] Completed: ${summaryMessage}`);

    // Return enhanced response with detailed metrics
    return NextResponse.json({
      success: true,
      message: summaryMessage,
      integrations: integrationsProcessed,
      integrationsWithNewData: integrationsWithNewData,
      totalApiRecordsRead: totalApiRecordsRead,
      totalRecordsCreated: totalRecordsCreated,
      totalRecordsUpdated: totalRecordsUpdated,
      totalRecordsSkipped: totalRecordsSkipped,
      optimizationStats: {
        incrementalSyncEnabled: true,
        newSalesStrategyActive: true,
        orderIdBasedSync: true,
        detailedMetricsTracking: true,
        efficientApiUsage: totalApiRecordsRead === 0 ? 'Maximum efficiency - No API calls needed' : 
                          `${totalRecordsSkipped} records skipped through smart detection`
      },
      enhancedFeatures: {
        newSalesSync: 'Enabled - Fetches only sales after last order_id',
        noDataDetection: 'Enabled - Shows when no new sales are found',
        detailedMetrics: 'Enabled - Tracks read/skip/update counts',
        orderIdTracking: 'Enabled - Maintains last processed order_id',
        hourlyOptimization: 'Enabled - Designed for frequent hourly checks'
      },
      results: results,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('[HourlyNewSalesCron] Fatal error:', error);
    
    if (logId) {
      await cronJobLogger.completeExecution(logId, {
        status: 'failure',
        message: `Fatal error: ${error instanceof Error ? error.message : 'Unknown error'}`,
        itemsProcessed: 0
      });
    }

    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      message: 'New Sales sync failed',
      integrations: 0,
      totalApiRecordsRead: 0,
      totalRecordsCreated: 0,
      totalRecordsUpdated: 0,
      totalRecordsSkipped: 0,
      timestamp: new Date().toISOString()
    }, { status: 500 });
  }
}

/**
 * Generate comprehensive summary message based on sync results
 */
function generateSummaryMessage(
  integrationsProcessed: number,
  integrationsWithNewData: number,
  totalApiRecordsRead: number,
  totalRecordsCreated: number,
  totalRecordsUpdated: number,
  totalRecordsSkipped: number
): string {
  if (integrationsProcessed === 0) {
    return 'No integrations found or processed';
  }

  if (totalApiRecordsRead === 0) {
    return `Processed ${integrationsProcessed} integrations - No new records found from last Order_id (optimized - no API calls needed)`;
  }

  const totalProcessed = totalRecordsCreated + totalRecordsUpdated;
  
  if (totalProcessed === 0) {
    return `Processed ${integrationsProcessed} integrations: Read ${totalApiRecordsRead} records from API, all ${totalRecordsSkipped} skipped (no changes detected)`;
  }

  const newDataInfo = integrationsWithNewData > 0 
    ? ` (${integrationsWithNewData} integrations had new data)`
    : '';

  return `Processed ${integrationsProcessed} integrations${newDataInfo}: Read ${totalApiRecordsRead} records from API - ${totalRecordsCreated} created, ${totalRecordsUpdated} updated, ${totalRecordsSkipped} skipped`;
}
