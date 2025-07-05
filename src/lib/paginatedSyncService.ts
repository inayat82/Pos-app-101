// src/lib/paginatedSyncService.ts

import admin from 'firebase-admin';
import { Timestamp } from 'firebase-admin/firestore';
import { takealotProxyService } from '@/modules/takealot/services';

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
    console.warn("paginatedSyncService: Initializing Firebase Admin with default credentials. Ensure service account is configured for production.");
  }
}

const db = admin.firestore();

interface SyncJobState {
  id: string;
  adminId: string;
  dataType: 'products' | 'sales';
  status: 'pending' | 'in_progress' | 'completed' | 'failed' | 'cancelled';
  currentPage: number;
  totalPages: number | null;
  totalItemsProcessed: number;
  totalItemsExpected: number | null;
  errorCount: number;
  startedAt: Timestamp;
  lastProcessedAt: Timestamp;
  completedAt?: Timestamp;
  failedAt?: Timestamp;
  cronLabel: string;
  maxPagesToFetch?: number;
  pagesPerChunk: number; // How many pages to process in each chunk
  lastError?: string;
  apiKey: string;
  baseEndpoint: string;
  // New date filtering fields
  dateFilterType?: 'none' | '6_months' | '3_months' | '1_month' | 'custom';
  dateFilterStart?: Timestamp;
  dateFilterEnd?: Timestamp;
  oldestProcessedDate?: Timestamp; // Track the oldest date we've seen
}

interface ChunkProcessResult {
  success: boolean;
  itemsProcessed: number;
  pagesProcessed: number;
  reachedEnd: boolean;
  totalPagesDiscovered?: number;
  errorMessage?: string;
}

/**
 * Creates or resumes a sync job for paginated processing
 */
export async function createOrResumeSyncJob(
  adminId: string,
  dataType: 'products' | 'sales',
  cronLabel: string,
  apiKey: string,
  maxPagesToFetch?: number,
  pagesPerChunk: number = 10, // Process 10 pages per chunk by default for better efficiency
  dateFilterType: 'none' | '6_months' | '3_months' | '1_month' | 'custom' = 'none',
  customDateStart?: Date,
  customDateEnd?: Date
): Promise<{ jobId: string; shouldProcess: boolean; currentPage: number }> {
  const baseEndpoint = dataType === 'products' ? '/v2/offers' : '/v2/sales';
  
  // Calculate date filter range
  let dateFilterStart: Timestamp | undefined;
  let dateFilterEnd: Timestamp | undefined;
  
  if (dataType === 'sales' && dateFilterType !== 'none') {
    const now = new Date();
    dateFilterEnd = Timestamp.fromDate(now);
    
    switch (dateFilterType) {
      case '6_months':
        const sixMonthsAgo = new Date(now);
        sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
        dateFilterStart = Timestamp.fromDate(sixMonthsAgo);
        break;
      case '3_months':
        const threeMonthsAgo = new Date(now);
        threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);
        dateFilterStart = Timestamp.fromDate(threeMonthsAgo);
        break;
      case '1_month':
        const oneMonthAgo = new Date(now);
        oneMonthAgo.setMonth(oneMonthAgo.getMonth() - 1);
        dateFilterStart = Timestamp.fromDate(oneMonthAgo);
        break;
      case 'custom':
        if (customDateStart) dateFilterStart = Timestamp.fromDate(customDateStart);
        if (customDateEnd) dateFilterEnd = Timestamp.fromDate(customDateEnd);
        break;
    }
  }
  
  // Check for existing pending or in_progress job
  const existingJobQuery = await db.collection('takealotSyncJobs')
    .where('adminId', '==', adminId)
    .where('dataType', '==', dataType)
    .where('cronLabel', '==', cronLabel)
    .where('dateFilterType', '==', dateFilterType)
    .where('status', 'in', ['pending', 'in_progress'])
    .orderBy('startedAt', 'desc')
    .limit(1)
    .get();

  if (!existingJobQuery.empty) {
    // Resume existing job
    const existingJob = existingJobQuery.docs[0];
    const jobData = existingJob.data() as SyncJobState;
    
    console.log(`[PaginatedSync] Resuming existing sync job ${existingJob.id} for ${adminId} (${dataType})`);
    
    // Update job status to in_progress and last processed time
    await existingJob.ref.update({
      status: 'in_progress',
      lastProcessedAt: Timestamp.now()
    });

    return {
      jobId: existingJob.id,
      shouldProcess: true,
      currentPage: jobData.currentPage
    };
  }

  // Create new sync job
  const newJobRef = db.collection('takealotSyncJobs').doc();
  const newJob: SyncJobState = {
    id: newJobRef.id,
    adminId,
    dataType,
    status: 'pending',
    currentPage: 1,
    totalPages: null,
    totalItemsProcessed: 0,
    totalItemsExpected: null,
    errorCount: 0,
    startedAt: Timestamp.now(),
    lastProcessedAt: Timestamp.now(),
    cronLabel,
    maxPagesToFetch,
    pagesPerChunk,
    apiKey,
    baseEndpoint,
    dateFilterType,
    dateFilterStart,
    dateFilterEnd
  };

  await newJobRef.set(newJob);
  
  console.log(`[PaginatedSync] Created new sync job ${newJobRef.id} for ${adminId} (${dataType})`);
  
  // Log job creation
  await logSyncEvent(
    adminId,
    newJobRef.id,
    'start',
    `New ${dataType} sync job created via ${cronLabel}`,
    {
      dataType,
      cronLabel,
      maxPagesToFetch,
      pagesPerChunk,
      dateFilterType,
      dateFilterStart: dateFilterStart?.toDate(),
      dateFilterEnd: dateFilterEnd?.toDate()
    }
  );
  
  return {
    jobId: newJobRef.id,
    shouldProcess: true,
    currentPage: 1
  };
}

