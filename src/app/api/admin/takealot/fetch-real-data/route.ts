// src/app/api/admin/takealot/fetch-real-data/route.ts
import { NextRequest, NextResponse } from 'next/server';
import admin from 'firebase-admin';
import '@/lib/firebase/firebaseAdmin'; // Initialize Firebase Admin SDK

const TAKEALOT_API_BASE = 'https://seller-api.takealot.com';

interface FetchOptions {
  type: 'offers' | 'sales';
  limit?: number;
  pageSize: number;
  batchMode: boolean;
  dateRange?: '30days' | '6months' | 'all';
}

export async function POST(request: NextRequest) {
  const encoder = new TextEncoder();
  
  try {
    const { integrationId, apiKey, options } = await request.json() as {
      integrationId: string;
      apiKey: string;
      options: FetchOptions;
    };

    if (!integrationId || !apiKey || !options) {
      return NextResponse.json({ 
        error: 'Missing required parameters: integrationId, apiKey, options' 
      }, { status: 400 });
    }

    // Create streaming response for real-time progress updates
    const stream = new ReadableStream({
      async start(controller) {
        try {
          await performRealDataFetch(
            controller, 
            encoder, 
            integrationId,
            apiKey, 
            options
          );
        } catch (error: any) {
          const errorMessage = `data: ${JSON.stringify({
            error: true,
            message: error.message,
            completed: true
          })}\n\n`;
          controller.enqueue(encoder.encode(errorMessage));
          controller.close();
        }
      }
    });

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      }
    });

  } catch (error: any) {
    console.error('Real data fetch error:', error);
    return NextResponse.json({ 
      error: error.message || 'Internal server error' 
    }, { status: 500 });
  }
}

