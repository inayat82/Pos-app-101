// src/lib/enhancedSyncService.ts
/**
 * Enhanced Sync Service with Dual-Write Support
 * This service wraps existing sync services to use dual-write functionality
 * Strategy: Try Neon first, fallback to Firebase if it fails
 */

import { SalesSyncService } from './salesSyncService';
import { ProductSyncService } from './productSyncService';
import { DualWriteService, dualWriteTakealotData, TakealotRecord } from './dualWriteService';
import { cronJobLogger } from './cronJobLogger';

export interface EnhancedSyncResult {
  success: boolean;
  totalRecords: number;
  neonRecords: number;
  firebaseRecords: number;
  errors: string[];
  warnings: string[];
  strategy: 'neon-primary' | 'firebase-fallback' | 'neon-failed';
  timeTaken: number;
  needsUserChoice?: boolean; // Whether user needs to choose Firebase fallback
  neonError?: string; // Error from Neon write attempt
}

export class EnhancedSyncService {
  private adminUid: string;
  private integrationId: string;
  private accountName: string;
  private salesSyncService: SalesSyncService;
  private productSyncService: ProductSyncService;

  constructor(adminUid: string, integrationId: string, accountName: string = 'Takealot') {
    this.adminUid = adminUid;
    this.integrationId = integrationId;
    this.accountName = accountName;
    this.salesSyncService = new SalesSyncService(integrationId);
    this.productSyncService = new ProductSyncService(integrationId);
  }

  /**
   * Enhanced sales sync with dual-write support
   */
  async syncSales(apiKey: string, strategy: string, triggerType: 'manual' | 'cron' = 'manual'): Promise<EnhancedSyncResult> {
    const startTime = Date.now();
    console.log(`[EnhancedSync] Starting sales sync with dual-write for ${this.integrationId}`);

    try {
      // Step 1: Fetch sales data from Takealot API
      console.log('[EnhancedSync] Fetching sales data from Takealot API...');
      const salesRecords = await this.salesSyncService.fetchSalesFromAPI(apiKey, strategy, triggerType);
      
      if (salesRecords.length === 0) {
        console.log('[EnhancedSync] No sales records found');
        return {
          success: true,
          totalRecords: 0,
          neonRecords: 0,
          firebaseRecords: 0,
          errors: [],
          warnings: ['No sales records found'],
          strategy: 'neon-primary',
          timeTaken: Date.now() - startTime
        };
      }

      // Step 2: Transform records for dual-write
      const transformedRecords = this.transformSalesRecords(salesRecords);
      
      // Step 3: Use dual-write service (Neon first, Firebase fallback only if user chooses)
      console.log(`[EnhancedSync] Writing ${transformedRecords.length} sales records to Neon...`);
      const dualWriteResult = await dualWriteTakealotData(
        this.adminUid,
        this.integrationId,
        'sales',
        transformedRecords,
        this.accountName
      );

      const result: EnhancedSyncResult = {
        success: dualWriteResult.success,
        totalRecords: salesRecords.length,
        neonRecords: dualWriteResult.neonRecordsWritten,
        firebaseRecords: dualWriteResult.firebaseRecordsWritten,
        errors: dualWriteResult.errors,
        warnings: dualWriteResult.warnings,
        strategy: dualWriteResult.strategy,
        timeTaken: Date.now() - startTime,
        needsUserChoice: !dualWriteResult.success && dualWriteResult.errors.length > 0,
        neonError: dualWriteResult.errors.length > 0 ? dualWriteResult.errors[0] : undefined
      };

      console.log(`[EnhancedSync] Sales sync completed in ${result.timeTaken}ms`);
      console.log(`[EnhancedSync] Strategy: ${result.strategy}, Success: ${result.success}`);
      
      return result;

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error('[EnhancedSync] Sales sync failed:', error);
      
      return {
        success: false,
        totalRecords: 0,
        neonRecords: 0,
        firebaseRecords: 0,
        errors: [errorMessage],
        warnings: [],
        strategy: 'neon-primary',
        timeTaken: Date.now() - startTime
      };
    }
  }

