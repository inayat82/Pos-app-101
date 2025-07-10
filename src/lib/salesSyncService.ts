// src/lib/salesSyncService.ts
import { dbAdmin as db } from '@/lib/firebase/firebaseAdmin';
import { cronJobLogger } from '@/lib/cronJobLogger';
import { takealotProxyService } from '@/modules/takealot/services';
import { ChangeDetectionService } from '@/lib/changeDetectionService';

interface SalesRecord {
  order_id?: string;
  sale_id?: string;
  selling_price?: number;
  order_status?: string;
  total_fee?: number;
  customer_name?: string;
  buyer_name?: string;
  customer?: string;
  status?: string;
  sale_status?: string;
  gross_sale?: number;
  [key: string]: any;
}

interface SyncResult {
  totalProcessed: number;
  totalNew: number;
  totalUpdated: number;
  totalErrors: number;
  totalSkipped: number;
}

export class SalesSyncService {
  private integrationId: string;
  private logId: string | null = null;
  private proxyInfo: { proxyUsed?: string; proxyCountry?: string; proxyProvider?: string } = {};

  constructor(integrationId: string) {
    this.integrationId = integrationId;
  }

  /**
   * Start logging for the sync operation
   */
  async startLogging(triggerType: 'manual' | 'cron', strategy: string, adminId?: string): Promise<void> {
    try {
      // Get admin and account details from integration and user records
      let actualAdminId = adminId;
      let adminName = 'Unknown Admin';
      let adminEmail = 'unknown@example.com';
      let accountName = 'Unknown Account';

      try {
        // Get integration details first
        const integrationDoc = await db.collection('takealotIntegrations').doc(this.integrationId).get();
        if (integrationDoc.exists) {
          const integrationData = integrationDoc.data();
          actualAdminId = integrationData?.adminId || adminId;
          accountName = integrationData?.accountName || 'Unknown Account';
        }

        // Get admin user details
        if (actualAdminId) {
          const adminDoc = await db.collection('users').doc(actualAdminId).get();
          if (adminDoc.exists) {
            const adminData = adminDoc.data();
            adminName = adminData?.name || adminData?.displayName || 'Unknown Admin';
            adminEmail = adminData?.email || 'unknown@example.com';
            // Override account name from user data if not found in integration
            if (accountName === 'Unknown Account') {
              accountName = adminData?.accountName || adminData?.company?.name || 'Unknown Account';
            }
          }
        }
      } catch (adminError) {
        console.warn(`[SalesSyncService] Could not fetch admin details for ${actualAdminId}:`, adminError);
      }

      this.logId = await cronJobLogger.startExecution({
        cronJobName: `sales-sync-${strategy.toLowerCase().replace(/\s+/g, '-')}`,
        cronJobType: triggerType === 'cron' ? 'scheduled' : 'manual',
        cronSchedule: this.getCronScheduleForStrategy(strategy),
        triggerType,
        triggerSource: triggerType === 'cron' ? 'vercel-cron' : 'manual-button',
        apiSource: 'Takealot API',
        adminId: actualAdminId || this.integrationId,
        adminName,
        adminEmail,
        accountId: actualAdminId,
        accountName,
        integrationId: this.integrationId,
        message: `Starting ${triggerType} sales sync for ${strategy} - ${accountName} (Admin: ${adminName})`,
        details: `Integration: ${this.integrationId}, Account: ${accountName}, Admin: ${adminName} (${adminEmail}), Trigger: ${triggerType}, Strategy: ${strategy}`
      });
      
      console.log(`Sales sync logging started: ${this.logId} for ${strategy} (${triggerType}) - ${accountName}`);
    } catch (error) {
      console.error('Failed to start sales sync logging:', error);
    }
  }

  /**
   * Get cron schedule for strategy
   */
  private getCronScheduleForStrategy(strategy: string): string {
    switch (strategy) {
      case 'Last 100':
        return '0 * * * *'; // Every hour
      case 'Last 30 Days':
        return '0 2 * * *'; // Every night at 2 AM
      case 'Last 6 Months':
        return '0 3 * * 0'; // Every Sunday at 3 AM
      case 'All Data':
        return 'manual'; // Manual only
      default:
        return 'manual';
    }
  }