async function performRealDataFetch(
  controller: ReadableStreamDefaultController,
  encoder: TextEncoder,
  integrationId: string,
  apiKey: string,
  options: FetchOptions
) {
  let totalProcessed = 0;
  let totalSaved = 0;
  let totalRequestsSent = 0;
  let totalPages = 1;
  let currentPage = 1;
  let hasMore = true;
  const allFetchedData: any[] = [];
  const responseTimes: number[] = [];
  let lastApiResponse = '';

  const updateProgress = (message: string, completed = false, extraData?: any) => {
    const averageResponseTime = responseTimes.length > 0 
      ? responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length 
      : undefined;

    const progressData = {
      message,
      recordsProcessed: totalProcessed,
      recordsSaved: totalSaved,
      recordsSkipped: 0,
      errors: 0,
      currentPage,
      totalPages,
      completed,
      log: `${new Date().toLocaleTimeString()}: ${message}`,
      data: completed ? allFetchedData : undefined,
      // Enhanced tracking
      requestSent: extraData?.requestSent || false,
      totalRequestsSent,
      averageResponseTime,
      apiResponse: extraData?.apiResponse,
      ...extraData
    };

    const progressMessage = `data: ${JSON.stringify(progressData)}\n\n`;
    controller.enqueue(encoder.encode(progressMessage));
  };

  try {
    updateProgress(`Starting real ${options.type} fetch from Takealot API...`);    // First, make a test call to get total count and calculate pages
    const testUrl = await buildApiUrl(options.type, 1, 1, options.dateRange); // Get just 1 record to check total
    
    updateProgress(`Testing API connectivity and getting total count...`);
    
    const testResponse = await makeApiCall(testUrl, apiKey);
    totalRequestsSent++;
    responseTimes.push(testResponse.responseTime || 0);
    
    updateProgress(`API test completed`, false, { requestSent: true });
    
    if (!testResponse.success) {
      throw new Error(`API test failed: ${testResponse.error}`);
    }

    // Capture first API response sample
    lastApiResponse = JSON.stringify(testResponse.data, null, 2).split('\n').slice(0, 20).join('\n');

    // Extract total count and calculate pages
    const totalResults = testResponse.data.page_summary?.total_results || 0;
    totalPages = Math.ceil(totalResults / options.pageSize);
    
    // Apply limit logic
    let targetRecords = totalResults;
    if (options.limit) {
      targetRecords = Math.min(options.limit, totalResults);
      totalPages = Math.ceil(targetRecords / options.pageSize);
    }

    updateProgress(`Found ${totalResults} total records. Will fetch ${targetRecords} records across ${totalPages} pages (${options.pageSize} per page)`);

    // Now fetch data page by page
    while (hasMore && currentPage <= totalPages) {
      try {        updateProgress(`Fetching page ${currentPage} of ${totalPages} (${options.pageSize} records per page)...`);

        const apiUrl = await buildApiUrl(options.type, currentPage, options.pageSize, options.dateRange);
        const response = await makeApiCall(apiUrl, apiKey);
        
        totalRequestsSent++;
        responseTimes.push(response.responseTime || 0);
        
        updateProgress(`Page ${currentPage}: API request completed`, false, { 
          requestSent: true,
          apiResponse: response.data 
        });

        if (!response.success) {
          throw new Error(`Page ${currentPage} failed: ${response.error}`);
        }

        const records = extractRecords(response.data, options.type);
        
        if (records.length === 0) {
          updateProgress(`Page ${currentPage}: No records found. Ending fetch.`);
          hasMore = false;
          break;
        }

        // Save this page's data to Firestore immediately
        updateProgress(`Page ${currentPage}: Fetched ${records.length} records. Saving to database...`);
        
        await saveRecordsToFirestore(records, integrationId, options.type);
        
        allFetchedData.push(...records);
        totalProcessed += records.length;
        totalSaved += records.length; // Assuming all fetched records are saved successfully

        updateProgress(`Page ${currentPage}: Saved ${records.length} records to database. Total: ${totalProcessed} fetched, ${totalSaved} saved`);

        // Update last API response sample periodically
        if (currentPage <= 3) { // Keep samples from first few pages
          lastApiResponse = JSON.stringify(response.data, null, 2).split('\n').slice(0, 20).join('\n');
        }

        // Check if we've reached our target limit
        if (options.limit && totalProcessed >= options.limit) {
          updateProgress(`Reached target limit of ${options.limit} records. Stopping fetch.`);
          hasMore = false;
          break;
        }

        currentPage++;

        // Check if this was the last page
        if (currentPage > totalPages) {
          hasMore = false;
        }

        // Add delay between requests to avoid rate limiting
        if (hasMore) {
          updateProgress(`Waiting 2 seconds before next page to avoid rate limiting...`);
          await new Promise(resolve => setTimeout(resolve, 2000));
        }

      } catch (pageError: any) {
        updateProgress(`Error on page ${currentPage}: ${pageError.message}`);
        
        // Try to continue with next page unless it's a critical error
        if (pageError.message.includes('401') || pageError.message.includes('403')) {
          throw pageError; // Auth errors should stop the whole process
        }
        
        currentPage++;
        await new Promise(resolve => setTimeout(resolve, 5000)); // Longer delay on error
      }
    }    // Final completion message
    const averageResponseTime = responseTimes.length > 0 
      ? responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length 
      : 0;

    updateProgress(
      `✅ FETCH COMPLETED! Successfully fetched ${totalProcessed} and saved ${totalSaved} ${options.type} records across ${currentPage - 1} pages. Sent ${totalRequestsSent} API requests with average response time of ${Math.round(averageResponseTime)}ms.`,
      true,
      {
        totalRequestsSent,
        totalRecordsFetched: totalProcessed,
        totalRecordsSaved: totalSaved,
        averageResponseTime,
        apiResponse: lastApiResponse ? JSON.parse(lastApiResponse) : null
      }
    );

  } catch (error: any) {
    console.error('Fatal error during real data fetch:', error);
    updateProgress(`❌ FATAL ERROR: ${error.message}`, true);
  } finally {
    controller.close();
  }
}

