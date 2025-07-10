// Service for working with shared Takealot table
import { neon } from '@neondatabase/serverless';

export class SharedTakealotService {
  constructor() {
    this.sql = neon(process.env.NEON_DATABASE_URL);
  }

  // Set admin context for RLS
  async setAdminContext(adminUid) {
    await this.sql`SET app.current_admin_uid = ${adminUid}`;
  }

  // Get all sales for an admin
  async getSales(adminUid, integrationId = null, limit = 100, offset = 0) {
    await this.setAdminContext(adminUid);
    
    if (integrationId) {
      return await this.sql`
        SELECT * FROM takealot_data 
        WHERE admin_uid = ${adminUid} 
          AND integration_id = ${integrationId}
          AND data_type = 'sales'
        ORDER BY sale_date DESC 
        LIMIT ${limit} OFFSET ${offset}
      `;
    } else {
      return await this.sql`
        SELECT * FROM takealot_data 
        WHERE admin_uid = ${adminUid} 
          AND data_type = 'sales'
        ORDER BY sale_date DESC 
        LIMIT ${limit} OFFSET ${offset}
      `;
    }
  }

  // Get all offers for an admin
  async getOffers(adminUid, integrationId = null, limit = 100, offset = 0) {
    await this.setAdminContext(adminUid);
    
    if (integrationId) {
      return await this.sql`
        SELECT * FROM takealot_data 
        WHERE admin_uid = ${adminUid} 
          AND integration_id = ${integrationId}
          AND data_type = 'offers'
        ORDER BY created_at DESC 
        LIMIT ${limit} OFFSET ${offset}
      `;
    } else {
      return await this.sql`
        SELECT * FROM takealot_data 
        WHERE admin_uid = ${adminUid} 
          AND data_type = 'offers'
        ORDER BY created_at DESC 
        LIMIT ${limit} OFFSET ${offset}
      `;
    }
  }

  // Insert new sales data
  async insertSalesData(adminUid, integrationId, salesData) {
    await this.setAdminContext(adminUid);
    
    const results = [];
    for (const sale of salesData) {
      const result = await this.sql`
        INSERT INTO takealot_data (
          admin_uid, integration_id, account_name, data_type,
          takealot_id, product_id, sku, product_name,
          sale_amount, quantity_sold, sale_date,
          commission_amount, commission_rate,
          category, brand, status, raw_data, metadata
        ) VALUES (
          ${adminUid}, ${integrationId}, ${sale.account_name || null}, 'sales',
          ${sale.sale_id}, ${sale.product_id}, ${sale.sku}, ${sale.product_name},
          ${sale.sale_amount}, ${sale.quantity_sold || 1}, ${sale.sale_date},
          ${sale.commission_amount || null}, ${sale.commission_rate || null},
          ${sale.category || null}, ${sale.brand || null}, ${sale.status || 'completed'},
          ${JSON.stringify(sale)}, ${JSON.stringify({ synced_at: new Date() })}
        )
        ON CONFLICT (admin_uid, integration_id, data_type, takealot_id) 
        DO UPDATE SET
          sale_amount = EXCLUDED.sale_amount,
          quantity_sold = EXCLUDED.quantity_sold,
          updated_at = NOW(),
          raw_data = EXCLUDED.raw_data
        RETURNING id;
      `;
      results.push(result[0]);
    }
    return results;
  }

  // Insert new offers data
  async insertOffersData(adminUid, integrationId, offersData) {
    await this.setAdminContext(adminUid);
    
    const results = [];
    for (const offer of offersData) {
      const result = await this.sql`
        INSERT INTO takealot_data (
          admin_uid, integration_id, account_name, data_type,
          takealot_id, product_id, sku, product_name,
          offer_price, stock_quantity, is_active,
          offer_start_date, offer_end_date,
          category, brand, status, raw_data, metadata
        ) VALUES (
          ${adminUid}, ${integrationId}, ${offer.account_name || null}, 'offers',
          ${offer.offer_id}, ${offer.product_id}, ${offer.sku}, ${offer.product_name},
          ${offer.offer_price}, ${offer.stock_quantity || 0}, ${offer.is_active !== false},
          ${offer.offer_start_date || new Date()}, ${offer.offer_end_date || null},
          ${offer.category || null}, ${offer.brand || null}, ${offer.status || 'active'},
          ${JSON.stringify(offer)}, ${JSON.stringify({ synced_at: new Date() })}
        )
        ON CONFLICT (admin_uid, integration_id, data_type, takealot_id) 
        DO UPDATE SET
          offer_price = EXCLUDED.offer_price,
          stock_quantity = EXCLUDED.stock_quantity,
          is_active = EXCLUDED.is_active,
          updated_at = NOW(),
          raw_data = EXCLUDED.raw_data
        RETURNING id;
      `;
      results.push(result[0]);
    }
    return results;
  }