/**
 * Processes a chunk of pages for a sync job
 */
export async function processJobChunk(jobId: string): Promise<ChunkProcessResult> {
  const jobRef = db.collection('takealotSyncJobs').doc(jobId);
  const jobDoc = await jobRef.get();
  
  if (!jobDoc.exists) {
    throw new Error(`Sync job ${jobId} not found`);
  }

  const jobData = jobDoc.data() as SyncJobState;
  
  if (jobData.status === 'completed' || jobData.status === 'cancelled') {
    return {
      success: true,
      itemsProcessed: 0,
      pagesProcessed: 0,
      reachedEnd: true
    };
  }

  if (jobData.status === 'failed') {
    throw new Error(`Sync job ${jobId} has failed: ${jobData.lastError}`);
  }

  // Log chunk start
  await logSyncEvent(
    jobData.adminId,
    jobId,
    'chunk_progress',
    `Starting chunk processing from page ${jobData.currentPage}`,
    {
      currentPage: jobData.currentPage,
      totalPages: jobData.totalPages,
      dataType: jobData.dataType,
      cronLabel: jobData.cronLabel
    }
  );

  // Update job status to in_progress
  await jobRef.update({
    status: 'in_progress',
    lastProcessedAt: Timestamp.now()
  });

  const pageSize = 100;
  let currentPage = jobData.currentPage;
  let itemsProcessedInChunk = 0;
  let pagesProcessedInChunk = 0;
  let reachedEnd = false;
  let totalPagesDiscovered = jobData.totalPages;

  console.log(`[PaginatedSync] Processing chunk for job ${jobId}, starting from page ${currentPage}`);

  try {
    // Process pages in this chunk
    for (let i = 0; i < jobData.pagesPerChunk; i++) {
      // Check if we've reached the max pages limit
      if (jobData.maxPagesToFetch && currentPage > jobData.maxPagesToFetch) {
        reachedEnd = true;
        break;
      }

      // Check if we've reached the total pages (if known)
      if (totalPagesDiscovered && currentPage > totalPagesDiscovered) {
        reachedEnd = true;
        break;
      }

      const takealotApiUrl = `https://api.takealot.com/seller${jobData.baseEndpoint}?page_number=${currentPage}&page_size=${pageSize}`;
      
      console.log(`[PaginatedSync] Fetching page ${currentPage} for job ${jobId} through proxy service`);

      try {
        const response = await takealotProxyService.get(jobData.baseEndpoint, jobData.apiKey, {
          page_number: currentPage,
          page_size: pageSize
        }, {
          adminId: jobData.adminId,
          integrationId: jobData.adminId,
          requestType: 'cron', // Paginated service is typically used by cron jobs
          dataType: jobData.dataType,
          timeout: 45000
        });

        if (!response.success) {
          throw new Error(`API Error (${response.statusCode}): ${response.error || 'Unknown error'}`);
        }

        const responseData = response.data;
        let itemsInCurrentPage: any[] = [];
        let currentPageItemCount = 0;
        let reachedDateLimit = false;

        // Extract items based on data type
        if (jobData.dataType === 'products' && responseData.offers && Array.isArray(responseData.offers)) {
          itemsInCurrentPage = responseData.offers;
          currentPageItemCount = responseData.offers.length;
          
          // Discover total pages from first page
          if (currentPage === 1 && responseData.page_summary && responseData.page_summary.total && responseData.page_summary.page_size) {
            totalPagesDiscovered = Math.ceil(responseData.page_summary.total / responseData.page_summary.page_size);
          }
        } else if (jobData.dataType === 'sales' && responseData.sales && Array.isArray(responseData.sales)) {
          itemsInCurrentPage = responseData.sales;
          currentPageItemCount = responseData.sales.length;
          
          // Discover total pages from first page
          if (currentPage === 1 && responseData.page_summary && responseData.page_summary.total_results && responseData.page_summary.page_size) {
            totalPagesDiscovered = Math.ceil(responseData.page_summary.total_results / responseData.page_summary.page_size);
          }

          // Check date filtering for sales data
          if (jobData.dateFilterType !== 'none' && jobData.dateFilterStart && itemsInCurrentPage.length > 0) {
            const filteredItems = [];
            let oldestDateInPage: Date | null = null;

            for (const sale of itemsInCurrentPage) {
              const saleDate = new Date(sale.order_date || sale.sale_date);
              
              // Track the oldest date we've seen
              if (!oldestDateInPage || saleDate < oldestDateInPage) {
                oldestDateInPage = saleDate;
              }

              // Check if this sale is within our date range
              const saleTimestamp = Timestamp.fromDate(saleDate);
              if (saleTimestamp.toMillis() >= jobData.dateFilterStart.toMillis()) {
                filteredItems.push(sale);
              }
            }

            // Update items to only include those within date range
            itemsInCurrentPage = filteredItems;
            currentPageItemCount = filteredItems.length;

            // Check if we've reached the date limit (oldest date in page is before our filter)
            if (oldestDateInPage && oldestDateInPage < jobData.dateFilterStart.toDate()) {
              reachedDateLimit = true;
              console.log(`[PaginatedSync] Reached date limit for job ${jobId}. Oldest date in page: ${oldestDateInPage.toISOString()}, Filter start: ${jobData.dateFilterStart.toDate().toISOString()}`);
              
              // Update job with oldest processed date
              await jobRef.update({
                oldestProcessedDate: Timestamp.fromDate(oldestDateInPage)
              });
            }
          }
        } else {
          console.warn(`[PaginatedSync] Unexpected data structure or empty data on page ${currentPage} for job ${jobId}`);
          currentPageItemCount = 0;
        }

        // Save items if any found
        if (itemsInCurrentPage.length > 0) {
          await saveItemsToFirestore(itemsInCurrentPage, jobData.dataType, jobData.adminId);
          itemsProcessedInChunk += currentPageItemCount;
        }

        pagesProcessedInChunk++;

        // Check if this is the last page (fewer items than page size) or reached date limit
        if (currentPageItemCount < pageSize || reachedDateLimit) {
          reachedEnd = true;
          // Update total pages discovered
          totalPagesDiscovered = currentPage;
          
          if (reachedDateLimit) {
            console.log(`[PaginatedSync] Job ${jobId} completed due to date limit reached`);
          }
          break;
        }

        currentPage++;

      } catch (pageError: any) {
        console.error(`[PaginatedSync] Error fetching page ${currentPage} for job ${jobId}:`, pageError.message);
        
        // Update error count but continue to next page
        await jobRef.update({
          errorCount: admin.firestore.FieldValue.increment(1),
          lastError: pageError.message
        });

        currentPage++;
        continue;
      }
    }

    // Update job progress
    const updateData: any = {
      currentPage,
      totalItemsProcessed: admin.firestore.FieldValue.increment(itemsProcessedInChunk),
      lastProcessedAt: Timestamp.now()
    };

    // Update total pages if discovered
    if (totalPagesDiscovered && totalPagesDiscovered !== jobData.totalPages) {
      updateData.totalPages = totalPagesDiscovered;
      updateData.totalItemsExpected = totalPagesDiscovered * pageSize; // Approximate
    }

    // Mark job as completed if reached end
    if (reachedEnd) {
      updateData.status = 'completed';
      updateData.completedAt = Timestamp.now();
      console.log(`[PaginatedSync] Job ${jobId} completed after processing ${pagesProcessedInChunk} pages`);
      
      // Log completion
      await logSyncEvent(
        jobData.adminId,
        jobId,
        'complete',
        `Sync job completed successfully`,
        {
          totalItemsProcessed: jobData.totalItemsProcessed + itemsProcessedInChunk,
          totalPagesProcessed: currentPage,
          dataType: jobData.dataType,
          cronLabel: jobData.cronLabel,
          duration: Date.now() - jobData.startedAt.toDate().getTime()
        }
      );
    } else {
      // Log chunk completion
      await logSyncEvent(
        jobData.adminId,
        jobId,
        'chunk_complete',
        `Chunk processed: ${pagesProcessedInChunk} pages, ${itemsProcessedInChunk} items`,
        {
          pagesProcessed: pagesProcessedInChunk,
          itemsProcessed: itemsProcessedInChunk,
          currentPage,
          totalPages: totalPagesDiscovered,
          dataType: jobData.dataType
        }
      );
    }

    await jobRef.update(updateData);

    return {
      success: true,
      itemsProcessed: itemsProcessedInChunk,
      pagesProcessed: pagesProcessedInChunk,
      reachedEnd,
      totalPagesDiscovered: totalPagesDiscovered || undefined
    };

  } catch (error: any) {
    console.error(`[PaginatedSync] Critical error processing chunk for job ${jobId}:`, error.message);
    
    // Log error
    await logSyncEvent(
      jobData.adminId,
      jobId,
      'error',
      `Chunk processing failed: ${error.message}`,
      {
        error: error.message,
        currentPage,
        itemsProcessedInChunk,
        pagesProcessedInChunk,
        dataType: jobData.dataType
      }
    );
    
    // Mark job as failed
    await jobRef.update({
      status: 'failed',
      failedAt: Timestamp.now(),
      lastError: error.message,
      errorCount: admin.firestore.FieldValue.increment(1)
    });

    return {
      success: false,
      itemsProcessed: itemsProcessedInChunk,
      pagesProcessed: pagesProcessedInChunk,
      reachedEnd: false,
      errorMessage: error.message
    };
  }
}