async function buildApiUrl(
  type: 'offers' | 'sales',
  page: number,
  pageSize: number,
  dateRange?: string
): Promise<string> {
  const endpoint = type === 'offers' ? '/v2/offers' : '/V2/sales';
  const url = `${TAKEALOT_API_BASE}${endpoint}`;
  
  const params = new URLSearchParams();
  params.append('page_size', pageSize.toString());
  params.append('page_number', page.toString());

  if (type === 'sales' && dateRange) {
    const endDate = new Date();
    const startDate = new Date();
    
    switch (dateRange) {
      case '30days':
        startDate.setDate(endDate.getDate() - 30);
        break;
      case '6months':
        startDate.setMonth(endDate.getMonth() - 6);
        break;
      case 'all':
        startDate.setFullYear(endDate.getFullYear() - 2); // Last 2 years for 'all'
        break;
      default:
        startDate.setDate(endDate.getDate() - 30); // Default to 30 days
    }
    
    params.append('start_date', startDate.toISOString().split('T')[0]);
    params.append('end_date', endDate.toISOString().split('T')[0]);
  }
  
  return `${url}?${params.toString()}`;
}

async function makeApiCall(url: string, apiKey: string): Promise<{
  success: boolean;
  data?: any;
  error?: string;
  responseTime?: number;
}> {
  const startTime = Date.now();
  
  try {
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Authorization': `Key ${apiKey}`,
        'Accept': 'application/json',
        'User-Agent': 'POS-App/1.0'
      },
      signal: AbortSignal.timeout(60000) // 60 second timeout
    });

    const responseTime = Date.now() - startTime;

    if (!response.ok) {
      if (response.status === 429) {
        throw new Error('Rate limit exceeded. Please try again later.');
      }
      if (response.status === 401) {
        throw new Error('Invalid API key or authentication failed.');
      }
      if (response.status === 403) {
        throw new Error('Access forbidden. Check API key permissions.');
      }
      throw new Error(`API Error: ${response.status} ${response.statusText}`);
    }    const data = await response.json();
    return { success: true, data, responseTime };

  } catch (error: any) {
    const responseTime = Date.now() - startTime;
    return { success: false, error: error.message, responseTime };
  }
}

function extractRecords(data: any, type: 'offers' | 'sales'): any[] {
  if (type === 'offers') {
    return data.offers || [];
  } else {
    return data.sales || [];
  }
}

