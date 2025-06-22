
import admin from 'firebase-admin';
import { Timestamp } from 'firebase-admin/firestore';
import axios from 'axios';

// Initialize Firebase Admin SDK if not already initialized
if (!admin.apps.length) {
  // Ensure you have your service account key configured in your Vercel environment variables
  // Example: GOOGLE_APPLICATION_CREDENTIALS_JSON (as a JSON string)
  // or separate variables for project_id, private_key, client_email
  if (process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON) {
    const serviceAccount = JSON.parse(process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON);
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
    });
  } else if (process.env.FIREBASE_SERVICE_ACCOUNT_PROJECT_ID && process.env.FIREBASE_SERVICE_ACCOUNT_PRIVATE_KEY && process.env.FIREBASE_SERVICE_ACCOUNT_CLIENT_EMAIL) {
    admin.initializeApp({
      credential: admin.credential.cert({
        projectId: process.env.FIREBASE_SERVICE_ACCOUNT_PROJECT_ID,
        privateKey: process.env.FIREBASE_SERVICE_ACCOUNT_PRIVATE_KEY.replace(/\\n/g, '\n'), // Handle escaped newlines
        clientEmail: process.env.FIREBASE_SERVICE_ACCOUNT_CLIENT_EMAIL,
      }),
    });
  } else {
    // Fallback for local development if firebaseConfig.ts has admin credentials (not recommended for production)
    // Or if running in an environment where default credentials are set up (e.g. Google Cloud)
    admin.initializeApp();
    console.warn("takealotSyncService: Initializing Firebase Admin with default credentials. Ensure service account is configured for production.");
  }
}

const db = admin.firestore();

interface SyncStrategy {
  id: string;
  description: string;
  cronLabel: string;
  cronEnabled: boolean;
  maxPagesToFetch?: number;
}

interface FetchProgressState {
  strategyId: string | null;
  isLoading: boolean;
  currentPage: number;
  totalPages: number;
  successfulItems: number;
  errorItems: number;
  currentBatchSuccess: number;
  currentBatchError: number;
  statusMessage: string;
  overallMessage: string | null;
}

