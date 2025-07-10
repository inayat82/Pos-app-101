import { Pool, PoolClient } from 'pg';
import path from 'path';
import { config } from 'dotenv';

// Load environment variables
if (typeof window === 'undefined') {
  // Server-side only
  config({ path: path.join(process.cwd(), '.env.local') });
}

interface SalesData {
    order_id: string;
    order_date: string;
    sku: string;
    product_title?: string;
    quantity?: number;
    selling_price: number;
    commission?: number;
    vat?: number;
    total_amount: number;
    order_status?: string;
    shipping_method?: string;
    customer_info?: any;
}

interface OffersData {
    offer_id: string;
    sku: string;
    product_title?: string;
    current_price: number;
    original_price?: number;
    stock_quantity?: number;
    offer_status?: string;
    is_active?: boolean;
    visibility?: string;
    promotion_type?: string;
    views?: number;
    clicks?: number;
    conversion_rate?: number;
    category_path?: string;
    brand?: string;
    offer_details?: any;
}

interface SalesFilters {
    dateFrom?: string;
    dateTo?: string;
    sku?: string;
    limit?: number;
}

interface OffersFilters {
    sku?: string;
    isActive?: boolean;
    status?: string;
    limit?: number;
}

export class NewTakealotService {
    private pool: Pool;

    constructor() {
        this.pool = new Pool({
            connectionString: process.env.NEON_DATABASE_URL,
            ssl: { rejectUnauthorized: false }
        });
    }

    // ===== SALES OPERATIONS =====
    
    /**
     * Insert sales data into takealot_sales table
     */
    async insertSalesData(
        adminUid: string, 
        integrationId: string, 
        accountName: string, 
        salesData: SalesData[]
    ) {
        const client = await this.pool.connect();
        try {
            const insertQuery = `
                INSERT INTO takealot_sales (
                    admin_uid, integration_id, account_name,
                    order_id, order_date, sku, product_title, quantity,
                    selling_price, commission, vat, total_amount,
                    order_status, shipping_method, customer_info
                ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
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

            const results = [];
            for (const sale of salesData) {
                const values = [
                    adminUid,
                    integrationId,
                    accountName,
                    sale.order_id,
                    sale.order_date,
                    sale.sku,
                    sale.product_title || null,
                    sale.quantity || 1,
                    sale.selling_price,
                    sale.commission || 0,
                    sale.vat || 0,
                    sale.total_amount,
                    sale.order_status || null,
                    sale.shipping_method || null,
                    sale.customer_info ? JSON.stringify(sale.customer_info) : null
                ];

                const result = await client.query(insertQuery, values);
                results.push(result);
            }

            return { success: true, inserted: results.length, data: results };
        } catch (error) {
            console.error('Error inserting sales data:', error);
            throw error;
        } finally {
            client.release();
        }
    }

    /**
     * Get sales data for an admin/integration
     */
    async getSalesData(
        adminUid: string, 
        integrationId: string | null = null, 
        filters: SalesFilters = {}
    ) {
        const client = await this.pool.connect();
        try {
            let query = 'SELECT * FROM takealot_sales WHERE admin_uid = $1';
            const values = [adminUid];
            let paramCount = 1;

            if (integrationId) {
                paramCount++;
                query += ` AND integration_id = $${paramCount}`;
                values.push(integrationId);
            }

            if (filters.dateFrom) {
                paramCount++;
                query += ` AND order_date >= $${paramCount}`;
                values.push(filters.dateFrom);
            }

            if (filters.dateTo) {
                paramCount++;
                query += ` AND order_date <= $${paramCount}`;
                values.push(filters.dateTo);
            }

            if (filters.sku) {
                paramCount++;
                query += ` AND sku = $${paramCount}`;
                values.push(filters.sku);
            }

            query += ' ORDER BY order_date DESC, created_at DESC';

            if (filters.limit) {
                paramCount++;
                query += ` LIMIT $${paramCount}`;
                values.push(filters.limit.toString());
            }

            const result = await client.query(query, values);
            return result.rows;
        } catch (error) {
            console.error('Error getting sales data:', error);
            throw error;
        } finally {
            client.release();
        }
    }

    // ===== OFFERS OPERATIONS =====

    /**
     * Insert offers data into takealot_offers table
     */
    async insertOffersData(
        adminUid: string, 
        integrationId: string, 
        accountName: string, 
        offersData: OffersData[]
    ) {
        const client = await this.pool.connect();
        try {
            const insertQuery = `
                INSERT INTO takealot_offers (
                    admin_uid, integration_id, account_name,
                    offer_id, sku, product_title, current_price, original_price,
                    stock_quantity, offer_status, is_active, visibility,
                    promotion_type, views, clicks, conversion_rate,
                    category_path, brand, offer_details
                ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19)
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

            const results = [];
            for (const offer of offersData) {
                const values = [
                    adminUid,
                    integrationId,
                    accountName,
                    offer.offer_id,
                    offer.sku,
                    offer.product_title || null,
                    offer.current_price,
                    offer.original_price || null,
                    offer.stock_quantity || 0,
                    offer.offer_status || null,
                    offer.is_active !== undefined ? offer.is_active : true,
                    offer.visibility || null,
                    offer.promotion_type || null,
                    offer.views || 0,
                    offer.clicks || 0,
                    offer.conversion_rate || 0,
                    offer.category_path || null,
                    offer.brand || null,
                    offer.offer_details ? JSON.stringify(offer.offer_details) : null
                ];

                const result = await client.query(insertQuery, values);
                results.push(result);
            }

            return { success: true, inserted: results.length, data: results };
        } catch (error) {
            console.error('Error inserting offers data:', error);
            throw error;
        } finally {
            client.release();
        }
    }