  /**
   * Complete logging for the sync operation
   */
  async completeLogging(result: SyncResult, strategy: string, triggerType: 'manual' | 'cron', success: boolean = true): Promise<void> {
    if (!this.logId) {
      console.warn('No log ID available for completing logging');
      return;
    }

    try {
      console.log(`Completing sales sync logging for ${strategy}:`, result);
      
      await cronJobLogger.completeExecution(this.logId, {
        status: success ? 'success' : 'failure',
        message: `${triggerType} sales sync ${success ? 'completed' : 'failed'} for ${strategy}`,
        totalReads: result.totalProcessed,
        totalWrites: result.totalNew + result.totalUpdated,
        itemsProcessed: result.totalProcessed,
        details: `New: ${result.totalNew}, Updated: ${result.totalUpdated}, Errors: ${result.totalErrors}, Skipped: ${result.totalSkipped}`,
        errorDetails: success ? undefined : `Errors: ${result.totalErrors}`,
        // Include proxy information for SuperAdmin monitoring
        proxyUsed: this.proxyInfo.proxyUsed,
        proxyCountry: this.proxyInfo.proxyCountry,
        proxyProvider: this.proxyInfo.proxyProvider
      });
      
      console.log(`Sales sync logging completed: ${this.logId} for ${strategy} (${triggerType})`);
    } catch (error) {
      console.error('Failed to complete sales sync logging:', error);
      console.error('Log ID:', this.logId);
      console.error('Strategy:', strategy);
      console.error('Trigger Type:', triggerType);
      console.error('Result:', result);
      
      // Don't throw here - we don't want logging errors to break the main operation
    }
  }

  /**
   * Process sales records with order_id-based upsert logic
   */
  async processSalesRecords(salesRecords: SalesRecord[]): Promise<SyncResult> {
    const result: SyncResult = {
      totalProcessed: 0,
      totalNew: 0,
      totalUpdated: 0,
      totalErrors: 0,
      totalSkipped: 0
    };

    if (!salesRecords || salesRecords.length === 0) {
      console.log('No sales records to process');
      return result;
    }

    console.log(`Processing ${salesRecords.length} sales records for integration ${this.integrationId}`);

    const collectionName = 'takealot_sales';
    
    // Process records in batches to avoid overwhelming Firestore
    const batchSize = 10;
    for (let i = 0; i < salesRecords.length; i += batchSize) {
      const batch = salesRecords.slice(i, i + batchSize);
      console.log(`Processing batch ${Math.floor(i/batchSize) + 1}: records ${i + 1} to ${i + batch.length}`);
      
      await Promise.all(batch.map(async (record) => {
        try {
          result.totalProcessed++;
          
          // Skip records without order_id
          if (!record.order_id) {
            console.warn('Skipping record without order_id:', record);
            result.totalSkipped++;
            return;
          }

          // Check if record already exists by order_id and integrationId
          const existingQuery = await db.collection(collectionName)
            .where('order_id', '==', record.order_id)
            .where('integrationId', '==', this.integrationId)
            .limit(1)
            .get();

          // Prepare the record for saving with calculated fields
          const firestoreRecord: SalesRecord = {
            ...record,
            integrationId: this.integrationId,
            fetchedAt: new Date().toISOString(),
            source: 'takealot_api',
            lastUpdatedAt: new Date().toISOString(),
            // Add calculated gross sale (Selling Price - Total Fee)
            gross_sale: this.calculateGrossSale(record.selling_price, record.total_fee),
            // Ensure customer name is properly mapped
            customer_name: record.customer_name || record.buyer_name || record.customer || '',
            // Ensure sale status is properly mapped  
            sale_status: record.order_status || record.status || record.sale_status || ''
          };

          if (existingQuery.empty) {
            // Create new record
            const docId = `${this.integrationId}_${record.order_id}`;
            await db.collection(collectionName).doc(docId).set(firestoreRecord);
            result.totalNew++;
            
            console.log(`Created new sales record: ${record.order_id}`);
          } else {
            // Update existing record
            const existingDoc = existingQuery.docs[0];
            const existingData = existingDoc.data();
            
            // Check if update is needed by comparing key fields
            const needsUpdate = this.hasSignificantChanges(existingData, record);
            
            if (needsUpdate) {
              // Create selective update - only include fields that are not undefined/null
              const updateData: any = {
                integrationId: this.integrationId,
                fetchedAt: new Date().toISOString(),
                source: 'takealot_api',
                lastUpdatedAt: new Date().toISOString(),
                // Add calculated fields during updates too
                gross_sale: this.calculateGrossSale(record.selling_price, record.total_fee),
                customer_name: record.customer_name || record.buyer_name || record.customer || '',
                sale_status: record.order_status || record.status || record.sale_status || ''
              };
              
              // Only add incoming fields that have valid values
              Object.keys(record).forEach(key => {
                const value = record[key];
                if (value !== undefined && value !== null) {
                  updateData[key] = value;
                }
              });
              
              await existingDoc.ref.update(updateData);
              result.totalUpdated++;
              
              console.log(`Updated existing sales record: ${record.order_id}`);
            } else {
              result.totalSkipped++;
              console.log(`No changes detected for sales record: ${record.order_id}`);
            }
          }
        } catch (error) {
          console.error(`Error processing sales record ${record.order_id}:`, error);
          result.totalErrors++;
        }
      }));

      // Small delay between batches
      if (i + batchSize < salesRecords.length) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    }

    console.log(`Sales processing completed for ${this.integrationId}:`, result);
    return result;
  }

