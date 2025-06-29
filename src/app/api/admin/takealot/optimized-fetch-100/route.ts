// src/app/api/admin/takealot/optimized-fetch-100/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { dbAdmin as db } from '@/lib/firebase/firebaseAdmin';
import { cronJobLogger } from '@/lib/cronJobLogger';

const TAKEALOT_API_BASE = 'https://seller-api.takealot.com';

interface OptimizedFetchOptions {
  type: 'sales' | 'products';
  limit?: number; // Made optional for unlimited fetches
  days?: number; // For date-based fetching
  verifyExisting: boolean;
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
  try {
    console.log('Optimized Takealot 100 records fetch endpoint called');
    
    const { integrationId, options } = await request.json() as {
      integrationId: string;
      options: OptimizedFetchOptions;
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
    
    if (!apiKey) {
      return NextResponse.json({ 
        error: 'API key not found for this integration' 
      }, { status: 400 });
    }

    // Create streaming response for progress updates
    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        const operationStartTime = Date.now();
        let totalNew = 0;
        let totalUpdated = 0;
        let totalSkipped = 0;
        let totalErrors = 0;

        try {
          // Log start of operation using centralized logging system
          const startLogId = await cronJobLogger.logManualFetchEnhanced({
            adminId: integrationData?.adminId || integrationId,
            integrationId,
            apiSource: 'takealot',
            operation: `Optimized ${options.type === 'sales' ? 'Sales' : 'Products'} Fetch - Started`,
            status: 'success',
            message: `Starting optimized ${options.type} fetch${options.limit ? ` (limit: ${options.limit})` : ' (unlimited)'}`,
            details: JSON.stringify({
              fetchLimit: options.limit || 'unlimited',
              daysFilter: options.days || null,
              verificationEnabled: options.verifyExisting,
              optimized: true
            })
          });

          // Send initial progress
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({
            message: `Starting optimized ${options.type} fetch${options.limit ? ` - Getting ${options.limit} records` : ' - Getting all records'}`,
            progress: 5,
            totalNew: 0,
            totalUpdated: 0,
            totalSkipped: 0,
            errors: 0,
            log: `Starting optimized fetch for ${options.type}${options.limit ? ` (limit: ${options.limit})` : ' (all records)'}`
          })}\n\n`));          // Set up API endpoint and parameters
          const endpoint = options.type === 'sales' ? '/V2/sales' : '/v2/offers';
          const params = new URLSearchParams();
          
          // Configure page size and pagination
          if (options.limit) {
            // For limited fetches, use single page if possible
            params.append('page_size', Math.min(options.limit, 100).toString());
            params.append('page_number', '1');
          } else {
            // For unlimited fetches, start with standard page size
            params.append('page_size', '100');
            params.append('page_number', '1');
          }

          // Add date filters for sales if specified
          if (options.type === 'sales' && options.days) {
            const daysAgo = new Date(Date.now() - options.days * 24 * 60 * 60 * 1000);
            params.append('created_date_start', daysAgo.toISOString().split('T')[0]);
          }          let allFetchedRecords: any[] = [];
          let currentPage = 1;
          let hasMorePages = true;

          // Fetch data from Takealot API (with pagination for unlimited fetches)
          while (hasMorePages) {
            params.set('page_number', currentPage.toString());
            const apiUrl = `${TAKEALOT_API_BASE}${endpoint}?${params.toString()}`;
            console.log(`Fetching page ${currentPage} from: ${apiUrl}`);

            controller.enqueue(encoder.encode(`data: ${JSON.stringify({
              message: `Fetching page ${currentPage} from Takealot API...`,
              progress: 15 + (currentPage - 1) * 5,
              totalNew,
              totalUpdated,
              totalSkipped,
              errors: totalErrors,
              log: `Requesting page ${currentPage} from Takealot API`
            })}\n\n`));

            const apiResponse = await fetch(apiUrl, {
              method: 'GET',
              headers: {
                'Authorization': `Key ${apiKey}`,
                'Content-Type': 'application/json',
                'User-Agent': 'POS-App/1.0'
              },
              signal: AbortSignal.timeout(60000)
            });

            if (!apiResponse.ok) {
              throw new Error(`API request failed: ${apiResponse.status} ${apiResponse.statusText}`);
            }

            const apiData = await apiResponse.json();
            
            // Extract records based on data type
            let pageRecords: any[] = [];
            if (options.type === 'sales') {
              pageRecords = apiData.sales || [];
            } else {
              pageRecords = apiData.offers || [];
            }

            console.log(`Fetched ${pageRecords.length} records from page ${currentPage}`);
            allFetchedRecords.push(...pageRecords);

            // Check if we should continue to next page
            if (options.limit) {
              // For limited fetches, stop when we have enough records
              hasMorePages = false;
              if (allFetchedRecords.length > options.limit) {
                allFetchedRecords = allFetchedRecords.slice(0, options.limit);
              }
            } else {
              // For unlimited fetches, continue until no more records
              hasMorePages = pageRecords.length === 100; // Continue if page is full
              if (hasMorePages) {
                currentPage++;
              }
            }

            // Break if we've fetched enough for limited requests
            if (options.limit && allFetchedRecords.length >= options.limit) {
              hasMorePages = false;
            }
          }          const totalFetched = allFetchedRecords.length;
          console.log(`Total fetched from API: ${totalFetched} records`);

          controller.enqueue(encoder.encode(`data: ${JSON.stringify({
            message: `Received ${totalFetched} records from API`,
            progress: 30,
            totalNew,
            totalUpdated,
            totalSkipped,
            errors: totalErrors,
            log: `Fetched ${totalFetched} records from Takealot API`
          })}\n\n`));

          if (allFetchedRecords.length === 0) {
            throw new Error('No records found in API response');
          }// Get existing records from database for comparison
          const collectionName = options.type === 'sales' ? 'takealot_sales' : 'takealot_offers';
          const existingRecordsMap = new Map();

          if (options.verifyExisting) {
            controller.enqueue(encoder.encode(`data: ${JSON.stringify({
              message: 'Checking existing records in database...',
              progress: 40,
              totalNew,
              totalUpdated,
              totalSkipped,
              errors: totalErrors,
              log: 'Querying existing records for comparison'
            })}\n\n`));            // Extract unique IDs from fetched records first
            const fetchedIds = allFetchedRecords.map((record: any) => {
              if (options.type === 'sales') {
                return record.order_id || record.sale_id;
              } else {
                return record.tsin_id || record.offer_id;
              }
            }).filter((id: any) => id !== undefined && id !== null) // Remove undefined/null values
              .map((id: any) => id.toString()); // Convert all to strings for consistent comparison

            console.log(`Looking for existing records with IDs: ${fetchedIds.length}`);if (fetchedIds.length > 0) {
              // Query existing records by specific TSIN/order IDs to improve efficiency
              const existingQuery = db.collection(collectionName)
                .where('integrationId', '==', integrationId);

              const existingSnapshot = await existingQuery.get();
              console.log(`Total existing records in database: ${existingSnapshot.size}`);
              console.log(`Looking for these ${options.type} IDs:`, fetchedIds.slice(0, 5), '...');
              
              existingSnapshot.forEach(doc => {
                const data = doc.data();
                let uniqueKey;
                
                if (options.type === 'sales') {
                  // Use order_id as unique identifier for sales
                  uniqueKey = data.order_id || data.sale_id;
                } else {
                  // Use tsin_id as unique identifier for products
                  uniqueKey = data.tsin_id || data.offer_id;
                }
                
                if (uniqueKey) {                  // Convert both to strings for comparison
                  const uniqueKeyStr = uniqueKey.toString();
                  const fetchedIdsStr = fetchedIds.map((id: any) => id.toString());
                  
                  if (fetchedIdsStr.includes(uniqueKeyStr)) {
                    existingRecordsMap.set(uniqueKeyStr, {
                      docId: doc.id,
                      data: data
                    });
                    console.log(`✅ Found existing record for ${options.type} ID: ${uniqueKey} (doc: ${doc.id})`);
                  }
                }
              });

              console.log(`Found ${existingRecordsMap.size} existing records matching fetched IDs`);
              if (existingRecordsMap.size === 0) {
                console.log('⚠️ No existing records found to update - all will be created as new');
                console.log('First few existing record IDs in DB:', [...existingSnapshot.docs.slice(0, 3).map(doc => {
                  const data = doc.data();
                  return options.type === 'sales' ? (data.order_id || data.sale_id) : (data.tsin_id || data.offer_id);
                })]);
              }
            }
          }          // Process each fetched record
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({
            message: 'Processing and verifying records...',
            progress: 50,
            totalNew,
            totalUpdated,
            totalSkipped,
            errors: totalErrors,
            log: `Processing ${allFetchedRecords.length} records with verification`
          })}\n\n`));