  /**
   * Enhanced product sync with dual-write support
   */
  async syncProducts(apiKey: string, strategy: string, triggerType: 'manual' | 'cron' = 'manual'): Promise<EnhancedSyncResult> {
    const startTime = Date.now();
    console.log(`[EnhancedSync] Starting product sync with dual-write for ${this.integrationId}`);

    try {
      // Step 1: Fetch product data from Takealot API
      console.log('[EnhancedSync] Fetching product data from Takealot API...');
      const productRecords = await this.productSyncService.fetchProductsFromAPI(apiKey, strategy, triggerType);
      
      if (productRecords.length === 0) {
        console.log('[EnhancedSync] No product records found');
        return {
          success: true,
          totalRecords: 0,
          neonRecords: 0,
          firebaseRecords: 0,
          errors: [],
          warnings: ['No product records found'],
          strategy: 'neon-primary',
          timeTaken: Date.now() - startTime
        };
      }

      // Step 2: Transform records for dual-write
      const transformedRecords = this.transformProductRecords(productRecords);
      
      // Step 3: Use dual-write service (Neon first, Firebase fallback only if user chooses)
      console.log(`[EnhancedSync] Writing ${transformedRecords.length} product records to Neon...`);
      const dualWriteResult = await dualWriteTakealotData(
        this.adminUid,
        this.integrationId,
        'offers',
        transformedRecords,
        this.accountName
      );

      const result: EnhancedSyncResult = {
        success: dualWriteResult.success,
        totalRecords: productRecords.length,
        neonRecords: dualWriteResult.neonRecordsWritten,
        firebaseRecords: dualWriteResult.firebaseRecordsWritten,
        errors: dualWriteResult.errors,
        warnings: dualWriteResult.warnings,
        strategy: dualWriteResult.strategy,
        timeTaken: Date.now() - startTime,
        needsUserChoice: !dualWriteResult.success && dualWriteResult.errors.length > 0,
        neonError: dualWriteResult.errors.length > 0 ? dualWriteResult.errors[0] : undefined
      };

      console.log(`[EnhancedSync] Product sync completed in ${result.timeTaken}ms`);
      console.log(`[EnhancedSync] Strategy: ${result.strategy}, Success: ${result.success}`);
      
      return result;

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error('[EnhancedSync] Product sync failed:', error);
      
      return {
        success: false,
        totalRecords: 0,
        neonRecords: 0,
        firebaseRecords: 0,
        errors: [errorMessage],
        warnings: [],
        strategy: 'neon-primary',
        timeTaken: Date.now() - startTime
      };
    }
  }

  /**
   * Transform sales records for dual-write format
   */
  private transformSalesRecords(salesRecords: any[]): TakealotRecord[] {
    return salesRecords.map(record => ({
      // Required fields
      integration_id: this.integrationId,
      admin_uid: this.adminUid,
      
      // Sales-specific fields
      order_id: record.order_id,
      product_title: record.product_title,
      customer_name: record.customer_name,
      order_date: record.order_date,
      selling_price: record.selling_price || 0,
      quantity: record.quantity || 0,
      status: record.status,
      tsin_id: record.tsin_id,
      sku: record.sku,
      customer_dc: record.customer_dc,
      takealot_url_mol: record.takealot_url_mol,
      success_fee: record.success_fee || 0,
      total_fee: record.total_fee || 0,
      stock_transfer_fee: record.stock_transfer_fee || 0,
      courier_collection_fee: record.courier_collection_fee || 0,
      commission: record.commission || 0,
      order_status: record.order_status,
      return_status: record.return_status,
      is_return: record.is_return || false,
      customer_city: record.customer_city,
      payment_method: record.payment_method,
      order_item_id: record.order_item_id,
      
      // Metadata
      created_at: new Date(),
      updated_at: new Date(),
      synced_from_firebase: false,
      
      // Preserve original data
      ...record
    }));
  }

