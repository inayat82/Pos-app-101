// src/lib/dualWriteService.ts
/**
 * Dual-Write Service for Takealot Data Migration
 * Strategy: Try Neon first, fallback to Firebase if it fails
 * 
 * This service handles the migration from Firebase to Neon by:
 * 1. Attempting to write to Neon first
 * 2. If Neon write fails, fallback to Firebase
 * 3. Log all operations for monitoring and debugging
 * 4. Support for both sales and offers data
 */

import { Pool } from 'pg';
import { dbAdmin as db } from '@/lib/firebase/firebaseAdmin';
import { Timestamp } from 'firebase-admin/firestore';
import { cronJobLogger } from '@/lib/cronJobLogger';

// Neon Database Configuration
const NEON_CONFIG = {
  connectionString: process.env.NEON_DATABASE_URL || 'postgres://neondb_owner:npg_mba9VdcFyk3C@ep-flat-frost-abxw66a6-pooler.eu-west-2.aws.neon.tech/neondb?sslmode=require',
  ssl: { rejectUnauthorized: false },
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
};

// Create connection pool
const neonPool = new Pool(NEON_CONFIG);

export interface DualWriteResult {
  success: boolean;
  neonSuccess: boolean;
  firebaseSuccess: boolean;
  recordsProcessed: number;
  neonRecordsWritten: number;
  firebaseRecordsWritten: number;
  errors: string[];
  warnings: string[];
  strategy: 'neon-primary' | 'firebase-fallback' | 'neon-failed';
  requiresUserChoice?: boolean; // New: indicates user needs to choose Firebase
}

export interface TakealotRecord {
  // Common fields
  integration_id: string;
  admin_uid: string;
  
  // Sales-specific fields
  order_id?: string;
  product_title?: string;
  customer_name?: string;
  order_date?: string;
  selling_price?: number;
  quantity?: number;
  status?: string;
  
  // Offers-specific fields
  tsin_id?: string;
  tsin?: string;
  sku?: string;
  brand?: string;
  category?: string;
  subcategory?: string;
  cost_price?: number;
  recommended_retail_price?: number;
  stock_at_takealot_total?: number;
  is_active?: boolean;
  offer_id?: string;
  
  // Common metadata
  created_at?: Date;
  updated_at?: Date;
  synced_from_firebase?: boolean;
  
  [key: string]: any; // Allow additional fields
}

export class DualWriteService {
  private adminUid: string;
  private integrationId: string;
  private dataType: 'sales' | 'offers';
  
  constructor(adminUid: string, integrationId: string, dataType: 'sales' | 'offers') {
    this.adminUid = adminUid;
    this.integrationId = integrationId;
    this.dataType = dataType;
  }

