// src/lib/neon/dual-write.service.ts
// Dual-write service for Takealot data migration
// Strategy: Try Neon first, fallback to Firebase if it fails

import { Pool } from 'pg';
import { db } from '@/lib/firebase/firebase';
import { collection, addDoc, updateDoc, doc, query, where, getDocs, deleteDoc, writeBatch } from 'firebase/firestore';

// Neon Database Configuration
const NEON_CONFIG = {
  connectionString: process.env.NEON_DATABASE_URL,
  ssl: true,
  max: 10, // Maximum number of connections in the pool
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
};

// Your Firebase Auth UID (confirmed from screenshots)
const FIREBASE_AUTH_UID = 'xKJD56reqGPq6FD8jlpWLGZqHiG2';

// Integration IDs (verified from Firebase data)
const INTEGRATION_IDS = {
  MALLA_TRADING: 'HFfQTUMDN21vbKCDNzv3',
  NGAT: 'XsGCVrhDVP9gjASGHCp'
};

export interface TakealotSale {
  order_id: string;
  product_title?: string;
  customer_name?: string;
  order_date?: Date;
  selling_price?: number;
  quantity?: number;
  status?: string;
  tsin_id?: string;
  sku?: string;
  customer_dc?: string;
  takealot_url_mol?: string;
  success_fee?: number;
  total_fee?: number;
  stock_transfer_fee?: number;
  courier_collection_fee?: number;
  commission?: number;
  order_status?: string;
  return_status?: string;
  is_return?: boolean;
  customer_city?: string;
  payment_method?: string;
  order_item_id?: string;
  integration_id: string;
  admin_uid: string;
  created_at?: Date;
  updated_at?: Date;
  synced_from_firebase?: boolean;
}

export interface TakealotOffer {
  tsin_id: string;
  product_title?: string;
  brand?: string;
  category?: string;
  subcategory?: string;
  sku?: string;
  selling_price?: number;
  cost_price?: number;
  recommended_retail_price?: number;
  stock_at_takealot_total?: number;
  total_stock_on_way?: number;
  status?: string;
  is_active?: boolean;
  offer_id?: string;
  lead_time?: number;
  weight?: number;
  dimensions?: any;
  images?: any;
  description?: string;
  image_url?: string;
  offer_url?: string;
  stock_dbn?: number;
  stock_cpt?: number;
  stock_jhb?: number;
  qty_require?: number;
  total_sold?: number;
  sold_30_days?: number;
  returned_30_days?: number;
  avg_selling_price?: number;
  return_rate?: number;
  days_since_last_order?: number;
  integration_id: string;
  admin_uid: string;
  created_at?: Date;
  updated_at?: Date;
  last_calculation_at?: Date;
  calculation_method?: string;
  synced_from_firebase?: boolean;
}

export interface WriteResult {
  success: boolean;
  source: 'neon' | 'firebase';
  error?: string;
  recordId?: string;
}

export interface ReadResult<T> {
  success: boolean;
  data: T[];
  source: 'neon' | 'firebase';
  error?: string;
}

export class DualWriteService {
  private neonPool: Pool;
  private isNeonHealthy: boolean = true;

  constructor() {
    this.neonPool = new Pool(NEON_CONFIG);
    this.initializeHealthCheck();
  }

  private async initializeHealthCheck() {
    try {
      await this.neonPool.query('SELECT 1');
      this.isNeonHealthy = true;
      console.log('✅ Neon database connection healthy');
    } catch (error) {
      console.error('❌ Neon database connection failed:', error);
      this.isNeonHealthy = false;
    }
  }

  private async checkNeonHealth(): Promise<boolean> {
    if (!this.isNeonHealthy) {
      return false;
    }

    try {
      const result = await this.neonPool.query('SELECT 1');
      return result.rows.length > 0;
    } catch (error) {
      console.error('Neon health check failed:', error);
      this.isNeonHealthy = false;
      return false;
    }
  }

  private getNeonTableName(dataType: 'sales' | 'offers'): string {
    return `takealot_${dataType}_admin_${FIREBASE_AUTH_UID.toLowerCase()}`;
  }

