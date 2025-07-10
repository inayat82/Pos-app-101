// src/lib/enhancedTakealotLogger.ts

import { dbAdmin } from '@/lib/firebase/firebaseAdmin';
import { Pool } from 'pg';

interface LogEntry {
  adminId: string;
  integrationId: string;
  operation: string;
  operationType: 'sync' | 'scraping' | 'api_call' | 'proxy_test' | 'data_migration';
  status: 'started' | 'success' | 'error' | 'warning';
  message: string;
  details?: any;
  proxyUsed?: string;
  duration?: number;
  recordsProcessed?: number;
  timestamp: Date;
}

interface ProxyUsageLog {
  adminId: string;
  integrationId: string;
  proxyAddress: string;
  proxyPort: number;
  operation: string;
  success: boolean;
  responseTime?: number;
  statusCode?: number;
  errorMessage?: string;
  timestamp: Date;
}

export class EnhancedTakealotLogger {
  private static instance: EnhancedTakealotLogger;
  private pool?: Pool;

  public static getInstance(): EnhancedTakealotLogger {
    if (!EnhancedTakealotLogger.instance) {
      EnhancedTakealotLogger.instance = new EnhancedTakealotLogger();
    }
    return EnhancedTakealotLogger.instance;
  }

  private constructor() {
    // Initialize Neon connection for enhanced logging
    if (process.env.NEON_DATABASE_URL) {
      this.pool = new Pool({
        connectionString: process.env.NEON_DATABASE_URL,
        ssl: { rejectUnauthorized: false }
      });
    }
  }

  /**
   * Log operation with dual-write to Firebase and Neon
   */
  async logOperation(entry: LogEntry): Promise<void> {
    const logData = {
      ...entry,
      timestamp: entry.timestamp || new Date(),
      id: `${entry.adminId}_${entry.integrationId}_${Date.now()}`
    };

    // Log to Firebase (existing functionality)
    try {
      await dbAdmin
        .collection('takealotIntegrations')
        .doc(entry.integrationId)
        .collection('operationLogs')
        .add({
          ...logData,
          timestamp: logData.timestamp
        });
    } catch (error) {
      console.warn('Failed to log operation to Firebase:', error);
    }

    // Log to Neon for enhanced querying and performance
    if (this.pool) {
      try {
        const client = await this.pool.connect();
        
        try {
          // Create table if it doesn't exist
          await client.query(`
            CREATE TABLE IF NOT EXISTS takealot_operation_logs (
              id SERIAL PRIMARY KEY,
              admin_uid VARCHAR(255) NOT NULL,
              integration_id VARCHAR(255) NOT NULL,
              operation VARCHAR(255) NOT NULL,
              operation_type VARCHAR(50) NOT NULL,
              status VARCHAR(50) NOT NULL,
              message TEXT,
              details JSONB,
              proxy_used VARCHAR(255),
              duration_ms INTEGER,
              records_processed INTEGER,
              created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
              INDEX idx_admin_integration (admin_uid, integration_id),
              INDEX idx_operation_type (operation_type),
              INDEX idx_status (status),
              INDEX idx_created_at (created_at)
            )
          `);

          // Insert log entry
          await client.query(`
            INSERT INTO takealot_operation_logs (
              admin_uid, integration_id, operation, operation_type, status,
              message, details, proxy_used, duration_ms, records_processed
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
          `, [
            entry.adminId,
            entry.integrationId,
            entry.operation,
            entry.operationType,
            entry.status,
            entry.message,
            entry.details ? JSON.stringify(entry.details) : null,
            entry.proxyUsed || null,
            entry.duration || null,
            entry.recordsProcessed || null
          ]);

        } finally {
          client.release();
        }
      } catch (error) {
        console.warn('Failed to log operation to Neon:', error);
      }
    }

    // Console log for immediate debugging
    const logLevel = entry.status === 'error' ? 'error' : 
                    entry.status === 'warning' ? 'warn' : 'info';
    
    console[logLevel](`[TakealotLogger] ${entry.operation} - ${entry.message}`, {
      adminId: entry.adminId,
      integrationId: entry.integrationId,
      operationType: entry.operationType,
      status: entry.status,
      proxyUsed: entry.proxyUsed,
      duration: entry.duration,
      recordsProcessed: entry.recordsProcessed
    });
  }