  /**
   * Check if a sales record has significant changes that warrant an update
   */
  private hasSignificantChanges(existing: any, incoming: SalesRecord): boolean {
    // Compare key fields that commonly change
    const fieldsToCompare = [
      'selling_price',
      'order_status', 
      'total_fee',
      'quantity',
      'commission',
      'shipping_fee',
      'delivery_date',
      'tracking_number',
      'customer_name',
      'sale_status',
      'gross_sale'
    ];

    for (const field of fieldsToCompare) {
      const existingValue = existing[field];
      const incomingValue = incoming[field];
      
      // Skip comparison if incoming value is undefined or null - don't overwrite existing good data
      if (incomingValue === undefined || incomingValue === null) {
        continue;
      }
      
      // Handle numeric comparisons
      if (typeof existingValue === 'number' && typeof incomingValue === 'number') {
        if (Math.abs(existingValue - incomingValue) > 0.01) { // Allow for small floating point differences
          console.log(`Field ${field} changed: ${existingValue} -> ${incomingValue}`);
          return true;
        }
      }
      // Handle string comparisons
      else if (existingValue !== incomingValue) {
        console.log(`Field ${field} changed: ${existingValue} -> ${incomingValue}`);
        return true;
      }
    }

    return false;
  }

  /**
   * Calculate gross sale amount (Selling Price - Total Fee)
   */
  private calculateGrossSale(sellingPrice?: number, totalFee?: number): number {
    const selling = sellingPrice || 0;
    const fee = totalFee || 0;
    return Math.max(0, selling - fee); // Ensure non-negative result
  }