  private getFirebaseCollectionName(dataType: 'sales' | 'offers'): string {
    return dataType === 'sales' ? 'takealot_sales' : 'takealot_offers';
  }

  // Write operations: Try Neon first, fallback to Firebase
  async writeSale(sale: TakealotSale): Promise<WriteResult> {
    // Strategy: Try Neon first, fallback to Firebase
    try {
      if (await this.checkNeonHealth()) {
        const result = await this.writeToNeon('sales', sale);
        if (result.success) {
          return { success: true, source: 'neon', recordId: result.recordId };
        }
      }
    } catch (neonError) {
      console.warn('Neon write failed, falling back to Firebase:', neonError);
    }

    // Fallback to Firebase
    try {
      const result = await this.writeToFirebase('sales', sale);
      return { success: true, source: 'firebase', recordId: result.recordId };
    } catch (firebaseError) {
      console.error('Both Neon and Firebase writes failed:', firebaseError);
      return { 
        success: false, 
        source: 'firebase', 
        error: `Both databases failed: ${firebaseError}` 
      };
    }
  }

  async writeOffer(offer: TakealotOffer): Promise<WriteResult> {
    // Strategy: Try Neon first, fallback to Firebase
    try {
      if (await this.checkNeonHealth()) {
        const result = await this.writeToNeon('offers', offer);
        if (result.success) {
          return { success: true, source: 'neon', recordId: result.recordId };
        }
      }
    } catch (neonError) {
      console.warn('Neon write failed, falling back to Firebase:', neonError);
    }

    // Fallback to Firebase
    try {
      const result = await this.writeToFirebase('offers', offer);
      return { success: true, source: 'firebase', recordId: result.recordId };
    } catch (firebaseError) {
      console.error('Both Neon and Firebase writes failed:', firebaseError);
      return { 
        success: false, 
        source: 'firebase', 
        error: `Both databases failed: ${firebaseError}` 
      };
    }
  }