  /**
   * Log proxy usage specifically
   */
  async logProxyUsage(usage: ProxyUsageLog): Promise<void> {
    // Log to Firebase
    try {
      await dbAdmin
        .collection('takealotIntegrations')
        .doc(usage.integrationId)
        .collection('proxyUsageLogs')
        .add({
          ...usage,
          timestamp: usage.timestamp || new Date()
        });
    } catch (error) {
      console.warn('Failed to log proxy usage to Firebase:', error);
    }

    // Log to Neon
    if (this.pool) {
      try {
        const client = await this.pool.connect();
        
        try {
          // Create table if it doesn't exist
          await client.query(`
            CREATE TABLE IF NOT EXISTS takealot_proxy_usage_logs (
              id SERIAL PRIMARY KEY,
              admin_uid VARCHAR(255) NOT NULL,
              integration_id VARCHAR(255) NOT NULL,
              proxy_address VARCHAR(255) NOT NULL,
              proxy_port INTEGER NOT NULL,
              operation VARCHAR(255) NOT NULL,
              success BOOLEAN NOT NULL,
              response_time_ms INTEGER,
              status_code INTEGER,
              error_message TEXT,
              created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
              INDEX idx_admin_integration (admin_uid, integration_id),
              INDEX idx_proxy (proxy_address, proxy_port),
              INDEX idx_success (success),
              INDEX idx_created_at (created_at)
            )
          `);

          // Insert proxy usage log
          await client.query(`
            INSERT INTO takealot_proxy_usage_logs (
              admin_uid, integration_id, proxy_address, proxy_port, operation,
              success, response_time_ms, status_code, error_message
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
          `, [
            usage.adminId,
            usage.integrationId,
            usage.proxyAddress,
            usage.proxyPort,
            usage.operation,
            usage.success,
            usage.responseTime || null,
            usage.statusCode || null,
            usage.errorMessage || null
          ]);

        } finally {
          client.release();
        }
      } catch (error) {
        console.warn('Failed to log proxy usage to Neon:', error);
      }
    }

    console.info(`[ProxyLogger] ${usage.operation} via ${usage.proxyAddress}:${usage.proxyPort}`, {
      success: usage.success,
      responseTime: usage.responseTime,
      statusCode: usage.statusCode,
      error: usage.errorMessage
    });
  }