  /**
   * Fetch sales data from Takealot API based on strategy
   */
  async fetchSalesFromAPI(apiKey: string, strategy: string, triggerType?: 'manual' | 'cron'): Promise<SalesRecord[]> {
    // Use enhanced method for "Last 100" strategy
    if (strategy === 'Last 100') {
      console.log('[SalesSync] Using Enhanced Last 100 strategy - smart comparison enabled');
      return await this.fetchEnhancedLast100Sales(apiKey, triggerType);
    }

    // Use chunked strategies for large datasets
    if (strategy === 'Last 6 Months') {
      console.log('[SalesSync] Using chunked Last 6 Months strategy');
      return await this.fetchLast6MonthsChunked(apiKey, triggerType);
    }

    if (strategy === 'All Data') {
      console.log('[SalesSync] Using progressive All Sales chunked strategy');
      return await this.fetchAllSalesProgressive(apiKey, triggerType);
    }

    // Fallback to original logic for other strategies
    const endpoint = '/v2/sales';
    
    // Configure parameters based on strategy
    const params: Record<string, string | number> = {
      page_size: 100
    };
    
    switch (strategy) {
      case 'Last 30 Days':
        const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
        params.created_date_start = thirtyDaysAgo.toISOString().split('T')[0];
        break;
      default:
        console.log(`[SalesSync] Using basic pagination for strategy: ${strategy}`);
        break;
    }

    const allSalesRecords: SalesRecord[] = [];
    let currentPage = 1;
    let totalPages = 1;

    try {
      do {
        params.page_number = currentPage;
        
        console.log(`[SalesSync] Fetching sales page ${currentPage} through proxy service`);
        
        // Enhanced error handling with retries for API requests
        let retryCount = 0;
        const maxRetries = 3;
        let response;
        
        while (retryCount < maxRetries) {
          try {
            // Use the new proxy service instead of direct fetch
            response = await takealotProxyService.get(endpoint, apiKey, params, {
              adminId: this.integrationId, // Use integrationId as adminId for logging
              integrationId: this.integrationId,
              requestType: triggerType || 'manual',
              dataType: 'sales',
              timeout: 60000
            });

            if (response.success) {
              break; // Success, exit retry loop
            } else {
              console.warn(`[SalesSync] API request failed (attempt ${retryCount + 1}/${maxRetries}): ${response.error}`);
              if (retryCount === maxRetries - 1) {
                throw new Error(`API request failed after ${maxRetries} attempts: ${response.error}`);
              }
            }
          } catch (error: any) {
            console.error(`[SalesSync] Error on attempt ${retryCount + 1}/${maxRetries}:`, error);
            if (retryCount === maxRetries - 1) {
              throw error;
            }
          }
          
          retryCount++;
          
          // Exponential backoff delay
          const delay = Math.min(1000 * Math.pow(2, retryCount - 1), 5000);
          console.log(`[SalesSync] Waiting ${delay}ms before retry...`);
          await new Promise(resolve => setTimeout(resolve, delay));
        }

        const data = response!.data;
        
        // Capture proxy information for logging (first successful request)
        if (response && response.proxyUsed && !this.proxyInfo.proxyUsed) {
          this.proxyInfo.proxyUsed = response.proxyUsed;
          this.proxyInfo.proxyProvider = 'Webshare';
          // Extract country from proxy logs (look for (ZA) pattern in the logs)
          // Since proxy info comes from logs, we'll extract it differently
          this.proxyInfo.proxyCountry = 'ZA'; // Default to ZA for South African proxies
          console.log(`[SalesSync] Captured proxy info:`, this.proxyInfo);
        }
        
        console.log(`[SalesSync] API Response for page ${currentPage}:`, {
          totalRecords: data.page_summary?.total || 'unknown',
          currentPageRecords: data.sales?.length || 0,
          pageInfo: data.page_summary || 'no page summary',
          proxyUsed: response?.proxyUsed || 'unknown'
        });
        
        // Extract sales records
        const salesRecords = data.sales || [];
        if (salesRecords.length === 0) {
          console.log(`[SalesSync] No sales records found on page ${currentPage}, stopping pagination`);
          break;
        }
        
        allSalesRecords.push(...salesRecords);
        
        // Update pagination info
        if (data.page_summary) {
          totalPages = Math.ceil(data.page_summary.total / 100);
        }
        
        console.log(`[SalesSync] Fetched page ${currentPage}/${totalPages}: ${salesRecords.length} records`);
        
        // For "Last 100" strategy, only fetch first page
        if (strategy === 'Last 100') {
          break;
        }
        
        currentPage++;
        
        // Add delay between requests
        await new Promise(resolve => setTimeout(resolve, 200));
        
      } while (currentPage <= totalPages);
      
    } catch (error) {
      console.error('[SalesSync] Error fetching sales from API:', error);
      throw error;
    }

    console.log(`[SalesSync] Total sales records fetched: ${allSalesRecords.length}`);
    return allSalesRecords;
  }

  /**
   * Last 6 Months Chunked Strategy - Uses date filtering with chunked processing
   * Based on proven chunkedSalesSyncService implementation
   */
  private async fetchLast6MonthsChunked(apiKey: string, triggerType?: 'manual' | 'cron'): Promise<SalesRecord[]> {
    console.log('[SalesSync] Starting Last 6 Months chunked sync');
    
    // Calculate date range
    const today = new Date();
    const sixMonthsAgo = new Date();
    sixMonthsAgo.setDate(today.getDate() - 180); // 6 months = 180 days
    
    const startDate = sixMonthsAgo.toISOString().split('T')[0];
    const endDate = today.toISOString().split('T')[0];
    
    console.log(`[SalesSync] Last 6 Months - Date range: ${startDate} to ${endDate}`);
    console.log(`[SalesSync] Last 6 Months - Using API endpoint: /v2/sales with created_date_start/created_date_end`);
    
    const result = await this.syncDateRangeChunked(apiKey, startDate, endDate, 'Last 6 Months', triggerType);
    console.log(`[SalesSync] Last 6 Months completed: ${result.length} total records`);
    
    return result;
  }