async function saveRecordsToFirestore(
  records: any[],
  integrationId: string,
  dataType: 'offers' | 'sales'
) {
  if (!records || records.length === 0) {
    return;
  }

  try {
    const db = admin.firestore();
    const collectionName = dataType === 'offers' ? 'takealot_offers' : 'takealot_sales';
    
    // Build a map of unique identifiers to check for existing documents
    const uniqueIds = new Map<string, any>();
    const docIds: string[] = [];
    
    // For offers, check for duplicates based on TSIN, barcode, and product_label_number
    if (dataType === 'offers') {
      const existingProductsMap = new Map<string, string>(); // key -> document ID
      
      // First, check for existing products with same TSIN, barcode, or product_label_number
      const existingQuery = await db.collection(collectionName)
        .where('integrationId', '==', integrationId)
        .get();
      
      existingQuery.forEach(doc => {
        const data = doc.data();
        if (data.tsin_id) {
          existingProductsMap.set(`tsin_${data.tsin_id}`, doc.id);
        }
        if (data.barcode) {
          existingProductsMap.set(`barcode_${data.barcode}`, doc.id);
        }
        if (data.product_label_number) {
          existingProductsMap.set(`pln_${data.product_label_number}`, doc.id);
        }
      });
      
      // Process records and use existing doc ID if duplicate found
      for (const record of records) {
        let docId = '';
        
        // Check for existing documents with same unique identifiers
        if (record.tsin_id && existingProductsMap.has(`tsin_${record.tsin_id}`)) {
          docId = existingProductsMap.get(`tsin_${record.tsin_id}`)!;
        } else if (record.barcode && existingProductsMap.has(`barcode_${record.barcode}`)) {
          docId = existingProductsMap.get(`barcode_${record.barcode}`)!;
        } else if (record.product_label_number && existingProductsMap.has(`pln_${record.product_label_number}`)) {
          docId = existingProductsMap.get(`pln_${record.product_label_number}`)!;
        } else {
          // Create new document ID based on business logic priority
          const uniqueId = record.offer_id || record.sku || record.seller_sku || record.tsin_id || `unknown_${Date.now()}_${Math.random()}`.replace('.', '');
          docId = `${integrationId}_${uniqueId}`;
          
          // Track new products to avoid duplicates within the same batch
          if (record.tsin_id) {
            existingProductsMap.set(`tsin_${record.tsin_id}`, docId);
          }
          if (record.barcode) {
            existingProductsMap.set(`barcode_${record.barcode}`, docId);
          }
          if (record.product_label_number) {
            existingProductsMap.set(`pln_${record.product_label_number}`, docId);
          }
        }
        
        uniqueIds.set(docId, { ...record, unique_id: record.offer_id || record.sku || record.tsin_id });
        docIds.push(docId);
      }
    } else {
      // For sales, use existing logic
      for (const record of records) {
        const uniqueId = record.order_item_id || record.sale_id || `${record.order_id}_${record.item_id}` || `unknown_${Date.now()}_${Math.random()}`.replace('.', '');
        const docId = `${integrationId}_${uniqueId}`;
        uniqueIds.set(docId, { ...record, unique_id: uniqueId });
        docIds.push(docId);
      }
    }
    
    // Check existing documents in batches
    const existingDocs = new Map<string, any>();
    const checkBatchSize = 10; // Firestore 'in' operator limit
    
    for (let i = 0; i < docIds.length; i += checkBatchSize) {
      const batchIds = docIds.slice(i, i + checkBatchSize);
      const existingQuery = await db.collection(collectionName)
        .where(admin.firestore.FieldPath.documentId(), 'in', batchIds)
        .get();
      
      existingQuery.forEach(doc => {
        if (doc.exists) {
          existingDocs.set(doc.id, doc.data());
        }
      });
    }
    
    // Now save records in batches
    const batchSize = 500; // Firestore batch limit
    const docIdArray = Array.from(uniqueIds.keys());
    
    for (let i = 0; i < docIdArray.length; i += batchSize) {
      const batchDocIds = docIdArray.slice(i, i + batchSize);
      const batch = db.batch();
      
      for (const docId of batchDocIds) {
        const record = uniqueIds.get(docId);
        const docRef = db.collection(collectionName).doc(docId);
        const existingData = existingDocs.get(docId);
        
        // Add metadata to the record
        const recordWithMetadata = {
          ...record,
          integrationId,
          dataType,
          lastUpdated: admin.firestore.FieldValue.serverTimestamp(),
          syncedAt: new Date().toISOString()
        };
        
        // If document exists, preserve the original fetchedAt timestamp
        if (existingData) {
          recordWithMetadata.fetchedAt = existingData.fetchedAt || admin.firestore.FieldValue.serverTimestamp();
          recordWithMetadata.firstFetchedAt = existingData.firstFetchedAt || existingData.fetchedAt || admin.firestore.FieldValue.serverTimestamp();
        } else {
          // New document
          recordWithMetadata.fetchedAt = admin.firestore.FieldValue.serverTimestamp();
          recordWithMetadata.firstFetchedAt = admin.firestore.FieldValue.serverTimestamp();
        }
        
        batch.set(docRef, recordWithMetadata, { merge: true });
      }
      
      // Commit the current batch
      await batch.commit();
    }
    
    const newRecords = docIds.length - existingDocs.size;
    const updatedRecords = existingDocs.size;
    
    console.log(`Successfully processed ${records.length} ${dataType} records: ${newRecords} new, ${updatedRecords} updated`);
  } catch (error) {
    console.error(`Error saving ${dataType} records to Firestore:`, error);
    throw new Error(`Failed to save ${dataType} records to database: ${error}`);
  }
}