async function fetchAndSaveTakealotData(
  baseEndpoint: string,
  apiKey: string,
  adminId: string,
  dataType: 'products' | 'sales',
  maxPagesToFetch?: number,
): Promise<{ success: boolean; message: string; totalItemsFetched: number; totalErrors: number }> {
  console.info(`[takealotSyncService] Starting fetch for ${dataType} for admin ${adminId}, endpoint: ${baseEndpoint}, maxPages: ${maxPagesToFetch}`);
  let currentPage = 1;
  let totalPagesFromAPI = 1;
  let effectiveTotalPages = maxPagesToFetch || 1;
  const allData: any[] = [];
  let totalSuccessfulItems = 0;
  let totalErrorItems = 0;
  const pageSize = 100;

  const onProgress = (progress: Partial<FetchProgressState>) => {
    console.info(`[takealotSyncService] Progress for ${adminId} (${dataType}): ${progress.statusMessage}`, progress);
    // In a Vercel environment, detailed real-time progress updates to Firestore might be too frequent.
    // Consider logging or a summary update at the end.
  };

  onProgress({
    isLoading: true,
    currentPage: 0,
    totalPages: effectiveTotalPages,
    successfulItems: 0,
    errorItems: 0,
    statusMessage: `Preparing to fetch ${dataType}...`,
    overallMessage: null,
  });

  do {
    const takealotApiUrl = `https://api.takealot.com/seller${baseEndpoint}?page_number=${currentPage}&page_size=${pageSize}`;
    onProgress({
      currentPage,
      totalPages: effectiveTotalPages,
      statusMessage: `Fetching page ${currentPage} of ${effectiveTotalPages} for ${dataType}...`,
    });

    try {
      const response = await axios.get(takealotApiUrl, {
        headers: { Authorization: `Key ${apiKey}` },
        timeout: 45000, // 45 seconds timeout, Vercel functions can run longer
      });

      const responseData = response.data;
      const responseStatus = response.status;

      if (responseStatus !== 200) {
        const errorMessage = responseData?.message || `API Error (${responseStatus})`;
        totalErrorItems += pageSize;
        onProgress({
          errorItems: totalErrorItems,
          currentBatchError: pageSize,
          statusMessage: `API error on page ${currentPage} for ${dataType}: ${errorMessage}`,
        });
        if (currentPage < effectiveTotalPages) {
          currentPage++;
          continue;
        } else {
          throw new Error(errorMessage);
        }
      }

      let itemsInCurrentBatch: any[] = [];
      let currentBatchItemCount = 0;

      if (dataType === 'products' && responseData.offers && Array.isArray(responseData.offers)) {
        itemsInCurrentBatch = responseData.offers;
        currentBatchItemCount = responseData.offers.length;
        if (responseData.page_summary && responseData.page_summary.total && responseData.page_summary.page_size) {
          totalPagesFromAPI = Math.ceil(responseData.page_summary.total / responseData.page_summary.page_size);
        } else {
          totalPagesFromAPI = (currentBatchItemCount < pageSize) ? currentPage : currentPage + 1;
        }
      } else if (dataType === 'sales' && responseData.sales && Array.isArray(responseData.sales)) {
        itemsInCurrentBatch = responseData.sales;
        currentBatchItemCount = responseData.sales.length;
        if (responseData.page_summary && responseData.page_summary.total_results && responseData.page_summary.page_size) {
          totalPagesFromAPI = Math.ceil(responseData.page_summary.total_results / responseData.page_summary.page_size);
        } else {
          totalPagesFromAPI = (currentBatchItemCount < pageSize) ? currentPage : currentPage + 1;
        }
      } else {
        console.warn(`[takealotSyncService] Unexpected data structure or empty data on page ${currentPage} for ${dataType}. Response:`, responseData);
        totalErrorItems += pageSize;
        onProgress({
          errorItems: totalErrorItems,
          currentBatchError: pageSize,
          statusMessage: `Unexpected data structure or no items on page ${currentPage} for ${dataType}.`,
        });
        if (currentPage < (maxPagesToFetch || totalPagesFromAPI)) {
          currentPage++;
          continue;
        } else {
          break;
        }
      }
      
      if (currentPage === 1) {
        effectiveTotalPages = maxPagesToFetch ? Math.min(totalPagesFromAPI, maxPagesToFetch) : totalPagesFromAPI;
        if (effectiveTotalPages === 0) effectiveTotalPages = 1;
      }

      allData.push(...itemsInCurrentBatch);
      totalSuccessfulItems += currentBatchItemCount;

      onProgress({
        totalPages: effectiveTotalPages,
        successfulItems: totalSuccessfulItems,
        currentBatchSuccess: currentBatchItemCount,
        currentBatchError: 0,
        statusMessage: `Page ${currentPage} of ${effectiveTotalPages} for ${dataType} fetched. ${currentBatchItemCount} items. Total: ${totalSuccessfulItems}`,
      });

      if (currentBatchItemCount < pageSize) {
        effectiveTotalPages = currentPage; 
      }

      if (currentPage >= effectiveTotalPages) {
        break;
      }
      currentPage++;
    } catch (error: any) {
      totalErrorItems += pageSize;
      const errorMessage = error.response?.data?.message || error.message || 'Unknown error';
      console.error(`[takealotSyncService] Critical error fetching page ${currentPage} for ${dataType} (Admin: ${adminId}): ${errorMessage}`, { errorData: error.response?.data });
      onProgress({
        isLoading: false,
        errorItems: totalErrorItems,
        statusMessage: `Critical error on page ${currentPage} for ${dataType}: ${errorMessage}`,
        overallMessage: `Fetch failed: ${errorMessage}`,
      });
      return { success: false, message: `Critical error during fetch: ${errorMessage}`, totalItemsFetched: totalSuccessfulItems, totalErrors: totalErrorItems };
    }
  } while (currentPage <= effectiveTotalPages);

  onProgress({ statusMessage: `All pages for ${dataType} fetched for admin ${adminId}. Total: ${totalSuccessfulItems}. Errors: ${totalErrorItems}. Preparing to save...` });
  if (allData.length > 0) {
    try {
      const collectionName = dataType === 'products' ? 'takealot_offers' : 'takealot_sales';
      let savedCount = 0;
      let updatedCount = 0;
      let errorCount = 0;

      // Use batch operations for better performance
      const batchSize = 500; // Firestore batch limit
      const batches = [];
      
      for (let i = 0; i < allData.length; i += batchSize) {
        const batch = db.batch();
        const batchItems = allData.slice(i, i + batchSize);
        
        for (const item of batchItems) {
          try {
            let docId: string;
            let documentData: any;
            
            if (dataType === 'sales') {
              // For sales, use order_id as unique identifier
              docId = item.order_id || item.sale_id || `${adminId}_${i}_${Date.now()}`;
              documentData = {
                ...item,
                integrationId: adminId,
                fetchedAt: Timestamp.now(),
                lastUpdated: Timestamp.now(),
                unique_id: docId
              };
              
              // Check if this is the first time we're seeing this record
              if (!item.firstFetchedAt) {
                documentData.firstFetchedAt = Timestamp.now();
              }
            } else {
              // For products, use TSIN or SKU as unique identifier
              docId = item.tsin_id || item.sku || item.offer_id || `${adminId}_${i}_${Date.now()}`;
              documentData = {
                ...item,
                integrationId: adminId,
                fetchedAt: Timestamp.now(),
                lastUpdated: Timestamp.now(),
                unique_id: docId
              };
              
              if (!item.firstFetchedAt) {
                documentData.firstFetchedAt = Timestamp.now();
              }
            }
            
            const docRef = db.collection(collectionName).doc(docId);
            
            // Use merge: true to update existing records instead of overwriting
            batch.set(docRef, documentData, { merge: true });
            
          } catch (itemError) {
            console.error(`[takealotSyncService] Error processing item in batch:`, itemError);
            errorCount++;
          }
        }
        
        batches.push(batch);
      }
      
      // Commit all batches
      for (let i = 0; i < batches.length; i++) {
        try {
          await batches[i].commit();
          savedCount += Math.min(batchSize, allData.length - (i * batchSize));
        } catch (batchError) {
          console.error(`[takealotSyncService] Error committing batch ${i + 1}:`, batchError);
          errorCount += Math.min(batchSize, allData.length - (i * batchSize));
        }
      }
      
      const successMsg = `${dataType} sync completed for admin ${adminId}: ${savedCount} saved/updated, ${errorCount} errors from ${totalSuccessfulItems} total items (${effectiveTotalPages} pages)`;
      console.info(`[takealotSyncService] ${successMsg}`);
      onProgress({ isLoading: false, statusMessage: successMsg, overallMessage: successMsg });
      return { success: true, message: successMsg, totalItemsFetched: totalSuccessfulItems, totalErrors: totalErrorItems + errorCount };
    } catch (dbError: any) {
      const errorMsg = `Error saving ${dataType} to Firestore for admin ${adminId}: ${dbError.message}`;
      console.error(`[takealotSyncService] ${errorMsg}`, dbError);
      onProgress({ isLoading: false, statusMessage: errorMsg, overallMessage: errorMsg });
      return { success: false, message: errorMsg, totalItemsFetched: totalSuccessfulItems, totalErrors: totalErrorItems };
    }
  } else if (totalErrorItems > 0 && totalSuccessfulItems === 0) {
    const errorMsg = `Failed to fetch any ${dataType} for admin ${adminId}. Encountered ${totalErrorItems} errors over ${effectiveTotalPages} page(s).`;
    console.warn(`[takealotSyncService] ${errorMsg}`);
    onProgress({ isLoading: false, statusMessage: errorMsg, overallMessage: errorMsg });
    return { success: false, message: errorMsg, totalItemsFetched: 0, totalErrors: totalErrorItems };
  } else if (totalSuccessfulItems === 0 && totalErrorItems === 0) {
    const noDataMsg = `No ${dataType} found or fetched for admin ${adminId} after checking ${effectiveTotalPages} page(s).`;
    console.info(`[takealotSyncService] ${noDataMsg}`);
    onProgress({ isLoading: false, statusMessage: noDataMsg, overallMessage: noDataMsg });
    return { success: true, message: noDataMsg, totalItemsFetched: 0, totalErrors: 0 };
  }

  const finalMsg = `Completed fetching ${dataType} for admin ${adminId}. Total items: ${totalSuccessfulItems} from ${effectiveTotalPages} page(s). Errors on ${totalErrorItems} items.`;
  console.info(`[takealotSyncService] ${finalMsg}`);
  onProgress({ isLoading: false, statusMessage: finalMsg, overallMessage: finalMsg });
  return { success: true, message: finalMsg, totalItemsFetched: totalSuccessfulItems, totalErrors: totalErrorItems };
}