  /**
   * Get recent operation logs with enhanced filtering
   */
  async getRecentLogs(
    adminId: string,
    integrationId: string,
    options: {
      limit?: number;
      operationType?: string;
      status?: string;
      since?: Date;
    } = {}
  ): Promise<LogEntry[]> {
    if (!this.pool) {
      // Fallback to Firebase
      try {
        let query = dbAdmin
          .collection('takealotIntegrations')
          .doc(integrationId)
          .collection('operationLogs')
          .where('adminId', '==', adminId)
          .orderBy('timestamp', 'desc');

        if (options.limit) {
          query = query.limit(options.limit);
        }

        const snapshot = await query.get();
        return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as unknown as LogEntry));
      } catch (error) {
        console.error('Failed to get logs from Firebase:', error);
        return [];
      }
    }

    // Use Neon for enhanced performance
    try {
      const client = await this.pool.connect();
      
      try {
        let query = `
          SELECT * FROM takealot_operation_logs 
          WHERE admin_uid = $1 AND integration_id = $2
        `;
        const params = [adminId, integrationId];
        let paramCount = 2;

        if (options.operationType) {
          paramCount++;
          query += ` AND operation_type = $${paramCount}`;
          params.push(options.operationType);
        }

        if (options.status) {
          paramCount++;
          query += ` AND status = $${paramCount}`;
          params.push(options.status);
        }

        if (options.since) {
          paramCount++;
          query += ` AND created_at >= $${paramCount}`;
          params.push(options.since.toISOString());
        }

        query += ' ORDER BY created_at DESC';

        if (options.limit) {
          paramCount++;
          query += ` LIMIT $${paramCount}`;
          params.push(options.limit.toString());
        }

        const result = await client.query(query, params);
        
        return result.rows.map(row => ({
          adminId: row.admin_uid,
          integrationId: row.integration_id,
          operation: row.operation,
          operationType: row.operation_type,
          status: row.status,
          message: row.message,
          details: row.details ? JSON.parse(row.details) : undefined,
          proxyUsed: row.proxy_used,
          duration: row.duration_ms,
          recordsProcessed: row.records_processed,
          timestamp: new Date(row.created_at)
        }));

      } finally {
        client.release();
      }
    } catch (error) {
      console.error('Failed to get logs from Neon:', error);
      return [];
    }
  }

  /**
   * Get proxy usage statistics
   */
  async getProxyStats(
    adminId: string,
    integrationId: string,
    since: Date = new Date(Date.now() - 24 * 60 * 60 * 1000) // Last 24 hours
  ): Promise<{
    totalRequests: number;
    successfulRequests: number;
    failedRequests: number;
    successRate: number;
    uniqueProxiesUsed: number;
    averageResponseTime: number;
    topProxies: Array<{ proxy: string; requests: number; successRate: number }>;
  }> {
    if (!this.pool) {
      return {
        totalRequests: 0,
        successfulRequests: 0,
        failedRequests: 0,
        successRate: 0,
        uniqueProxiesUsed: 0,
        averageResponseTime: 0,
        topProxies: []
      };
    }

    try {
      const client = await this.pool.connect();
      
      try {
        const statsQuery = `
          SELECT 
            COUNT(*) as total_requests,
            COUNT(*) FILTER (WHERE success = true) as successful_requests,
            COUNT(*) FILTER (WHERE success = false) as failed_requests,
            COUNT(DISTINCT CONCAT(proxy_address, ':', proxy_port)) as unique_proxies,
            AVG(response_time_ms) FILTER (WHERE response_time_ms IS NOT NULL) as avg_response_time
          FROM takealot_proxy_usage_logs 
          WHERE admin_uid = $1 AND integration_id = $2 AND created_at >= $3
        `;

        const statsResult = await client.query(statsQuery, [adminId, integrationId, since.toISOString()]);
        const stats = statsResult.rows[0];

        const topProxiesQuery = `
          SELECT 
            CONCAT(proxy_address, ':', proxy_port) as proxy,
            COUNT(*) as requests,
            (COUNT(*) FILTER (WHERE success = true) * 100.0 / COUNT(*)) as success_rate
          FROM takealot_proxy_usage_logs 
          WHERE admin_uid = $1 AND integration_id = $2 AND created_at >= $3
          GROUP BY proxy_address, proxy_port
          ORDER BY requests DESC
          LIMIT 10
        `;

        const topProxiesResult = await client.query(topProxiesQuery, [adminId, integrationId, since.toISOString()]);

        const totalRequests = parseInt(stats.total_requests) || 0;
        const successfulRequests = parseInt(stats.successful_requests) || 0;

        return {
          totalRequests,
          successfulRequests,
          failedRequests: parseInt(stats.failed_requests) || 0,
          successRate: totalRequests > 0 ? (successfulRequests / totalRequests) * 100 : 0,
          uniqueProxiesUsed: parseInt(stats.unique_proxies) || 0,
          averageResponseTime: parseFloat(stats.avg_response_time) || 0,
          topProxies: topProxiesResult.rows.map(row => ({
            proxy: row.proxy,
            requests: parseInt(row.requests),
            successRate: parseFloat(row.success_rate) || 0
          }))
        };

      } finally {
        client.release();
      }
    } catch (error) {
      console.error('Failed to get proxy stats from Neon:', error);
      return {
        totalRequests: 0,
        successfulRequests: 0,
        failedRequests: 0,
        successRate: 0,
        uniqueProxiesUsed: 0,
        averageResponseTime: 0,
        topProxies: []
      };
    }
  }

  /**
   * Close the database connection
   */
  async close(): Promise<void> {
    if (this.pool) {
      await this.pool.end();
    }
  }
}

// Export singleton instance
export const enhancedTakealotLogger = EnhancedTakealotLogger.getInstance();