  /**
   * Main dual-write method: Try Neon first, fallback to Firebase
   */
  async writeRecords(records: TakealotRecord[], accountName: string = 'Takealot'): Promise<DualWriteResult> {
    const startTime = Date.now();
    const result: DualWriteResult = {
      success: false,
      neonSuccess: false,
      firebaseSuccess: false,
      recordsProcessed: records.length,
      neonRecordsWritten: 0,
      firebaseRecordsWritten: 0,
      errors: [],
      warnings: [],
      strategy: 'neon-primary'
    };

    console.log(`[DualWrite] Starting dual-write for ${records.length} ${this.dataType} records`);
    console.log(`[DualWrite] Admin UID: ${this.adminUid}, Integration: ${this.integrationId}, Account: ${accountName}`);

    // Add account name to all records
    const recordsWithAccountName = records.map(record => ({
      ...record,
      account_name: record.account_name || accountName
    }));

    try {
      // STEP 1: Try Neon first (Primary strategy)
      console.log('[DualWrite] 🎯 Attempting Neon write (primary)...');
      
      const neonResult = await this.writeToNeon(recordsWithAccountName);
      
      if (neonResult.success) {
        // Neon write successful
        result.neonSuccess = true;
        result.neonRecordsWritten = neonResult.recordsWritten;
        result.success = true;
        result.strategy = 'neon-primary';
        
        console.log(`[DualWrite] ✅ Neon write successful! ${neonResult.recordsWritten} records written`);
        
        // Log success for monitoring
        await this.logOperation('neon-write-success', {
          recordsWritten: neonResult.recordsWritten,
          timeTaken: Date.now() - startTime,
          strategy: 'neon-primary'
        });
        
      } else {
        // Neon write failed, do NOT automatically fallback to Firebase
        result.errors.push(`Neon write failed: ${neonResult.error}`);
        result.warnings.push('Neon write failed. User must choose whether to use Firebase fallback.');
        result.success = false;
        result.strategy = 'neon-failed';
        result.requiresUserChoice = true;
        
        console.log(`[DualWrite] ❌ Neon write failed: ${neonResult.error}`);
        console.log('[DualWrite] ⚠️ Waiting for user decision on Firebase fallback...');
        
        // Log Neon failure for monitoring
        await this.logOperation('neon-write-failed', {
          error: neonResult.error,
          recordsLost: records.length,
          timeTaken: Date.now() - startTime,
          requiresUserChoice: true
        });
      }
      
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      result.errors.push(`Dual-write service error: ${errorMessage}`);
      result.success = false;
      
      console.error('[DualWrite] 💥 Dual-write service error:', error);
      
      // Log service error
      await this.logOperation('dual-write-service-error', {
        error: errorMessage,
        recordsLost: records.length,
        timeTaken: Date.now() - startTime
      });
    }

    const timeTaken = Date.now() - startTime;
    console.log(`[DualWrite] Operation completed in ${timeTaken}ms`);
    console.log(`[DualWrite] Final result: ${result.success ? 'SUCCESS' : 'FAILED'} (${result.strategy})`);
    
    return result;
  }

  /**
   * Write records to Neon database using NEW shared tables
   */
  private async writeToNeon(records: TakealotRecord[]): Promise<{success: boolean; recordsWritten: number; error?: string}> {
    const client = await neonPool.connect();
    
    try {
      await client.query('BEGIN');
      
      // Use the new shared tables instead of admin-specific ones
      const tableName = this.dataType === 'sales' ? 'takealot_sales' : 'takealot_offers';
      
      let recordsWritten = 0;
      
      for (const record of records) {
        try {
          if (this.dataType === 'sales') {
            await this.insertSalesRecordNew(client, record);
          } else {
            await this.insertOffersRecordNew(client, record);
          }
          recordsWritten++;
        } catch (recordError) {
          console.warn(`[DualWrite] Failed to insert record: ${recordError}`);
          // Continue with other records
        }
      }
      
      await client.query('COMMIT');
      return { success: true, recordsWritten };
      
    } catch (error) {
      await client.query('ROLLBACK');
      const errorMessage = error instanceof Error ? error.message : 'Unknown Neon error';
      return { success: false, recordsWritten: 0, error: errorMessage };
    } finally {
      client.release();
    }
  }

  /**
   * Insert sales record into NEW takealot_sales table
   */
  private async insertSalesRecordNew(client: any, record: TakealotRecord): Promise<void> {
    const query = `
      INSERT INTO takealot_sales (
        admin_uid, integration_id, account_name, order_id, order_date, sku,
        product_title, quantity, selling_price, commission, vat, total_amount,
        order_status, shipping_method, customer_info
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15
      )
      ON CONFLICT (admin_uid, integration_id, order_id, sku) 
      DO UPDATE SET
        product_title = EXCLUDED.product_title,
        quantity = EXCLUDED.quantity,
        selling_price = EXCLUDED.selling_price,
        commission = EXCLUDED.commission,
        vat = EXCLUDED.vat,
        total_amount = EXCLUDED.total_amount,
        order_status = EXCLUDED.order_status,
        shipping_method = EXCLUDED.shipping_method,
        customer_info = EXCLUDED.customer_info,
        updated_at = CURRENT_TIMESTAMP,
        synced_at = CURRENT_TIMESTAMP
    `;
    
    const values = [
      this.adminUid,
      this.integrationId,
      record.account_name || 'Takealot', // Default account name
      record.order_id,
      record.order_date || record.sale_date || new Date().toISOString().split('T')[0],
      record.sku || 'unknown',
      record.product_title || record.title,
      record.quantity || 1,
      record.selling_price || record.gross_sale || 0,
      record.commission || 0,
      record.vat || 0,
      record.total_amount || record.gross_sale || record.selling_price || 0,
      record.order_status || record.status,
      record.shipping_method || null,
      record.customer_name ? JSON.stringify({ name: record.customer_name }) : null
    ];
    
    await client.query(query, values);
  }

