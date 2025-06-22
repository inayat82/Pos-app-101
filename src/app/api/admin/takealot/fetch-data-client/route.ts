// src/app/api/admin/takealot/fetch-data-client/route.ts
import { NextRequest, NextResponse } from 'next/server';

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
        try {
          await performClientDataFetch(
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
    console.error('Data fetch error:', error);
    return NextResponse.json({ 
      error: error.message || 'Internal server error' 
    }, { status: 500 });
  }
}

async function performClientDataFetch(
  controller: ReadableStreamDefaultController,
  encoder: TextEncoder,
  integrationId: string,
  apiKey: string,
  options: FetchOptions
) {
  let totalProcessed = 0;
  let totalErrors = 0;
  let currentPage = 1;
  let hasMore = true;
  let fetchedData: any[] = [];

  const updateProgress = (message: string, completed = false) => {
    const progressData = {
      message,
      recordsProcessed: totalProcessed,
      errors: totalErrors,
      currentPage,
      completed,
      log: `${new Date().toLocaleTimeString()}: ${message}`,
      data: completed ? fetchedData : undefined
    };

    const progressMessage = `data: ${JSON.stringify(progressData)}\n\n`;
    controller.enqueue(encoder.encode(progressMessage));
  };

  try {
    updateProgress(`Starting ${options.type} fetch with pagination (${options.pageSize} records per batch)`);

    // Test mode: only fetch first few pages
    const maxPages = options.testMode ? 2 : 5; // Limit for demonstration
    
    while (hasMore && currentPage <= maxPages && (!options.limit || totalProcessed < options.limit)) {
      try {
        updateProgress(`Fetching page ${currentPage} (batch of ${options.pageSize} records)...`);
        
        // Construct API URL with pagination
        const endpoint = options.type === 'offers' ? '/v2/offers' : '/V2/sales';
        let url = `${TAKEALOT_API_BASE}${endpoint}`;
        
        const params = new URLSearchParams();
        params.append('page_size', '10'); // Keep small for testing
        params.append('page_number', currentPage.toString());
        
        if (options.type === 'sales') {
          const endDate = new Date();
          const startDate = new Date();
          startDate.setDate(endDate.getDate() - 7); // Last 7 days
          
          params.append('start_date', startDate.toISOString().split('T')[0]);
          params.append('end_date', endDate.toISOString().split('T')[0]);
        }
        
        url = `${url}?${params.toString()}`;
        
        updateProgress(`Making request to: ${url}`);

        const response = await fetch(url, {
          method: 'GET',
          headers: {
            'Authorization': `Key ${apiKey}`,
            'Accept': 'application/json',
            'User-Agent': 'POS-App/1.0'
          },
          signal: AbortSignal.timeout(60000)
        });

        updateProgress(`Response status: ${response.status} ${response.statusText}`);

        if (!response.ok) {
          if (response.status === 429) {
            updateProgress('Rate limit hit, waiting 30 seconds...');
            await new Promise(resolve => setTimeout(resolve, 30000));
            continue;
          }

          throw new Error(`API Error: ${response.status} ${response.statusText}`);
        }

        const data = await response.json();
        
        // Handle different response structures
        let records = [];
        if (options.type === 'offers') {
          records = data.offers || [];
        } else if (options.type === 'sales') {
          records = data.sales || [];
        }
        
        updateProgress(`Found ${records.length} records in response`);
        
        if (records.length === 0) {
          updateProgress(`No records found. Stopping pagination.`);
          hasMore = false;
          break;
        }

        // Add metadata to records for client-side saving
        const recordsWithMetadata = records.map((record: any) => ({
          ...record,
          integrationId,
          dataType: options.type,
          fetchedAt: new Date().toISOString(),
          syncedAt: new Date().toISOString(),
          original_id: record.id || record.offer_id || record.sale_id
        }));

        fetchedData.push(...recordsWithMetadata);
        totalProcessed += records.length;

        updateProgress(`Page ${currentPage} completed. Processed ${records.length} records (Total: ${totalProcessed})`);

        // Simple pagination logic
        const pageSummary = data.page_summary || {};
        const hasNextPage = pageSummary.page_number < pageSummary.total_pages;
        
        if (!hasNextPage || records.length === 0) {
          updateProgress(`Reached end of data. Current page: ${currentPage}, Total pages: ${pageSummary.total_pages || 'unknown'}`);
          hasMore = false;
        }

        currentPage++;

        // Add delay between requests
        if (hasMore) {
          await new Promise(resolve => setTimeout(resolve, 1000));
        }

      } catch (pageError: any) {
        totalErrors++;
        updateProgress(`Error on page ${currentPage}: ${pageError.message}`);
        
        if (totalErrors >= 3) {
          throw new Error(`Too many errors (${totalErrors}). Stopping fetch.`);
        }
        
        currentPage++;
        await new Promise(resolve => setTimeout(resolve, 5000));
      }
    }

    // Final update with completion status and data for client-side saving
    updateProgress(
      `Fetch completed! Total processed: ${totalProcessed}, Errors: ${totalErrors}. Data ready for client-side saving.`,
      true
    );

  } catch (error: any) {
    console.error('Fatal error during data fetch:', error);
    updateProgress(`Fatal error: ${error.message}`, true);
  } finally {
    controller.close();
  }
}