    /**
     * Get offers data for an admin/integration
     */
    async getOffersData(
        adminUid: string, 
        integrationId: string | null = null, 
        filters: OffersFilters = {}
    ) {
        const client = await this.pool.connect();
        try {
            let query = 'SELECT * FROM takealot_offers WHERE admin_uid = $1';
            const values = [adminUid];
            let paramCount = 1;

            if (integrationId) {
                paramCount++;
                query += ` AND integration_id = $${paramCount}`;
                values.push(integrationId);
            }

            if (filters.sku) {
                paramCount++;
                query += ` AND sku = $${paramCount}`;
                values.push(filters.sku);
            }

            if (filters.isActive !== undefined) {
                paramCount++;
                query += ` AND is_active = $${paramCount}`;
                values.push(filters.isActive.toString());
            }

            if (filters.status) {
                paramCount++;
                query += ` AND offer_status = $${paramCount}`;
                values.push(filters.status);
            }

            query += ' ORDER BY updated_at DESC, created_at DESC';

            if (filters.limit) {
                paramCount++;
                query += ` LIMIT $${paramCount}`;
                values.push(filters.limit.toString());
            }

            const result = await client.query(query, values);
            return result.rows;
        } catch (error) {
            console.error('Error getting offers data:', error);
            throw error;
        } finally {
            client.release();
        }
    }

    // ===== ANALYTICS OPERATIONS =====

    /**
     * Get sales analytics for an admin
     */
    async getSalesAnalytics(
        adminUid: string, 
        integrationId: string | null = null, 
        dateFrom: string | null = null, 
        dateTo: string | null = null
    ) {
        const client = await this.pool.connect();
        try {
            let query = `
                SELECT 
                    COUNT(*) as total_orders,
                    SUM(quantity) as total_quantity,
                    SUM(total_amount) as total_revenue,
                    AVG(total_amount) as avg_order_value,
                    COUNT(DISTINCT sku) as unique_products
                FROM takealot_sales 
                WHERE admin_uid = $1
            `;
            const values = [adminUid];
            let paramCount = 1;

            if (integrationId) {
                paramCount++;
                query += ` AND integration_id = $${paramCount}`;
                values.push(integrationId);
            }

            if (dateFrom) {
                paramCount++;
                query += ` AND order_date >= $${paramCount}`;
                values.push(dateFrom);
            }

            if (dateTo) {
                paramCount++;
                query += ` AND order_date <= $${paramCount}`;
                values.push(dateTo);
            }

            const result = await client.query(query, values);
            return result.rows[0];
        } catch (error) {
            console.error('Error getting sales analytics:', error);
            throw error;
        } finally {
            client.release();
        }
    }

