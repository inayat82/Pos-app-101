// src/app/api/admin/takealot/all-sales-sync/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { dbAdmin as db } from '@/lib/firebase/firebaseAdmin';
import { SalesSyncService } from '@/lib/salesSyncService';
import { cronJobLogger } from '@/lib/cronJobLogger';
import { TakealotProxyService, takealotProxyService } from '@/modules/takealot/services/proxy.service';
import { Timestamp, FieldValue } from 'firebase-admin/firestore';

interface PageInfo {
  totalPages: number;
  totalRecords: number;
}

interface SyncJob {
  jobId: string;
  jobType: string;
  status: 'initialized' | 'in_progress' | 'completed' | 'failed' | 'paused';
  totalPages: number;
  totalRecords: number;
  currentPage: number;
  completedPages: number;
  failedPages: number;
  newRecords: number;
  updatedRecords: number;
  skippedRecords: number;
  errorCount: number;
  startedAt: Date;
  estimatedCompletion: Date;
  lastProcessedAt: Date;
  completedAt?: Date;
  createdBy: string;
  logId: string;
  batchSize?: number;
  error?: string;
  lastError?: string;
}

export async function POST(request: NextRequest) {
  try {
    const { 
      integrationId, 
      adminId = null, 
      mode = 'initialize',
      jobId = null,
      batchSize = 5,
      pageStart = null
    } = await request.json();

    if (!integrationId) {
      return NextResponse.json({
        success: false,
        error: 'Integration ID is required'
      }, { status: 400 });
    }

    // Get integration data and API key
    const integrationDocRef = db.collection('takealotIntegrations').doc(integrationId);
    const integrationDoc = await integrationDocRef.get();
    
    if (!integrationDoc.exists) {
      return NextResponse.json({
        success: false,
        error: 'Takealot integration not found'
      }, { status: 404 });
    }
    
    const integrationData = integrationDoc.data();
    const apiKey = integrationData?.apiKey;
    
    if (!apiKey) {
      return NextResponse.json({
        success: false,
        error: 'API key not found for this integration'
      }, { status: 400 });
    }

    let logId: string | null = null;

    // Different operation modes:
    // 1. initialize - Just determine page count and prepare sync job
    // 2. execute - Execute a batch of pages in the sync process
    // 3. status - Check the status of an ongoing sync job
    if (mode === 'initialize') {
      // Create a log ID for tracking this long-running operation
      logId = await cronJobLogger.startExecution({
        cronJobName: 'all-sales-sync',
        cronJobType: 'manual',
        triggerType: 'manual',
        triggerSource: 'admin-ui',
        apiSource: 'Takealot API',
        message: `Starting All Sales sync (${mode}) for integration ${integrationId}`,
        details: `Mode: ${mode}, Integration: ${integrationId}, Admin: ${adminId || 'unknown'}`,
        integrationId: integrationId,
        adminId: adminId || integrationData.adminId
      });

      // Make initial API call to determine total page count
      const pageInfo = await determinePageCount(apiKey, integrationId);

      // Create a new sync job record
      const syncJobRef = db.collection('takealotIntegrations').doc(integrationId)
                          .collection('syncJobs').doc();

      // Calculate estimated time based on page count
      const estimatedSecondsPerPage = 5; // Adjusted for proxy usage
      const estimatedTotalSeconds = pageInfo.totalPages * estimatedSecondsPerPage;
      const estimatedCompletion = new Date(Date.now() + estimatedTotalSeconds * 1000);
      
      // Store the sync job details
      await syncJobRef.set({
        jobId: syncJobRef.id,
        jobType: 'all-sales',
        status: 'initialized',
        totalPages: pageInfo.totalPages,
        totalRecords: pageInfo.totalRecords,
        currentPage: 0,
        completedPages: 0,
        failedPages: 0,
        newRecords: 0,
        updatedRecords: 0,
        skippedRecords: 0,
        errorCount: 0,
        startedAt: new Date(),
        estimatedCompletion: estimatedCompletion,
        lastProcessedAt: new Date(),
        createdBy: adminId || integrationData.adminId,
        logId: logId,
        batchSize: batchSize
      });

      return NextResponse.json({
        success: true,
        jobId: syncJobRef.id,
        pageInfo,
        estimatedTotalSeconds,
        estimatedCompletion: estimatedCompletion.toISOString()
      });
    } 
    else if (mode === 'execute') {
      if (!jobId) {
        return NextResponse.json({
          success: false,
          error: 'Job ID is required for execution mode'
        }, { status: 400 });
      }

      // Get the job details
      const jobDocRef = db.collection('takealotIntegrations').doc(integrationId)
                        .collection('syncJobs').doc(jobId);
      const jobDoc = await jobDocRef.get();

      if (!jobDoc.exists) {
        return NextResponse.json({
          success: false,
          error: 'Sync job not found'
        }, { status: 404 });
      }

      const jobData = jobDoc.data() as SyncJob;
      
      // Don't process completed or failed jobs
      if (['completed', 'failed'].includes(jobData.status)) {
        return NextResponse.json({
          success: false,
          error: `Job is already in ${jobData.status} state`
        }, { status: 400 });
      }

      // Use the existing log ID from the job
      logId = jobData.logId;

      // Update job to in_progress if it's not already
      if (jobData.status === 'initialized' || jobData.status === 'paused') {
        await jobDocRef.update({
          status: 'in_progress',
          lastProcessedAt: new Date()
        });
      }

      // Determine which pages to process in this batch
      let startPage = pageStart !== null ? pageStart : jobData.currentPage + 1;
      const actualBatchSize = jobData.batchSize || batchSize;
      const endPage = Math.min(startPage + actualBatchSize - 1, jobData.totalPages);

      console.log(`Processing batch: pages ${startPage} to ${endPage} of ${jobData.totalPages}`);

      // Create the sales sync service
      const salesSyncService = new SalesSyncService(integrationId);

      // Process the batch of pages
      const batchResults = await processBatch(
        apiKey, 
        startPage, 
        endPage,
        salesSyncService,
        integrationId
      );

      // Update job status
      const updateData: any = {
        currentPage: endPage,
        completedPages: FieldValue.increment(batchResults.pagesProcessed),
        failedPages: FieldValue.increment(batchResults.failedPages),
        newRecords: FieldValue.increment(batchResults.newRecords),
        updatedRecords: FieldValue.increment(batchResults.updatedRecords),
        skippedRecords: FieldValue.increment(batchResults.skippedRecords),
        errorCount: FieldValue.increment(batchResults.errors),
        lastProcessedAt: new Date()
      };

      // Check if job is completed
      if (endPage >= jobData.totalPages) {
        updateData.status = 'completed';
        updateData.completedAt = new Date();

        // Update log with completion
        if (logId) {
          await cronJobLogger.completeExecution(logId, {
            status: 'success',
            itemsProcessed: batchResults.newRecords + batchResults.updatedRecords,
            details: `All Sales sync completed. Total pages: ${jobData.totalPages}, New records: ${jobData.newRecords + batchResults.newRecords}, Updated: ${jobData.updatedRecords + batchResults.updatedRecords}`
          });
        }
      }

      // If there were errors in this batch
      if (batchResults.lastError) {
        updateData.lastError = batchResults.lastError;
      }

      await jobDocRef.update(updateData);

      // Return batch results
      return NextResponse.json({
        success: true,
        jobId,
        batchResults,
        isComplete: endPage >= jobData.totalPages,
        nextPage: endPage < jobData.totalPages ? endPage + 1 : null
      });
    }
    else if (mode === 'status') {
      if (!jobId) {
        return NextResponse.json({
          success: false,
          error: 'Job ID is required for status mode'
        }, { status: 400 });
      }

      // Get the job details
      const jobDocRef = db.collection('takealotIntegrations').doc(integrationId)
                        .collection('syncJobs').doc(jobId);
      const jobDoc = await jobDocRef.get();

      if (!jobDoc.exists) {
        return NextResponse.json({
          success: false,
          error: 'Sync job not found'
        }, { status: 404 });
      }

      const jobData = jobDoc.data() as SyncJob;
      
      // Calculate progress percentage
      const progressPercentage = Math.round(
        (jobData.completedPages / (jobData.totalPages || 1)) * 100
      );

      return NextResponse.json({
        success: true,
        jobStatus: jobData,
        progressPercentage,
        remainingPages: jobData.totalPages - jobData.completedPages
      });
    }
    else {
      return NextResponse.json({
        success: false,
        error: `Mode '${mode}' not supported`
      }, { status: 400 });
    }

  } catch (error: any) {
    console.error('All sales sync error:', error);
    return NextResponse.json({
      success: false,
      error: error.message || 'Failed to process All Sales sync request',
      details: process.env.NODE_ENV === 'development' ? error.stack : undefined
    }, { status: 500 });
  }
}

