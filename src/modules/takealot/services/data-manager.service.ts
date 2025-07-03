// src/modules/takealot/services/data-manager.service.ts
// Takealot Data Manager - Firebase operations & data persistence

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
    console.warn("TakealotDataManager: Initializing Firebase Admin with default credentials.");
  }
}

const db = admin.firestore();

// Interfaces for data structures
export interface TakealotProduct {
  tsin_id?: string;
  sku?: string;
  offer_id?: string;
  title?: string;
  price?: number;
  stock?: number;
  status?: string;
  lastUpdated?: Timestamp;
  firstFetchedAt?: Timestamp;
  integrationId: string;
  unique_id: string;
  [key: string]: any;
}

export interface TakealotSale {
  order_id?: string;
  sale_id?: string;
  order_date?: string;
  amount?: number;
  quantity?: number;
  tsin_id?: string;
  sku?: string;
  status?: string;
  lastUpdated?: Timestamp;
  firstFetchedAt?: Timestamp;
  integrationId: string;
  unique_id: string;
  [key: string]: any;
}

export interface DataRetrievalOptions {
  adminId: string;
  apiKey: string;
  dataType: 'products' | 'sales';
  maxPagesToFetch?: number;
  batchSize?: number;
  enableDuplicateCheck?: boolean;
  updateExistingRecords?: boolean;
}

export interface DataRetrievalResult {
  success: boolean;
  message: string;
  totalItemsFetched: number;
  totalItemsProcessed: number;
  duplicatesFound: number;
  duplicatesUpdated: number;
  newRecordsAdded: number;
  totalErrors: number;
  processingTime: number;
}