  /**
   * Insert offers record into NEW takealot_offers table
   */
  private async insertOffersRecordNew(client: any, record: TakealotRecord): Promise<void> {
    const query = `
      INSERT INTO takealot_offers (
        admin_uid, integration_id, account_name, offer_id, sku, product_title,
        current_price, original_price, stock_quantity, offer_status, is_active,
        visibility, promotion_type, views, clicks, conversion_rate,
        category_path, brand, offer_details
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19
      )
      ON CONFLICT (admin_uid, integration_id, offer_id) 
      DO UPDATE SET
        sku = EXCLUDED.sku,
        product_title = EXCLUDED.product_title,
        current_price = EXCLUDED.current_price,
        original_price = EXCLUDED.original_price,
        stock_quantity = EXCLUDED.stock_quantity,
        offer_status = EXCLUDED.offer_status,
        is_active = EXCLUDED.is_active,
        visibility = EXCLUDED.visibility,
        promotion_type = EXCLUDED.promotion_type,
        views = EXCLUDED.views,
        clicks = EXCLUDED.clicks,
        conversion_rate = EXCLUDED.conversion_rate,
        category_path = EXCLUDED.category_path,
        brand = EXCLUDED.brand,
        offer_details = EXCLUDED.offer_details,
        updated_at = CURRENT_TIMESTAMP,
        synced_at = CURRENT_TIMESTAMP
    `;
    
    const values = [
      this.adminUid,
      this.integrationId,
      record.account_name || 'Takealot',
      record.offer_id || record.tsin_id || record.sku,
      record.sku,
      record.product_title || record.title,
      record.selling_price || record.current_price || 0,
      record.rrp || record.recommended_retail_price || null,
      record.stock_at_takealot_total || record.stock_quantity || 0,
      record.status || null,
      record.is_active !== undefined ? record.is_active : true,
      record.visibility || null,
      record.promotion_type || null,
      record.views || 0,
      record.clicks || 0,
      record.conversion_rate || 0,
      record.category || record.subcategory || null,
      record.brand || null,
      JSON.stringify({
        tsin_id: record.tsin_id,
        barcode: record.barcode,
        image_url: record.image_url,
        offer_url: record.offer_url,
        leadtime_days: record.leadtime_days,
        storage_fee_eligible: record.storage_fee_eligible
      })
    ];
    
    await client.query(query, values);
  }

  /**
   * Fallback: Write records to Firebase
   */
  private async writeToFirebase(records: TakealotRecord[]): Promise<{success: boolean; recordsWritten: number; error?: string}> {
    try {
      const collectionName = this.dataType === 'sales' ? 'takealot_sales' : 'takealot_offers';
      const batchSize = 500; // Firestore batch limit
      let recordsWritten = 0;
      
      for (let i = 0; i < records.length; i += batchSize) {
        const batch = db.batch();
        const batchRecords = records.slice(i, i + batchSize);
        
        for (const record of batchRecords) {
          const docId = this.dataType === 'sales' 
            ? record.order_id || `${this.integrationId}_${Date.now()}_${Math.random()}`
            : record.tsin_id || `${this.integrationId}_${Date.now()}_${Math.random()}`;
          
          const docRef = db.collection(collectionName).doc(docId);
          
          const firebaseRecord = {
            ...record,
            integrationId: this.integrationId,
            adminId: this.adminUid,
            created_at: Timestamp.now(),
            updated_at: Timestamp.now(),
            synced_from_neon_failure: true // Mark as fallback
          };
          
          batch.set(docRef, firebaseRecord, { merge: true });
          recordsWritten++;
        }
        
        await batch.commit();
      }
      
      return { success: true, recordsWritten };
      
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown Firebase error';
      return { success: false, recordsWritten: 0, error: errorMessage };
    }
  }

