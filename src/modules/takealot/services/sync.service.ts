// src/modules/takealot/services/sync.service.ts
// Takealot Sync Service - Handles data synchronization between Takealot API and Firestore

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
}

interface SyncProgressCallback {
  (progress: Partial<FetchProgressState>): void;
}

// Default progress callback that does nothing
const defaultProgressCallback: SyncProgressCallback = () => {};

/**
 * Fetch and save Takealot data with pagination support
 */
export async function fetchAndSaveTakealotData(
  baseEndpoint: string,
  apiKey: string,
  adminId: string,
  dataType: 'products' | 'sales',
  maxPagesToFetch?: number,
  onProgress: SyncProgressCallback = defaultProgressCallback
): Promise<{ success: boolean; message: string; totalItemsFetched: number; totalErrors: number }> {
  
  let currentPage = 1;
  let totalSuccessfulItems = 0;
  let totalErrorItems = 0;
  let totalPagesFromAPI = 1;
  let effectiveTotalPages = 1;
  const pageSize = 100;
  const allData: any[] = [];

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
      console.log(`[TakealotSyncService] Making proxy request to ${endpoint}, page ${currentPage}`);
      
      // Use the proxy service for the request
      const response = await takealotProxyService.get(endpoint, apiKey, params, {
        adminId: adminId,
        integrationId: adminId,
        requestType: 'manual',
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
      console.log(`[TakealotSyncService] Proxy request successful, proxy used: ${response.proxyUsed}`);

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
        console.warn(`[TakealotSyncService] Unexpected data structure or empty results for ${dataType}:`, responseData);
        onProgress({
          errorItems: totalErrorItems,
          statusMessage: `Unexpected data structure or empty results for ${dataType} on page ${currentPage}`,
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
        statusMessage: `Successfully fetched ${currentBatchItemCount} items from page ${currentPage} for ${dataType}`,
      });

      if (currentBatchItemCount < pageSize || currentPage >= effectiveTotalPages) {
        break;
      }

      currentPage++;
    } catch (error) {
      console.error(`[TakealotSyncService] Error fetching page ${currentPage} for ${dataType}:`, error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      totalErrorItems += pageSize;
      
      onProgress({
        errorItems: totalErrorItems,
        currentBatchError: pageSize,
        statusMessage: `Error fetching page ${currentPage} for ${dataType}: ${errorMessage}`,
      });

      if (currentPage < effectiveTotalPages) {
        currentPage++;
        continue;
      } else {
        break;
      }
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
        const batchData = allData.slice(i, i + batchSize);
        
        for (const item of batchData) {
          try {
            let docId: string;
            let documentData: any;
            
            if (dataType === 'sales') {
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
              
              if (!item.firstFetchedAt) {
                documentData.firstFetchedAt = Timestamp.now();
              }
            } else {
              docId = item.tsin_id || item.offer_id || `${adminId}_${i}_${Date.now()}`;
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
            console.error(`[TakealotSyncService] Error processing item:`, itemError);
            errorCount++;
          }
        }
        
        batches.push(batch);
      }

      // Execute all batches
      await Promise.all(batches.map(batch => batch.commit()));
      savedCount = allData.length - errorCount;

      onProgress({ 
        statusMessage: `Successfully saved ${savedCount} ${dataType} records to Firestore. Errors: ${errorCount}` 
      });

      return {
        success: true,
        message: `Successfully fetched and saved ${savedCount} ${dataType} records. ${errorCount} errors encountered.`,
        totalItemsFetched: savedCount,
        totalErrors: errorCount + totalErrorItems
      };
    } catch (error) {
      console.error(`[TakealotSyncService] Error saving ${dataType} to Firestore:`, error);
      return {
        success: false,
        message: `Error saving ${dataType}: ${error instanceof Error ? error.message : 'Unknown error'}`,
        totalItemsFetched: 0,
        totalErrors: totalErrorItems
      };
    }
  } else {
    return {
      success: false,
      message: `No ${dataType} data fetched`,
      totalItemsFetched: 0,
      totalErrors: totalErrorItems
    };
  }
}

/**
 * Clean up duplicate records in Firestore
 */
export async function cleanupDuplicateRecords(
  adminId: string,
  dataType: 'products' | 'sales'
): Promise<{ success: boolean; message: string; duplicatesRemoved: number }> {
  const collectionName = dataType === 'products' ? 'takealot_offers' : 'takealot_sales';
  const uniqueField = dataType === 'products' ? 'tsin_id' : 'order_id';
  
  try {
    console.log(`[TakealotSyncService] Starting cleanup of duplicate ${dataType} for admin ${adminId}`);
    
    const querySnapshot = await db.collection(collectionName)
      .where('integrationId', '==', adminId)
      .get();
    
    const seenIds = new Set<string>();
    const duplicateDocIds: string[] = [];
    
    querySnapshot.forEach(doc => {
      const data = doc.data();
      const uniqueId = data[uniqueField];
      
      if (uniqueId && seenIds.has(uniqueId)) {
        duplicateDocIds.push(doc.id);
      } else if (uniqueId) {
        seenIds.add(uniqueId);
      }
    });
    
    if (duplicateDocIds.length > 0) {
      // Delete duplicates in batches
      const batchSize = 500;
      const batches = [];
      
      for (let i = 0; i < duplicateDocIds.length; i += batchSize) {
        const batch = db.batch();
        const batchIds = duplicateDocIds.slice(i, i + batchSize);
        
        for (const docId of batchIds) {
          const docRef = db.collection(collectionName).doc(docId);
          batch.delete(docRef);
        }
        
        batches.push(batch);
      }
      
      await Promise.all(batches.map(batch => batch.commit()));
      
      console.log(`[TakealotSyncService] Cleaned up ${duplicateDocIds.length} duplicate ${dataType} records`);
      
      return {
        success: true,
        message: `Successfully removed ${duplicateDocIds.length} duplicate ${dataType} records`,
        duplicatesRemoved: duplicateDocIds.length
      };
    } else {
      return {
        success: true,
        message: `No duplicate ${dataType} records found`,
        duplicatesRemoved: 0
      };
    }
  } catch (error) {
    console.error(`[TakealotSyncService] Error cleaning up duplicate ${dataType}:`, error);
    return {
      success: false,
      message: `Error cleaning up duplicates: ${error instanceof Error ? error.message : 'Unknown error'}`,
      duplicatesRemoved: 0
    };
  }
}

export type { SyncStrategy, FetchProgressState, SyncProgressCallback };