    /**
     * Get offers analytics for an admin
     */
    async getOffersAnalytics(adminUid: string, integrationId: string | null = null) {
        const client = await this.pool.connect();
        try {
            let query = `
                SELECT 
                    COUNT(*) as total_offers,
                    COUNT(*) FILTER (WHERE is_active = true) as active_offers,
                    COUNT(*) FILTER (WHERE is_active = false) as inactive_offers,
                    AVG(current_price) as avg_price,
                    SUM(stock_quantity) as total_stock,
                    SUM(views) as total_views,
                    SUM(clicks) as total_clicks,
                    AVG(conversion_rate) as avg_conversion_rate
                FROM takealot_offers 
                WHERE admin_uid = $1
            `;
            const values = [adminUid];
            let paramCount = 1;

            if (integrationId) {
                paramCount++;
                query += ` AND integration_id = $${paramCount}`;
                values.push(integrationId);
            }

            const result = await client.query(query, values);
            return result.rows[0];
        } catch (error) {
            console.error('Error getting offers analytics:', error);
            throw error;
        } finally {
            client.release();
        }
    }

    /**
     * Get sales analytics per product/SKU
     */
    async getSalesAnalyticsByProduct(
        adminUid: string, 
        integrationId: string | null = null,
        dateFrom?: string,
        dateTo?: string
    ) {
        const client = await this.pool.connect();
        try {
            let query = `
                SELECT 
                    sku,
                    product_title,
                    COUNT(*) as total_sales,
                    SUM(quantity) as total_quantity_sold,
                    SUM(selling_price * quantity) as total_revenue,
                    AVG(selling_price) as avg_selling_price,
                    COUNT(CASE WHEN order_date >= CURRENT_DATE - INTERVAL '30 days' THEN 1 END) as sales_30_days,
                    SUM(CASE WHEN order_date >= CURRENT_DATE - INTERVAL '30 days' THEN quantity ELSE 0 END) as quantity_30_days,
                    MAX(order_date) as last_sale_date,
                    CURRENT_DATE - MAX(order_date)::date as days_since_last_sale
                FROM takealot_sales 
                WHERE admin_uid = $1
            `;
            
            const values = [adminUid];
            let paramCount = 1;

            if (integrationId) {
                paramCount++;
                query += ` AND integration_id = $${paramCount}`;
                values.push(integrationId);
            }

            if (dateFrom) {
                paramCount++;
                query += ` AND order_date >= $${paramCount}`;
                values.push(dateFrom);
            }

            if (dateTo) {
                paramCount++;
                query += ` AND order_date <= $${paramCount}`;
                values.push(dateTo);
            }

            query += `
                GROUP BY sku, product_title
                ORDER BY total_revenue DESC
            `;

            const result = await client.query(query, values);
            return result.rows.map(row => ({
                sku: row.sku,
                product_title: row.product_title,
                total_sales: parseInt(row.total_sales),
                total_quantity_sold: parseInt(row.total_quantity_sold),
                total_revenue: parseFloat(row.total_revenue),
                avg_selling_price: parseFloat(row.avg_selling_price),
                sales_30_days: parseInt(row.sales_30_days),
                quantity_30_days: parseInt(row.quantity_30_days),
                last_sale_date: row.last_sale_date,
                days_since_last_sale: parseInt(row.days_since_last_sale) || 999
            }));
        } catch (error) {
            console.error('Error getting sales analytics by product:', error);
            throw error;
        } finally {
            client.release();
        }
    }

    // ===== PAGINATION METHODS =====

