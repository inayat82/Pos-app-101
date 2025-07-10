import { Client } from 'pg';

// Types for Takealot data
export interface Product {
  id: number;
  tsin_id: string;
  title?: string;
  brand?: string;
  category?: string;
  subcategory?: string;
  sku?: string;
  selling_price: number;
  cost_price: number;
  recommended_retail_price: number;
  stock_at_takealot_total: number;
  total_stock_on_way: number;
  status?: string;
  is_active: boolean;
  offer_id?: string;
  lead_time: number;
  weight: number;
  dimensions?: any;
  images?: any;
  description?: string;
  image_url?: string;
  offer_url?: string;
  stock_dbn: number;
  stock_cpt: number;
  stock_jhb: number;
  qty_require: number;
  total_sold: number;
  sold_30_days: number;
  returned_30_days: number;
  avg_selling_price: number;
  return_rate: number;
  days_since_last_order: number;
  integration_id: string;
  admin_uid: string;
  created_at: Date;
  updated_at: Date;
  last_calculation_at?: Date;
  calculation_method?: string;
  synced_from_firebase: boolean;
}

export interface Sale {
  id: number;
  order_id: string;
  product_title?: string;
  customer_name?: string;
  order_date?: Date;
  selling_price?: number;
  quantity: number;
  status?: string;
  tsin_id?: string;
  sku?: string;
  customer_dc?: string;
  takealot_url_mol?: string;
  success_fee: number;
  total_fee: number;
  stock_transfer_fee: number;
  courier_collection_fee: number;
  commission: number;
  order_status?: string;
  return_status?: string;
  is_return: boolean;
  customer_city?: string;
  payment_method?: string;
  order_item_id?: string;
  integration_id: string;
  admin_uid: string;
  created_at: Date;
  updated_at: Date;
  synced_from_firebase: boolean;
}

export interface ProductFilters {
  search?: string;
  status?: string[];
  category?: string;
  brand?: string;
  stock_level?: 'all' | 'in_stock' | 'out_of_stock';
  price_range?: { min: number; max: number };
}

export interface SalesFilters {
  search?: string;
  date_range?: { start: Date; end: Date };
  status?: string[];
  customer_dc?: string;
  order_status?: string[];
}

/**
 * Neon Data Service for Takealot data
 * Provides methods to read Takealot products and sales data from Neon database
 */
export class NeonDataService {
  private static instance: NeonDataService;
  private client: Client | null = null;

  private constructor() {}

  static getInstance(): NeonDataService {
    if (!NeonDataService.instance) {
      NeonDataService.instance = new NeonDataService();
    }
    return NeonDataService.instance;
  }

  /**
   * Initialize database connection
   */
  private async getConnection(): Promise<Client> {
    if (!this.client) {
      this.client = new Client({
        connectionString: process.env.DATABASE_URL,
      });
      await this.client.connect();
    }
    return this.client;
  }

  /**
   * Generate table name for admin
   */
  private getProductTableName(adminUid: string): string {
    return `takealot_offers_admin_${adminUid}`;
  }

  private getSalesTableName(adminUid: string): string {
    return `takealot_sales_admin_${adminUid}`;
  }

  /**
   * Get admin UID from integration ID
   */
  private async getAdminUidFromIntegration(integrationId: string): Promise<string> {
    // For now, we'll extract admin UID from existing data
    // In production, this should come from integration management
    const client = await this.getConnection();
    
    // Try to find admin_uid from existing product data
    try {
      const result = await client.query(
        `SELECT DISTINCT admin_uid FROM information_schema.tables 
         WHERE table_name LIKE 'takealot_offers_admin_%' 
         LIMIT 1`
      );
      
      if (result.rows.length > 0) {
        // Extract admin_uid from table name
        const tableName = result.rows[0].table_name;
        return tableName.replace('takealot_offers_admin_', '');
      }
    } catch (error) {
      console.warn('Could not determine admin UID from tables, using fallback');
    }
    
    // Fallback: use known admin UID from migration
    return 'xKJD56reqGPq6FD8jlpWLGZqHiG2';
  }