          const batch = db.batch();
          let batchCount = 0;
          const maxBatchSize = 500;

          for (let i = 0; i < allFetchedRecords.length; i++) {
            const record = allFetchedRecords[i];
            
            try {              // Determine unique identifier
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

              // Convert to string for consistent comparison
              const uniqueKeyStr = uniqueKey.toString();
              console.log(`Processing ${options.type} with ID: ${uniqueKeyStr}`);
              const existingRecord = existingRecordsMap.get(uniqueKeyStr);
              
              if (existingRecord) {
                console.log(`✅ Found existing record for ${uniqueKeyStr}, checking for updates...`);
              } else {
                console.log(`❌ No existing record found for ${uniqueKeyStr}, will create new`);
              }
              const now = new Date().toISOString();
              
              // Prepare the record data
              const recordData = {
                integrationId,
                ...record,
                fetchedAt: now,
                lastUpdated: now,
                source: 'takealot_api',
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
                  // For sales: update only Sale Status and Amount
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
                  }                } else {
                  // For products: update Price, RRP, SKU, Image, and Quantity
                  const currentPrice = existing.selling_price;
                  const currentRRP = existing.rrp;
                  const currentSKU = existing.sku;
                  const currentImage = existing.image_url || existing.image || existing.product_image;
                  const currentQty = existing.quantity_available || existing.available_quantity || existing.qty;

                  console.log(`Comparing product ${uniqueKey}: Price ${currentPrice} vs ${record.selling_price}, RRP ${currentRRP} vs ${record.rrp}, SKU '${currentSKU}' vs '${record.sku}'`);

                  if (currentPrice !== record.selling_price) {
                    updateFields.selling_price = record.selling_price;
                    needsUpdate = true;
                    console.log(`Price changed: ${currentPrice} -> ${record.selling_price}`);
                  }

                  if (currentRRP !== record.rrp) {
                    updateFields.rrp = record.rrp;
                    needsUpdate = true;
                    console.log(`RRP changed: ${currentRRP} -> ${record.rrp}`);
                  }

                  if (currentSKU !== record.sku) {
                    updateFields.sku = record.sku;
                    needsUpdate = true;
                    console.log(`SKU changed: '${currentSKU}' -> '${record.sku}'`);
                  }

                  // Update image if available
                  const newImage = record.image_url || record.image || record.product_image;
                  if (newImage && currentImage !== newImage) {
                    updateFields.image_url = newImage;
                    updateFields.image = newImage;
                    updateFields.product_image = newImage;
                    needsUpdate = true;
                    console.log(`Image changed: '${currentImage}' -> '${newImage}'`);
                  }

                  // Update quantity if available
                  const newQty = record.quantity_available || record.available_quantity || record.qty;
                  if (newQty !== undefined && currentQty !== newQty) {
                    updateFields.quantity_available = newQty;
                    updateFields.available_quantity = newQty;
                    updateFields.qty = newQty;
                    needsUpdate = true;
                    console.log(`Quantity changed: ${currentQty} -> ${newQty}`);
                  }
                }                if (needsUpdate) {
                  // Update existing record
                  console.log(`Updating existing record for ${uniqueKey} with fields:`, Object.keys(updateFields));
                  const docRef = db.collection(collectionName).doc(existingRecord.docId);
                  batch.update(docRef, updateFields);
                  totalUpdated++;
                  batchCount++;
                } else {
                  // No changes needed
                  console.log(`No changes needed for ${uniqueKey}, skipping update`);
                  totalSkipped++;
                }
              } else {
                // New record - add it
                console.log(`Creating new record for ${uniqueKey}`);
                recordData.firstFetchedAt = now;
                const newDocId = `${integrationId}_${uniqueKey}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
                const docRef = db.collection(collectionName).doc(newDocId);
                batch.set(docRef, recordData);
                totalNew++;
                batchCount++;
              }              // Execute batch when it reaches limit
              if (batchCount >= maxBatchSize) {
                await batch.commit();
                batchCount = 0;
                
                // Send progress update
                const progress = 50 + Math.round((i / allFetchedRecords.length) * 40);
                controller.enqueue(encoder.encode(`data: ${JSON.stringify({
                  message: `Processed ${i + 1}/${allFetchedRecords.length} records`,
                  progress,
                  totalNew,
                  totalUpdated,
                  totalSkipped,
                  errors: totalErrors,
                  log: `Batch saved: ${totalNew} new, ${totalUpdated} updated, ${totalSkipped} skipped`
                })}\n\n`));
              }

            } catch (recordError: any) {
              console.error(`Error processing record ${i}:`, recordError);
              totalErrors++;
            }
          }

          // Commit any remaining batch operations
          if (batchCount > 0) {
            await batch.commit();
          }

          controller.enqueue(encoder.encode(`data: ${JSON.stringify({
            message: 'Saving operation log...',
            progress: 95,
            totalNew,
            totalUpdated,
            totalSkipped,
            errors: totalErrors,
            log: 'Finalizing operation and saving logs'
          })}\n\n`));

          // Save operation log
          const operationEndTime = Date.now();
          const operationDuration = operationEndTime - operationStartTime;          const logData = {
            integrationId,
            operation: `Optimized ${options.type === 'sales' ? 'Sales' : 'Products'} Fetch`,
            type: options.type,
            trigger: 'manual_optimized',
            status: totalErrors > 0 ? 'completed_with_errors' : 'success',
            recordsFetched: allFetchedRecords.length,
            recordsNew: totalNew,
            recordsUpdated: totalUpdated,
            recordsSkipped: totalSkipped,
            errors: totalErrors,
            duration: operationDuration,
            optimized: true,
            verificationEnabled: options.verifyExisting,
            createdAt: new Date().toISOString(),
            dbUpdated: new Date().toISOString(),
            summary: {
              fetchedFromAPI: allFetchedRecords.length,
              newRecords: totalNew,
              updatedRecords: totalUpdated,
              skippedRecords: totalSkipped,
              errors: totalErrors,
              optimizationUsed: true
            }
          };

          // Log using centralized logging system
          await cronJobLogger.logManualFetchEnhanced({
            adminId: integrationData?.adminId || integrationId,
            integrationId,
            apiSource: 'takealot',
            operation: `Optimized ${options.type === 'sales' ? 'Sales' : 'Products'} Fetch`,
            itemsProcessed: allFetchedRecords.length,
            status: totalErrors > 0 ? 'failure' : 'success',
            message: `Optimized fetch completed - ${totalNew} new, ${totalUpdated} updated, ${totalSkipped} unchanged`,
            details: JSON.stringify({
              recordsFetched: allFetchedRecords.length,
              recordsNew: totalNew,
              recordsUpdated: totalUpdated,
              recordsSkipped: totalSkipped,
              errors: totalErrors,
              optimized: true,
              verificationEnabled: options.verifyExisting,
              summary: {
                fetchedFromAPI: allFetchedRecords.length,
                newRecords: totalNew,
                updatedRecords: totalUpdated,
                skippedRecords: totalSkipped,
                errors: totalErrors,
                optimizationUsed: true
              }
            }),
            errorDetails: totalErrors > 0 ? `Completed with ${totalErrors} errors` : undefined,
            duration: operationDuration
          });

          // Send completion
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({
            message: `Optimized fetch completed - ${totalNew} new, ${totalUpdated} updated, ${totalSkipped} unchanged`,
            progress: 100,
            totalNew,
            totalUpdated,
            totalSkipped,
            errors: totalErrors,            completed: true,
            success: true,
            summary: {
              fetchedFromAPI: allFetchedRecords.length,
              newRecords: totalNew,
              updatedRecords: totalUpdated,
              skippedRecords: totalSkipped,
              errors: totalErrors,
              optimizationUsed: true
            },
            log: `Completed: ${totalNew} new, ${totalUpdated} updated, ${totalSkipped} unchanged, ${totalErrors} errors`
          })}\n\n`));

        } catch (error: any) {
          console.error('Optimized fetch error:', error);
          
          // Log error using centralized logging system
          try {
            await cronJobLogger.logManualFetchEnhanced({
              adminId: integrationData?.adminId || integrationId,
              integrationId,
              apiSource: 'takealot',
              operation: `Optimized ${options.type === 'sales' ? 'Sales' : 'Products'} Fetch`,
              itemsProcessed: 0,
              status: 'failure',
              message: `Optimized fetch failed: ${error.message}`,
              details: JSON.stringify({
                recordsFetched: 0,
                recordsNew: totalNew,
                recordsUpdated: totalUpdated,
                recordsSkipped: totalSkipped,
                errors: totalErrors + 1,
                optimized: true
              }),
              errorDetails: error.message,
              duration: Date.now() - operationStartTime
            });
          } catch (logError) {
            console.error('Failed to log error:', logError);
          }
          
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({
            error: true,
            message: error.message,
            completed: true,
            totalNew,
            totalUpdated,
            totalSkipped,
            errors: totalErrors + 1,
            log: `Error: ${error.message}`
          })}\n\n`));
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
    console.error('Optimized fetch initialization error:', error);
    
    return NextResponse.json({ 
      success: false,
      error: error.message,
      details: process.env.NODE_ENV === 'development' ? error.stack : undefined
    }, { status: 500 });
  }
}