    /**
     * Get paginated products with analytics and server-side filtering
     */
    async getPaginatedProductsWithAnalytics(
        adminUid: string,
        integrationId: string,
        page: number = 1,
        limit: number = 20,
        filters: any = {}
    ) {
        const client = await this.pool.connect();
        try {
            const offset = (page - 1) * limit;
            
            // Build WHERE clause for filters
            let whereConditions = ['o.admin_uid = $1'];
            let values = [adminUid];
            let paramCount = 1;

            if (integrationId) {
                paramCount++;
                whereConditions.push(`o.integration_id = $${paramCount}`);
                values.push(integrationId);
            }

            // Search filter
            if (filters.search) {
                paramCount++;
                whereConditions.push(`(o.product_title ILIKE $${paramCount} OR o.sku ILIKE $${paramCount})`);
                values.push(`%${filters.search}%`);
            }

            // Status filter
            if (filters.status && filters.status.length > 0) {
                paramCount++;
                whereConditions.push(`o.offer_status = ANY($${paramCount})`);
                values.push(filters.status);
            }

            // Price range filter
            if (filters.minPrice !== undefined) {
                paramCount++;
                whereConditions.push(`o.current_price >= $${paramCount}`);
                values.push(filters.minPrice);
            }

            if (filters.maxPrice !== undefined) {
                paramCount++;
                whereConditions.push(`o.current_price <= $${paramCount}`);
                values.push(filters.maxPrice);
            }

            // Stock filter
            if (filters.hasStock !== undefined) {
                paramCount++;
                whereConditions.push(filters.hasStock ? `o.stock_quantity > $${paramCount}` : `o.stock_quantity <= $${paramCount}`);
                values.push('0');
            }

            const whereClause = whereConditions.join(' AND ');

            // Build ORDER BY clause
            let orderBy = 'o.updated_at DESC';
            if (filters.sortBy) {
                const sortDirection = filters.sortOrder === 'asc' ? 'ASC' : 'DESC';
                switch (filters.sortBy) {
                    case 'title':
                        orderBy = `o.product_title ${sortDirection}`;
                        break;
                    case 'price':
                        orderBy = `o.current_price ${sortDirection}`;
                        break;
                    case 'stock':
                        orderBy = `o.stock_quantity ${sortDirection}`;
                        break;
                    case 'sold_30_days':
                        orderBy = `COALESCE(s.quantity_30_days, 0) ${sortDirection}`;
                        break;
                    default:
                        orderBy = `o.${filters.sortBy} ${sortDirection}`;
                }
            }

            // Main query with sales analytics joined
            const dataQuery = `
                SELECT 
                    o.*,
                    COALESCE(s.total_sales, 0) as sales_count,
                    COALESCE(s.total_quantity_sold, 0) as total_sold,
                    COALESCE(s.total_revenue, 0) as total_revenue,
                    COALESCE(s.avg_selling_price, o.current_price) as avg_selling_price,
                    COALESCE(s.sales_30_days, 0) as sales_30_days,
                    COALESCE(s.quantity_30_days, 0) as sold_30_days,
                    COALESCE(s.last_sale_date, null) as last_sale_date,
                    COALESCE(s.days_since_last_sale, 999) as days_since_last_order,
                    CASE 
                        WHEN s.quantity_30_days > 10 THEN true 
                        ELSE false 
                    END as is_bestseller,
                    CASE 
                        WHEN s.days_since_last_sale > 60 OR s.days_since_last_sale IS NULL THEN true 
                        ELSE false 
                    END as is_slow_moving,
                    CASE 
                        WHEN o.stock_quantity < (COALESCE(s.quantity_30_days, 0) * 0.5) THEN true 
                        ELSE false 
                    END as needs_restock,
                    GREATEST(0, (COALESCE(s.quantity_30_days, 0) * 2) - COALESCE(o.stock_quantity, 0)) as qty_require
                FROM takealot_offers o
                LEFT JOIN (
                    SELECT 
                        sku,
                        COUNT(*) as total_sales,
                        SUM(quantity) as total_quantity_sold,
                        SUM(total_amount) as total_revenue,
                        AVG(selling_price) as avg_selling_price,
                        COUNT(*) FILTER (WHERE order_date >= NOW() - INTERVAL '30 days') as sales_30_days,
                        SUM(quantity) FILTER (WHERE order_date >= NOW() - INTERVAL '30 days') as quantity_30_days,
                        MAX(order_date) as last_sale_date,
                        EXTRACT(days FROM NOW() - MAX(order_date)) as days_since_last_sale
                    FROM takealot_sales 
                    WHERE admin_uid = $1 ${integrationId ? 'AND integration_id = $2' : ''}
                    GROUP BY sku
                ) s ON o.sku = s.sku
                WHERE ${whereClause}
                ORDER BY ${orderBy}
                LIMIT $${paramCount + 1} OFFSET $${paramCount + 2}
            `;

            values.push(limit, offset);
            
            // Count query for pagination
            const countQuery = `
                SELECT COUNT(*) as total
                FROM takealot_offers o
                WHERE ${whereClause}
            `;
            
            // Execute both queries
            const [dataResult, countResult] = await Promise.all([
                client.query(dataQuery, values),
                client.query(countQuery, values.slice(0, -2)) // Remove limit and offset for count
            ]);

            const total = parseInt(countResult.rows[0].total);
            const totalPages = Math.ceil(total / limit);

            return {
                data: dataResult.rows,
                page,
                limit,
                total,
                totalPages,
                hasNextPage: page < totalPages,
                hasPrevPage: page > 1,
                analytics: {
                    totalProducts: total,
                    currentPageCount: dataResult.rows.length
                }
            };

        } catch (error) {
            console.error('Error getting paginated products with analytics:', error);
            throw error;
        } finally {
            client.release();
        }
    }

