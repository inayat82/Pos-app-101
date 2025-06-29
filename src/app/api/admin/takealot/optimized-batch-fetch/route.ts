// src/app/api/admin/takealot/optimized-batch-fetch/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { dbAdmin as db } from '@/lib/firebase/firebaseAdmin';
import { cronJobLogger } from '@/lib/cronJobLogger';

const TAKEALOT_API_BASE = 'https://seller-api.takealot.com';

interface OptimizedBatchFetchOptions {
  type: 'sales' | 'products';
  limit?: number; // Optional limit for specific record count
  days?: number; // For date-based fetching (30, 180, etc.)
  verifyExisting: boolean;
  batchSize?: number; // Pages to fetch per batch (default: 10)
  maxConcurrentBatches?: number; // Max concurrent API calls (default: 3)
}

interface SalesRecord {
  order_id?: string;
  sale_id?: string;
  selling_price?: number;
  order_status?: string;
  total_fee?: number;
  [key: string]: any;
}

interface ProductRecord {
  tsin_id?: string;
  offer_id?: string;
  selling_price?: number;
  rrp?: number;
  sku?: string;
  image_url?: string;
  image?: string;
  product_image?: string;
  quantity_available?: number;
  available_quantity?: number;
  qty?: number;
  [key: string]: any;
}