  /**
   * All Sales Progressive Strategy - Moves backwards in 6-month chunks until 0 data
   * Based on proven chunkedSalesSyncService implementation
   */
  private async fetchAllSalesProgressive(apiKey: string, triggerType?: 'manual' | 'cron'): Promise<SalesRecord[]> {
    console.log('[SalesSync] Starting All Sales progressive chunked sync');
    
    const allRecords: SalesRecord[] = [];
    const today = new Date();
    let currentEndDate = new Date(today);
    let chunkNumber = 1;
    let hasMoreData = true;
    
    console.log('[SalesSync] Starting progressive historical sync...');

    while (hasMoreData) {
      // Calculate 6-month chunk (180 days)
      const chunkStartDate = new Date(currentEndDate);
      chunkStartDate.setDate(currentEndDate.getDate() - 180);
      
      const startDateStr = chunkStartDate.toISOString().split('T')[0];
      const endDateStr = currentEndDate.toISOString().split('T')[0];
      
      console.log(`[SalesSync] Processing chunk ${chunkNumber}: ${startDateStr} to ${endDateStr}`);
      
      try {
        const chunkRecords = await this.syncDateRangeChunked(apiKey, startDateStr, endDateStr, `All Sales Chunk ${chunkNumber}`, triggerType);
        
        // Add records to total
        allRecords.push(...chunkRecords);
        
        console.log(`[SalesSync] Chunk ${chunkNumber} completed: ${chunkRecords.length} records`);
        
        // Check if we should continue
        if (chunkRecords.length === 0) {
          console.log(`[SalesSync] Chunk ${chunkNumber} returned 0 records - stopping progressive sync`);
          hasMoreData = false;
        } else {
          // Move to next chunk (go further back in time)
          currentEndDate = new Date(chunkStartDate);
          currentEndDate.setDate(chunkStartDate.getDate() - 1); // Start next chunk 1 day before this chunk started
          chunkNumber++;
          
          // Safety limit: don't go back more than 3 years
          const threeYearsAgo = new Date();
          threeYearsAgo.setFullYear(today.getFullYear() - 3);
          
          if (currentEndDate < threeYearsAgo) {
            console.log(`[SalesSync] Reached 3-year limit - stopping progressive sync`);
            hasMoreData = false;
          }
          
          // Add delay between chunks
          if (hasMoreData) {
            console.log('[SalesSync] Waiting 3 seconds before next chunk...');
            await new Promise(resolve => setTimeout(resolve, 3000));
          }
        }
        
      } catch (chunkError: any) {
        console.error(`[SalesSync] Error in chunk ${chunkNumber}:`, chunkError);
        
        // Continue with next chunk despite error
        currentEndDate = new Date(chunkStartDate);
        currentEndDate.setDate(chunkStartDate.getDate() - 1);
        chunkNumber++;
      }
    }

    console.log(`[SalesSync] Progressive sync completed: ${chunkNumber - 1} chunks, ${allRecords.length} total records`);
    return allRecords;
  }