  private async writeToNeon(dataType: 'sales' | 'offers', data: TakealotSale | TakealotOffer): Promise<{ success: boolean; recordId?: string }> {
    const tableName = this.getNeonTableName(dataType);
    const client = await this.neonPool.connect();

    try {
      if (dataType === 'sales') {
        const sale = data as TakealotSale;
        const query = `
          INSERT INTO ${tableName} (
            order_id, product_title, customer_name, order_date, selling_price, quantity, status,
            tsin_id, sku, customer_dc, takealot_url_mol, success_fee, total_fee, stock_transfer_fee,
            courier_collection_fee, commission, order_status, return_status, is_return, customer_city,
            payment_method, order_item_id, integration_id, admin_uid, created_at, updated_at, synced_from_firebase
          ) VALUES (
            $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24, $25, $26, $27
          )
          ON CONFLICT (order_id, integration_id) DO UPDATE SET
            product_title = EXCLUDED.product_title,
            customer_name = EXCLUDED.customer_name,
            order_date = EXCLUDED.order_date,
            selling_price = EXCLUDED.selling_price,
            quantity = EXCLUDED.quantity,
            status = EXCLUDED.status,
            updated_at = CURRENT_TIMESTAMP
          RETURNING id
        `;

        const values = [
          sale.order_id,
          sale.product_title || null,
          sale.customer_name || null,
          sale.order_date || null,
          sale.selling_price || null,
          sale.quantity || null,
          sale.status || null,
          sale.tsin_id || null,
          sale.sku || null,
          sale.customer_dc || null,
          sale.takealot_url_mol || null,
          sale.success_fee || null,
          sale.total_fee || null,
          sale.stock_transfer_fee || null,
          sale.courier_collection_fee || null,
          sale.commission || null,
          sale.order_status || null,
          sale.return_status || null,
          sale.is_return || false,
          sale.customer_city || null,
          sale.payment_method || null,
          sale.order_item_id || null,
          sale.integration_id,
          sale.admin_uid,
          sale.created_at || new Date(),
          sale.updated_at || new Date(),
          sale.synced_from_firebase || false
        ];

        const result = await client.query(query, values);
        return { success: true, recordId: result.rows[0]?.id?.toString() };
      } else {
        const offer = data as TakealotOffer;
        const query = `
          INSERT INTO ${tableName} (
            tsin_id, product_title, brand, category, subcategory, sku, selling_price, cost_price,
            recommended_retail_price, stock_at_takealot_total, total_stock_on_way, status, is_active,
            offer_id, lead_time, weight, dimensions, images, description, image_url, offer_url,
            stock_dbn, stock_cpt, stock_jhb, qty_require, total_sold, sold_30_days, returned_30_days,
            avg_selling_price, return_rate, days_since_last_order, integration_id, admin_uid,
            created_at, updated_at, last_calculation_at, calculation_method, synced_from_firebase
          ) VALUES (
            $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24, $25, $26, $27, $28, $29, $30, $31, $32, $33, $34, $35, $36, $37, $38
          )
          ON CONFLICT (tsin_id, integration_id) DO UPDATE SET
            product_title = EXCLUDED.product_title,
            brand = EXCLUDED.brand,
            category = EXCLUDED.category,
            selling_price = EXCLUDED.selling_price,
            status = EXCLUDED.status,
            updated_at = CURRENT_TIMESTAMP
          RETURNING id
        `;

        const values = [
          offer.tsin_id,
          offer.product_title || null,
          offer.brand || null,
          offer.category || null,
          offer.subcategory || null,
          offer.sku || null,
          offer.selling_price || null,
          offer.cost_price || null,
          offer.recommended_retail_price || null,
          offer.stock_at_takealot_total || null,
          offer.total_stock_on_way || null,
          offer.status || null,
          offer.is_active || true,
          offer.offer_id || null,
          offer.lead_time || null,
          offer.weight || null,
          offer.dimensions ? JSON.stringify(offer.dimensions) : null,
          offer.images ? JSON.stringify(offer.images) : null,
          offer.description || null,
          offer.image_url || null,
          offer.offer_url || null,
          offer.stock_dbn || null,
          offer.stock_cpt || null,
          offer.stock_jhb || null,
          offer.qty_require || null,
          offer.total_sold || null,
          offer.sold_30_days || null,
          offer.returned_30_days || null,
          offer.avg_selling_price || null,
          offer.return_rate || null,
          offer.days_since_last_order || null,
          offer.integration_id,
          offer.admin_uid,
          offer.created_at || new Date(),
          offer.updated_at || new Date(),
          offer.last_calculation_at || null,
          offer.calculation_method || null,
          offer.synced_from_firebase || false
        ];

        const result = await client.query(query, values);
        return { success: true, recordId: result.rows[0]?.id?.toString() };
      }
    } catch (error) {
      console.error(`Neon write failed for ${dataType}:`, error);
      return { success: false };
    } finally {
      client.release();
    }
  }

  private async writeToFirebase(dataType: 'sales' | 'offers', data: TakealotSale | TakealotOffer): Promise<{ success: boolean; recordId?: string }> {
    const collectionName = this.getFirebaseCollectionName(dataType);
    
    try {
      const docRef = await addDoc(collection(db, collectionName), {
        ...data,
        created_at: new Date(),
        updated_at: new Date()
      });
      
      return { success: true, recordId: docRef.id };
    } catch (error) {
      console.error(`Firebase write failed for ${dataType}:`, error);
      throw error;
    }
  }

  // Read operations: Try Neon first, fallback to Firebase
  async readSales(integrationId: string, limit: number = 100): Promise<ReadResult<TakealotSale>> {
    // Try Neon first
    try {
      if (await this.checkNeonHealth()) {
        const result = await this.readFromNeon('sales', integrationId, limit);
        if (result.success) {
          return { success: true, data: result.data as TakealotSale[], source: 'neon' };
        }
      }
    } catch (neonError) {
      console.warn('Neon read failed, falling back to Firebase:', neonError);
    }

    // Fallback to Firebase
    try {
      const result = await this.readFromFirebase('sales', integrationId, limit);
      return { success: true, data: result.data as TakealotSale[], source: 'firebase' };
    } catch (firebaseError) {
      console.error('Both Neon and Firebase reads failed:', firebaseError);
      return { 
        success: false, 
        data: [], 
        source: 'firebase', 
        error: `Both databases failed: ${firebaseError}` 
      };
    }
  }