export async function processSyncPreferencesForSchedule(cronLabelToProcess: string) {
  console.info(`[takealotSyncService] Processing sync preferences for cron label: ${cronLabelToProcess}`);
  const syncPrefsSnapshot = await db.collection('takealotSyncPreferences').get();

  if (syncPrefsSnapshot.empty) {
    console.info('[takealotSyncService] No sync preferences found.');
    return { success: true, message: 'No sync preferences found.', details: [] };
  }

  const results = [];  for (const doc of syncPrefsSnapshot.docs) {
    const adminId = doc.id;
    const preferences = doc.data();
    
    // Get API key from takealotIntegrations collection
    const integrationSnapshot = await db.collection('takealotIntegrations')
      .where('adminId', '==', adminId)
      .get();

    if (integrationSnapshot.empty) {
      console.warn(`[takealotSyncService] No integration found for admin ${adminId}. Skipping sync.`);
      results.push({ adminId, status: 'skipped', reason: 'No integration found' });
      continue;
    }
    
    const integrationData = integrationSnapshot.docs[0].data();
    const apiKey = integrationData?.apiKey;
    if (!apiKey) {
      console.warn(`[takealotSyncService] API key is empty for admin ${adminId}. Skipping sync.`);
      results.push({ adminId, status: 'skipped', reason: 'API key empty' });
      continue;
    }

    const salesStrategies: SyncStrategy[] = preferences.salesStrategies || [];
    const productStrategies: SyncStrategy[] = preferences.productStrategies || [];
    let adminProcessed = false;

    // Process Sales Strategies
    for (const strategy of salesStrategies) {
      if (strategy.cronEnabled && strategy.cronLabel === cronLabelToProcess) {
        adminProcessed = true;
        console.info(`[takealotSyncService] Executing sales strategy "${strategy.description}" for admin ${adminId}`);
        try {
          const result = await fetchAndSaveTakealotData(
            '/v2/sales',
            apiKey,
            adminId,
            'sales',
            strategy.maxPagesToFetch,
          );
          results.push({ adminId, strategy: strategy.id, type: 'sales', ...result });
        } catch (error: any) {
          console.error(`[takealotSyncService] Error executing sales strategy ${strategy.id} for admin ${adminId}:`, error.message);
          results.push({ adminId, strategy: strategy.id, type: 'sales', success: false, message: error.message });
        }
      }
    }

    // Process Product Strategies
    for (const strategy of productStrategies) {
      if (strategy.cronEnabled && strategy.cronLabel === cronLabelToProcess) {
        adminProcessed = true;
        console.info(`[takealotSyncService] Executing product strategy "${strategy.description}" for admin ${adminId}`);
        try {
          const result = await fetchAndSaveTakealotData(
            '/v2/offers', 
            apiKey,
            adminId,
            'products',
            strategy.maxPagesToFetch,
          );
          results.push({ adminId, strategy: strategy.id, type: 'products', ...result });
        } catch (error: any) {
          console.error(`[takealotSyncService] Error executing product strategy ${strategy.id} for admin ${adminId}:`, error.message);
          results.push({ adminId, strategy: strategy.id, type: 'products', success: false, message: error.message });
        }
      }
    }
    if (!adminProcessed && (salesStrategies.length > 0 || productStrategies.length > 0)) {
        // This admin has strategies, but none matched the current cronLabelToProcess
        // console.info(`[takealotSyncService] No strategies matched cron label '${cronLabelToProcess}' for admin ${adminId}`);
    }
  }
  const summaryMessage = `Finished processing sync preferences for cron label: ${cronLabelToProcess}. Processed ${results.length} tasks.`;
  console.info(`[takealotSyncService] ${summaryMessage}`);
  return { success: true, message: summaryMessage, details: results };
}

// Helper to map schedule query param to cronLabel
export function getCronLabelFromSchedule(schedule: string | null): string | null {
  if (!schedule) return null;
  const mapping: { [key: string]: string } = {
    'hourly': 'Every 1 hr',
    'three-hourly': 'Every 3 hr',
    'six-hourly': 'Every 6 hr',
    'twelve-hourly': 'Every 12 hr',
    'nightly': 'Every Night',
    'weekly': 'Every Sunday',
    // Add more mappings if you have different schedule parameters
  };
  return mapping[schedule.toLowerCase()] || null;
}
