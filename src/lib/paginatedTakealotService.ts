// Enhanced NewTakealotService with pagination methods

import { Pool, PoolClient } from 'pg';
import path from 'path';
import { config } from 'dotenv';

// Load environment variables
if (typeof window === 'undefined') {
  // Server-side only
  config({ path: path.join(process.cwd(), '.env.local') });
}

export class NewTakealotService {
    private pool: Pool;

    constructor() {
        this.pool = new Pool({
            connectionString: process.env.NEON_DATABASE_URL,
            ssl: { rejectUnauthorized: false }
        });
    }

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
            let values: any[] = [adminUid];
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
                values.push(0);
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
            let values: any[] = [adminUid];
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

    /**
     * Close the connection pool
     */
    async close() {
        await this.pool.end();
    }
}