  async readOffers(integrationId: string, limit: number = 100): Promise<ReadResult<TakealotOffer>> {
    // Try Neon first
    try {
      if (await this.checkNeonHealth()) {
        const result = await this.readFromNeon('offers', integrationId, limit);
        if (result.success) {
          return { success: true, data: result.data as TakealotOffer[], source: 'neon' };
        }
      }
    } catch (neonError) {
      console.warn('Neon read failed, falling back to Firebase:', neonError);
    }

    // Fallback to Firebase
    try {
      const result = await this.readFromFirebase('offers', integrationId, limit);
      return { success: true, data: result.data as TakealotOffer[], source: 'firebase' };
    } catch (firebaseError) {
      console.error('Both Neon and Firebase reads failed:', firebaseError);
      return { 
        success: false, 
        data: [], 
        source: 'firebase', 
        error: `Both databases failed: ${firebaseError}` 
      };
    }
  }

  private async readFromNeon(dataType: 'sales' | 'offers', integrationId: string, limit: number): Promise<{ success: boolean; data: any[] }> {
    const tableName = this.getNeonTableName(dataType);
    const client = await this.neonPool.connect();

    try {
      const query = `
        SELECT * FROM ${tableName} 
        WHERE integration_id = $1 
        ORDER BY created_at DESC 
        LIMIT $2
      `;

      const result = await client.query(query, [integrationId, limit]);
      return { success: true, data: result.rows };
    } catch (error) {
      console.error(`Neon read failed for ${dataType}:`, error);
      return { success: false, data: [] };
    } finally {
      client.release();
    }
  }

  private async readFromFirebase(dataType: 'sales' | 'offers', integrationId: string, limit: number): Promise<{ success: boolean; data: any[] }> {
    const collectionName = this.getFirebaseCollectionName(dataType);
    
    try {
      const q = query(
        collection(db, collectionName),
        where('integrationId', '==', integrationId)
      );

      const querySnapshot = await getDocs(q);
      const data: any[] = [];

      querySnapshot.forEach((doc) => {
        data.push({
          id: doc.id,
          ...doc.data()
        });
      });

      return { success: true, data: data.slice(0, limit) };
    } catch (error) {
      console.error(`Firebase read failed for ${dataType}:`, error);
      throw error;
    }
  }

  // Batch operations
  async writeSalesBatch(sales: TakealotSale[]): Promise<WriteResult[]> {
    const results: WriteResult[] = [];
    
    for (const sale of sales) {
      const result = await this.writeSale(sale);
      results.push(result);
    }
    
    return results;
  }

  async writeOffersBatch(offers: TakealotOffer[]): Promise<WriteResult[]> {
    const results: WriteResult[] = [];
    
    for (const offer of offers) {
      const result = await this.writeOffer(offer);
      results.push(result);
    }
    
    return results;
  }

  // Health check and diagnostics
  async getDatabaseStatus(): Promise<{ neon: boolean; firebase: boolean }> {
    const neonHealthy = await this.checkNeonHealth();
    
    let firebaseHealthy = false;
    try {
      // Simple Firebase health check
      const testQuery = query(collection(db, 'takealot_sales'), where('admin_uid', '==', 'test'));
      await getDocs(testQuery);
      firebaseHealthy = true;
    } catch (error) {
      console.error('Firebase health check failed:', error);
    }

    return { neon: neonHealthy, firebase: firebaseHealthy };
  }

  // Cleanup
  async close(): Promise<void> {
    await this.neonPool.end();
  }
}

// Export singleton instance
export const dualWriteService = new DualWriteService();