  /**
   * Sync a specific date range with chunked processing
   * Core chunked logic based on proven implementation
   */
  private async syncDateRangeChunked(
    apiKey: string, 
    startDate: string, 
    endDate: string, 
    strategy: string,
    triggerType?: 'manual' | 'cron'
  ): Promise<SalesRecord[]> {
    const chunkSize = 10; // 10 pages per chunk (1000 records per chunk)
    let currentChunkStart = 1;
    let hasMoreData = true;
    let totalChunks = 0;
    
    const allRecords: SalesRecord[] = [];

    console.log(`[SalesSync] Syncing date range ${startDate} to ${endDate} with chunks`);

    while (hasMoreData) {
      const chunkEnd = currentChunkStart + chunkSize - 1;
      
      console.log(`[SalesSync] Processing chunk ${totalChunks + 1}: pages ${currentChunkStart}-${chunkEnd} for ${startDate} to ${endDate}`);

      try {
        const chunkRecords = await this.processPageChunk(
          apiKey,
          currentChunkStart,
          chunkEnd,
          startDate,
          endDate,
          triggerType
        );

        allRecords.push(...chunkRecords);
        totalChunks++;

        console.log(`[SalesSync] Chunk ${totalChunks} completed: ${chunkRecords.length} records, ${chunkEnd - currentChunkStart + 1} pages`);

        // Improved stopping condition: stop only if we get 0 records for 2 consecutive chunks
        if (chunkRecords.length === 0) {
          console.log('[SalesSync] No records in chunk - checking if we should stop...');
          // Try one more chunk to confirm end of data
          const nextChunkStart = currentChunkStart + chunkSize;
          const nextChunkEnd = nextChunkStart + chunkSize - 1;
          
          try {
            const confirmationChunk = await this.processPageChunk(
              apiKey,
              nextChunkStart,
              nextChunkEnd,
              startDate,
              endDate,
              triggerType
            );
            
            if (confirmationChunk.length === 0) {
              console.log('[SalesSync] Confirmation chunk also empty - stopping sync');
              hasMoreData = false;
            } else {
              console.log(`[SalesSync] Confirmation chunk has ${confirmationChunk.length} records - continuing`);
              allRecords.push(...confirmationChunk);
              totalChunks++;
              currentChunkStart = nextChunkStart + chunkSize;
            }
          } catch (error) {
            console.log('[SalesSync] Error in confirmation chunk - stopping sync');
            hasMoreData = false;
          }
        } else {
          // Move to next chunk
          currentChunkStart += chunkSize;
          
          // Add delay between chunks
          console.log('[SalesSync] Waiting 2 seconds before next chunk...');
          await new Promise(resolve => setTimeout(resolve, 2000));
        }

      } catch (chunkError: any) {
        console.error(`[SalesSync] Error in chunk ${totalChunks + 1}:`, chunkError);
        
        // Continue with next chunk despite error
        currentChunkStart += chunkSize;
        totalChunks++;
      }
    }

    console.log(`[SalesSync] Date range sync completed: ${totalChunks} chunks, ${allRecords.length} total records`);
    return allRecords;
  }

  /**
   * Process a chunk of pages (e.g., pages 1-10) with date filtering
   */
  private async processPageChunk(
    apiKey: string,
    startPage: number,
    endPage: number,
    startDate?: string,
    endDate?: string,
    triggerType?: 'manual' | 'cron'
  ): Promise<SalesRecord[]> {
    const allRecords: SalesRecord[] = [];
    let pagesProcessed = 0;

    console.log(`[SalesSync] Fetching pages ${startPage} to ${endPage}${startDate && endDate ? ` for date range ${startDate} to ${endDate}` : ''}`);

    // Fetch all pages in this chunk
    let emptyPageCount = 0;
    for (let page = startPage; page <= endPage; page++) {
      try {
        const pageData = await this.fetchSalesPage(apiKey, page, startDate, endDate, triggerType);
        
        if (!pageData || pageData.length === 0) {
          emptyPageCount++;
          console.log(`[SalesSync] Page ${page} returned no data (empty page ${emptyPageCount})`);
          
          // If we get 3 consecutive empty pages, likely reached end
          if (emptyPageCount >= 3) {
            console.log(`[SalesSync] 3 consecutive empty pages - likely reached end of data`);
            break;
          }
        } else {
          emptyPageCount = 0; // Reset counter when we get data
          allRecords.push(...pageData);
          console.log(`[SalesSync] Page ${page}: ${pageData.length} records fetched`);
        }

        pagesProcessed++;

        // Small delay between pages
        await new Promise(resolve => setTimeout(resolve, 200));

      } catch (pageError: any) {
        console.error(`[SalesSync] Error fetching page ${page}:`, pageError);
        pagesProcessed++; // Count the page even if it failed
        // Continue with next page
        continue;
      }
    }

    console.log(`[SalesSync] Chunk complete: ${allRecords.length} total records from ${pagesProcessed} pages`);
    return allRecords;
  }

