// src/app/api/admin/takealot/fetch-data/route.ts
import { NextRequest, NextResponse } from 'next/server';
import admin from 'firebase-admin';
import { cronJobLogger } from '@/lib/cronJobLogger';
import '@/lib/firebase/firebaseAdmin'; // Initialize Firebase Admin SDK

const TAKEALOT_API_BASE = 'https://seller-api.takealot.com';

interface FetchOptions {
  type: 'offers' | 'sales';
  limit?: number;
  pageSize: number;
  batchMode: boolean;
  testMode?: boolean;
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
        // Start centralized logging for this manual fetch
        let logId: string | null = null;
        try {
          logId = await cronJobLogger.logManualFetch({
            adminId: integrationId, // Using integrationId as proxy
            adminName: 'Unknown',
            adminEmail: 'unknown@example.com',
            operation: `Streaming ${options.type} Fetch`,
            apiSource: 'Takealot API',
            status: 'success', // Will be updated
            message: `Starting streaming fetch for ${options.type}`,
            details: `Batch mode: ${options.batchMode}, Page size: ${options.pageSize}`
          });
        } catch (logError) {
          console.error('Failed to start centralized logging:', logError);
        }

        try {
          await performDataFetch(
            controller, 
            encoder, 
            integrationId,
            apiKey, 
            options,
            logId
          );
        } catch (error: any) {
          // Log error to centralized system
          if (logId) {
            try {
              await cronJobLogger.logManualFetch({
                adminId: integrationId,
                adminName: 'Unknown',
                adminEmail: 'unknown@example.com',
                operation: `Streaming ${options.type} Fetch Error`,
                apiSource: 'Takealot API',
                status: 'failure',
                message: `Streaming fetch failed: ${error.message}`,
                errorDetails: error.message
              });
            } catch (logError) {
              console.error('Failed to log error to centralized system:', logError);
            }
          }

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
    console.error('Data fetch error:', error);
    return NextResponse.json({ 
      error: error.message || 'Internal server error' 
    }, { status: 500 });
  }
}

async function saveRecordToDatabase(
  record: any,
  integrationId: string,
  type: 'offers' | 'sales'
) {
  try {
    const db = admin.firestore();
    const collectionName = type === 'offers' ? 'takealot_offers' : 'takealot_sales';
    
    // Create document with integration ID and timestamp
    const docData = {
      ...record,
      integrationId,
      syncedAt: admin.firestore.FieldValue.serverTimestamp(),
      lastUpdated: admin.firestore.FieldValue.serverTimestamp()
    };

    // For offers, use offer_id as document ID if available
    // For sales, use order_item_id or create a unique ID
    let docId;
    if (type === 'offers' && record.offer_id) {
      docId = `${integrationId}_${record.offer_id}`;
    } else if (type === 'sales' && record.order_item_id) {
      docId = `${integrationId}_${record.order_item_id}`;
    } else {
      // Generate unique ID
      docId = `${integrationId}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }

    const docRef = db.collection(collectionName).doc(docId);
    await docRef.set(docData, { merge: true });
    
    return true;
  } catch (error) {
    console.error('Error saving record to database:', error);
    throw error;
  }
}

async function performDataFetch(
  controller: ReadableStreamDefaultController,
  encoder: TextEncoder,
  integrationId: string,
  apiKey: string,
  options: FetchOptions,
  logId?: string | null
) {
  let totalProcessed = 0;
  const totalSkipped = 0;
  let totalErrors = 0;
  let currentPage = 1;
  let hasMore = true;

  const updateProgress = (message: string, completed = false) => {
    const progressData = {
      message,
      recordsProcessed: totalProcessed,
      recordsSkipped: totalSkipped,
      errors: totalErrors,
      currentPage,
      completed,
      log: `${new Date().toLocaleTimeString()}: ${message}`
    };

    const progressMessage = `data: ${JSON.stringify(progressData)}\n\n`;
    controller.enqueue(encoder.encode(progressMessage));
  };
  try {
    updateProgress(`Starting ${options.type} fetch with pagination (${options.pageSize} records per batch)`);

    // Legacy job logging removed - now using centralized logging system
    const db = admin.firestore();
    const jobId = `${options.type}-${integrationId}-${Date.now()}`;

    while (hasMore && (!options.limit || totalProcessed < options.limit)) {
      try {
        updateProgress(`Fetching page ${currentPage} (batch of ${options.pageSize} records)...`);

        // Construct API URL with pagination
        const endpoint = options.type === 'offers' ? '/v2/offers' : '/v2/orders';
        let url = `${TAKEALOT_API_BASE}${endpoint}?limit=${options.pageSize}&offset=${(currentPage - 1) * options.pageSize}`;
        
        if (options.type === 'sales') {
          // Add date range for sales if needed
          const endDate = new Date();
          const startDate = new Date();
          startDate.setDate(endDate.getDate() - 30); // Last 30 days
          
          url += `&start_date=${startDate.toISOString().split('T')[0]}`;
          url += `&end_date=${endDate.toISOString().split('T')[0]}`;
        }

        const response = await fetch(url, {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${apiKey}`,
            'Content-Type': 'application/json',
          },
          signal: AbortSignal.timeout(60000) // 60 second timeout
        });

        if (!response.ok) {
          if (response.status === 429) {
            updateProgress('Rate limit hit, waiting 30 seconds...');
            await new Promise(resolve => setTimeout(resolve, 30000));
            continue; // Retry same page
          }

          throw new Error(`API Error: ${response.status} ${response.statusText}`);
        }

        const data = await response.json();
        const records = data.results || data.data || (Array.isArray(data) ? data : []);
        
        if (records.length === 0) {
          hasMore = false;
          updateProgress('No more records found');
          break;
        }

        updateProgress(`Processing batch of ${records.length} records from page ${currentPage}...`);

        // Process records in the current batch
        for (const record of records) {
          try {
            if (options.testMode) {
              // In test mode, just count records
              totalProcessed++;
            } else {
              // In real mode, save to database
              await saveRecordToDatabase(record, integrationId, options.type);
              totalProcessed++;
            }

            // Stop if we've reached the limit
            if (options.limit && totalProcessed >= options.limit) {
              hasMore = false;
              break;
            }
          } catch (saveError: any) {
            totalErrors++;
            console.error('Error saving record:', saveError);
          }
        }

        updateProgress(`Completed page ${currentPage}: processed ${records.length} records (Total: ${totalProcessed})`);

        // Check if we have more pages
        if (records.length < options.pageSize) {
          hasMore = false;
        }

        currentPage++;

        // Rate limiting - wait between requests
        if (hasMore) {
          await new Promise(resolve => setTimeout(resolve, 1000)); // 1 second delay
        }

      } catch (error: any) {
        totalErrors++;
        updateProgress(`Error fetching page ${currentPage}: ${error.message}`);
        
        if (error.name === 'AbortError') {
          updateProgress('Request timeout - stopping operation');
          break;
        }

        // For other errors, continue with next page after delay
        await new Promise(resolve => setTimeout(resolve, 5000)); // 5 second delay
        currentPage++;
        
        if (totalErrors > 10) {
          updateProgress('Too many errors - stopping operation');
          break;
        }
      }
    }

    // Final update
    const finalMessage = options.testMode 
      ? `Test completed: Found ${totalProcessed} ${options.type} records`
      : `Data fetch completed: Processed ${totalProcessed} ${options.type} records, ${totalErrors} errors`;
    
    updateProgress(finalMessage, true);

  } catch (error: any) {
    updateProgress(`Fatal error: ${error.message}`, true);
    totalErrors++;
  } finally {
    controller.close();
  }
}
