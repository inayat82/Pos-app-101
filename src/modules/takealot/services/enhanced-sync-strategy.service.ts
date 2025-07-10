// src/modules/takealot/services/enhanced-sync-strategy.service.ts
// Enhanced Takealot Sync Strategy Service with Neon support and concurrent processing

import admin from 'firebase-admin';
import { Timestamp } from 'firebase-admin/firestore';
import { takealotProxyService } from './proxy.service';
import { DualWriteService } from '@/lib/dualWriteService';
import { cronJobLogger } from '@/lib/cronJobLogger';

// Initialize Firebase Admin SDK if not already initialized
if (!admin.apps.length) {
  if (process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON) {
    const serviceAccount = JSON.parse(process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON);
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
    });
  } else if (process.env.FIREBASE_SERVICE_ACCOUNT_PROJECT_ID && process.env.FIREBASE_SERVICE_ACCOUNT_PRIVATE_KEY && process.env.FIREBASE_SERVICE_ACCOUNT_CLIENT_EMAIL) {
    admin.initializeApp({
      credential: admin.credential.cert({
        projectId: process.env.FIREBASE_SERVICE_ACCOUNT_PROJECT_ID,
        privateKey: process.env.FIREBASE_SERVICE_ACCOUNT_PRIVATE_KEY.replace(/\\n/g, '\n'),
        clientEmail: process.env.FIREBASE_SERVICE_ACCOUNT_CLIENT_EMAIL,
      }),
    });
  } else {
    admin.initializeApp();
    console.warn("Enhanced TakealotSync: Initializing Firebase Admin with default credentials.");
  }
}

const db = admin.firestore();

export interface EnhancedSyncResult {
  success: boolean;
  message: string;
  totalItemsFetched: number;
  totalErrors: number;
  neonRecords: number;
  firebaseRecords: number;
  strategy: 'neon-primary' | 'firebase-fallback';
  processingTime: number;
  concurrentPages: number;
}

export interface ConcurrentFetchOptions {
  maxConcurrentPages: number;
  batchSize: number;
  retryAttempts: number;
  delayBetweenBatches: number;
}

const DEFAULT_CONCURRENT_OPTIONS: ConcurrentFetchOptions = {
  maxConcurrentPages: 5, // Process 5 pages concurrently
  batchSize: 100, // 100 records per batch for database writes
  retryAttempts: 3,
  delayBetweenBatches: 1000 // 1 second delay between batches
};

export class EnhancedTakealotSyncService {
  private adminId: string;
  private integrationId: string;
  private apiKey: string;
  private dualWriteService: DualWriteService | null = null;

  constructor(adminId: string, integrationId: string, apiKey: string) {
    this.adminId = adminId;
    this.integrationId = integrationId;
    this.apiKey = apiKey;
  }

