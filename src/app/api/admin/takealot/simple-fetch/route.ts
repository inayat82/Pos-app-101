// src/app/api/admin/takealot/simple-fetch/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { dbAdmin as db } from '@/lib/firebase/firebaseAdmin';

const TAKEALOT_API_BASE = 'https://seller-api.takealot.com';

interface FetchOptions {
  type: 'offers' | 'sales';
  limit?: number;
  days?: number;
  batchMode: boolean;
  testMode?: boolean;
}

export async function POST(request: NextRequest) {
  try {
    console.log('Simple Takealot data fetch endpoint called');
    
    const { integrationId, apiKey: providedApiKey, options } = await request.json() as {
      integrationId: string;
      apiKey?: string;
      options: FetchOptions;
    };

    if (!integrationId || !options) {
      return NextResponse.json({ 
        error: 'Missing required parameters: integrationId, options' 
      }, { status: 400 });
    }

    console.log(`Fetching ${options.type} data for integration: ${integrationId}`);
    
    // Get the API key from database like working APIs do
    const integrationDocRef = db.collection('takealotIntegrations').doc(integrationId);
    const integrationDoc = await integrationDocRef.get();
    
    if (!integrationDoc.exists) {
      return NextResponse.json({ 
        error: 'Takealot integration not found' 
      }, { status: 404 });
    }
    
    const integrationData = integrationDoc.data();
    const apiKey = providedApiKey || integrationData?.apiKey;
    
    if (!apiKey) {
      return NextResponse.json({ 
        error: 'API key not found for this integration' 
      }, { status: 400 });
    }// Set up API endpoint
    const endpoint = options.type === 'offers' ? '/v2/offers' : '/V2/sales';
    
    // First, make a test call to get total records for pagination
    const initialParams = new URLSearchParams();
    initialParams.append('page_size', '1');
    initialParams.append('page_number', '1');
    
    if (options.type === 'sales' && options.days) {
      const daysAgo = new Date(Date.now() - options.days * 24 * 60 * 60 * 1000);
      initialParams.append('created_date_start', daysAgo.toISOString().split('T')[0]);
    }    const testUrl = `${TAKEALOT_API_BASE}${endpoint}?${initialParams.toString()}`;
    console.log(`Getting total count from: ${testUrl}`);

    const testResponse = await fetch(testUrl, {
      method: 'GET',
      headers: {
        'Authorization': `Key ${apiKey}`,
        'Content-Type': 'application/json',
        'User-Agent': 'POS-App/1.0'
      },
      signal: AbortSignal.timeout(30000)    });
    
    if (!testResponse.ok) {
      throw new Error(`Failed to get total count: ${testResponse.status} ${testResponse.statusText}`);
    }

    const testData = await testResponse.json();
    
    // Calculate total pages based on response structure
    let totalRecords = 0;
    if (options.type === 'offers' && testData.total_results) {
      totalRecords = testData.total_results;
    } else if (options.type === 'sales' && testData.page_summary && testData.page_summary.total) {
      totalRecords = testData.page_summary.total;
    }

    const pageSize = 100; // Use 100 as specified
    const totalPages = Math.ceil(totalRecords / pageSize);
    const maxRecords = options.limit ? Math.min(options.limit, totalRecords) : totalRecords;
    const maxPages = options.testMode ? 1 : Math.ceil(maxRecords / pageSize);

    console.log(`Total records: ${totalRecords}, Total pages: ${totalPages}, Will fetch: ${maxPages} pages`);
    
    // Set up query parameters for actual fetching
    const params = new URLSearchParams();
    params.append('page_size', pageSize.toString());

    if (options.type === 'sales' && options.days) {
      const daysAgo = new Date(Date.now() - options.days * 24 * 60 * 60 * 1000);
      params.append('created_date_start', daysAgo.toISOString().split('T')[0]);
    }

    // Create streaming response for progress updates
    const encoder = new TextEncoder();
    const stream = new ReadableStream({      async start(controller) {
        const operationStartTime = Date.now();
        try {          // Send initial progress
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({
            message: `Starting ${options.type} fetch - Found ${totalRecords} total records`,
            progress: 0,
            total: maxRecords,
            recordsProcessed: 0,
            recordsSkipped: 0,
            errors: 0,
            log: `Starting ${options.type} fetch - ${maxPages} pages to process`
          })}\n\n`));

          let allRecords = [];
          let totalProcessed = 0;
          let totalSkipped = 0;
          let totalErrors = 0;

          // Fetch pages in batches
          for (let page = 1; page <= maxPages; page++) {
            try {
              const pageParams = new URLSearchParams(params);
              pageParams.set('page_number', page.toString());
              const pageUrl = `${TAKEALOT_API_BASE}${endpoint}?${pageParams.toString()}`;
              
              console.log(`Fetching page ${page}/${maxPages}: ${pageUrl}`);

              const pageStartTime = Date.now();
              const pageResponse = await fetch(pageUrl, {
                method: 'GET',
                headers: {
                  'Authorization': `Key ${apiKey}`,
                  'Content-Type': 'application/json',
                  'User-Agent': 'POS-App/1.0'
                },
                signal: AbortSignal.timeout(60000)
              });

              if (!pageResponse.ok) {
                throw new Error(`Page ${page} failed: ${pageResponse.status} ${pageResponse.statusText}`);
              }              const pageData = await pageResponse.json();
              const pageResponseTime = Date.now() - pageStartTime;// Extract records from response based on data type
              let pageRecords = [];
              if (options.type === 'sales') {
                // Takealot sales response structure: { "page_summary": {...}, "sales": [...] }
                if (pageData.sales && Array.isArray(pageData.sales)) {
                  pageRecords = pageData.sales;
                }
              } else if (options.type === 'offers') {
                // Takealot offers response structure: { "offers": [...], "total_results": ... }
                if (pageData.offers && Array.isArray(pageData.offers)) {
                  pageRecords = pageData.offers;
                } else if (Array.isArray(pageData)) {
                  pageRecords = pageData;
                }
              }
              
              // Fallback to generic extraction
              if (pageRecords.length === 0) {
                if (Array.isArray(pageData)) {
                  pageRecords = pageData;
                } else if (pageData.results && Array.isArray(pageData.results)) {
                  pageRecords = pageData.results;
                } else if (pageData.data && Array.isArray(pageData.data)) {
                  pageRecords = pageData.data;
                }
              }

              console.log(`Page ${page}: ${pageRecords.length} records in ${pageResponseTime}ms`);

              // Process records from current page
              for (const record of pageRecords) {
                try {
                  // Transform record for Firestore
                  const firestoreRecord = {
                    integrationId,
                    ...record,
                    fetchedAt: new Date().toISOString(),
                    source: 'takealot_api',
                    page: page
                  };

                  allRecords.push(firestoreRecord);
                  totalProcessed++;

                  // Check if we've hit our limit
                  if (options.limit && totalProcessed >= options.limit) {
                    break;
                  }
                } catch (error) {
                  console.error(`Error processing record:`, error);
                  totalErrors++;
                }
              }

              // Send progress update after each page
              const progress = Math.round((page / maxPages) * 90); // Leave 10% for final processing
              controller.enqueue(encoder.encode(`data: ${JSON.stringify({
                message: `Completed page ${page}/${maxPages} - ${pageRecords.length} records`,
                progress,
                total: maxRecords,
                recordsProcessed: totalProcessed,
                recordsSkipped: totalSkipped,
                errors: totalErrors,
                log: `Page ${page}/${maxPages}: ${pageRecords.length} records in ${pageResponseTime}ms`
              })}\n\n`));

              // Break if we've reached our limit
              if (options.limit && totalProcessed >= options.limit) {
                break;
              }

              // Add small delay between requests to avoid rate limiting
              if (page < maxPages) {
                await new Promise(resolve => setTimeout(resolve, 100));
              }            } catch (error: any) {
              console.error(`Error fetching page ${page}:`, error);
              totalErrors++;
              
              controller.enqueue(encoder.encode(`data: ${JSON.stringify({
                message: `Error on page ${page}: ${error.message}`,
                progress: Math.round((page / maxPages) * 90),
                total: maxRecords,
                recordsProcessed: totalProcessed,
                recordsSkipped: totalSkipped,
                errors: totalErrors,
                log: `Page ${page} failed: ${error.message}`
              })}\n\n`));
            }}

          // Save records to Firestore
          if (allRecords.length > 0 && !options.testMode) {
            controller.enqueue(encoder.encode(`data: ${JSON.stringify({
              message: `Saving ${allRecords.length} records to database...`,
              progress: 95,
              total: maxRecords,
              recordsProcessed: totalProcessed,
              recordsSkipped: totalSkipped,
              errors: totalErrors,
              log: `Saving ${allRecords.length} records to Firestore`
            })}\n\n`));            try {
              const collectionName = options.type === 'offers' ? 'takealot_offers' : 'takealot_sales';
              
              // Save records in batches to avoid overwhelming Firestore
              const batchSize = 10;
              for (let i = 0; i < allRecords.length; i += batchSize) {
                const batch = allRecords.slice(i, i + batchSize);
                const savePromises = batch.map(async (record) => {
                  // Create a unique ID for each record
                  const recordId = options.type === 'offers' 
                    ? `${integrationId}_${record.offer_id || record.id || Date.now()}_${Math.random().toString(36).substr(2, 9)}`
                    : `${integrationId}_${record.sale_id || record.id || Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
                    
                  return db.collection(collectionName).doc(recordId).set(record);
                });
                
                await Promise.all(savePromises);
                
                // Small delay between batches
                if (i + batchSize < allRecords.length) {
                  await new Promise(resolve => setTimeout(resolve, 100));
                }
              }
              
              console.log(`Successfully saved ${allRecords.length} records to ${collectionName}`);            } catch (saveError: any) {
              console.error('Error saving to Firestore:', saveError);
              totalErrors++;
              
              controller.enqueue(encoder.encode(`data: ${JSON.stringify({
                message: `Warning: Failed to save some records to database`,
                progress: 98,
                total: maxRecords,
                recordsProcessed: totalProcessed,
                recordsSkipped: totalSkipped,
                errors: totalErrors,
                log: `Database save error: ${saveError.message}`
              })}\n\n`));
            }
          }          // Send completion
          const operationEndTime = Date.now();
          const operationDuration = operationEndTime - operationStartTime;          // Save operation log to fetch_logs collection
          try {
            console.log('Saving operation log to fetch_logs...');
            const logData = {
              integrationId,
              operation: `${options.type === 'offers' ? 'Product' : 'Sales'} Fetch`,
              type: options.type === 'offers' ? 'products' : 'sales',
              trigger: 'manual',
              status: totalErrors > 0 ? 'completed_with_errors' : 'success',
              recordsFetched: totalProcessed,
              recordsSaved: totalProcessed,
              pagesFetched: Math.min(maxPages, Math.ceil(totalProcessed / pageSize)),
              totalPages: totalPages,
              totalRecords: totalRecords,
              duplicates: totalSkipped,
              errors: totalErrors,
              duration: operationDuration,
              createdAt: new Date().toISOString(),
              summary: {
                totalRecords,
                totalPages,
                pagesFetched: Math.min(maxPages, Math.ceil(totalProcessed / pageSize)),
                recordsFetched: totalProcessed,
                saved: !options.testMode
              }
            };

            console.log('Log data to save:', JSON.stringify(logData, null, 2));
            const logDoc = await db.collection('fetch_logs').add(logData);
            console.log('Operation logged successfully with ID:', logDoc.id);
          } catch (logError: any) {
            console.error('Failed to save operation log:', logError);
          }          controller.enqueue(encoder.encode(`data: ${JSON.stringify({
            message: `Data fetch completed - ${totalProcessed} records fetched${!options.testMode ? ' and saved' : ''}`,
            progress: 100,
            total: maxRecords,
            recordsProcessed: totalProcessed,
            recordsSkipped: totalSkipped,
            errors: totalErrors,
            completed: true,
            summary: {
              totalRecords,
              totalPages,
              pagesFetched: Math.min(maxPages, Math.ceil(totalProcessed / pageSize)),
              recordsFetched: totalProcessed,
              saved: !options.testMode
            },
            log: `Completed: ${totalProcessed} processed, ${totalSkipped} skipped, ${totalErrors} errors${!options.testMode ? ', saved to database' : ''}`
          })}\n\n`));

          console.log(`Data fetch completed: ${totalProcessed} processed, ${totalErrors} errors. About to save operation log...`);

        } catch (error: any) {
          console.error('Data fetch error:', error);
          
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({
            error: true,
            message: error.message,
            completed: true,
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
    console.error('Simple fetch error:', error);
    
    return NextResponse.json({ 
      success: false,
      error: error.message,
      details: process.env.NODE_ENV === 'development' ? error.stack : undefined
    }, { status: 500 });
  }
}
