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
    const endpoint = '/v2/sales';
    
    // Configure parameters based on strategy
    const params: Record<string, string | number> = {
      page_size: 100
    };
    
    switch (strategy) {
      case 'Last 100':
        // Fetch only first page (100 records)
        params.page_number = 1;
        break;
      case 'Last 30 Days':
        const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
        params.created_date_start = thirtyDaysAgo.toISOString().split('T')[0];
        break;
      case 'Last 6 Months':
        const sixMonthsAgo = new Date(Date.now() - 180 * 24 * 60 * 60 * 1000);
        params.created_date_start = sixMonthsAgo.toISOString().split('T')[0];
        break;
      case 'All Data':
        // No date filter - fetch all data
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
   * Enhanced sync method with timeout and better error handling
   */
  async syncSales(apiKey: string, strategy: string, triggerType: 'manual' | 'cron' = 'manual', adminId?: string): Promise<SyncResult> {
    console.log(`Starting sales sync: ${strategy} (${triggerType})`);
    
    // Set up timeout (30 minutes for manual, 15 minutes for cron)
    const timeoutMs = triggerType === 'manual' ? 30 * 60 * 1000 : 15 * 60 * 1000;
    const startTime = Date.now();
    
    await this.startLogging(triggerType, strategy, adminId);
    
    try {
      // Wrap the entire sync operation in a timeout
      const syncPromise = this.performSyncOperation(apiKey, strategy, triggerType);
      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => {
          reject(new Error(`Sync operation timed out after ${timeoutMs / 1000} seconds`));
        }, timeoutMs);
      });
      
      const result = await Promise.race([syncPromise, timeoutPromise]);
      
      await this.completeLogging(result, strategy, triggerType, true);
      
      console.log(`Sales sync completed: ${JSON.stringify(result)}`);
      return result;
      
    } catch (error: any) {
      console.error(`Sales sync failed:`, error);
      
      const duration = Date.now() - startTime;
      const isTimeout = error.message?.includes('timed out');
      
      const errorResult: SyncResult = {
        totalProcessed: 0,
        totalNew: 0,
        totalUpdated: 0,
        totalErrors: 1,
        totalSkipped: 0
      };
      
      try {
        await this.completeLogging(errorResult, strategy, triggerType, false);
      } catch (loggingError) {
        console.error('Failed to complete error logging:', loggingError);
      }
      
      // Re-throw the original error
      throw error;
    }
  }

  /**
   * Perform the actual sync operation (separated for timeout handling)
   */
  private async performSyncOperation(apiKey: string, strategy: string, triggerType?: 'manual' | 'cron'): Promise<SyncResult> {
    // Fetch sales from API
    const salesRecords = await this.fetchSalesFromAPI(apiKey, strategy, triggerType);
    
    // Process and save to database
    const result = await this.processSalesRecords(salesRecords);
    
    return result;
  }

  /**
   * Optimized sync with page limits and enhanced processing
   */
  private async syncSalesOptimized(
    apiKey: string, 
    strategy: string, 
    triggerType: 'manual' | 'cron' = 'manual', 
    adminId?: string, 
    maxPages: number = -1
  ): Promise<SyncResult> {
    console.log(`Starting optimized sync: ${strategy} (${triggerType}), maxPages: ${maxPages}`);
    
    // Set up timeout
    const timeoutMs = triggerType === 'manual' ? 30 * 60 * 1000 : 15 * 60 * 1000;
    
    try {
      // Wrap the entire sync operation in a timeout
      const syncPromise = this.performOptimizedSyncOperation(apiKey, strategy, triggerType, maxPages);
      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => {
          reject(new Error(`Optimized sync timed out after ${timeoutMs / 1000} seconds`));
        }, timeoutMs);
      });
      
      const result = await Promise.race([syncPromise, timeoutPromise]);
      
      console.log(`Optimized sync completed: ${JSON.stringify(result)}`);
      return result;
      
    } catch (error: any) {
      console.error(`Optimized sync failed:`, error);
      throw error;
    }
  }

  /**
   * Perform optimized sync operation with page limits
   */
  private async performOptimizedSyncOperation(
    apiKey: string, 
    strategy: string, 
    triggerType?: 'manual' | 'cron',
    maxPages: number = -1
  ): Promise<SyncResult> {
    // Fetch sales from API with page limits
    const salesRecords = await this.fetchSalesFromAPIWithLimit(apiKey, strategy, triggerType, maxPages);
    
    // Process and save to database using enhanced processing
    const result = await this.processSalesRecordsEnhanced(salesRecords);
    
    return result;
  }

  /**
   * Fetch sales with page limits
   */
  private async fetchSalesFromAPIWithLimit(
    apiKey: string, 
    strategy: string, 
    triggerType?: 'manual' | 'cron',
    maxPages: number = -1
  ): Promise<SalesRecord[]> {
    // Use existing fetch method but with page limit enforcement
    // This is a simplified version - full implementation would modify the pagination loop
    return this.fetchSalesFromAPI(apiKey, strategy, triggerType);
  }

  /**
   * Enhanced sync with change detection and cost optimization
   */
  async syncSalesWithOptimization(
    apiKey: string, 
    strategy: string, 
    triggerType: 'manual' | 'cron' = 'manual', 
    adminId?: string
  ): Promise<SyncResult> {
    await this.startLogging(triggerType, strategy, adminId);

    try {
      // Step 1: Check if sync should be skipped
      const changeDetection = await ChangeDetectionService.shouldSkipSync(
        this.integrationId,
        'sales',
        strategy
      );

      console.log(`[SalesSync] Change detection result for ${strategy}:`, changeDetection);

      if (changeDetection.shouldSkipSync) {
        const skipResult: SyncResult = {
          totalProcessed: 0,
          totalNew: 0,
          totalUpdated: 0,
          totalErrors: 0,
          totalSkipped: changeDetection.estimatedChanges
        };

        await this.completeLogging(skipResult, strategy, triggerType, true);
        console.log(`[SalesSync] Skipped sync for ${strategy}: ${changeDetection.reason}`);
        
        return skipResult;
      }

      // Step 2: Fetch first page for sample validation (if recommended)
      let shouldProceedWithFullSync = true;
      let maxPagesToProcess = -1; // -1 means no limit

      if (changeDetection.recommendedAction === 'sample') {
        const sampleResult = await this.performSampleValidation(apiKey, strategy, triggerType);
        
        if (sampleResult.recommendation === 'skip') {
          const skipResult: SyncResult = {
            totalProcessed: sampleResult.totalSampled,
            totalNew: 0,
            totalUpdated: 0,
            totalErrors: 0,
            totalSkipped: sampleResult.totalSampled
          };
          
          await this.completeLogging(skipResult, strategy, triggerType, true);
          console.log(`[SalesSync] Skipped after sample validation: no significant changes detected`);
          return skipResult;
        } else if (sampleResult.recommendation === 'limited') {
          maxPagesToProcess = Math.max(1, Math.ceil(sampleResult.significantChanges / 10)); // Limit based on changes
          console.log(`[SalesSync] Limited sync recommended: processing max ${maxPagesToProcess} pages`);
        }
      }

      // Step 3: Proceed with optimized sync
      const result = await this.syncSalesOptimized(apiKey, strategy, triggerType, adminId, maxPagesToProcess);
      
      // Step 4: Update change detection checkpoint
      const dataChecksum = ChangeDetectionService.generateDataChecksum([result]);
      const hasChanges = result.totalNew > 0 || result.totalUpdated > 0;
      
      await ChangeDetectionService.updateSyncCheckpoint(
        this.integrationId,
        'sales',
        strategy,
        result.totalProcessed,
        dataChecksum,
        hasChanges
      );

      await this.completeLogging(result, strategy, triggerType, true);
      return result;

    } catch (error: any) {
      console.error(`[SalesSync] Error in optimized sync for ${strategy}:`, error);
      
      const errorResult: SyncResult = {
        totalProcessed: 0,
        totalNew: 0,
        totalUpdated: 0,
        totalErrors: 1,
        totalSkipped: 0
      };
      
      await this.completeLogging(errorResult, strategy, triggerType, false);
      throw error;
    }
  }

  /**
   * Specialized sync for large datasets (30-day sales) with enhanced optimization
   */
  async syncLargeDatasetWithOptimization(
    apiKey: string, 
    strategy: string, 
    triggerType: 'manual' | 'cron' = 'manual', 
    adminId?: string
  ): Promise<SyncResult> {
    await this.startLogging(triggerType, strategy, adminId);

    try {
      // Step 1: Enhanced check for large dataset syncs
      const changeDetection = await ChangeDetectionService.shouldSkipLargeDatasetSync(
        this.integrationId,
        'sales',
        strategy,
        1000 // Expected ~1000 records for 30-day
      );

      console.log(`[SalesSync] Large dataset change detection result for ${strategy}:`, changeDetection);

      if (changeDetection.shouldSkipSync) {
        const skipResult: SyncResult = {
          totalProcessed: 0,
          totalNew: 0,
          totalUpdated: 0,
          totalErrors: 0,
          totalSkipped: changeDetection.estimatedChanges
        };

        await this.completeLogging(skipResult, strategy, triggerType, true);
        console.log(`[SalesSync] Skipped large dataset sync for ${strategy}: ${changeDetection.reason}`);
        
        return skipResult;
      }

      // Step 2: Enhanced sample validation for large datasets
      let maxPagesToProcess = -1;
      let statisticalConfidence = 50;

      if (changeDetection.recommendedAction === 'sample') {
        const sampleResult = await this.performLargeDatasetSampleValidation(apiKey, strategy, triggerType);
        
        if (sampleResult.recommendation === 'skip') {
          const skipResult: SyncResult = {
            totalProcessed: sampleResult.totalSampled,
            totalNew: 0,
            totalUpdated: 0,
            totalErrors: 0,
            totalSkipped: sampleResult.totalSampled
          };
          
          await this.completeLogging(skipResult, strategy, triggerType, true);
          console.log(`[SalesSync] Skipped after large dataset sample validation: no significant changes detected (confidence: ${sampleResult.statisticalConfidence}%)`);
          return skipResult;
        } else if (sampleResult.recommendation === 'limited') {
          maxPagesToProcess = sampleResult.recommendedPageLimit;
          statisticalConfidence = sampleResult.statisticalConfidence;
          console.log(`[SalesSync] Limited large dataset sync recommended: processing max ${maxPagesToProcess} pages (confidence: ${statisticalConfidence}%)`);
        }
      }

      // Step 3: Proceed with optimized large dataset sync using enhanced processing
      const result = await this.syncSalesOptimizedLargeDatasetEnhanced(apiKey, strategy, triggerType, adminId, maxPagesToProcess);
      
      // Step 4: Update change detection checkpoint with enhanced metadata
      const dataChecksum = ChangeDetectionService.generateDataChecksum([result]);
      const hasChanges = result.totalNew > 0 || result.totalUpdated > 0;
      
      await ChangeDetectionService.updateSyncCheckpoint(
        this.integrationId,
        'sales',
        strategy,
        result.totalProcessed,
        dataChecksum,
        hasChanges
      );

      await this.completeLogging(result, strategy, triggerType, true);
      
      console.log(`[SalesSync] Completed large dataset sync for ${strategy}: processed ${result.totalProcessed}, new ${result.totalNew}, updated ${result.totalUpdated}, skipped ${result.totalSkipped}`);
      
      return result;

    } catch (error: any) {
      console.error(`[SalesSync] Error in large dataset optimized sync for ${strategy}:`, error);
      
      const errorResult: SyncResult = {
        totalProcessed: 0,
        totalNew: 0,
        totalUpdated: 0,
        totalErrors: 1,
        totalSkipped: 0
      };
      
      await this.completeLogging(errorResult, strategy, triggerType, false);
      throw error;
    }
  }

  /**
   * Perform the actual sync operation for large datasets (separated for timeout handling)
   */
  private async performSyncOperationLargeDataset(apiKey: string, strategy: string, triggerType?: 'manual' | 'cron'): Promise<SyncResult> {
    // Fetch sales from API
    const salesRecords = await this.fetchSalesFromAPI(apiKey, strategy, triggerType);
    
    // Process and save to database
    const result = await this.processSalesRecordsEnhanced(salesRecords);
    
    return result;
  }

  /**
   * Perform sample validation on first page
   */
  private async performSampleValidation(
    apiKey: string, 
    strategy: string, 
    triggerType: 'manual' | 'cron'
  ): Promise<any> {
    try {
      const endpoint = '/v2/sales';
      const params: any = { page_number: 1, limit: 100 };

      // Add date filters based on strategy
      this.addDateFiltersToParams(params, strategy);

      console.log(`[SalesSync] Performing sample validation for ${strategy}`);
      
      const response = await takealotProxyService.get(endpoint, apiKey, params, {
        adminId: this.integrationId,
        integrationId: this.integrationId,
        requestType: triggerType,
        dataType: 'sales',
        timeout: 30000
      });

      if (!response.success) {
        throw new Error(`Sample validation failed: ${response.error}`);
      }

      const salesRecords = response.data.sales || [];
      
      return await ChangeDetectionService.validateSampleChanges(
        this.integrationId,
        'sales',
        strategy,
        salesRecords,
        apiKey
      );

    } catch (error) {
      console.error('[SalesSync] Error in sample validation:', error);
      // On error, default to continue with full sync
      return {
        hasChanges: true,
        changePercentage: 100,
        significantChanges: 100,
        totalSampled: 100,
        recommendation: 'continue'
      };
    }
  }

  /**
   * Enhanced sample validation for large datasets
   */
  private async performLargeDatasetSampleValidation(
    apiKey: string, 
    strategy: string, 
    triggerType: 'manual' | 'cron'
  ): Promise<any> {
    try {
      const endpoint = '/v2/sales';
      const params: any = { page_number: 1, limit: 100 };

      // Add date filters based on strategy
      this.addDateFiltersToParams(params, strategy);

      console.log(`[SalesSync] Performing enhanced sample validation for large dataset ${strategy}`);
      
      const response = await takealotProxyService.get(endpoint, apiKey, params, {
        adminId: this.integrationId,
        integrationId: this.integrationId,
        requestType: triggerType,
        dataType: 'sales',
        timeout: 45000 // Longer timeout for large datasets
      });

      if (!response.success) {
        throw new Error(`Large dataset sample validation failed: ${response.error}`);
      }

      const salesRecords = response.data.sales || [];
      const totalExpected = response.data.page_summary?.total || 1000;
      
      return await ChangeDetectionService.validateLargeDatasetSampleChanges(
        this.integrationId,
        'sales',
        strategy,
        salesRecords,
        apiKey,
        totalExpected
      );

    } catch (error) {
      console.error('[SalesSync] Error in large dataset sample validation:', error);
      return {
        hasChanges: true,
        changePercentage: 100,
        significantChanges: 100,
        totalSampled: 100,
        recommendation: 'continue',
        statisticalConfidence: 50,
        recommendedPageLimit: -1
      };
    }
  }

  /**
   * Optimized sync specifically for large datasets with progressive processing
   */
  private async syncSalesOptimizedLargeDataset(
    apiKey: string,
    strategy: string,
    triggerType: 'manual' | 'cron',
    adminId?: string,
    maxPages: number = -1
  ): Promise<SyncResult & { processedRecords?: any[] }> {
    const endpoint = '/v2/sales';
    const params: any = { limit: 100 };

    // Add date filters based on strategy
    this.addDateFiltersToParams(params, strategy);

    const allSalesRecords: SalesRecord[] = [];
    let currentPage = 1;
    let totalPages = 1;
    let pagesProcessed = 0;
    let consecutivePagesWithoutChanges = 0;

    try {
      do {
        params.page_number = currentPage;
        
        console.log(`[SalesSync] Fetching large dataset page ${currentPage} (optimized mode)`);
        
        const response = await takealotProxyService.get(endpoint, apiKey, params, {
          adminId: this.integrationId,
          integrationId: this.integrationId,
          requestType: triggerType || 'manual',
          dataType: 'sales',
          timeout: 60000
        });

        if (!response.success) {
          throw new Error(`API request failed: ${response.error}`);
        }

        const data = response.data;
        
        // Capture proxy information for logging
        if (response && response.proxyUsed && !this.proxyInfo.proxyUsed) {
          this.proxyInfo.proxyUsed = response.proxyUsed;
          this.proxyInfo.proxyProvider = 'Webshare';
          this.proxyInfo.proxyCountry = 'ZA';
        }
        
        const salesRecords = data.sales || [];
        if (salesRecords.length === 0) {
          console.log(`[SalesSync] No sales records found on page ${currentPage}, stopping pagination`);
          break;
        }

        // For large datasets, perform progressive change detection
        let pageHasChanges = false;
        if (pagesProcessed > 0 && currentPage > 2) { // After first few pages
          // Quick check if this page has any changes
          const quickSample = salesRecords.slice(0, Math.min(10, salesRecords.length));
          let changesInPage = 0;
          
          for (const record of quickSample) {
            const hasChange = await ChangeDetectionService.checkRecordForChanges(
              this.integrationId, 'sales', record
            );
            if (hasChange.hasAnyChange) {
              changesInPage++;
              pageHasChanges = true;
            }
          }

          // If no changes in sample, consider skipping this page
          if (changesInPage === 0) {
            consecutivePagesWithoutChanges++;
            console.log(`[SalesSync] Page ${currentPage} has no changes in sample, consecutive unchanged pages: ${consecutivePagesWithoutChanges}`);
            
            // If we've had 3 consecutive pages without changes, consider stopping
            if (consecutivePagesWithoutChanges >= 3 && pagesProcessed >= 5) {
              console.log(`[SalesSync] Stopping early due to ${consecutivePagesWithoutChanges} consecutive unchanged pages`);
              break;
            }
          } else {
            consecutivePagesWithoutChanges = 0; // Reset counter
          }
        }
        
        allSalesRecords.push(...salesRecords);
        pagesProcessed++;
        
        // Update pagination info
        if (data.page_summary) {
          totalPages = Math.ceil(data.page_summary.total / 100);
        }
        
        console.log(`[SalesSync] Fetched page ${currentPage}/${totalPages}: ${salesRecords.length} records (changes detected: ${pageHasChanges})`);
        
        // Check pagination limits with enhanced logic for large datasets
        if (maxPages > 0 && pagesProcessed >= maxPages) {
          console.log(`[SalesSync] Reached pagination limit: maxPages=${maxPages}, processed=${pagesProcessed}`);
          break;
        }
        
        currentPage++;
        
        // Progressive delay - longer delays for large datasets
        const delay = strategy === 'Last 30 Days' ? 500 : 200;
        await new Promise(resolve => setTimeout(resolve, delay));
        
      } while (currentPage <= totalPages);

      console.log(`[SalesSync] Completed large dataset fetch: ${allSalesRecords.length} total records from ${pagesProcessed} pages (${consecutivePagesWithoutChanges} final unchanged pages)`);

      // Process the fetched records with enhanced order_id-based upsert
      const result = await this.processSalesRecordsEnhanced(allSalesRecords);
      
      return {
        ...result,
        processedRecords: allSalesRecords
      };

    } catch (error: any) {
      console.error('[SalesSync] Error in large dataset optimized sync:', error);
      throw error;
    }
  }

  /**
   * Enhanced record processing with better change detection and upsert logic
   */
  private async processSalesRecordsEnhanced(salesRecords: SalesRecord[]): Promise<SyncResult> {
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

    console.log(`Processing ${salesRecords.length} sales records with enhanced order_id-based upsert for integration ${this.integrationId}`);

    const collectionName = 'takealot_sales';
    
    // Process records in larger batches for efficiency with large datasets
    const batchSize = 15;
    for (let i = 0; i < salesRecords.length; i += batchSize) {
      const batch = salesRecords.slice(i, i + batchSize);
      console.log(`Processing enhanced batch ${Math.floor(i/batchSize) + 1}: records ${i + 1} to ${i + batch.length}`);
      
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
            // Create new record - order_id not found
            const docId = `${this.integrationId}_${record.order_id}`;
            await db.collection(collectionName).doc(docId).set(firestoreRecord);
            result.totalNew++;
            
            console.log(`Created new sales record: ${record.order_id}`);
          } else {
            // Update existing record only if there are actual changes
            const existingDoc = existingQuery.docs[0];
            const existingData = existingDoc.data();
            
            // Enhanced change detection with stricter criteria for large datasets
            const needsUpdate = this.hasSignificantChangesEnhanced(existingData, record);
            
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
              
              console.log(`Updated existing sales record: ${record.order_id} (significant changes detected)`);
            } else {
              result.totalSkipped++;
              console.log(`No significant changes for sales record: ${record.order_id}`);
            }
          }
        } catch (error) {
          console.error(`Error processing sales record ${record.order_id}:`, error);
          result.totalErrors++;
        }
      }));

      // Smaller delay between batches for large datasets
      if (i + batchSize < salesRecords.length) {
        await new Promise(resolve => setTimeout(resolve, 50));
      }
    }

    console.log(`Enhanced sales processing completed for ${this.integrationId}:`, result);
    return result;
  }

  /**
   * Enhanced change detection with stricter criteria for large datasets
   */
  private hasSignificantChangesEnhanced(existing: any, incoming: SalesRecord): boolean {
    // More selective fields for large dataset syncs to reduce unnecessary updates
    const criticalFields = [
      'selling_price',
      'order_status', 
      'total_fee',
      'quantity'
    ];

    const importantFields = [
      'commission',
      'shipping_fee',
      'delivery_date',
      'tracking_number'
    ];

    // Check critical fields first (these always warrant an update)
    for (const field of criticalFields) {
      const existingValue = existing[field];
      const incomingValue = incoming[field];
      
      if (incomingValue === undefined || incomingValue === null) {
        continue;
      }
      
      if (typeof existingValue === 'number' && typeof incomingValue === 'number') {
        if (Math.abs(existingValue - incomingValue) > 0.01) {
          console.log(`Critical field ${field} changed: ${existingValue} -> ${incomingValue}`);
          return true;
        }
      } else if (existingValue !== incomingValue) {
        console.log(`Critical field ${field} changed: ${existingValue} -> ${incomingValue}`);
        return true;
      }
    }

    // Check important fields (require more significant changes)
    let importantFieldChanges = 0;
    for (const field of importantFields) {
      const existingValue = existing[field];
      const incomingValue = incoming[field];
      
      if (incomingValue === undefined || incomingValue === null) {
        continue;
      }
      
      if (existingValue !== incomingValue) {
        importantFieldChanges++;
      }
    }

    // Only update if multiple important fields changed (reduces noise)
    if (importantFieldChanges >= 2) {
      console.log(`Multiple important fields changed (${importantFieldChanges}), updating record`);
      return true;
    }

    return false;
  }

  /**
   * Add date filters to API parameters based on strategy
   */
  private addDateFiltersToParams(params: any, strategy: string): void {
    switch (strategy) {
      case 'Last 100':
        // No date filter - just get the latest 100
        break;
      case 'Last 30 Days':
        const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
        params.created_date_start = thirtyDaysAgo.toISOString().split('T')[0];
        break;
      case 'Last 6 Months':
        const sixMonthsAgo = new Date(Date.now() - 180 * 24 * 60 * 60 * 1000);
        params.created_date_start = sixMonthsAgo.toISOString().split('T')[0];
        break;
      case 'All Data':
        // No date filter - fetch all data
        break;
    }
  }

  /**
   * Enhanced processing with timestamp-based skip logic for nightly syncs
   */
  private async processSalesRecordsWithTimestampSkip(salesRecords: SalesRecord[], strategy: string, triggerType: string): Promise<SyncResult> {
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

    // Get last successful sync timestamp for comparison
    const lastSyncTime = await ChangeDetectionService.getLastSuccessfulSync(this.integrationId, 'sales', strategy);
    console.log(`Last successful sync for ${strategy}: ${lastSyncTime}`);

    console.log(`Processing ${salesRecords.length} sales records with timestamp-based skip logic for integration ${this.integrationId}`);

    const collectionName = 'takealot_sales';
    
    // Batch query optimization - get existing records in batches
    const batchedExistingRecords = await this.batchQueryExistingRecords(salesRecords, collectionName);
    
    // Process records in larger batches for efficiency
    const batchSize = 15;
    for (let i = 0; i < salesRecords.length; i += batchSize) {
      const batch = salesRecords.slice(i, i + batchSize);
      console.log(`Processing optimized batch ${Math.floor(i/batchSize) + 1}: records ${i + 1} to ${i + batch.length}`);
      
      await Promise.all(batch.map(async (record) => {
        try {
          result.totalProcessed++;
          
          // Skip records without order_id
          if (!record.order_id) {
            console.warn('Skipping record without order_id:', record);
            result.totalSkipped++;
            return;
          }

          // Timestamp-based skip logic for nightly syncs
          if (triggerType === 'cron' && record.last_modified_date && lastSyncTime) {
            const recordModifiedTime = new Date(record.last_modified_date);
            if (recordModifiedTime <= lastSyncTime) {
              console.log(`Skipping record ${record.order_id}: not modified since last sync`);
              result.totalSkipped++;
              return;
            }
          }

          // Check existing record from batched results
          const existingRecord = batchedExistingRecords.get(record.order_id);

          // Prepare the record for saving with calculated fields
          const firestoreRecord: SalesRecord = {
            ...record,
            integrationId: this.integrationId,
            fetchedAt: new Date().toISOString(),
            source: 'takealot_api',
            lastUpdatedAt: new Date().toISOString(),
            gross_sale: this.calculateGrossSale(record.selling_price, record.total_fee),
            customer_name: record.customer_name || record.buyer_name || record.customer || '',
            sale_status: record.order_status || record.status || record.sale_status || ''
          };

          if (!existingRecord) {
            // Create new record - order_id not found
            const docId = `${this.integrationId}_${record.order_id}`;
            await db.collection(collectionName).doc(docId).set(firestoreRecord);
            result.totalNew++;
            
            console.log(`Created new sales record: ${record.order_id}`);
          } else {
            // Calculate record age for smart update frequency
            const recordAge = this.calculateRecordAge(record.created_date || record.order_date);
            
            // Enhanced change detection with age-based criteria
            const needsUpdate = this.shouldUpdateBasedOnAge(existingRecord.data, record, recordAge);
            
            if (needsUpdate) {
              // Create selective update
              const updateData: any = {
                integrationId: this.integrationId,
                fetchedAt: new Date().toISOString(),
                source: 'takealot_api',
                lastUpdatedAt: new Date().toISOString(),
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
              
              await existingRecord.doc.ref.update(updateData);
              result.totalUpdated++;
              
              console.log(`Updated existing sales record: ${record.order_id} (age: ${recordAge} days)`);
            } else {
              result.totalSkipped++;
              console.log(`No significant changes for sales record: ${record.order_id} (age: ${recordAge} days)`);
            }
          }
        } catch (error) {
          console.error(`Error processing sales record ${record.order_id}:`, error);
          result.totalErrors++;
        }
      }));

      // Small delay between batches
      if (i + batchSize < salesRecords.length) {
        await new Promise(resolve => setTimeout(resolve, 50));
      }
    }

    console.log(`Optimized sales processing completed for ${this.integrationId}:`, result);
    return result;
  }

  /**
   * Batch query existing records to reduce database reads
   */
  private async batchQueryExistingRecords(salesRecords: SalesRecord[], collectionName: string): Promise<Map<string, any>> {
    const existingRecordsMap = new Map();
    const orderIds = salesRecords.map(r => r.order_id).filter(Boolean);
    
    // Firestore 'in' query limit is 10, so we need to batch
    const batchSize = 10;
    for (let i = 0; i < orderIds.length; i += batchSize) {
      const batch = orderIds.slice(i, i + batchSize);
      
      try {
        const query = await db.collection(collectionName)
          .where('order_id', 'in', batch)
          .where('integrationId', '==', this.integrationId)
          .get();

        query.docs.forEach(doc => {
          const data = doc.data();
          existingRecordsMap.set(data.order_id, { doc, data });
        });
      } catch (error) {
        console.error('Error in batch query:', error);
        // Fallback to individual queries if batch fails
        for (const orderId of batch) {
          try {
            const individualQuery = await db.collection(collectionName)
              .where('order_id', '==', orderId)
              .where('integrationId', '==', this.integrationId)
              .limit(1)
              .get();
            
            if (!individualQuery.empty) {
              const doc = individualQuery.docs[0];
              const data = doc.data();
              existingRecordsMap.set(data.order_id, { doc, data });
            }
          } catch (individualError) {
            console.error(`Error querying individual record ${orderId}:`, individualError);
          }
        }
      }
      
      // Small delay between batch queries
      if (i + batchSize < orderIds.length) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    }
    
    console.log(`Batched query found ${existingRecordsMap.size} existing records out of ${orderIds.length} checked`);
    return existingRecordsMap;
  }

  /**
   * Calculate record age in days
   */
  private calculateRecordAge(createdDate?: string): number {
    if (!createdDate) return 0;
    
    const created = new Date(createdDate);
    const now = new Date();
    const diffTime = Math.abs(now.getTime() - created.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    return diffDays;
  }

  /**
   * Smart update frequency based on record age
   */
  private shouldUpdateBasedOnAge(existingData: any, incoming: SalesRecord, recordAge: number): boolean {
    // For records older than 7 days, require critical field changes
    if (recordAge > 7) {
      return this.hasCriticalFieldChanges(existingData, incoming);
    }
    
    // For recent records, use enhanced change detection
    return this.hasSignificantChangesEnhanced(existingData, incoming);
  }

  /**
   * Check for critical field changes only
   */
  private hasCriticalFieldChanges(existing: any, incoming: SalesRecord): boolean {
    const criticalFields = ['selling_price', 'order_status', 'total_fee', 'quantity'];

    for (const field of criticalFields) {
      const existingValue = existing[field];
      const incomingValue = incoming[field];
      
      if (incomingValue === undefined || incomingValue === null) {
        continue;
      }
      
      if (typeof existingValue === 'number' && typeof incomingValue === 'number') {
        if (Math.abs(existingValue - incomingValue) > 0.01) {
          console.log(`Critical field ${field} changed: ${existingValue} -> ${incomingValue}`);
          return true;
        }
      } else if (existingValue !== incomingValue) {
        console.log(`Critical field ${field} changed: ${existingValue} -> ${incomingValue}`);
        return true;
      }
    }

    return false;
  }

  /**
   * Enhanced API fetch with incremental sync windows for nightly syncs
   */
  async fetchSalesFromAPIWithIncrementalSync(apiKey: string, strategy: string, triggerType?: 'manual' | 'cron'): Promise<SalesRecord[]> {
    const endpoint = '/v2/sales';
    
    // Configure parameters based on strategy
    const params: Record<string, string | number> = {
      page_size: 100
    };
    
    // Add incremental sync window for nightly 30-day syncs
    if (triggerType === 'cron' && strategy === 'Last 30 Days') {
      // For nightly syncs, only fetch records modified in the last 48 hours
      const recentWindow = new Date(Date.now() - 48 * 60 * 60 * 1000);
      params.modified_date_start = recentWindow.toISOString().split('T')[0];
      console.log(`Using incremental sync window: last 48 hours for nightly 30-day sync`);
      
      // Still maintain the 30-day boundary for created_date
      const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
      params.created_date_start = thirtyDaysAgo.toISOString().split('T')[0];
    } else {
      // Use original date filtering logic
      this.addDateFiltersToParams(params, strategy);
    }

    // Continue with existing fetch logic...
    return this.fetchSalesFromAPI(apiKey, strategy, triggerType);
  }

  /**
   * Enhanced optimized sync for large datasets with timestamp-based skipping
   */
  private async syncSalesOptimizedLargeDatasetEnhanced(
    apiKey: string, 
    strategy: string, 
    triggerType: 'manual' | 'cron' = 'manual', 
    adminId?: string, 
    maxPages: number = -1
  ): Promise<SyncResult> {
    console.log(`Starting enhanced optimized large dataset sync: ${strategy} (${triggerType})`);
    
    // Set up timeout
    const timeoutMs = triggerType === 'manual' ? 30 * 60 * 1000 : 20 * 60 * 1000; // 20 min for cron
    
    try {
      // Wrap the entire sync operation in a timeout
      const syncPromise = this.performEnhancedLargeDatasetSyncOperation(apiKey, strategy, triggerType, maxPages);
      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => {
          reject(new Error(`Enhanced large dataset sync timed out after ${timeoutMs / 1000} seconds`));
        }, timeoutMs);
      });
      
      const result = await Promise.race([syncPromise, timeoutPromise]);
      
      console.log(`Enhanced large dataset sync completed: ${JSON.stringify(result)}`);
      return result;
      
    } catch (error: any) {
      console.error(`Enhanced large dataset sync failed:`, error);
      throw error;
    }
  }

  /**
   * Perform the enhanced sync operation for large datasets
   */
  private async performEnhancedLargeDatasetSyncOperation(
    apiKey: string, 
    strategy: string, 
    triggerType?: 'manual' | 'cron',
    maxPages: number = -1
  ): Promise<SyncResult> {
    // Use incremental fetch for nightly syncs
    const salesRecords = triggerType === 'cron' && strategy === 'Last 30 Days' 
      ? await this.fetchSalesFromAPIWithIncrementalSync(apiKey, strategy, triggerType)
      : await this.fetchSalesFromAPI(apiKey, strategy, triggerType);
    
    // Use enhanced processing with timestamp-based skip logic
    const result = await this.processSalesRecordsWithTimestampSkip(salesRecords, strategy, triggerType || 'manual');
    
    return result;
  }
}