/**
 * Save items to Firestore using batch operations
 */
async function saveItemsToFirestore(items: any[], dataType: 'products' | 'sales', adminId: string): Promise<void> {
  const collectionName = dataType === 'products' ? 'takealot_offers' : 'takealot_sales';
  const batchSize = 500; // Firestore batch limit
  
  console.log(`[PaginatedSync] Saving ${items.length} ${dataType} items for admin ${adminId}`);

  for (let i = 0; i < items.length; i += batchSize) {
    const batch = db.batch();
    const batchItems = items.slice(i, i + batchSize);
    
    for (const item of batchItems) {
      let docId: string;
      let documentData: any;
      
      if (dataType === 'sales') {
        docId = item.order_id || item.sale_id || `${adminId}_${i}_${Date.now()}`;
        documentData = {
          // Core sales fields
          order_id: item.order_id,
          sale_id: item.sale_id,
          tsin_id: item.tsin_id,
          tsin: item.tsin,
          sku: item.sku || item.product_label_number || null,
          product_title: item.product_title || item.title,
          brand: item.brand,
          quantity: item.quantity || item.quantity_sold || item.units_sold || 0,
          selling_price: item.selling_price || item.price || 0,
          commission: item.commission || 0,
          order_date: item.order_date || item.sale_date,
          order_status: item.order_status || item.status,
          return_status: item.return_status,
          is_return: item.is_return || false,
          customer_city: item.customer_city,
          payment_method: item.payment_method,
          // Metadata
          integrationId: adminId,
          fetchedAt: Timestamp.now(),
          lastUpdated: Timestamp.now(),
          unique_id: docId,
          // Keep all original fields for reference
          originalData: item
        };
        
        if (!item.firstFetchedAt) {
          documentData.firstFetchedAt = Timestamp.now();
        }
      } else {
        // For products, use TSIN as unique identifier
        if (!item.tsin_id) {
          console.warn(`[PaginatedSync] Product missing TSIN ID, skipping item:`, item);
          continue;
        }
        
        docId = item.tsin_id;
        documentData = {
          // Core product fields
          tsin_id: item.tsin_id,
          tsin: item.tsin,
          sku: item.sku || item.product_label_number || null,
          product_title: item.product_title || item.title,
          brand: item.brand,
          category: item.category,
          subcategory: item.subcategory,
          selling_price: item.selling_price || item.price || 0,
          cost_price: item.cost_price || 0,
          recommended_retail_price: item.recommended_retail_price || 0,
          stock_at_takealot_total: item.stock_at_takealot_total || 0,
          total_stock_on_way: item.total_stock_on_way || 0,
          status: item.status,
          is_active: item.is_active !== false,
          offer_id: item.offer_id,
          lead_time: item.lead_time || 0,
          weight: item.weight || 0,
          dimensions: item.dimensions,
          images: item.images || [],
          description: item.description,
          // Metadata
          integrationId: adminId,
          fetchedAt: Timestamp.now(),
          lastUpdated: Timestamp.now(),
          unique_id: docId,
          // Keep all original fields for reference
          originalData: item
        };
        
        if (!item.firstFetchedAt) {
          documentData.firstFetchedAt = Timestamp.now();
        }
      }
      
      const docRef = db.collection(collectionName).doc(docId);
      batch.set(docRef, documentData, { merge: true });
    }
    
    await batch.commit();
  }
}