export async function POST(request: NextRequest) {
  let logId: string | null = null;
  
  try {
    console.log('Optimized Batch Takealot fetch endpoint called');
    
    const { integrationId, options } = await request.json() as {
      integrationId: string;
      options: OptimizedBatchFetchOptions;
    };

    if (!integrationId || !options) {
      return NextResponse.json({ 
        error: 'Missing required parameters: integrationId, options' 
      }, { status: 400 });
    }

    // Get integration data and API key
    const integrationDocRef = db.collection('takealotIntegrations').doc(integrationId);
    const integrationDoc = await integrationDocRef.get();
    
    if (!integrationDoc.exists) {
      return NextResponse.json({ 
        error: 'Takealot integration not found' 
      }, { status: 404 });
    }
    
    const integrationData = integrationDoc.data();
    const apiKey = integrationData?.apiKey;
    const adminId = integrationData?.adminId;
    
    if (!apiKey) {
      return NextResponse.json({ 
        error: 'API key not found for this integration' 
      }, { status: 400 });
    }

    // Start logging the operation
    logId = await cronJobLogger.logManualFetchEnhanced({
      adminId: adminId || integrationId,
      integrationId,
      apiSource: 'Takealot API',
      operation: `batch_${options.type}_fetch`,
      status: 'success',
      message: `Manual batch ${options.type} fetch started`,
      details: `Batch ${options.type} fetch (${options.days ? options.days + ' days' : options.limit ? options.limit + ' records' : 'all'})`
    });

    // Create streaming response for progress updates
    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        const operationStartTime = Date.now();
        let totalNew = 0;
        let totalUpdated = 0;
        let totalSkipped = 0;
        let totalErrors = 0;
        let totalFetched = 0;
        let totalPages = 0;

        try {
          // Send initial progress
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({
            message: `Starting optimized batch ${options.type} fetch${options.limit ? ` - Getting ${options.limit} records` : ''}${options.days ? ` - Last ${options.days} days` : ' - All records'}`,
            progress: 5,
            totalNew: 0,
            totalUpdated: 0,
            totalSkipped: 0,
            totalFetched: 0,
            pages: 0,
            errors: 0,
            log: `Starting optimized batch fetch for ${options.type}${options.limit ? ` (limit: ${options.limit})` : ''}${options.days ? ` (${options.days} days)` : ' (all records)'}`
          })}\n\n`));

          // Set up API endpoint and parameters
          const endpoint = options.type === 'sales' ? '/V2/sales' : '/v2/offers';
          const baseParams = new URLSearchParams();
          
          // Configure page size and initial page
          const pageSize = 100;
          baseParams.append('page_size', pageSize.toString());

          // Add date filters for sales if specified
          if (options.type === 'sales' && options.days) {
            const daysAgo = new Date(Date.now() - options.days * 24 * 60 * 60 * 1000);
            baseParams.append('created_date_start', daysAgo.toISOString().split('T')[0]);
            console.log(`Adding date filter: ${daysAgo.toISOString().split('T')[0]}`);
          }

          // Determine how many pages to expect (initial estimate)
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({
            message: 'Getting initial page to estimate total records...',
            progress: 10,
            totalNew,
            totalUpdated,
            totalSkipped,
            totalFetched,
            pages: totalPages,
            errors: totalErrors,
            log: 'Fetching first page to estimate total scope'
          })}\n\n`));

          // Fetch first page to get total count
          const initialParams = new URLSearchParams(baseParams);
          initialParams.append('page_number', '1');
          const initialUrl = `${TAKEALOT_API_BASE}${endpoint}?${initialParams.toString()}`;
          
          const initialResponse = await fetch(initialUrl, {
            method: 'GET',
            headers: {
              'Authorization': `Key ${apiKey}`,
              'Content-Type': 'application/json',
              'User-Agent': 'POS-App/1.0'
            },
            signal: AbortSignal.timeout(60000)
          });

          if (!initialResponse.ok) {
            throw new Error(`Initial API request failed: ${initialResponse.status} ${initialResponse.statusText}`);
          }

          const initialData = await initialResponse.json();
          
          // Extract total records and calculate max pages
          let estimatedTotalRecords = 0;
          if (options.type === 'sales' && initialData.page_summary?.total) {
            estimatedTotalRecords = initialData.page_summary.total;
          } else if (options.type === 'products' && initialData.total_results) {
            estimatedTotalRecords = initialData.total_results;
          }

          const estimatedTotalPages = Math.ceil(estimatedTotalRecords / pageSize);
          const maxRecordsToFetch = options.limit ? Math.min(options.limit, estimatedTotalRecords) : estimatedTotalRecords;
          const maxPagesToFetch = Math.ceil(maxRecordsToFetch / pageSize);

          console.log(`Estimated total records: ${estimatedTotalRecords}, max pages to fetch: ${maxPagesToFetch}`);

          controller.enqueue(encoder.encode(`data: ${JSON.stringify({
            message: `Found ~${estimatedTotalRecords} total records, fetching ${maxPagesToFetch} pages`,
            progress: 15,
            totalNew,
            totalUpdated,
            totalSkipped,
            totalFetched,
            pages: totalPages,
            errors: totalErrors,
            log: `Estimated ${estimatedTotalRecords} records across ${maxPagesToFetch} pages`
          })}\n\n`));

          // Process the first page we already fetched
          let firstPageRecords: any[] = [];
          if (options.type === 'sales') {
            firstPageRecords = initialData.sales || [];
          } else {
            firstPageRecords = initialData.offers || [];
          }

          let allFetchedRecords = [...firstPageRecords];
          totalFetched = firstPageRecords.length;
          totalPages = 1;

          // Configure batch processing
          const batchSize = options.batchSize || 10; // Pages per batch
          const maxConcurrentBatches = options.maxConcurrentBatches || 3;
          
          // Fetch remaining pages in batches
          let currentPage = 2; // Start from page 2 since we already have page 1
          
          while (currentPage <= maxPagesToFetch && (!options.limit || allFetchedRecords.length < options.limit)) {
            const batchPromises: Promise<any[]>[] = [];
            const batchStartPage = currentPage;
            const batchEndPage = Math.min(currentPage + batchSize - 1, maxPagesToFetch);

            console.log(`Fetching batch: pages ${batchStartPage} to ${batchEndPage}`);

            controller.enqueue(encoder.encode(`data: ${JSON.stringify({
              message: `Fetching pages ${batchStartPage}-${batchEndPage} (batch of ${batchEndPage - batchStartPage + 1})`,
              progress: 15 + Math.round(((batchStartPage - 1) / maxPagesToFetch) * 30),
              totalNew,
              totalUpdated,
              totalSkipped,
              totalFetched,
              pages: totalPages,
              errors: totalErrors,
              log: `Batch fetch: pages ${batchStartPage}-${batchEndPage}`
            })}\n\n`));

            // Create promises for batch of pages
            for (let page = batchStartPage; page <= batchEndPage; page++) {
              const pageParams = new URLSearchParams(baseParams);
              pageParams.append('page_number', page.toString());
              const pageUrl = `${TAKEALOT_API_BASE}${endpoint}?${pageParams.toString()}`;

              const pagePromise = fetch(pageUrl, {
                method: 'GET',
                headers: {
                  'Authorization': `Key ${apiKey}`,
                  'Content-Type': 'application/json',
                  'User-Agent': 'POS-App/1.0'
                },
                signal: AbortSignal.timeout(60000)
              }).then(async (response) => {
                if (!response.ok) {
                  throw new Error(`Page ${page} failed: ${response.status} ${response.statusText}`);
                }
                const data = await response.json();
                const records = options.type === 'sales' ? (data.sales || []) : (data.offers || []);
                console.log(`Fetched page ${page}: ${records.length} records`);
                return records;
              }).catch((error) => {
                console.error(`Error fetching page ${page}:`, error);
                totalErrors++;
                return []; // Return empty array on error
              });

              batchPromises.push(pagePromise);
            }

            // Wait for batch to complete with concurrency limit
            const batchResults = await Promise.all(batchPromises);
            
            // Process batch results
            for (const pageRecords of batchResults) {
              if (pageRecords.length > 0) {
                allFetchedRecords.push(...pageRecords);
                totalFetched += pageRecords.length;
                totalPages++;
                
                // Stop if we have enough records
                if (options.limit && allFetchedRecords.length >= options.limit) {
                  allFetchedRecords = allFetchedRecords.slice(0, options.limit);
                  break;
                }
              }
            }

            currentPage = batchEndPage + 1;

            // Update progress
            controller.enqueue(encoder.encode(`data: ${JSON.stringify({
              message: `Fetched ${totalFetched} records from ${totalPages} pages`,
              progress: 15 + Math.round((totalPages / maxPagesToFetch) * 30),
              totalNew,
              totalUpdated,
              totalSkipped,
              totalFetched,
              pages: totalPages,
              errors: totalErrors,
              log: `Batch completed: ${totalFetched} records from ${totalPages} pages`
            })}\n\n`));
          }

          console.log(`Total fetched from API: ${totalFetched} records from ${totalPages} pages`);

          controller.enqueue(encoder.encode(`data: ${JSON.stringify({
            message: `Received ${totalFetched} records from ${totalPages} pages`,
            progress: 45,
            totalNew,
            totalUpdated,
            totalSkipped,
            totalFetched,
            pages: totalPages,
            errors: totalErrors,
            log: `API fetch complete: ${totalFetched} records from ${totalPages} pages`
          })}\n\n`));

          if (allFetchedRecords.length === 0) {
            throw new Error('No records found in API response');
          }

          // Get existing records from database for comparison
          const collectionName = options.type === 'sales' ? 'takealot_sales' : 'takealot_offers';
          const existingRecordsMap = new Map();

          if (options.verifyExisting) {
            controller.enqueue(encoder.encode(`data: ${JSON.stringify({
              message: 'Checking existing records in database...',
              progress: 50,
              totalNew,
              totalUpdated,
              totalSkipped,
              totalFetched,
              pages: totalPages,
              errors: totalErrors,
              log: 'Querying existing records for deduplication'
            })}\n\n`));

            // Extract unique IDs from fetched records
            const fetchedIds = allFetchedRecords.map((record: any) => {
              if (options.type === 'sales') {
                return record.order_id || record.sale_id;
              } else {
                return record.tsin_id || record.offer_id;
              }
            }).filter((id: any) => id !== undefined && id !== null)
              .map((id: any) => id.toString());

            console.log(`Looking for existing records with ${fetchedIds.length} unique IDs`);

            if (fetchedIds.length > 0) {
              // Query existing records efficiently
              const existingQuery = db.collection(collectionName)
                .where('integrationId', '==', integrationId);

              const existingSnapshot = await existingQuery.get();
              console.log(`Total existing records in database: ${existingSnapshot.size}`);
              
              existingSnapshot.forEach(doc => {
                const data = doc.data();
                let uniqueKey;
                
                if (options.type === 'sales') {
                  uniqueKey = data.order_id || data.sale_id;
                } else {
                  uniqueKey = data.tsin_id || data.offer_id;
                }
                
                if (uniqueKey) {
                  const uniqueKeyStr = uniqueKey.toString();
                  const fetchedIdsStr = fetchedIds.map((id: any) => id.toString());
                  
                  if (fetchedIdsStr.includes(uniqueKeyStr)) {
                    existingRecordsMap.set(uniqueKeyStr, {
                      docId: doc.id,
                      data: data
                    });
                  }
                }
              });

              console.log(`Found ${existingRecordsMap.size} existing records matching fetched IDs`);
            }
          }

          // Process records in batches for database operations
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({
            message: 'Processing and saving records with deduplication...',
            progress: 60,
            totalNew,
            totalUpdated,
            totalSkipped,
            totalFetched,
            pages: totalPages,
            errors: totalErrors,
            log: `Processing ${allFetchedRecords.length} records with verification`
          })}\n\n`));

          const dbBatchSize = 500; // Firestore batch limit
          let dbBatch = db.batch();
          let dbBatchCount = 0;

          for (let i = 0; i < allFetchedRecords.length; i++) {
            const record = allFetchedRecords[i];
            
            try {
              // Determine unique identifier
              let uniqueKey;
              if (options.type === 'sales') {
                uniqueKey = record.order_id || record.sale_id;
              } else {
                uniqueKey = record.tsin_id || record.offer_id;
              }

              if (!uniqueKey) {
                console.warn(`Record ${i} missing unique identifier, skipping`);
                totalSkipped++;
                continue;
              }

              const uniqueKeyStr = uniqueKey.toString();
              const existingRecord = existingRecordsMap.get(uniqueKeyStr);
              const now = new Date().toISOString();
              
              // Prepare the record data
              const recordData = {
                integrationId,
                ...record,
                fetchedAt: now,
                lastUpdated: now,
                source: 'takealot_api_batch',
                dbUpdated: now
              };

              if (existingRecord) {
                // Record exists - check if update is needed
                const existing = existingRecord.data;
                let needsUpdate = false;
                const updateFields: any = {
                  lastUpdated: now,
                  fetchedAt: now,
                  dbUpdated: now
                };

                if (options.type === 'sales') {
                  // For sales: update Status and Amount
                  const currentStatus = existing.order_status || existing.sale_status;
                  const currentAmount = existing.selling_price || existing.total_amount;
                  const newStatus = record.order_status || record.sale_status;
                  const newAmount = record.selling_price || record.total_amount;

                  if (currentStatus !== newStatus) {
                    updateFields.order_status = newStatus;
                    updateFields.sale_status = newStatus;
                    needsUpdate = true;
                  }

                  if (currentAmount !== newAmount) {
                    updateFields.selling_price = newAmount;
                    updateFields.total_amount = newAmount;
                    updateFields.total_fee = record.total_fee;
                    needsUpdate = true;
                  }
                } else {
                  // For products: update Price, RRP, SKU, Image, and Quantity
                  const currentPrice = existing.selling_price;
                  const currentRRP = existing.rrp;
                  const currentSKU = existing.sku;
                  const currentImage = existing.image_url || existing.image || existing.product_image;
                  const currentQty = existing.quantity_available || existing.available_quantity || existing.qty;

                  if (currentPrice !== record.selling_price) {
                    updateFields.selling_price = record.selling_price;
                    needsUpdate = true;
                  }

                  if (currentRRP !== record.rrp) {
                    updateFields.rrp = record.rrp;
                    needsUpdate = true;
                  }

                  if (currentSKU !== record.sku) {
                    updateFields.sku = record.sku;
                    needsUpdate = true;
                  }

                  const newImage = record.image_url || record.image || record.product_image;
                  if (newImage && currentImage !== newImage) {
                    updateFields.image_url = newImage;
                    updateFields.image = newImage;
                    updateFields.product_image = newImage;
                    needsUpdate = true;
                  }

                  const newQty = record.quantity_available || record.available_quantity || record.qty;
                  if (newQty !== undefined && currentQty !== newQty) {
                    updateFields.quantity_available = newQty;
                    updateFields.available_quantity = newQty;
                    updateFields.qty = newQty;
                    needsUpdate = true;
                  }
                }

                if (needsUpdate) {
                  // Update existing record
                  const docRef = db.collection(collectionName).doc(existingRecord.docId);
                  dbBatch.update(docRef, updateFields);
                  totalUpdated++;
                  dbBatchCount++;
                } else {
                  // No changes needed
                  totalSkipped++;
                }
              } else {
                // New record - add it
                recordData.firstFetchedAt = now;
                const newDocId = `${integrationId}_${uniqueKey}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
                const docRef = db.collection(collectionName).doc(newDocId);
                dbBatch.set(docRef, recordData);
                totalNew++;
                dbBatchCount++;
              }

              // Execute batch when it reaches limit
              if (dbBatchCount >= dbBatchSize) {
                await dbBatch.commit();
                dbBatch = db.batch();
                dbBatchCount = 0;
                
                // Send progress update
                const progress = 60 + Math.round((i / allFetchedRecords.length) * 30);
                controller.enqueue(encoder.encode(`data: ${JSON.stringify({
                  message: `Processed ${i + 1}/${allFetchedRecords.length} records`,
                  progress,
                  totalNew,
                  totalUpdated,
                  totalSkipped,
                  totalFetched,
                  pages: totalPages,
                  errors: totalErrors,
                  log: `Database save: ${totalNew} new, ${totalUpdated} updated, ${totalSkipped} skipped`
                })}\n\n`));
              }

            } catch (recordError: any) {
              console.error(`Error processing record ${i}:`, recordError);
              totalErrors++;
            }
          }

          // Commit any remaining batch operations
          if (dbBatchCount > 0) {
            await dbBatch.commit();
          }

          controller.enqueue(encoder.encode(`data: ${JSON.stringify({
            message: 'Saving operation log...',
            progress: 95,
            totalNew,
            totalUpdated,
            totalSkipped,
            totalFetched,
            pages: totalPages,
            errors: totalErrors,
            log: 'Finalizing operation and saving logs'
          })}\n\n`));

          // Save operation log
          const operationEndTime = Date.now();
          const operationDuration = operationEndTime - operationStartTime;

          const logData = {
            integrationId,
            operation: `Optimized Batch ${options.type === 'sales' ? 'Sales' : 'Products'} Fetch`,
            type: options.type,
            trigger: 'manual_optimized_batch',
            status: totalErrors > 0 ? 'completed_with_errors' : 'success',
            recordsFetched: totalFetched,
            recordsNew: totalNew,
            recordsUpdated: totalUpdated,
            recordsSkipped: totalSkipped,
            pages: totalPages,
            errors: totalErrors,
            duration: operationDuration,
            optimized: true,
            batchProcessing: true,
            verificationEnabled: options.verifyExisting,
            batchSize: batchSize,
            estimatedTotal: estimatedTotalRecords,
            createdAt: new Date().toISOString(),
            dbUpdated: new Date().toISOString(),
            summary: {
              fetchedFromAPI: totalFetched,
              newRecords: totalNew,
              updatedRecords: totalUpdated,
              skippedRecords: totalSkipped,
              pages: totalPages,
              errors: totalErrors,
              optimizationUsed: true,
              batchProcessing: true
            }
          };

          // Legacy logging removed - now using centralized logging system

          // Send completion
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({
            message: `Optimized batch fetch completed - ${totalNew} new, ${totalUpdated} updated, ${totalSkipped} unchanged`,
            progress: 100,
            totalNew,
            totalUpdated,
            totalSkipped,
            totalFetched,
            pages: totalPages,
            errors: totalErrors,
            completed: true,
            success: true,
            summary: {
              fetchedFromAPI: totalFetched,
              newRecords: totalNew,
              updatedRecords: totalUpdated,
              skippedRecords: totalSkipped,
              pages: totalPages,
              errors: totalErrors,
              optimizationUsed: true,
              batchProcessing: true
            },
            log: `Completed: ${totalNew} new, ${totalUpdated} updated, ${totalSkipped} unchanged, ${totalErrors} errors, ${totalPages} pages`
          })}\n\n`));

          // Log completion
          if (logId) {
            await cronJobLogger.logManualFetchEnhanced({
              adminId: adminId || integrationId,
              integrationId,
              apiSource: 'Takealot API',
              operation: `batch_${options.type}_fetch`,
              status: 'success',
              message: `Batch ${options.type} fetch completed successfully`,
              details: `Processed ${totalFetched} records: ${totalNew} new, ${totalUpdated} updated, ${totalSkipped} unchanged`,
              totalPages,
              totalReads: totalFetched,
              totalWrites: totalNew + totalUpdated,
              itemsProcessed: totalFetched,
              duration: Date.now() - operationStartTime
            });
          }

        } catch (error: any) {
          console.error('Optimized batch fetch error:', error);
          
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({
            error: true,
            message: error.message,
            completed: true,
            totalNew,
            totalUpdated,
            totalSkipped,
            totalFetched,
            pages: totalPages,
            errors: totalErrors + 1,
            log: `Error: ${error.message}`
          })}\n\n`));

          // Log error
          if (logId) {
            await cronJobLogger.logManualFetchEnhanced({
              adminId: adminId || integrationId,
              integrationId,
              apiSource: 'Takealot API',
              operation: `batch_${options.type}_fetch`,
              status: 'failure',
              message: `Batch ${options.type} fetch failed`,
              details: `Error after processing ${totalFetched} records`,
              errorDetails: error.message,
              totalPages,
              totalReads: totalFetched,
              totalWrites: totalNew + totalUpdated,
              itemsProcessed: totalFetched,
              duration: Date.now() - operationStartTime
            });
          }
        } finally {
          controller.close();
        }
      }
    });

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      },
    });

  } catch (error: any) {
    console.error('Optimized batch fetch initialization error:', error);
    
    // Log initialization error
    if (logId) {
      await cronJobLogger.logManualFetchEnhanced({
        adminId: 'unknown',
        integrationId: 'unknown',
        apiSource: 'Takealot API',
        operation: 'batch_fetch_initialization',
        status: 'failure',
        message: 'Batch fetch initialization failed',
        errorDetails: error.message,
        duration: 0
      });
    }
    
    return NextResponse.json({ 
      success: false,
      error: error.message,
      details: process.env.NODE_ENV === 'development' ? error.stack : undefined
    }, { status: 500 });
  }
}