  /**
   * Enhanced sync with concurrent processing and Neon database support
   */
  async syncWithConcurrency(
    baseEndpoint: string,
    dataType: 'products' | 'sales',
    maxPagesToFetch?: number,
    options: Partial<ConcurrentFetchOptions> = {}
  ): Promise<EnhancedSyncResult> {
    const startTime = Date.now();
    const syncOptions = { ...DEFAULT_CONCURRENT_OPTIONS, ...options };
    
    console.log(`[EnhancedSync] Starting concurrent sync for ${dataType}, admin: ${this.adminId}`);
    
    // Initialize dual-write service
    const dataTypeForService = dataType === 'products' ? 'offers' : 'sales';
    this.dualWriteService = new DualWriteService(this.adminId, this.integrationId, dataTypeForService);

    try {
      // Step 1: Get total pages from first API call
      const totalPages = await this.getTotalPages(baseEndpoint, dataType);
      const effectivePages = Math.min(totalPages, maxPagesToFetch || totalPages);
      
      console.log(`[EnhancedSync] Total pages to process: ${effectivePages}`);

      // Step 2: Create page batches for concurrent processing
      const pageBatches = this.createPageBatches(effectivePages, syncOptions.maxConcurrentPages);
      
      // Step 3: Process pages concurrently
      const allData: any[] = [];
      let totalErrors = 0;
      
      for (let batchIndex = 0; batchIndex < pageBatches.length; batchIndex++) {
        const batch = pageBatches[batchIndex];
        console.log(`[EnhancedSync] Processing batch ${batchIndex + 1}/${pageBatches.length} with ${batch.length} pages`);
        
        // Process pages in current batch concurrently
        const batchPromises = batch.map(pageNumber => 
          this.fetchPageWithRetry(baseEndpoint, dataType, pageNumber, syncOptions.retryAttempts)
        );
        
        const batchResults = await Promise.allSettled(batchPromises);
        
        // Process batch results
        for (const result of batchResults) {
          if (result.status === 'fulfilled' && result.value.success) {
            allData.push(...result.value.data);
          } else {
            totalErrors++;
            console.error(`[EnhancedSync] Batch page failed:`, result);
          }
        }
        
        // Add delay between batches to avoid overwhelming the API
        if (batchIndex < pageBatches.length - 1) {
          await this.delay(syncOptions.delayBetweenBatches);
        }
      }

      // Step 4: Write to Neon database using DualWriteService
      console.log(`[EnhancedSync] Writing ${allData.length} records to database`);
      const writeResult = await this.writeToDatabase(allData, dataType, syncOptions.batchSize);

      const processingTime = Date.now() - startTime;
      
      const result: EnhancedSyncResult = {
        success: writeResult.success,
        message: `Enhanced sync completed: ${allData.length} records processed in ${processingTime}ms`,
        totalItemsFetched: allData.length,
        totalErrors,
        neonRecords: writeResult.neonRecordsWritten,
        firebaseRecords: writeResult.firebaseRecordsWritten,
        strategy: writeResult.strategy,
        processingTime,
        concurrentPages: syncOptions.maxConcurrentPages
      };

      // Log success
      console.log(`[EnhancedSync] Successfully completed sync: ${allData.length} records, strategy: ${writeResult.strategy}, time: ${processingTime}ms`);

      return result;

    } catch (error: any) {
      const processingTime = Date.now() - startTime;
      console.error(`[EnhancedSync] Sync failed:`, error);
      
      // Log error
      console.error(`[EnhancedSync] Sync failed: ${error.message}, time: ${processingTime}ms`);

      return {
        success: false,
        message: `Enhanced sync failed: ${error.message}`,
        totalItemsFetched: 0,
        totalErrors: 1,
        neonRecords: 0,
        firebaseRecords: 0,
        strategy: 'neon-primary',
        processingTime,
        concurrentPages: syncOptions.maxConcurrentPages
      };
    }
  }

  /**
   * Get total pages from API
   */
  private async getTotalPages(baseEndpoint: string, dataType: 'products' | 'sales'): Promise<number> {
    const response = await takealotProxyService.get(baseEndpoint, this.apiKey, {
      page_number: 1,
      page_size: 100
    }, {
      adminId: this.adminId,
      integrationId: this.integrationId,
      requestType: 'manual',
      dataType,
      timeout: 30000
    });

    if (!response.success || !response.data) {
      throw new Error(`Failed to get total pages: ${response.error}`);
    }

    const data = response.data;
    
    if (dataType === 'products' && data.page_summary) {
      return Math.ceil(data.page_summary.total / data.page_summary.page_size);
    } else if (dataType === 'sales' && data.page_summary) {
      return Math.ceil(data.page_summary.total_results / data.page_summary.page_size);
    }
    
    // Fallback: assume single page
    return 1;
  }

  /**
   * Create page batches for concurrent processing
   */
  private createPageBatches(totalPages: number, maxConcurrentPages: number): number[][] {
    const batches: number[][] = [];
    const pages = Array.from({ length: totalPages }, (_, i) => i + 1);
    
    for (let i = 0; i < pages.length; i += maxConcurrentPages) {
      batches.push(pages.slice(i, i + maxConcurrentPages));
    }
    
    return batches;
  }

  /**
   * Fetch single page with retry logic
   */
  private async fetchPageWithRetry(
    baseEndpoint: string, 
    dataType: 'products' | 'sales', 
    pageNumber: number, 
    retryAttempts: number
  ): Promise<{ success: boolean; data: any[] }> {
    for (let attempt = 1; attempt <= retryAttempts; attempt++) {
      try {
        console.log(`[EnhancedSync] Fetching page ${pageNumber}, attempt ${attempt}`);
        
        const response = await takealotProxyService.get(baseEndpoint, this.apiKey, {
          page_number: pageNumber,
          page_size: 100
        }, {
          adminId: this.adminId,
          integrationId: this.integrationId,
          requestType: 'manual',
          dataType,
          timeout: 45000
        });

        if (response.success && response.data) {
          const items = dataType === 'products' ? 
            (response.data.offers || []) : 
            (response.data.sales || []);
          
          return { success: true, data: items };
        } else {
          throw new Error(response.error || 'Unknown API error');
        }
      } catch (error: any) {
        console.warn(`[EnhancedSync] Page ${pageNumber} attempt ${attempt} failed:`, error.message);
        
        if (attempt === retryAttempts) {
          return { success: false, data: [] };
        }
        
        // Exponential backoff
        await this.delay(Math.pow(2, attempt) * 1000);
      }
    }
    
    return { success: false, data: [] };
  }