  /**
   * Transform product records for dual-write format
   */
  private transformProductRecords(productRecords: any[]): TakealotRecord[] {
    return productRecords.map(record => ({
      // Required fields
      integration_id: this.integrationId,
      admin_uid: this.adminUid,
      
      // Product-specific fields
      tsin_id: record.tsin_id,
      tsin: record.tsin,
      sku: record.sku,
      product_title: record.product_title,
      brand: record.brand,
      category: record.category,
      subcategory: record.subcategory,
      selling_price: record.selling_price || 0,
      cost_price: record.cost_price || 0,
      recommended_retail_price: record.recommended_retail_price || 0,
      stock_at_takealot_total: record.stock_at_takealot_total || 0,
      total_stock_on_way: record.total_stock_on_way || 0,
      status: record.status,
      is_active: record.is_active !== false,
      offer_id: record.offer_id,
      lead_time: record.lead_time || 0,
      weight: record.weight || 0,
      dimensions: record.dimensions,
      images: record.images,
      description: record.description,
      image_url: record.image_url,
      offer_url: record.offer_url,
      stock_dbn: record.stock_dbn || 0,
      stock_cpt: record.stock_cpt || 0,
      stock_jhb: record.stock_jhb || 0,
      qty_require: record.qty_require || 0,
      total_sold: record.total_sold || 0,
      sold_30_days: record.sold_30_days || 0,
      returned_30_days: record.returned_30_days || 0,
      avg_selling_price: record.avg_selling_price || 0,
      return_rate: record.return_rate || 0,
      days_since_last_order: record.days_since_last_order || 999,
      
      // Metadata
      created_at: new Date(),
      updated_at: new Date(),
      synced_from_firebase: false,
      
      // Preserve original data
      ...record
    }));
  }

  /**
   * Test dual-write connections
   */
  async testConnections(): Promise<{neon: boolean; firebase: boolean; errors: string[]}> {
    const salesDualWrite = new DualWriteService(this.adminUid, this.integrationId, 'sales');
    return await salesDualWrite.testConnections();
  }

  /**
   * Sync both sales and products
   */
  async syncAll(apiKey: string, strategy: string, triggerType: 'manual' | 'cron' = 'manual'): Promise<{
    sales: EnhancedSyncResult;
    products: EnhancedSyncResult;
    overall: {
      success: boolean;
      totalRecords: number;
      neonRecords: number;
      firebaseRecords: number;
      timeTaken: number;
    };
  }> {
    const startTime = Date.now();
    console.log(`[EnhancedSync] Starting complete sync (sales + products) for ${this.integrationId}`);

    const [salesResult, productsResult] = await Promise.all([
      this.syncSales(apiKey, strategy, triggerType),
      this.syncProducts(apiKey, strategy, triggerType)
    ]);

    const overall = {
      success: salesResult.success && productsResult.success,
      totalRecords: salesResult.totalRecords + productsResult.totalRecords,
      neonRecords: salesResult.neonRecords + productsResult.neonRecords,
      firebaseRecords: salesResult.firebaseRecords + productsResult.firebaseRecords,
      timeTaken: Date.now() - startTime
    };

    console.log(`[EnhancedSync] Complete sync finished in ${overall.timeTaken}ms`);
    console.log(`[EnhancedSync] Overall success: ${overall.success}`);
    console.log(`[EnhancedSync] Total records: ${overall.totalRecords} (Neon: ${overall.neonRecords}, Firebase: ${overall.firebaseRecords})`);

    return {
      sales: salesResult,
      products: productsResult,
      overall
    };
  }
}

/**
 * Convenience function to create enhanced sync service
 */
export function createEnhancedSyncService(adminUid: string, integrationId: string): EnhancedSyncService {
  return new EnhancedSyncService(adminUid, integrationId);
}

/**
 * Test dual-write functionality
 */
export async function testDualWriteSetup(adminUid: string, integrationId: string): Promise<{
  connections: {neon: boolean; firebase: boolean; errors: string[]};
  tableNames: {sales: string; offers: string};
  ready: boolean;
}> {
  const enhancedSync = new EnhancedSyncService(adminUid, integrationId);
  const connections = await enhancedSync.testConnections();
  
  const tableNames = {
    sales: `takealot_sales_admin_${adminUid.toLowerCase()}`,
    offers: `takealot_offers_admin_${adminUid.toLowerCase()}`
  };

  const ready = connections.neon && connections.firebase;

  return {
    connections,
    tableNames,
    ready
  };
}