  /**
   * Get all products for an integration
   */
  async getProducts(integrationId: string): Promise<Product[]> {
    try {
      const client = await this.getConnection();
      const adminUid = await this.getAdminUidFromIntegration(integrationId);
      const tableName = this.getProductTableName(adminUid);
      
      const query = `
        SELECT * FROM ${tableName} 
        WHERE integration_id = $1 
        ORDER BY created_at DESC
      `;
      
      const result = await client.query(query, [integrationId]);
      return result.rows;
    } catch (error) {
      console.error('Error fetching products from Neon:', error);
      throw new Error(`Failed to fetch products: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get products with filters
   */
  async getProductsWithFilters(integrationId: string, filters: ProductFilters): Promise<Product[]> {
    try {
      const client = await this.getConnection();
      const adminUid = await this.getAdminUidFromIntegration(integrationId);
      const tableName = this.getProductTableName(adminUid);
      
      let query = `SELECT * FROM ${tableName} WHERE integration_id = $1`;
      const params: any[] = [integrationId];
      let paramIndex = 2;
      
      // Add search filter
      if (filters.search) {
        query += ` AND (title ILIKE $${paramIndex} OR sku ILIKE $${paramIndex} OR tsin_id ILIKE $${paramIndex})`;
        params.push(`%${filters.search}%`);
        paramIndex++;
      }
      
      // Add status filter
      if (filters.status && filters.status.length > 0) {
        query += ` AND status = ANY($${paramIndex})`;
        params.push(filters.status);
        paramIndex++;
      }
      
      // Add category filter
      if (filters.category) {
        query += ` AND category = $${paramIndex}`;
        params.push(filters.category);
        paramIndex++;
      }
      
      // Add brand filter
      if (filters.brand) {
        query += ` AND brand = $${paramIndex}`;
        params.push(filters.brand);
        paramIndex++;
      }
      
      // Add stock level filter
      if (filters.stock_level) {
        if (filters.stock_level === 'in_stock') {
          query += ` AND stock_at_takealot_total > 0`;
        } else if (filters.stock_level === 'out_of_stock') {
          query += ` AND stock_at_takealot_total = 0`;
        }
      }
      
      // Add price range filter
      if (filters.price_range) {
        query += ` AND selling_price BETWEEN $${paramIndex} AND $${paramIndex + 1}`;
        params.push(filters.price_range.min, filters.price_range.max);
        paramIndex += 2;
      }
      
      query += ` ORDER BY created_at DESC`;
      
      const result = await client.query(query, params);
      return result.rows;
    } catch (error) {
      console.error('Error fetching filtered products from Neon:', error);
      throw new Error(`Failed to fetch filtered products: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get single product by TSIN ID
   */
  async getProduct(integrationId: string, tsinId: string): Promise<Product | null> {
    try {
      const client = await this.getConnection();
      const adminUid = await this.getAdminUidFromIntegration(integrationId);
      const tableName = this.getProductTableName(adminUid);
      
      const query = `
        SELECT * FROM ${tableName} 
        WHERE integration_id = $1 AND tsin_id = $2
        LIMIT 1
      `;
      
      const result = await client.query(query, [integrationId, tsinId]);
      return result.rows.length > 0 ? result.rows[0] : null;
    } catch (error) {
      console.error('Error fetching product from Neon:', error);
      throw new Error(`Failed to fetch product: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get all sales for an integration
   */
  async getSales(integrationId: string): Promise<Sale[]> {
    try {
      const client = await this.getConnection();
      const adminUid = await this.getAdminUidFromIntegration(integrationId);
      const tableName = this.getSalesTableName(adminUid);
      
      const query = `
        SELECT * FROM ${tableName} 
        WHERE integration_id = $1 
        ORDER BY order_date DESC, created_at DESC
      `;
      
      const result = await client.query(query, [integrationId]);
      return result.rows;
    } catch (error) {
      console.error('Error fetching sales from Neon:', error);
      throw new Error(`Failed to fetch sales: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get sales with filters
   */
  async getSalesWithFilters(integrationId: string, filters: SalesFilters): Promise<Sale[]> {
    try {
      const client = await this.getConnection();
      const adminUid = await this.getAdminUidFromIntegration(integrationId);
      const tableName = this.getSalesTableName(adminUid);
      
      let query = `SELECT * FROM ${tableName} WHERE integration_id = $1`;
      const params: any[] = [integrationId];
      let paramIndex = 2;
      
      // Add search filter
      if (filters.search) {
        query += ` AND (product_title ILIKE $${paramIndex} OR order_id ILIKE $${paramIndex} OR customer_name ILIKE $${paramIndex})`;
        params.push(`%${filters.search}%`);
        paramIndex++;
      }
      
      // Add date range filter
      if (filters.date_range) {
        query += ` AND order_date BETWEEN $${paramIndex} AND $${paramIndex + 1}`;
        params.push(filters.date_range.start, filters.date_range.end);
        paramIndex += 2;
      }
      
      // Add status filter
      if (filters.status && filters.status.length > 0) {
        query += ` AND status = ANY($${paramIndex})`;
        params.push(filters.status);
        paramIndex++;
      }
      
      // Add customer DC filter
      if (filters.customer_dc) {
        query += ` AND customer_dc = $${paramIndex}`;
        params.push(filters.customer_dc);
        paramIndex++;
      }
      
      // Add order status filter
      if (filters.order_status && filters.order_status.length > 0) {
        query += ` AND order_status = ANY($${paramIndex})`;
        params.push(filters.order_status);
        paramIndex++;
      }
      
      query += ` ORDER BY order_date DESC, created_at DESC`;
      
      const result = await client.query(query, params);
      return result.rows;
    } catch (error) {
      console.error('Error fetching filtered sales from Neon:', error);
      throw new Error(`Failed to fetch filtered sales: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get sales for a specific date range
   */
  async getSalesByDateRange(integrationId: string, startDate: Date, endDate: Date): Promise<Sale[]> {
    return this.getSalesWithFilters(integrationId, {
      date_range: { start: startDate, end: endDate }
    });
  }

  /**
   * Get sales for a specific product
   */
  async getSalesByProduct(integrationId: string, tsinId: string): Promise<Sale[]> {
    try {
      const client = await this.getConnection();
      const adminUid = await this.getAdminUidFromIntegration(integrationId);
      const tableName = this.getSalesTableName(adminUid);
      
      const query = `
        SELECT * FROM ${tableName} 
        WHERE integration_id = $1 AND tsin_id = $2 
        ORDER BY order_date DESC
      `;
      
      const result = await client.query(query, [integrationId, tsinId]);
      return result.rows;
    } catch (error) {
      console.error('Error fetching product sales from Neon:', error);
      throw new Error(`Failed to fetch product sales: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get product count for an integration
   */
  async getProductCount(integrationId: string): Promise<number> {
    try {
      const client = await this.getConnection();
      const adminUid = await this.getAdminUidFromIntegration(integrationId);
      const tableName = this.getProductTableName(adminUid);
      
      const query = `SELECT COUNT(*) as count FROM ${tableName} WHERE integration_id = $1`;
      const result = await client.query(query, [integrationId]);
      
      return parseInt(result.rows[0].count);
    } catch (error) {
      console.error('Error fetching product count from Neon:', error);
      return 0;
    }
  }

  /**
   * Get sales count for an integration
   */
  async getSalesCount(integrationId: string): Promise<number> {
    try {
      const client = await this.getConnection();
      const adminUid = await this.getAdminUidFromIntegration(integrationId);
      const tableName = this.getSalesTableName(adminUid);
      
      const query = `SELECT COUNT(*) as count FROM ${tableName} WHERE integration_id = $1`;
      const result = await client.query(query, [integrationId]);
      
      return parseInt(result.rows[0].count);
    } catch (error) {
      console.error('Error fetching sales count from Neon:', error);
      return 0;
    }
  }

  /**
   * Get distinct categories for an integration
   */
  async getCategories(integrationId: string): Promise<string[]> {
    try {
      const client = await this.getConnection();
      const adminUid = await this.getAdminUidFromIntegration(integrationId);
      const tableName = this.getProductTableName(adminUid);
      
      const query = `
        SELECT DISTINCT category FROM ${tableName} 
        WHERE integration_id = $1 AND category IS NOT NULL 
        ORDER BY category
      `;
      
      const result = await client.query(query, [integrationId]);
      return result.rows.map(row => row.category);
    } catch (error) {
      console.error('Error fetching categories from Neon:', error);
      return [];
    }
  }

  /**
   * Get distinct brands for an integration
   */
  async getBrands(integrationId: string): Promise<string[]> {
    try {
      const client = await this.getConnection();
      const adminUid = await this.getAdminUidFromIntegration(integrationId);
      const tableName = this.getProductTableName(adminUid);
      
      const query = `
        SELECT DISTINCT brand FROM ${tableName} 
        WHERE integration_id = $1 AND brand IS NOT NULL 
        ORDER BY brand
      `;
      
      const result = await client.query(query, [integrationId]);
      return result.rows.map(row => row.brand);
    } catch (error) {
      console.error('Error fetching brands from Neon:', error);
      return [];
    }
  }

  /**
   * Close database connection
   */
  async disconnect(): Promise<void> {
    if (this.client) {
      await this.client.end();
      this.client = null;
    }
  }
}

// Export singleton instance
export const neonDataService = NeonDataService.getInstance();