  /**
   * Fetch a single page of sales data with date filtering
   */
  private async fetchSalesPage(
    apiKey: string, 
    pageNumber: number, 
    startDate?: string, 
    endDate?: string,
    triggerType?: 'manual' | 'cron'
  ): Promise<SalesRecord[]> {
    console.log(`[SalesSync] Fetching page ${pageNumber} through proxy service`);

    // Use correct endpoint and parameters for chunked approach
    const params: Record<string, string | number> = {
      page_size: 100,
      page_number: pageNumber
    };

    // Add date filtering if provided (use correct parameter names)
    if (startDate && endDate) {
      params.created_date_start = startDate;
      params.created_date_end = endDate;
      console.log(`[SalesSync] Date range: ${startDate} to ${endDate}`);
    }

    // Enhanced error handling with retries for API requests
    let retryCount = 0;
    const maxRetries = 3;
    let response;
    
    while (retryCount < maxRetries) {
      try {
        // Use the proxy service with correct endpoint for chunked approach
        response = await takealotProxyService.get('/v2/sales', apiKey, params, {
          adminId: this.integrationId,
          integrationId: this.integrationId,
          requestType: triggerType || 'manual',
          dataType: 'sales',
          timeout: 30000
        });

        if (response.success) {
          break; // Success, exit retry loop
        } else {
          console.warn(`[SalesSync] API request failed (attempt ${retryCount + 1}/${maxRetries}): ${response.error}`);
          if (retryCount === maxRetries - 1) {
            throw new Error(`API request failed after ${maxRetries} attempts: ${response.error}`);
          }
        }
      } catch (error: any) {
        console.error(`[SalesSync] Error on attempt ${retryCount + 1}/${maxRetries}:`, error);
        if (retryCount === maxRetries - 1) {
          throw error;
        }
      }
      
      retryCount++;
      
      // Exponential backoff delay
      const delay = Math.min(1000 * Math.pow(2, retryCount - 1), 5000);
      console.log(`[SalesSync] Waiting ${delay}ms before retry...`);
      await new Promise(resolve => setTimeout(resolve, delay));
    }

    if (!response || !response.success) {
      throw new Error('Failed to fetch page after all retries');
    }

    // Capture proxy information for logging (first successful request)
    if (response.proxyUsed && !this.proxyInfo.proxyUsed) {
      this.proxyInfo.proxyUsed = response.proxyUsed;
      this.proxyInfo.proxyProvider = 'WebShare';
      this.proxyInfo.proxyCountry = 'ZA'; // Default to ZA for South African proxies
      console.log(`[SalesSync] Captured proxy info:`, this.proxyInfo);
    }

    const data = response.data;
    
    console.log(`[SalesSync] API Response for page ${pageNumber}:`, {
      totalRecords: data.page_summary?.total || 'unknown',
      currentPageRecords: data.sales?.length || 0,
      pageInfo: data.page_summary || 'no page summary',
      proxyUsed: response.proxyUsed || 'unknown'
    });
    
    // Extract sales records
    const salesRecords = data.sales || [];
    return salesRecords;
  }