/**
 * Get all active sync jobs for monitoring
 */
export async function getActiveSyncJobs(): Promise<SyncJobState[]> {
  const snapshot = await db.collection('takealotSyncJobs')
    .where('status', 'in', ['pending', 'in_progress'])
    .orderBy('startedAt', 'desc')
    .get();

  return snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id } as SyncJobState));
}

/**
 * Cancel a sync job
 */
export async function cancelSyncJob(jobId: string): Promise<void> {
  await db.collection('takealotSyncJobs').doc(jobId).update({
    status: 'cancelled',
    completedAt: Timestamp.now()
  });
}

/**
 * Clean up completed jobs older than specified days
 */
export async function cleanupOldJobs(daysOld: number = 7): Promise<number> {
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - daysOld);
  
  const snapshot = await db.collection('takealotSyncJobs')
    .where('status', 'in', ['completed', 'failed', 'cancelled'])
    .where('completedAt', '<', Timestamp.fromDate(cutoffDate))
    .get();

  const batch = db.batch();
  snapshot.docs.forEach(doc => {
    batch.delete(doc.ref);
  });

  if (snapshot.docs.length > 0) {
    await batch.commit();
  }

  return snapshot.docs.length;
}

/**
 * Log sync events to the centralized logging system
 * @deprecated - now using centralized cronJobLogger system
 */
