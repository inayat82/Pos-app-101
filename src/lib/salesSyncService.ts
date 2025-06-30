// src/lib/salesSyncService.ts
import { dbAdmin as db } from '@/lib/firebase/firebaseAdmin';
import { cronJobLogger } from '@/lib/cronJobLogger';

interface SalesRecord {
  order_id?: string;
  sale_id?: string;
  selling_price?: number;
  order_status?: string;
  total_fee?: number;
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
        errorDetails: success ? undefined : `Errors: ${result.totalErrors}`
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

          // Prepare the record for saving
          const firestoreRecord: SalesRecord = {
            ...record,
            integrationId: this.integrationId,
            fetchedAt: new Date().toISOString(),
            source: 'takealot_api',
            lastUpdatedAt: new Date().toISOString()
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
                lastUpdatedAt: new Date().toISOString()
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
      'tracking_number'
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
   * Fetch sales data from Takealot API based on strategy
   */
  async fetchSalesFromAPI(apiKey: string, strategy: string): Promise<SalesRecord[]> {
    const TAKEALOT_API_BASE = 'https://seller-api.takealot.com';
    const endpoint = '/V2/sales';
    
    // Configure parameters based on strategy
    const params = new URLSearchParams();
    params.append('page_size', '100');
    
    switch (strategy) {
      case 'Last 100':
        // Fetch only first page (100 records)
        params.append('page_number', '1');
        break;
      case 'Last 30 Days':
        const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
        params.append('created_date_start', thirtyDaysAgo.toISOString().split('T')[0]);
        break;
      case 'Last 6 Months':
        const sixMonthsAgo = new Date(Date.now() - 180 * 24 * 60 * 60 * 1000);
        params.append('created_date_start', sixMonthsAgo.toISOString().split('T')[0]);
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
        params.set('page_number', currentPage.toString());
        const apiUrl = `${TAKEALOT_API_BASE}${endpoint}?${params.toString()}`;
        
        console.log(`Fetching sales page ${currentPage}: ${apiUrl}`);
        console.log(`API Request Headers:`, {
          'Authorization': `Key ${apiKey.substring(0, 10)}...`,
          'Content-Type': 'application/json',
          'User-Agent': 'POS-App/1.0'
        });
        
        const response = await fetch(apiUrl, {
          method: 'GET',
          headers: {
            'Authorization': `Key ${apiKey}`,
            'Content-Type': 'application/json',
            'User-Agent': 'POS-App/1.0'
          },
          signal: AbortSignal.timeout(60000)
        });

        if (!response.ok) {
          throw new Error(`API request failed: ${response.status} ${response.statusText}`);
        }

        const data = await response.json();
        console.log(`API Response for page ${currentPage}:`, {
          totalRecords: data.page_summary?.total || 'unknown',
          currentPageRecords: data.sales?.length || 0,
          pageInfo: data.page_summary || 'no page summary'
        });
        
        // Extract sales records
        const salesRecords = data.sales || [];
        if (salesRecords.length === 0) {
          console.log(`No sales records found on page ${currentPage}, stopping pagination`);
          break;
        }
        
        allSalesRecords.push(...salesRecords);
        
        // Update pagination info
        if (data.page_summary) {
          totalPages = Math.ceil(data.page_summary.total / 100);
        }
        
        console.log(`Fetched page ${currentPage}/${totalPages}: ${salesRecords.length} records`);
        
        // For "Last 100" strategy, only fetch first page
        if (strategy === 'Last 100') {
          break;
        }
        
        currentPage++;
        
        // Add delay between requests
        await new Promise(resolve => setTimeout(resolve, 200));
        
      } while (currentPage <= totalPages);
      
    } catch (error) {
      console.error('Error fetching sales from API:', error);
      throw error;
    }

    console.log(`Total sales records fetched: ${allSalesRecords.length}`);
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
      const syncPromise = this.performSyncOperation(apiKey, strategy);
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
  private async performSyncOperation(apiKey: string, strategy: string): Promise<SyncResult> {
    // Fetch sales from API
    const salesRecords = await this.fetchSalesFromAPI(apiKey, strategy);
    
    // Process and save to database
    const result = await this.processSalesRecords(salesRecords);
    
    return result;
  }
}