  /**
   * Write data to database using DualWriteService
   */
  private async writeToDatabase(
    allData: any[], 
    dataType: 'products' | 'sales',
    batchSize: number
  ) {
    console.log(`[EnhancedSync] Writing ${allData.length} records to database in batches of ${batchSize}`);
    
    // Convert data to TakealotRecord format
    const records = allData.map(item => this.convertToTakealotRecord(item, dataType));
    
    // Process in batches to avoid memory issues
    const batches = [];
    for (let i = 0; i < records.length; i += batchSize) {
      batches.push(records.slice(i, i + batchSize));
    }
    
    let totalNeonRecords = 0;
    let totalFirebaseRecords = 0;
    let strategy: 'neon-primary' | 'firebase-fallback' = 'neon-primary';
    
    for (let i = 0; i < batches.length; i++) {
      console.log(`[EnhancedSync] Processing database batch ${i + 1}/${batches.length}`);
      
      if (!this.dualWriteService) {
        throw new Error('DualWriteService not initialized');
      }
      
      const batchResult = await this.dualWriteService.writeRecords(batches[i]);
      
      totalNeonRecords += batchResult.neonRecordsWritten;
      totalFirebaseRecords += batchResult.firebaseRecordsWritten;
      
      if (batchResult.strategy === 'firebase-fallback') {
        strategy = 'firebase-fallback';
      }
    }

    return {
      success: true,
      neonRecordsWritten: totalNeonRecords,
      firebaseRecordsWritten: totalFirebaseRecords,
      strategy
    };
  }

  /**
   * Convert API response item to TakealotRecord format
   */
  private convertToTakealotRecord(item: any, dataType: 'products' | 'sales'): any {
    const baseRecord = {
      integration_id: this.integrationId,
      admin_uid: this.adminId,
      created_at: new Date(),
      updated_at: new Date(),
      synced_from_firebase: false
    };

    if (dataType === 'sales') {
      return {
        ...baseRecord,
        order_id: item.order_id,
        product_title: item.product_title || item.title,
        customer_name: item.customer_name,
        order_date: item.order_date ? new Date(item.order_date) : new Date(),
        selling_price: parseFloat(item.selling_price) || 0,
        quantity: parseInt(item.quantity) || 0,
        status: item.status || 'completed',
        tsin_id: item.tsin_id,
        sku: item.sku,
        customer_dc: item.customer_dc,
        takealot_url_mol: item.takealot_url_mol,
        success_fee: parseFloat(item.success_fee) || 0,
        total_fee: parseFloat(item.total_fee) || 0,
        stock_transfer_fee: parseFloat(item.stock_transfer_fee) || 0,
        courier_collection_fee: parseFloat(item.courier_collection_fee) || 0,
        commission: parseFloat(item.commission) || 0,
        order_status: item.order_status,
        return_status: item.return_status,
        is_return: Boolean(item.is_return),
        customer_city: item.customer_city,
        payment_method: item.payment_method,
        order_item_id: item.order_item_id
      };
    } else {
      return {
        ...baseRecord,
        tsin_id: item.tsin_id,
        product_title: item.product_title || item.title,
        brand: item.brand,
        category: item.category,
        subcategory: item.subcategory,
        sku: item.sku,
        selling_price: parseFloat(item.selling_price) || 0,
        cost_price: parseFloat(item.cost_price) || 0,
        recommended_retail_price: parseFloat(item.recommended_retail_price) || 0,
        stock_at_takealot_total: parseInt(item.stock_at_takealot_total) || 0,
        total_stock_on_way: parseInt(item.total_stock_on_way) || 0,
        status: item.status,
        is_active: Boolean(item.is_active),
        offer_id: item.offer_id,
        lead_time: parseInt(item.lead_time) || 0,
        weight: parseFloat(item.weight) || 0,
        dimensions: item.dimensions,
        images: Array.isArray(item.images) ? item.images : [],
        description: item.description,
        image_url: item.image_url,
        offer_url: item.offer_url
      };
    }
  }