export async function logSyncEvent(
  adminId: string,
  jobId: string,
  type: 'start' | 'chunk_progress' | 'chunk_complete' | 'error' | 'complete' | 'cancelled',
  message: string,
  metadata?: any
): Promise<void> {
  try {
    // Legacy logging removed - now using centralized logging system
    console.log(`[PaginatedSync] ${type}: ${message}`, metadata);
  } catch (error) {
    console.error('[PaginatedSync] Failed to log sync event:', error);
    // Don't throw error to avoid breaking sync process
  }
}

/**
 * Get sync job statistics for admin dashboard
 */
export async function getSyncJobStats(adminId?: string): Promise<{
  activeJobs: number;
  activeProductJobs: number;
  activeSalesJobs: number;
  completedJobsLast24h: number;
  totalItemsProcessedLast24h: number;
  errorRate: number;
}> {
  try {
    const yesterday = new Date();
    yesterday.setHours(yesterday.getHours() - 24);
    
    // Get active jobs
    let activeJobsQuery = db.collection('takealotSyncJobs')
      .where('status', 'in', ['pending', 'in_progress']);
    
    if (adminId) {
      activeJobsQuery = activeJobsQuery.where('adminId', '==', adminId);
    }
    
    const activeJobsSnapshot = await activeJobsQuery.get();
    const activeJobs = activeJobsSnapshot.docs.map(doc => doc.data() as SyncJobState);
    
    // Get completed jobs from last 24h
    let completedJobsQuery = db.collection('takealotSyncJobs')
      .where('completedAt', '>=', Timestamp.fromDate(yesterday));
    
    if (adminId) {
      completedJobsQuery = completedJobsQuery.where('adminId', '==', adminId);
    }
    
    const completedJobsSnapshot = await completedJobsQuery.get();
    const completedJobs = completedJobsSnapshot.docs.map(doc => doc.data() as SyncJobState);
    
    // Get error logs from last 24h from centralized logging
    let errorLogsQuery = db.collection('logs')
      .where('timestamp', '>=', Timestamp.fromDate(yesterday))
      .where('status', 'in', ['failure', 'timeout', 'cancelled']);
    
    if (adminId) {
      errorLogsQuery = errorLogsQuery.where('adminId', '==', adminId);
    }
    
    const errorLogsSnapshot = await errorLogsQuery.get();
    
    // Get total logs for error rate calculation from centralized logging
    let totalLogsQuery = db.collection('logs')
      .where('timestamp', '>=', Timestamp.fromDate(yesterday));
    
    if (adminId) {
      totalLogsQuery = totalLogsQuery.where('adminId', '==', adminId);
    }
    
    const totalLogsSnapshot = await totalLogsQuery.get();
    
    const stats = {
      activeJobs: activeJobs.length,
      activeProductJobs: activeJobs.filter(job => job.dataType === 'products').length,
      activeSalesJobs: activeJobs.filter(job => job.dataType === 'sales').length,
      completedJobsLast24h: completedJobs.length,
      totalItemsProcessedLast24h: completedJobs.reduce((sum, job) => sum + job.totalItemsProcessed, 0),
      errorRate: totalLogsSnapshot.size > 0 ? Math.round((errorLogsSnapshot.size / totalLogsSnapshot.size) * 100) : 0
    };
    
    return stats;
  } catch (error) {
    console.error('[PaginatedSync] Failed to get sync job stats:', error);
    return {
      activeJobs: 0,
      activeProductJobs: 0,
      activeSalesJobs: 0,
      completedJobsLast24h: 0,
      totalItemsProcessedLast24h: 0,
      errorRate: 0
    };
  }
}