  // Get analytics for an admin
  async getAnalytics(adminUid, integrationId = null) {
    await this.setAdminContext(adminUid);
    
    const whereClause = integrationId 
      ? `admin_uid = '${adminUid}' AND integration_id = '${integrationId}'`
      : `admin_uid = '${adminUid}'`;

    const analytics = await this.sql`
      SELECT 
        data_type,
        integration_id,
        COUNT(*) as total_records,
        COUNT(CASE WHEN data_type = 'sales' THEN 1 END) as sales_count,
        COUNT(CASE WHEN data_type = 'offers' THEN 1 END) as offers_count,
        SUM(CASE WHEN data_type = 'sales' THEN sale_amount ELSE 0 END) as total_revenue,
        SUM(CASE WHEN data_type = 'sales' THEN commission_amount ELSE 0 END) as total_commission,
        AVG(CASE WHEN data_type = 'sales' THEN sale_amount END) as avg_sale_amount
      FROM takealot_data 
      WHERE ${whereClause}
      GROUP BY data_type, integration_id
      ORDER BY data_type, integration_id
    `;

    return analytics;
  }

  // Get recent activity
  async getRecentActivity(adminUid, integrationId = null, days = 7) {
    await this.setAdminContext(adminUid);
    
    const whereClause = integrationId 
      ? `admin_uid = '${adminUid}' AND integration_id = '${integrationId}'`
      : `admin_uid = '${adminUid}'`;

    return await this.sql`
      SELECT 
        data_type,
        DATE(COALESCE(sale_date, created_at)) as activity_date,
        COUNT(*) as record_count,
        SUM(CASE WHEN data_type = 'sales' THEN sale_amount ELSE 0 END) as daily_revenue
      FROM takealot_data 
      WHERE ${whereClause}
        AND COALESCE(sale_date, created_at) >= NOW() - INTERVAL '${days} days'
      GROUP BY data_type, activity_date
      ORDER BY activity_date DESC, data_type
    `;
  }

  // Search products by SKU or name
  async searchProducts(adminUid, searchTerm, integrationId = null) {
    await this.setAdminContext(adminUid);
    
    const whereClause = integrationId 
      ? `admin_uid = '${adminUid}' AND integration_id = '${integrationId}'`
      : `admin_uid = '${adminUid}'`;

    return await this.sql`
      SELECT DISTINCT
        product_id,
        sku,
        product_name,
        category,
        brand,
        data_type,
        COUNT(*) as record_count
      FROM takealot_data 
      WHERE ${whereClause}
        AND (
          sku ILIKE ${'%' + searchTerm + '%'} OR 
          product_name ILIKE ${'%' + searchTerm + '%'}
        )
      GROUP BY product_id, sku, product_name, category, brand, data_type
      ORDER BY record_count DESC, product_name
      LIMIT 50
    `;
  }

  // Get integration summary
  async getIntegrationSummary(adminUid) {
    await this.setAdminContext(adminUid);
    
    return await this.sql`
      SELECT 
        integration_id,
        account_name,
        COUNT(*) as total_records,
        COUNT(CASE WHEN data_type = 'sales' THEN 1 END) as sales_count,
        COUNT(CASE WHEN data_type = 'offers' THEN 1 END) as offers_count,
        SUM(CASE WHEN data_type = 'sales' THEN sale_amount ELSE 0 END) as total_revenue,
        MAX(COALESCE(sale_date, created_at)) as last_activity
      FROM takealot_data 
      WHERE admin_uid = ${adminUid}
      GROUP BY integration_id, account_name
      ORDER BY last_activity DESC
    `;
  }
}

// Export as default for ES modules
export default SharedTakealotService;

// Example usage:
/*
const takealotService = new SharedTakealotService();

// Get sales for an admin
const sales = await takealotService.getSales('admin123', 'integration456');

// Insert new sales data
await takealotService.insertSalesData('admin123', 'integration456', [
  {
    sale_id: 'TK123456',
    product_id: 'PROD789',
    sku: 'SKU001',
    product_name: 'Test Product',
    sale_amount: 99.99,
    quantity_sold: 2,
    sale_date: new Date(),
    commission_amount: 9.99
  }
]);

// Get analytics
const analytics = await takealotService.getAnalytics('admin123');
*/

// No module.exports needed for ES modules