  /**
   * Utility function for delays
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

/**
 * Enhanced fetch function with concurrent processing
 */
export async function fetchAndSaveTakealotDataEnhanced(
  baseEndpoint: string,
  apiKey: string,
  adminId: string,
  dataType: 'products' | 'sales',
  maxPagesToFetch?: number,
  concurrentOptions?: Partial<ConcurrentFetchOptions>
): Promise<EnhancedSyncResult> {
  const syncService = new EnhancedTakealotSyncService(adminId, adminId, apiKey);
  return syncService.syncWithConcurrency(baseEndpoint, dataType, maxPagesToFetch, concurrentOptions);
}

/**
 * Process sync preferences with enhanced concurrent strategy
 */
export async function processSyncPreferencesEnhanced(cronLabelToProcess: string) {
  console.log(`[EnhancedSync] Processing sync preferences for cron label: ${cronLabelToProcess}`);
  
  const integrationSnapshots = await db.collection('takealotIntegrations').get();
  const results: any[] = [];

  for (const integrationDoc of integrationSnapshots.docs) {
    const integrationData = integrationDoc.data();
    const adminId = integrationData.adminId;
    const apiKey = integrationData.apiKey;
    
    if (!adminId || !apiKey) {
      console.warn(`[EnhancedSync] Missing adminId or apiKey for integration ${integrationDoc.id}`);
      continue;
    }

    // Load sync preferences
    const [salesPrefs, productPrefs] = await Promise.all([
      db.collection(`takealotIntegrations/${integrationDoc.id}/syncPreferences`).doc('sales').get(),
      db.collection(`takealotIntegrations/${integrationDoc.id}/syncPreferences`).doc('products').get()
    ]);

    const salesStrategies = salesPrefs.exists ? salesPrefs.data()?.strategies || [] : [];
    const productStrategies = productPrefs.exists ? productPrefs.data()?.strategies || [] : [];

    let adminProcessed = false;

    // Process Sales Strategies with enhanced concurrency
    for (const strategy of salesStrategies) {
      if (strategy.cronEnabled && strategy.cronLabel === cronLabelToProcess) {
        adminProcessed = true;
        console.log(`[EnhancedSync] Executing enhanced sales strategy "${strategy.description}" for admin ${adminId}`);
        
        try {
          const result = await fetchAndSaveTakealotDataEnhanced(
            '/v2/sales',
            apiKey,
            adminId,
            'sales',
            strategy.maxPagesToFetch,
            {
              maxConcurrentPages: 8, // Increased concurrency for faster processing
              batchSize: 200,
              retryAttempts: 3,
              delayBetweenBatches: 500
            }
          );
          results.push({ adminId, strategyId: strategy.id, type: 'sales', ...result });
        } catch (error: any) {
          console.error(`[EnhancedSync] Error executing enhanced sales strategy ${strategy.id} for admin ${adminId}:`, error.message);
          results.push({ adminId, strategyId: strategy.id, type: 'sales', success: false, message: error.message });
        }
      }
    }

    // Process Product Strategies with enhanced concurrency
    for (const strategy of productStrategies) {
      if (strategy.cronEnabled && strategy.cronLabel === cronLabelToProcess) {
        adminProcessed = true;
        console.log(`[EnhancedSync] Executing enhanced product strategy "${strategy.description}" for admin ${adminId}`);
        
        try {
          const result = await fetchAndSaveTakealotDataEnhanced(
            '/v2/offers',
            apiKey,
            adminId,
            'products',
            strategy.maxPagesToFetch,
            {
              maxConcurrentPages: 10, // Higher concurrency for products
              batchSize: 250,
              retryAttempts: 3,
              delayBetweenBatches: 300
            }
          );
          results.push({ adminId, strategyId: strategy.id, type: 'products', ...result });
        } catch (error: any) {
          console.error(`[EnhancedSync] Error executing enhanced product strategy ${strategy.id} for admin ${adminId}:`, error.message);
          results.push({ adminId, strategyId: strategy.id, type: 'products', success: false, message: error.message });
        }
      }
    }
  }

  console.log(`[EnhancedSync] Enhanced sync processing completed with ${results.length} results`);
  return results;
}