    /**
     * Get paginated sales with analytics and server-side filtering
     */
    async getPaginatedSalesWithAnalytics(
        adminUid: string,
        integrationId: string,
        page: number = 1,
        limit: number = 20,
        filters: any = {}
    ) {
        const client = await this.pool.connect();
        try {
            const offset = (page - 1) * limit;
            
            // Build WHERE clause for filters
            let whereConditions = ['s.admin_uid = $1'];
            let values = [adminUid];
            let paramCount = 1;

            if (integrationId) {
                paramCount++;
                whereConditions.push(`s.integration_id = $${paramCount}`);
                values.push(integrationId);
            }

            // Search filter
            if (filters.search) {
                paramCount++;
                whereConditions.push(`(s.product_title ILIKE $${paramCount} OR s.sku ILIKE $${paramCount} OR s.order_id ILIKE $${paramCount})`);
                values.push(`%${filters.search}%`);
            }

            // Date range filter
            if (filters.dateFrom) {
                paramCount++;
                whereConditions.push(`s.order_date >= $${paramCount}`);
                values.push(filters.dateFrom);
            }

            if (filters.dateTo) {
                paramCount++;
                whereConditions.push(`s.order_date <= $${paramCount}`);
                values.push(filters.dateTo);
            }

            // Status filter
            if (filters.status && filters.status.length > 0) {
                paramCount++;
                whereConditions.push(`s.order_status = ANY($${paramCount})`);
                values.push(filters.status);
            }

            // Amount range filter
            if (filters.minAmount !== undefined) {
                paramCount++;
                whereConditions.push(`s.total_amount >= $${paramCount}`);
                values.push(filters.minAmount);
            }

            if (filters.maxAmount !== undefined) {
                paramCount++;
                whereConditions.push(`s.total_amount <= $${paramCount}`);
                values.push(filters.maxAmount);
            }

            const whereClause = whereConditions.join(' AND ');

            // Build ORDER BY clause
            let orderBy = 's.order_date DESC';
            if (filters.sortBy) {
                const sortDirection = filters.sortOrder === 'asc' ? 'ASC' : 'DESC';
                switch (filters.sortBy) {
                    case 'order_date':
                        orderBy = `s.order_date ${sortDirection}`;
                        break;
                    case 'product_title':
                        orderBy = `s.product_title ${sortDirection}`;
                        break;
                    case 'selling_price':
                        orderBy = `s.selling_price ${sortDirection}`;
                        break;
                    case 'total_amount':
                        orderBy = `s.total_amount ${sortDirection}`;
                        break;
                    case 'quantity':
                        orderBy = `s.quantity ${sortDirection}`;
                        break;
                    default:
                        orderBy = `s.${filters.sortBy} ${sortDirection}`;
                }
            }

            // Main query with product details joined
            const dataQuery = `
                SELECT 
                    s.*,
                    o.offer_details->>'image_url' as image_url,
                    o.offer_details->>'offer_url' as offer_url,
                    o.offer_details->>'tsin_id' as tsin_id
                FROM takealot_sales s
                LEFT JOIN takealot_offers o ON s.sku = o.sku AND s.admin_uid = o.admin_uid AND s.integration_id = o.integration_id
                WHERE ${whereClause}
                ORDER BY ${orderBy}
                LIMIT $${paramCount + 1} OFFSET $${paramCount + 2}
            `;

            values.push(limit, offset);
            
            // Count query for pagination
            const countQuery = `
                SELECT COUNT(*) as total
                FROM takealot_sales s
                WHERE ${whereClause}
            `;

            // Analytics query
            const analyticsQuery = `
                SELECT 
                    COUNT(*) as total_sales,
                    SUM(quantity) as total_quantity,
                    SUM(total_amount) as total_revenue,
                    AVG(total_amount) as avg_order_value,
                    COUNT(DISTINCT sku) as unique_products
                FROM takealot_sales s
                WHERE ${whereClause}
            `;
            
            // Execute queries
            const [dataResult, countResult, analyticsResult] = await Promise.all([
                client.query(dataQuery, values),
                client.query(countQuery, values.slice(0, -2)), // Remove limit and offset for count
                client.query(analyticsQuery, values.slice(0, -2)) // Remove limit and offset for analytics
            ]);

            const total = parseInt(countResult.rows[0].total);
            const totalPages = Math.ceil(total / limit);

            return {
                data: dataResult.rows,
                page,
                limit,
                total,
                totalPages,
                hasNextPage: page < totalPages,
                hasPrevPage: page > 1,
                analytics: {
                    ...analyticsResult.rows[0],
                    currentPageCount: dataResult.rows.length
                }
            };

        } catch (error) {
            console.error('Error getting paginated sales with analytics:', error);
            throw error;
        } finally {
            client.release();
        }
    }