  /**
   * Log operation for monitoring and debugging
   */
  private async logOperation(operation: string, data: any): Promise<void> {
    try {
      // Simple console logging for now
      console.log(`[DualWrite] Operation: ${operation}`, {
        adminUid: this.adminUid,
        integrationId: this.integrationId,
        dataType: this.dataType,
        timestamp: new Date(),
        ...data
      });
    } catch (error) {
      console.error('[DualWrite] Failed to log operation:', error);
    }
  }

  /**
   * Test connection to both Neon and Firebase
   */
  async testConnections(): Promise<{neon: boolean; firebase: boolean; errors: string[]}> {
    const result: {neon: boolean; firebase: boolean; errors: string[]} = {
      neon: false,
      firebase: false,
      errors: []
    };

    // Test Neon connection
    try {
      const client = await neonPool.connect();
      await client.query('SELECT 1');
      client.release();
      result.neon = true;
    } catch (error) {
      result.errors.push(`Neon connection failed: ${error}`);
    }

    // Test Firebase connection
    try {
      await db.collection('_test').limit(1).get();
      result.firebase = true;
    } catch (error) {
      result.errors.push(`Firebase connection failed: ${error}`);
    }

    return result;
  }

  /**
   * Explicit Firebase fallback when user chooses it after Neon failure
   */
  async writeToFirebaseExplicit(records: TakealotRecord[]): Promise<DualWriteResult> {
    const startTime = Date.now();
    const result: DualWriteResult = {
      success: false,
      neonSuccess: false,
      firebaseSuccess: false,
      recordsProcessed: records.length,
      neonRecordsWritten: 0,
      firebaseRecordsWritten: 0,
      errors: [],
      warnings: ['User chose Firebase fallback after Neon failure'],
      strategy: 'firebase-fallback'
    };

    console.log(`[DualWrite] User chose Firebase fallback for ${records.length} ${this.dataType} records`);

    try {
      const firebaseResult = await this.writeToFirebase(records);
      
      if (firebaseResult.success) {
        result.firebaseSuccess = true;
        result.firebaseRecordsWritten = firebaseResult.recordsWritten;
        result.success = true;
        
        console.log(`[DualWrite] ✅ Explicit Firebase write successful! ${firebaseResult.recordsWritten} records written`);
        
        // Log explicit fallback usage
        await this.logOperation('firebase-explicit-fallback', {
          recordsWritten: firebaseResult.recordsWritten,
          timeTaken: Date.now() - startTime,
          userChoice: true
        });
        
      } else {
        result.errors.push(`Firebase write failed: ${firebaseResult.error}`);
        result.success = false;
        
        console.log(`[DualWrite] ❌ Explicit Firebase write failed: ${firebaseResult.error}`);
      }
      
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      result.errors.push(`Firebase explicit write error: ${errorMessage}`);
      result.success = false;
    }

    return result;
  }
}

/**
 * Convenience function for dual-write operations
 */
export async function dualWriteTakealotData(
  adminUid: string,
  integrationId: string,
  dataType: 'sales' | 'offers',
  records: TakealotRecord[],
  accountName: string = 'Takealot'
): Promise<DualWriteResult> {
  const dualWriteService = new DualWriteService(adminUid, integrationId, dataType);
  return await dualWriteService.writeRecords(records, accountName);
}

/**
 * Test dual-write connections
 */
export async function testDualWriteConnections(
  adminUid: string,
  integrationId: string,
  dataType: 'sales' | 'offers'
): Promise<{neon: boolean; firebase: boolean; errors: string[]}> {
  const dualWriteService = new DualWriteService(adminUid, integrationId, dataType);
  return await dualWriteService.testConnections();
}
