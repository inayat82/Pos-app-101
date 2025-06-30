// src/lib/productSyncService.ts
import { dbAdmin as db } from '@/lib/firebase/firebaseAdmin';
import { cronJobLogger } from '@/lib/cronJobLogger';

interface ProductRecord {
  tsin_id?: string;
  offer_id?: string;
  selling_price?: number;
  rrp?: number;
  sku?: string;
  image_url?: string;
  quantity_available?: number;
  status?: string;
  [key: string]: any;
}

interface SyncResult {
  totalProcessed: number;
  totalNew: number;
  totalUpdated: number;
  totalErrors: number;
  totalSkipped: number;
}

export class ProductSyncService {
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
        console.warn(`[ProductSyncService] Could not fetch admin details for ${actualAdminId}:`, adminError);
      }

      this.logId = await cronJobLogger.startExecution({
        cronJobName: `product-sync-${strategy.toLowerCase().replace(/\s+/g, '-')}`,
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
        message: `Starting ${triggerType} product sync for ${strategy} - ${accountName} (Admin: ${adminName})`,
        details: `Integration: ${this.integrationId}, Account: ${accountName}, Admin: ${adminName} (${adminEmail}), Trigger: ${triggerType}, Strategy: ${strategy}`
      });
      
      console.log(`Product sync logging started: ${this.logId} for ${strategy} (${triggerType}) - ${accountName}`);
    } catch (error) {
      console.error('Failed to start product sync logging:', error);
    }
  }

  /**
   * Get cron schedule for strategy
   */
  private getCronScheduleForStrategy(strategy: string): string {
    switch (strategy) {
      case 'Fetch 100 Products':
        return '0 */3 * * *'; // Every 3 hours
      case 'Fetch 200 Products':
        return 'manual'; // Manual only
      case 'Fetch All Products (6h)':
        return '0 */6 * * *'; // Every 6 hours
      case 'Fetch All Products (12h)':
        return '0 */12 * * *'; // Every 12 hours
      default:
        return 'manual';
    }
  }

  /**
   * Complete logging for the sync operation
   */
  /**
   * Process product records with TSIN-based upsert logic
   * IMPORTANT: Preserves calculation fields and only updates API fields
   */
  async processProductRecords(productRecords: ProductRecord[]): Promise<SyncResult> {
    const result: SyncResult = {
      totalProcessed: 0,
      totalNew: 0,
      totalUpdated: 0,
      totalErrors: 0,
      totalSkipped: 0
    };

    if (!productRecords || productRecords.length === 0) {
      return result;
    }

    const collectionName = 'takealot_offers';
    
    // Process records in batches to avoid overwhelming Firestore
    const batchSize = 10;
    for (let i = 0; i < productRecords.length; i += batchSize) {
      const batch = productRecords.slice(i, i + batchSize);
      
      await Promise.all(batch.map(async (record) => {
        try {
          result.totalProcessed++;
          
          // Skip records without TSIN ID
          if (!record.tsin_id) {
            console.warn('Skipping product record without TSIN ID:', record);
            result.totalSkipped++;
            return;
          }

          // Check if record already exists by TSIN ID and integrationId
          const existingQuery = await db.collection(collectionName)
            .where('tsin_id', '==', record.tsin_id)
            .where('integrationId', '==', this.integrationId)
            .limit(1)
            .get();

          if (existingQuery.empty) {
            // Create new record with all fields
            const docId = `${this.integrationId}_${record.tsin_id}`;
            
            const firestoreRecord: ProductRecord = {
              ...record,
              integrationId: this.integrationId,
              fetchedAt: new Date().toISOString(),
              source: 'takealot_api',
              lastUpdatedAt: new Date().toISOString(),
              firstFetchedAt: new Date().toISOString()
            };

            await db.collection(collectionName).doc(docId).set(firestoreRecord);
            result.totalNew++;
            
            console.log(`Created new product record: ${record.tsin_id}`);
          } else {
            // Update existing record but preserve calculation fields
            const existingDoc = existingQuery.docs[0];
            const existingData = existingDoc.data();
            
            // Check if update is needed by comparing API fields only
            const needsUpdate = this.hasSignificantChanges(existingData, record);
            
            if (needsUpdate) {
              // Prepare update data with only API fields, preserving calculation fields
              const updateData = this.prepareUpdateData(existingData, record);
              
              await existingDoc.ref.update(updateData);
              result.totalUpdated++;
              
              console.log(`Updated existing product record: ${record.tsin_id}`);
            } else {
              result.totalSkipped++;
              console.log(`No API changes detected for product record: ${record.tsin_id}`);
            }
          }
        } catch (error) {
          console.error(`Error processing product record ${record.tsin_id}:`, error);
          result.totalErrors++;
        }
      }));

      // Small delay between batches
      if (i + batchSize < productRecords.length) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    }

    return result;
  }

  /**
   * Prepare update data that preserves calculation fields
   * Only updates API fields from Takealot
   */
  private prepareUpdateData(existingData: any, incomingRecord: ProductRecord): any {
    // API fields that can be updated
    const apiFields = [
      'selling_price',
      'rrp',
      'sku',
      'image_url',
      'image_url_1',
      'image_url_2', 
      'image_url_3',
      'quantity_available',
      'stock_at_takealot',
      'stock_at_takealot_total',
      'stock_on_way',
      'total_stock_on_way',
      'status',
      'is_active',
      'title',
      'product_title',
      'brand',
      'category',
      'subcategory',
      'cost_price',
      'recommended_retail_price',
      'lead_time',
      'weight',
      'dimensions',
      'description',
      'offer_id'
    ];

    // Calculation fields to preserve (never overwrite)
    const calculationFields = [
      'qty_require',
      'total_sold',
      'sold_30_days',
      'returned_30_days',
      'avg_selling_price',
      'return_rate',
      'days_since_last_order',
      'has_tsin_metrics',
      'has_legacy_metrics',
      'metrics_last_calculated',
      'calculation_method',
      'tsinCalculatedMetrics',
      'calculatedMetrics',
      'lastTsinCalculation',
      'quantity_required',
      'last_30_days_sold',
      'last_30_days_return',
      'avgSellingPrice',
      'returnRate',
      'daysSinceLastOrder',
      'qtyRequire',
      'totalSold',
      'last30DaysSold',
      'last30DaysReturn'
    ];

    const updateData: any = {
      lastUpdatedAt: new Date().toISOString(),
      fetchedAt: new Date().toISOString(),
      source: 'takealot_api'
    };

    // Only update API fields, preserve calculation fields
    for (const field of apiFields) {
      if (incomingRecord.hasOwnProperty(field)) {
        const value = incomingRecord[field];
        // Only include fields that have valid values (not undefined or null)
        if (value !== undefined && value !== null) {
          updateData[field] = value;
        }
      }
    }

    console.log(`Preparing update for ${incomingRecord.tsin_id}: updating ${Object.keys(updateData).length} API fields, preserving calculation fields`);
    
    return updateData;
  }

  /**
   * Check if a product record has significant changes in API fields that warrant an update
   * Only compares API fields, ignores calculation fields
   */
  private hasSignificantChanges(existing: any, incoming: ProductRecord): boolean {
    // Compare only API fields that commonly change
    const fieldsToCompare = [
      'selling_price',
      'rrp',
      'sku',
      'image_url',
      'image_url_1',
      'quantity_available',
      'stock_at_takealot_total',
      'total_stock_on_way',
      'status',
      'is_active',
      'title'
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
          console.log(`API field ${field} changed: ${existingValue} -> ${incomingValue}`);
          return true;
        }
      }
      // Handle string comparisons
      else if (existingValue !== incomingValue) {
        console.log(`API field ${field} changed: ${existingValue} -> ${incomingValue}`);
        return true;
      }
    }

    return false;
  }

  /**
   * Fetch product data from Takealot API based on strategy
   */
  async fetchProductsFromAPI(apiKey: string, strategy: string): Promise<ProductRecord[]> {
    const TAKEALOT_API_BASE = 'https://seller-api.takealot.com';
    const endpoint = '/v2/offers';
    
    // Configure parameters based on strategy
    const params = new URLSearchParams();
    params.append('page_size', '100');
    
    let maxPages = 1000; // Default max for unlimited strategies
    
    switch (strategy) {
      case 'Fetch 100 Products':
        // Fetch only first page (100 records)
        params.append('page_number', '1');
        maxPages = 1;
        break;
      case 'Fetch 200 Products':
        // Fetch first 2 pages (200 records)
        maxPages = 2;
        break;
      case 'Fetch All Products (6h)':
      case 'Fetch All Products (12h)':
        // No limit - fetch all available products
        maxPages = 1000;
        break;
    }

    const allProductRecords: ProductRecord[] = [];
    let currentPage = 1;
    let totalPages = 1;

    try {
      do {
        params.set('page_number', currentPage.toString());
        const apiUrl = `${TAKEALOT_API_BASE}${endpoint}?${params.toString()}`;
        
        console.log(`Fetching products page ${currentPage}: ${apiUrl}`);
        
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
        
        // Extract product records
        const productRecords = data.offers || [];
        allProductRecords.push(...productRecords);
        
        // Update pagination info
        if (data.total_results && data.page_size) {
          totalPages = Math.ceil(data.total_results / data.page_size);
        }
        
        console.log(`Fetched page ${currentPage}/${Math.min(totalPages, maxPages)}: ${productRecords.length} records`);
        
        // Stop if we've reached our max pages or if the page is empty
        if (currentPage >= maxPages || productRecords.length === 0) {
          break;
        }
        
        currentPage++;
        
        // Add delay between requests
        await new Promise(resolve => setTimeout(resolve, 200));
        
      } while (currentPage <= totalPages && currentPage <= maxPages);
      
    } catch (error) {
      console.error('Error fetching products from API:', error);
      throw error;
    }

    console.log(`Total product records fetched: ${allProductRecords.length}`);
    return allProductRecords;
  }

  /**
   * Main sync method that combines API fetch and database update
   */
  /**
   * Enhanced sync method with timeout and better error handling
   */
  async syncProducts(apiKey: string, strategy: string, triggerType: 'manual' | 'cron' = 'manual', adminId?: string): Promise<SyncResult> {
    console.log(`Starting product sync: ${strategy} (${triggerType})`);
    
    // Set up timeout (30 minutes for manual, 15 minutes for cron)
    const timeoutMs = triggerType === 'manual' ? 30 * 60 * 1000 : 15 * 60 * 1000;
    const startTime = Date.now();
    
    await this.startLogging(triggerType, strategy, adminId);
    
    try {
      // Wrap the entire sync operation in a timeout
      const syncPromise = this.performSyncOperation(apiKey, strategy);
      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => {
          reject(new Error(`Product sync operation timed out after ${timeoutMs / 1000} seconds`));
        }, timeoutMs);
      });
      
      const result = await Promise.race([syncPromise, timeoutPromise]);
      
      await this.completeLogging(result, strategy, triggerType, true);
      
      console.log(`Product sync completed: ${JSON.stringify(result)}`);
      return result;
      
    } catch (error: any) {
      console.error(`Product sync failed:`, error);
      
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
    // Fetch products from API
    const productRecords = await this.fetchProductsFromAPI(apiKey, strategy);
    
    // Process and save to database
    const result = await this.processProductRecords(productRecords);
    
    return result;
  }

  /**
   * Enhanced complete logging with better error handling
   */
  async completeLogging(result: SyncResult, strategy: string, triggerType: 'manual' | 'cron', success: boolean = true): Promise<void> {
    if (!this.logId) {
      console.warn('No log ID available for completing logging');
      return;
    }

    try {
      console.log(`Completing product sync logging for ${strategy}:`, result);
      
      await cronJobLogger.completeExecution(this.logId, {
        status: success ? 'success' : 'failure',
        message: `${triggerType} product sync ${success ? 'completed' : 'failed'} for ${strategy}`,
        totalReads: result.totalProcessed,
        totalWrites: result.totalNew + result.totalUpdated,
        itemsProcessed: result.totalProcessed,
        details: `New: ${result.totalNew}, Updated: ${result.totalUpdated}, Errors: ${result.totalErrors}, Skipped: ${result.totalSkipped}`,
        errorDetails: success ? undefined : `Errors: ${result.totalErrors}`
      });
      
      console.log(`Product sync logging completed: ${this.logId} for ${strategy} (${triggerType})`);
    } catch (error) {
      console.error('Failed to complete product sync logging:', error);
      console.error('Log ID:', this.logId);
      console.error('Strategy:', strategy);
      console.error('Trigger Type:', triggerType);
      console.error('Result:', result);
      
      // Don't throw here - we don't want logging errors to break the main operation
    }
  }
}
