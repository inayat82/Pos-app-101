// src/modules/takealot/services/sync-strategy.service.ts
// Takealot Sync Strategy Service - Cron jobs & sync preferences

import admin from 'firebase-admin';
import { Timestamp } from 'firebase-admin/firestore';
import { takealotProxyService } from './proxy.service';

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
    console.warn("TakealotSyncStrategy: Initializing Firebase Admin with default credentials. Ensure service account is configured for production.");
  }
}

const db = admin.firestore();

export interface SyncStrategy {
  id: string;
  description: string;
  cronLabel: string;
  cronEnabled: boolean;
  maxPagesToFetch?: number;
}

export interface FetchProgressState {
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

export async function fetchAndSaveTakealotData(
  baseEndpoint: string,
  apiKey: string,
  adminId: string,
  dataType: 'products' | 'sales',
  maxPagesToFetch?: number,
): Promise<{ success: boolean; message: string; totalItemsFetched: number; totalErrors: number }> {
  console.info(`[TakealotSyncStrategy] Starting fetch for ${dataType} for admin ${adminId}, endpoint: ${baseEndpoint}, maxPages: ${maxPagesToFetch}`);
  let currentPage = 1;
  let totalPagesFromAPI = 1;
  let effectiveTotalPages = maxPagesToFetch || 1;
  const allData: any[] = [];
  let totalSuccessfulItems = 0;
  let totalErrorItems = 0;
  const pageSize = 100;

  const onProgress = (progress: Partial<FetchProgressState>) => {
    console.info(`[TakealotSyncStrategy] Progress for ${adminId} (${dataType}): ${progress.statusMessage}`, progress);
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
    const endpoint = baseEndpoint;
    const params = {
      page_number: currentPage,
      page_size: pageSize
    };
    
    onProgress({
      currentPage,
      totalPages: effectiveTotalPages,
      statusMessage: `Fetching page ${currentPage} of ${effectiveTotalPages} for ${dataType}...`,
    });

    try {
      console.log(`[TakealotSyncStrategy] Making proxy request to ${endpoint}, page ${currentPage}`);
      
      const response = await takealotProxyService.get(endpoint, apiKey, params, {
        adminId: adminId,
        integrationId: adminId,
        requestType: 'cron',
        dataType: dataType as 'products' | 'sales',
        timeout: 45000
      });

      if (!response.success) {
        const errorMessage = response.error || `API Error (${response.statusCode})`;
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

      const responseData = response.data;
      console.log(`[TakealotSyncStrategy] Proxy request successful, proxy used: ${response.proxyUsed}`);

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
        console.warn(`[TakealotSyncStrategy] Unexpected data structure or empty data on page ${currentPage} for ${dataType}. Response:`, responseData);
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
      console.error(`[TakealotSyncStrategy] Critical error fetching page ${currentPage} for ${dataType} (Admin: ${adminId}): ${errorMessage}`, { errorData: error.response?.data });
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
      const updatedCount = 0;
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
                // Core sales fields - explicitly mapped for reliability
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
              
              // Check if this is the first time we're seeing this record
              if (!item.firstFetchedAt) {
                documentData.firstFetchedAt = Timestamp.now();
              }
            } else {
              // For products, use TSIN as unique identifier
              if (!item.tsin_id) {
                console.warn(`[TakealotSyncStrategy] Product missing TSIN ID, skipping item:`, item);
                errorCount++;
                continue;
              }
              
              docId = item.tsin_id;
              documentData = {
                // Core product fields - explicitly mapped for reliability
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
                is_active: item.is_active !== false, // Default to true unless explicitly false
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
            
            // Use merge: true to update existing records instead of overwriting
            batch.set(docRef, documentData, { merge: true });
            
          } catch (itemError) {
            console.error(`[TakealotSyncStrategy] Error processing item in batch:`, itemError);
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
          console.error(`[TakealotSyncStrategy] Error committing batch ${i + 1}:`, batchError);
          errorCount += Math.min(batchSize, allData.length - (i * batchSize));
        }
      }
      
      const successMsg = `${dataType} sync completed for admin ${adminId}: ${savedCount} saved/updated, ${errorCount} errors from ${totalSuccessfulItems} total items (${effectiveTotalPages} pages)`;
      console.info(`[TakealotSyncStrategy] ${successMsg}`);
      onProgress({ isLoading: false, statusMessage: successMsg, overallMessage: successMsg });
      return { success: true, message: successMsg, totalItemsFetched: totalSuccessfulItems, totalErrors: totalErrorItems + errorCount };
    } catch (dbError: any) {
      const errorMsg = `Error saving ${dataType} to Firestore for admin ${adminId}: ${dbError.message}`;
      console.error(`[TakealotSyncStrategy] ${errorMsg}`, dbError);
      onProgress({ isLoading: false, statusMessage: errorMsg, overallMessage: errorMsg });
      return { success: false, message: errorMsg, totalItemsFetched: totalSuccessfulItems, totalErrors: totalErrorItems };
    }
  } else if (totalErrorItems > 0 && totalSuccessfulItems === 0) {
    const errorMsg = `Failed to fetch any ${dataType} for admin ${adminId}. Encountered ${totalErrorItems} errors over ${effectiveTotalPages} page(s).`;
    console.warn(`[TakealotSyncStrategy] ${errorMsg}`);
    onProgress({ isLoading: false, statusMessage: errorMsg, overallMessage: errorMsg });
    return { success: false, message: errorMsg, totalItemsFetched: 0, totalErrors: totalErrorItems };
  } else if (totalSuccessfulItems === 0 && totalErrorItems === 0) {
    const noDataMsg = `No ${dataType} found or fetched for admin ${adminId} after checking ${effectiveTotalPages} page(s).`;
    console.info(`[TakealotSyncStrategy] ${noDataMsg}`);
    onProgress({ isLoading: false, statusMessage: noDataMsg, overallMessage: noDataMsg });
    return { success: true, message: noDataMsg, totalItemsFetched: 0, totalErrors: 0 };
  }

  const finalMsg = `Completed fetching ${dataType} for admin ${adminId}. Total items: ${totalSuccessfulItems} from ${effectiveTotalPages} page(s). Errors on ${totalErrorItems} items.`;
  console.info(`[TakealotSyncStrategy] ${finalMsg}`);
  onProgress({ isLoading: false, statusMessage: finalMsg, overallMessage: finalMsg });
  return { success: true, message: finalMsg, totalItemsFetched: totalSuccessfulItems, totalErrors: totalErrorItems };
}

export async function processSyncPreferencesForSchedule(cronLabelToProcess: string) {
  console.info(`[TakealotSyncStrategy] Processing sync preferences for cron label: ${cronLabelToProcess}`);
  const syncPrefsSnapshot = await db.collection('takealotSyncPreferences').get();

  if (syncPrefsSnapshot.empty) {
    console.info('[TakealotSyncStrategy] No sync preferences found.');
    return { success: true, message: 'No sync preferences found.', details: [] };
  }

  const results = [];
  
  for (const doc of syncPrefsSnapshot.docs) {
    const adminId = doc.id;
    const preferences = doc.data();
    
    // Get API key from takealotIntegrations collection
    const integrationSnapshot = await db.collection('takealotIntegrations')
      .where('adminId', '==', adminId)
      .get();

    if (integrationSnapshot.empty) {
      console.warn(`[TakealotSyncStrategy] No integration found for admin ${adminId}. Skipping sync.`);
      results.push({ adminId, status: 'skipped', reason: 'No integration found' });
      continue;
    }
    
    const integrationData = integrationSnapshot.docs[0].data();
    const apiKey = integrationData?.apiKey;
    if (!apiKey) {
      console.warn(`[TakealotSyncStrategy] API key is empty for admin ${adminId}. Skipping sync.`);
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
        console.info(`[TakealotSyncStrategy] Executing sales strategy "${strategy.description}" for admin ${adminId}`);
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
          console.error(`[TakealotSyncStrategy] Error executing sales strategy ${strategy.id} for admin ${adminId}:`, error.message);
          results.push({ adminId, strategy: strategy.id, type: 'sales', success: false, message: error.message });
        }
      }
    }

    // Process Product Strategies
    for (const strategy of productStrategies) {
      if (strategy.cronEnabled && strategy.cronLabel === cronLabelToProcess) {
        adminProcessed = true;
        console.info(`[TakealotSyncStrategy] Executing product strategy "${strategy.description}" for admin ${adminId}`);
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
          console.error(`[TakealotSyncStrategy] Error executing product strategy ${strategy.id} for admin ${adminId}:`, error.message);
          results.push({ adminId, strategy: strategy.id, type: 'products', success: false, message: error.message });
        }
      }
    }
    
    if (!adminProcessed && (salesStrategies.length > 0 || productStrategies.length > 0)) {
      // This admin has strategies, but none matched the current cronLabelToProcess
      // console.info(`[TakealotSyncStrategy] No strategies matched cron label '${cronLabelToProcess}' for admin ${adminId}`);
    }
  }
  
  const summaryMessage = `Finished processing sync preferences for cron label: ${cronLabelToProcess}. Processed ${results.length} tasks.`;
  console.info(`[TakealotSyncStrategy] ${summaryMessage}`);
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