// Utility functions for generating unique identifiers
export function generateProductUniqueId(product: any, adminId: string): string {
  // Priority order: tsin_id > offer_id > sku > fallback
  return product.tsin_id || 
         product.offer_id || 
         product.sku || 
         `${adminId}_product_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

export function generateSaleUniqueId(sale: any, adminId: string): string {
  // Priority order: order_id > sale_id > fallback
  return sale.order_id || 
         sale.sale_id || 
         `${adminId}_sale_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

// Advanced duplicate detection with multiple criteria
export async function findExistingRecord(
  collectionName: string, 
  item: any, 
  adminId: string, 
  dataType: 'products' | 'sales'
): Promise<{ exists: boolean; docId?: string; existingData?: any }> {
  try {
    const queries: Promise<FirebaseFirestore.QuerySnapshot>[] = [];
    
    if (dataType === 'products') {
      // Check by multiple product identifiers
      if (item.tsin_id) {
        queries.push(
          db.collection(collectionName)
            .where('integrationId', '==', adminId)
            .where('tsin_id', '==', item.tsin_id)
            .limit(1)
            .get()
        );
      }
      if (item.offer_id) {
        queries.push(
          db.collection(collectionName)
            .where('integrationId', '==', adminId)
            .where('offer_id', '==', item.offer_id)
            .limit(1)
            .get()
        );
      }
      if (item.sku) {
        queries.push(
          db.collection(collectionName)
            .where('integrationId', '==', adminId)
            .where('sku', '==', item.sku)
            .limit(1)
            .get()
        );
      }
    } else if (dataType === 'sales') {
      // Check by multiple sale identifiers
      if (item.order_id) {
        queries.push(
          db.collection(collectionName)
            .where('integrationId', '==', adminId)
            .where('order_id', '==', item.order_id)
            .limit(1)
            .get()
        );
      }
      if (item.sale_id) {
        queries.push(
          db.collection(collectionName)
            .where('integrationId', '==', adminId)
            .where('sale_id', '==', item.sale_id)
            .limit(1)
            .get()
        );
      }
    }

    // Execute all queries in parallel
    const results = await Promise.all(queries);
    
    // Find the first non-empty result
    for (const querySnapshot of results) {
      if (!querySnapshot.empty) {
        const doc = querySnapshot.docs[0];
        return {
          exists: true,
          docId: doc.id,
          existingData: doc.data()
        };
      }
    }
    
    return { exists: false };
  } catch (error) {
    console.error(`Error checking for existing record:`, error);
    return { exists: false };
  }
}

// Smart merge function that preserves important data
export function mergeRecordData(existingData: any, newData: any, dataType: 'products' | 'sales'): any {
  const mergedData = { ...existingData };
  
  // Always update these fields with new data
  const alwaysUpdateFields = ['lastUpdated', 'fetchedAt'];
  
  // Fields to update only if new data has a value and existing doesn't, or if new value is more recent
  const conditionalUpdateFields = dataType === 'products' 
    ? ['price', 'stock', 'status', 'title', 'description', 'availability']
    : ['status', 'amount', 'quantity', 'order_date', 'shipping_status'];
  
  // Always update specified fields
  alwaysUpdateFields.forEach(field => {
    if (newData[field] !== undefined) {
      mergedData[field] = newData[field];
    }
  });
  
  // Conditionally update other fields
  conditionalUpdateFields.forEach(field => {
    if (newData[field] !== undefined) {
      // Update if existing field is empty or new data is more recent
      if (!mergedData[field] || 
          (field === 'lastUpdated' && newData[field] > mergedData[field])) {
        mergedData[field] = newData[field];
      }
    }
  });
  
  // Preserve the original firstFetchedAt timestamp
  if (!mergedData.firstFetchedAt && newData.firstFetchedAt) {
    mergedData.firstFetchedAt = newData.firstFetchedAt;
  }
  
  return mergedData;
}

// Main robust data retrieval function
export async function retrieveTakealotDataWithDuplicateManagement(
  options: DataRetrievalOptions
): Promise<DataRetrievalResult> {
  const startTime = Date.now();
  console.log(`[TakealotDataManager] Starting robust data retrieval for ${options.dataType} - Admin: ${options.adminId}`);
  
  const {
    adminId,
    apiKey,
    dataType,
    maxPagesToFetch = null,
    batchSize = 100,
    enableDuplicateCheck = true,
    updateExistingRecords = true
  } = options;

  let currentPage = 1;
  let totalPagesFromAPI = 1;
  let totalItemsFetched = 0;
  let totalItemsProcessed = 0;
  let duplicatesFound = 0;
  let duplicatesUpdated = 0;
  let newRecordsAdded = 0;
  let totalErrors = 0;
  const collectionName = dataType === 'products' ? 'takealotProducts' : 'takealot_sales';
  const baseEndpoint = dataType === 'products' ? '/v2/offers' : '/V2/sales';
  
  try {
    do {
      console.log(`[TakealotDataManager] Fetching page ${currentPage} for ${dataType} through proxy service...`);
      
      const takealotApiUrl = `https://seller-api.takealot.com${baseEndpoint}?page_number=${currentPage}&page_size=${batchSize}`;
      
      try {
        const response = await takealotProxyService.get(baseEndpoint, apiKey, {
          page_number: currentPage,
          page_size: batchSize
        }, {
          adminId: options.adminId,
          integrationId: options.adminId,
          requestType: 'manual',
          dataType: dataType,
          timeout: 60000
        });

        if (!response.success) {
          console.warn(`[TakealotDataManager] Proxy request failed for page ${currentPage}: ${response.error}`);
          break;
        }

        const responseData = response.data;
        console.log(`[TakealotDataManager] Proxy request successful for page ${currentPage}, proxy used: ${response.proxyUsed}`);

        if (!responseData) {
          console.warn(`[TakealotDataManager] No data received for page ${currentPage}`);
          break;
        }

        // Handle different response structures
        let items: any[] = [];
        let pageInfo: any = {};

        if (dataType === 'products') {
          items = responseData.offers || [];
          pageInfo = {
            total_results: responseData.total_results || 0,
            page_size: responseData.page_size || batchSize,
            page_number: responseData.page_number || currentPage
          };
        } else {
          items = responseData.sales || [];
          pageInfo = responseData.page_summary || {};
        }

        if (currentPage === 1 && pageInfo.total_results) {
          totalPagesFromAPI = Math.ceil(pageInfo.total_results / batchSize);
          console.log(`[TakealotDataManager] Total pages available: ${totalPagesFromAPI}`);
        }

        if (items.length === 0) {
          console.log(`[TakealotDataManager] No items found on page ${currentPage}, ending fetch`);
          break;
        }

        totalItemsFetched += items.length;
        console.log(`[TakealotDataManager] Processing ${items.length} items from page ${currentPage}`);

        // Process items in batches for Firestore
        const firestoreBatchSize = 500;
        const batches = [];
        
        for (let i = 0; i < items.length; i += firestoreBatchSize) {
          const batch = db.batch();
          const batchItems = items.slice(i, i + firestoreBatchSize);
          let batchNewRecords = 0;
          let batchDuplicates = 0;
          let batchUpdated = 0;
          
          for (const item of batchItems) {
            try {
              const uniqueId = dataType === 'products' 
                ? generateProductUniqueId(item, adminId)
                : generateSaleUniqueId(item, adminId);

              const documentData = {
                ...item,
                integrationId: adminId,
                fetchedAt: Timestamp.now(),
                lastUpdated: Timestamp.now(),
                unique_id: uniqueId
              };

              let shouldProcess = true;
              let docRef: FirebaseFirestore.DocumentReference;

              if (enableDuplicateCheck) {
                // Check for existing record
                const existingRecord = await findExistingRecord(collectionName, item, adminId, dataType);
                
                if (existingRecord.exists && existingRecord.docId) {
                  duplicatesFound++;
                  batchDuplicates++;
                  
                  if (updateExistingRecords) {
                    // Merge with existing data
                    const mergedData = mergeRecordData(existingRecord.existingData, documentData, dataType);
                    docRef = db.collection(collectionName).doc(existingRecord.docId);
                    batch.set(docRef, mergedData, { merge: true });
                    duplicatesUpdated++;
                    batchUpdated++;
                  } else {
                    shouldProcess = false;
                  }
                } else {
                  // New record
                  if (!documentData.firstFetchedAt) {
                    documentData.firstFetchedAt = Timestamp.now();
                  }
                  docRef = db.collection(collectionName).doc(uniqueId);
                  batch.set(docRef, documentData);
                  newRecordsAdded++;
                  batchNewRecords++;
                }
              } else {
                // No duplicate check, always add/update
                if (!documentData.firstFetchedAt) {
                  documentData.firstFetchedAt = Timestamp.now();
                }
                docRef = db.collection(collectionName).doc(uniqueId);
                batch.set(docRef, documentData, { merge: true });
                newRecordsAdded++;
                batchNewRecords++;
              }

              if (shouldProcess) {
                totalItemsProcessed++;
              }

            } catch (itemError) {
              console.error(`[TakealotDataManager] Error processing item:`, itemError);
              totalErrors++;
            }
          }
          
          console.log(`[TakealotDataManager] Batch ${batches.length + 1}: ${batchNewRecords} new, ${batchDuplicates} duplicates, ${batchUpdated} updated`);
          batches.push(batch);
        }

        // Commit all batches
        for (let batchIndex = 0; batchIndex < batches.length; batchIndex++) {
          try {
            await batches[batchIndex].commit();
            console.log(`[TakealotDataManager] Successfully committed batch ${batchIndex + 1}/${batches.length}`);
          } catch (batchError) {
            console.error(`[TakealotDataManager] Error committing batch ${batchIndex + 1}:`, batchError);
            totalErrors++;
          }
        }

      } catch (apiError: any) {
        console.error(`[TakealotDataManager] API error on page ${currentPage}:`, apiError.message);
        totalErrors++;
        
        // If it's a rate limit error, wait and retry
        if (apiError.response?.status === 429) {
          console.log(`[TakealotDataManager] Rate limited, waiting 60 seconds before continuing...`);
          await new Promise(resolve => setTimeout(resolve, 60000));
          continue;
        }
        
        await new Promise(resolve => setTimeout(resolve, 1000));
      }

      currentPage++;
      
      if (maxPagesToFetch && currentPage > maxPagesToFetch) {
        console.log(`[TakealotDataManager] Reached max pages limit: ${maxPagesToFetch}`);
        break;
      }
      
      if (currentPage > totalPagesFromAPI) {
        console.log(`[TakealotDataManager] Reached end of available pages: ${totalPagesFromAPI}`);
        break;
      }

      await new Promise(resolve => setTimeout(resolve, 500));

    } while (true);

    const processingTime = Date.now() - startTime;
    const successMessage = `Successfully processed ${totalItemsProcessed} ${dataType} items for admin ${adminId}. ` +
                          `New: ${newRecordsAdded}, Duplicates found: ${duplicatesFound}, Updated: ${duplicatesUpdated}, Errors: ${totalErrors}`;

    console.log(`[TakealotDataManager] ${successMessage}`);
    console.log(`[TakealotDataManager] Processing completed in ${processingTime}ms`);

    return {
      success: true,
      message: successMessage,
      totalItemsFetched,
      totalItemsProcessed,
      duplicatesFound,
      duplicatesUpdated,
      newRecordsAdded,
      totalErrors,
      processingTime
    };

  } catch (error: any) {
    const processingTime = Date.now() - startTime;
    const errorMessage = `Failed to retrieve ${dataType} data for admin ${adminId}: ${error.message}`;
    
    console.error(`[TakealotDataManager] ${errorMessage}`, error);

    return {
      success: false,
      message: errorMessage,
      totalItemsFetched,
      totalItemsProcessed,
      duplicatesFound,
      duplicatesUpdated,
      newRecordsAdded,
      totalErrors: totalErrors + 1,
      processingTime
    };
  }
}

// Utility function to clean up duplicate records
export async function cleanupDuplicateRecords(
  adminId: string, 
  dataType: 'products' | 'sales'
): Promise<{ success: boolean; message: string; duplicatesRemoved: number }> {
  console.log(`[TakealotDataManager] Starting duplicate cleanup for ${dataType} - Admin: ${adminId}`);
  
  const collectionName = dataType === 'products' ? 'takealotProducts' : 'takealot_sales';
  let duplicatesRemoved = 0;
  
  try {
    const snapshot = await db.collection(collectionName)
      .where('integrationId', '==', adminId)
      .get();
    
    const recordsMap = new Map<string, FirebaseFirestore.QueryDocumentSnapshot[]>();
    
    snapshot.docs.forEach(doc => {
      const data = doc.data();
      let key: string;
      
      if (dataType === 'products') {
        key = data.tsin_id || data.offer_id || data.sku || doc.id;
      } else {
        key = data.order_id || data.sale_id || doc.id;
      }
      
      if (!recordsMap.has(key)) {
        recordsMap.set(key, []);
      }
      recordsMap.get(key)!.push(doc);
    });
    
    const batch = db.batch();
    let batchOpsCount = 0;
    
    for (const [key, docs] of recordsMap.entries()) {
      if (docs.length > 1) {
        docs.sort((a, b) => {
          const aTime = a.data().lastUpdated?.toMillis() || 0;
          const bTime = b.data().lastUpdated?.toMillis() || 0;
          return bTime - aTime;
        });
        
        for (let i = 1; i < docs.length; i++) {
          batch.delete(docs[i].ref);
          duplicatesRemoved++;
          batchOpsCount++;
          
          if (batchOpsCount >= 450) {
            await batch.commit();
            console.log(`[TakealotDataManager] Committed batch of ${batchOpsCount} deletions`);
            batchOpsCount = 0;
          }
        }
      }
    }
    
    if (batchOpsCount > 0) {
      await batch.commit();
      console.log(`[TakealotDataManager] Committed final batch of ${batchOpsCount} deletions`);
    }
    
    const message = `Successfully removed ${duplicatesRemoved} duplicate ${dataType} records for admin ${adminId}`;
    console.log(`[TakealotDataManager] ${message}`);
    
    return {
      success: true,
      message,
      duplicatesRemoved
    };
    
  } catch (error: any) {
    const errorMessage = `Failed to cleanup duplicate ${dataType} records for admin ${adminId}: ${error.message}`;
    console.error(`[TakealotDataManager] ${errorMessage}`, error);
    
    return {
      success: false,
      message: errorMessage,
      duplicatesRemoved
    };
  }
}