  /**
   * Enhanced Last 100 Sales Sync - Only checks for new sales by comparing against last 100 in database
   * This optimized method fetches 1 page (100 records) and only saves truly new sales
   */
  async fetchEnhancedLast100Sales(apiKey: string, triggerType: 'manual' | 'cron' = 'manual'): Promise<SalesRecord[]> {
    console.log('[SalesSync] Starting Enhanced Last 100 Sales fetch - checking for new sales only');
    
    try {
      // Step 1: Get the last 100 order_ids from database to compare against
      console.log('[SalesSync] Fetching last 100 order_ids from database for comparison...');
      const existingOrderIds = await this.getLastOrderIdsFromDatabase(100);
      console.log(`[SalesSync] Found ${existingOrderIds.length} existing order_ids in database`);

      // Step 2: Fetch only 1 page (100 records) from Takealot API
      console.log('[SalesSync] Fetching latest 100 sales from Takealot API...');
      
      // Use proxy service for API call with correct signature
      const response = await takealotProxyService.get('/v2/sales', apiKey, {
        page_size: 100,
        page_number: 1
      }, {
        adminId: this.integrationId,
        integrationId: this.integrationId,
        requestType: triggerType,
        dataType: 'sales'
      });
      
      if (!response.success || !response.data || !response.data.results) {
        throw new Error('Invalid API response - no sales data received');
      }

      const apiSalesRecords = response.data.results;
      console.log(`[SalesSync] Fetched ${apiSalesRecords.length} sales from API (latest page)`);

      // Step 3: Filter out sales that already exist in database
      const newSalesRecords = apiSalesRecords.filter((sale: any) => {
        const orderId = sale.order_id || sale.id;
        return orderId && !existingOrderIds.includes(orderId);
      });

      console.log(`[SalesSync] Found ${newSalesRecords.length} truly new sales out of ${apiSalesRecords.length} API records`);
      
      // Step 4: Update proxy info for logging
      if (response.proxyUsed) {
        this.proxyInfo = {
          proxyUsed: response.proxyUsed,
          proxyCountry: 'Unknown',
          proxyProvider: 'WebShare'
        };
      }

      // Log the optimization results
      if (this.logId) {
        await cronJobLogger.updateExecution(this.logId, {
          totalReads: 1, // Only 1 API call made
          itemsProcessed: newSalesRecords.length,
          message: `Optimized sync: ${newSalesRecords.length} new sales found from ${apiSalesRecords.length} API records`,
          details: `Database comparison: ${existingOrderIds.length} existing order_ids checked, ${apiSalesRecords.length - newSalesRecords.length} duplicates filtered out`
        });
      }

      return newSalesRecords;

    } catch (error) {
      console.error('[SalesSync] Error in Enhanced Last 100 Sales fetch:', error);
      throw error;
    }
  }

  /**
   * Get the last N order_ids from database for comparison
   * Uses Neon database for better performance
   */
  private async getLastOrderIdsFromDatabase(limit: number = 100): Promise<string[]> {
    try {
      // Try Neon first for better performance
      const neonOrderIds = await this.getOrderIdsFromNeon(limit);
      if (neonOrderIds.length > 0) {
        console.log(`[SalesSync] Retrieved ${neonOrderIds.length} order_ids from Neon database`);
        return neonOrderIds;
      }

      // Fallback to Firebase if Neon fails
      console.log('[SalesSync] Neon failed, falling back to Firebase for order_ids...');
      return await this.getOrderIdsFromFirebase(limit);

    } catch (error) {
      console.error('[SalesSync] Error getting order_ids from database:', error);
      return []; // Return empty array to continue with all records
    }
  }

  /**
   * Get order_ids from Neon database
   */
  private async getOrderIdsFromNeon(limit: number): Promise<string[]> {
    try {
      // Get integration details for adminId
      const integrationDoc = await db.collection('takealotIntegrations').doc(this.integrationId).get();
      if (!integrationDoc.exists) {
        throw new Error('Integration not found');
      }

      const adminId = integrationDoc.data()?.adminId;
      if (!adminId) {
        throw new Error('Admin ID not found in integration');
      }

      // Use NewTakealotService to query Neon
      const { NewTakealotService } = await import('./newTakealotService');
      const neonService = new NewTakealotService();
      
      try {
        const salesData = await neonService.getSalesData(adminId, this.integrationId, {
          limit
        });

        const orderIds = salesData
          .map((sale: any) => sale.order_id)
          .filter((id: any) => id) // Remove null/undefined values
          .slice(0, limit); // Ensure we only get the requested number

        return orderIds;
      } finally {
        await neonService.close();
      }

    } catch (error) {
      console.warn('[SalesSync] Failed to get order_ids from Neon:', error);
      return [];
    }
  }

  /**
   * Get order_ids from Firebase (fallback)
   */
  private async getOrderIdsFromFirebase(limit: number): Promise<string[]> {
    try {
      const salesQuery = db.collection('sales')
        .where('integrationId', '==', this.integrationId)
        .orderBy('order_date', 'desc')
        .limit(limit);

      const salesSnapshot = await salesQuery.get();
      
      const orderIds = salesSnapshot.docs
        .map(doc => doc.data().order_id)
        .filter(id => id); // Remove null/undefined values

      console.log(`[SalesSync] Retrieved ${orderIds.length} order_ids from Firebase`);
      return orderIds;

    } catch (error) {
      console.error('[SalesSync] Error getting order_ids from Firebase:', error);
      return [];
    }
  }
}