    // ===== UTILITY OPERATIONS =====

    /**
     * Get all integrations for an admin
     */
    async getAdminIntegrations(adminUid: string) {
        const client = await this.pool.connect();
        try {
            const query = `
                SELECT DISTINCT integration_id, account_name 
                FROM (
                    SELECT integration_id, account_name FROM takealot_sales WHERE admin_uid = $1
                    UNION
                    SELECT integration_id, account_name FROM takealot_offers WHERE admin_uid = $1
                ) integrations
                ORDER BY account_name
            `;
            
            const result = await client.query(query, [adminUid]);
            return result.rows;
        } catch (error) {
            console.error('Error getting admin integrations:', error);
            throw error;
        } finally {
            client.release();
        }
    }

    /**
     * Delete data for specific admin/integration
     */
    async deleteAdminData(adminUid: string, integrationId: string | null = null) {
        const client = await this.pool.connect();
        try {
            await client.query('BEGIN');

            let salesQuery = 'DELETE FROM takealot_sales WHERE admin_uid = $1';
            let offersQuery = 'DELETE FROM takealot_offers WHERE admin_uid = $1';
            const values = [adminUid];

            if (integrationId) {
                salesQuery += ' AND integration_id = $2';
                offersQuery += ' AND integration_id = $2';
                values.push(integrationId);
            }

            const salesResult = await client.query(salesQuery, values);
            const offersResult = await client.query(offersQuery, values);

            await client.query('COMMIT');

            return {
                success: true,
                deletedSales: salesResult.rowCount,
                deletedOffers: offersResult.rowCount
            };
        } catch (error) {
            await client.query('ROLLBACK');
            console.error('Error deleting admin data:', error);
            throw error;
        } finally {
            client.release();
        }
    }

    /**
     * Close the connection pool
     */
    async close() {
        await this.pool.end();
    }
}

module.exports = NewTakealotService;

export default NewTakealotService;