/**
 * Determine total page count by making an initial API request
 */
async function determinePageCount(apiKey: string, integrationId: string): Promise<PageInfo> {
  try {
    // Use the takealotProxyService for API call
    const response = await takealotProxyService.get('/v2/sales', apiKey, {
      page_number: 1,
      page_size: 100
    }, {
      adminId: integrationId,
      integrationId,
      requestType: 'manual',
      dataType: 'sales',
      timeout: 30000
    });

    if (!response.success) {
      throw new Error(response.error || 'Failed to fetch sales data');
    }

    const data = response.data;
    
    // Extract pagination information
    const totalRecords = data.page_summary?.total || 0;
    const pageSize = 100;  // Standard page size for Takealot API
    const totalPages = Math.ceil(totalRecords / pageSize);

    console.log(`Determined All Sales page count: ${totalPages} pages, ${totalRecords} total records`);

    return {
      totalPages,
      totalRecords
    };
  } catch (error: any) {
    console.error('Error determining page count:', error);
    throw new Error(`Failed to determine page count: ${error.message}`);
  }
}

/**
 * Process a batch of pages and store sales data
 */
async function processBatch(
  apiKey: string, 
  startPage: number, 
  endPage: number,
  salesSyncService: SalesSyncService,
  integrationId: string
): Promise<{
  pagesProcessed: number;
  failedPages: number;
  newRecords: number;
  updatedRecords: number;
  skippedRecords: number;
  errors: number;
  lastError?: string;
}> {
  const result = {
    pagesProcessed: 0,
    failedPages: 0,
    newRecords: 0,
    updatedRecords: 0,
    skippedRecords: 0,
    errors: 0,
    lastError: undefined as string | undefined
  };

  // Process each page in the batch
  for (let currentPage = startPage; currentPage <= endPage; currentPage++) {
    try {
      console.log(`[AllSalesSync] Processing page ${currentPage} of ${endPage}`);
      
      // Fetch sales data using the proxy service
      const salesRecords = await fetchSalesPageWithProxy(apiKey, currentPage, integrationId);
      
      if (!salesRecords || !salesRecords.length) {
        console.log(`[AllSalesSync] No records found on page ${currentPage}, marking as processed`);
        result.pagesProcessed++;
        continue;
      }
      
      console.log(`[AllSalesSync] Found ${salesRecords.length} records on page ${currentPage}`);
      
      // Use the existing processSalesRecords method which handles order_id-based upserts
      const pageResult = await salesSyncService.processSalesRecords(salesRecords);
      
      // Update result counters
      result.newRecords += pageResult.totalNew || 0;
      result.updatedRecords += pageResult.totalUpdated || 0;
      result.skippedRecords += pageResult.totalSkipped || 0;
      result.errors += pageResult.totalErrors || 0;
      
      result.pagesProcessed++;
      
      // Add delay between pages to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 200));
      
    } catch (error: any) {
      console.error(`[AllSalesSync] Error processing page ${currentPage}:`, error);
      result.failedPages++;
      result.errors++;
      result.lastError = error.message || 'Unknown error processing page';
    }
  }
  
  return result;
}

/**
 * Fetch a specific page of sales data using the proxy service
 */
async function fetchSalesPageWithProxy(apiKey: string, pageNumber: number, integrationId: string): Promise<any[]> {
  try {
    console.log(`[AllSalesSync] Fetching page ${pageNumber} through proxy service`);
    
    const response = await takealotProxyService.get('/v2/sales', apiKey, {
      page_number: pageNumber,
      page_size: 100
    }, {
      adminId: integrationId,
      integrationId,
      requestType: 'manual',
      dataType: 'sales',
      timeout: 30000
    });
    
    if (!response.success) {
      throw new Error(response.error || 'Failed to fetch sales data');
    }
    
    const data = response.data;
    console.log(`[AllSalesSync] Proxy used for page ${pageNumber}: ${response.proxyUsed || 'unknown'}`);
    
    // Extract sales records
    return data.sales || [];
    
  } catch (error: any) {
    console.error(`[AllSalesSync] Error fetching page ${pageNumber}:`, error);
    throw new Error(`Failed to fetch page ${pageNumber}: ${error.message}`);
  }
}
