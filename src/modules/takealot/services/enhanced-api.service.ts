// src/modules/takealot/services/enhanced-api.service.ts
// Enhanced Takealot API Service with WebShare proxy integration

import { TakealotRequestConfig, DEFAULT_TAKEALOT_CONFIG } from '@/modules/webshare/types';
import { webshareService } from '@/modules/webshare/services';

interface TakealotApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  statusCode?: number;
  responseTime?: number;
  proxyUsed?: string;
}

interface RequestMetrics {
  timestamp: Date;
  url: string;
  method: string;
  statusCode: number;
  responseTime: number;
  proxyUsed?: string;
  error?: string;
}

class TakealotEnhancedApiService {
  private config: TakealotRequestConfig;
  private requestMetrics: RequestMetrics[] = [];
  private rateLimitTracker = new Map<string, { count: number; resetTime: number }>();

  constructor(
    config: Partial<TakealotRequestConfig> = {}
  ) {
    this.config = { ...DEFAULT_TAKEALOT_CONFIG, ...config };
  }

  /**
   * Update configuration
   */
  updateConfig(config: Partial<TakealotRequestConfig>): void {
    this.config = { ...this.config, ...config };
  }

  /**
   * Check rate limit before making request
   */
  private checkRateLimit(): boolean {
    const now = Date.now();
    const minuteKey = Math.floor(now / 60000); // Current minute
    const hourKey = Math.floor(now / 3600000); // Current hour

    // Check per-minute limit
    const minuteTracker = this.rateLimitTracker.get(`minute_${minuteKey}`);
    if (minuteTracker && minuteTracker.count >= this.config.rateLimit.requestsPerMinute) {
      return false;
    }

    // Check per-hour limit
    const hourTracker = this.rateLimitTracker.get(`hour_${hourKey}`);
    if (hourTracker && hourTracker.count >= this.config.rateLimit.requestsPerHour) {
      return false;
    }

    return true;
  }

  /**
   * Update rate limit counters
   */
  private updateRateLimit(): void {
    const now = Date.now();
    const minuteKey = Math.floor(now / 60000);
    const hourKey = Math.floor(now / 3600000);

    // Update minute counter
    const minuteTracker = this.rateLimitTracker.get(`minute_${minuteKey}`) || { count: 0, resetTime: now + 60000 };
    minuteTracker.count++;
    this.rateLimitTracker.set(`minute_${minuteKey}`, minuteTracker);

    // Update hour counter
    const hourTracker = this.rateLimitTracker.get(`hour_${hourKey}`) || { count: 0, resetTime: now + 3600000 };
    hourTracker.count++;
    this.rateLimitTracker.set(`hour_${hourKey}`, hourTracker);

    // Clean up old entries
    this.cleanupRateLimitTrackers();
  }

  /**
   * Clean up expired rate limit trackers
   */
  private cleanupRateLimitTrackers(): void {
    const now = Date.now();
    for (const [key, tracker] of this.rateLimitTracker.entries()) {
      if (now > tracker.resetTime) {
        this.rateLimitTracker.delete(key);
      }
    }
  }

  /**
   * Make HTTP request to Takealot API with proxy support
   */
  async makeRequest<T = any>(
    url: string,
    options: RequestInit = {}
  ): Promise<TakealotApiResponse<T>> {
    // Check rate limit
    if (!this.checkRateLimit()) {
      return {
        success: false,
        error: 'Rate limit exceeded',
        statusCode: 429,
      };
    }

    const startTime = Date.now();
    let proxyUsed: string | undefined;

    // Prepare request options
    const requestOptions: RequestInit = {
      ...options,
      headers: {
        ...this.config.headers,
        ...options.headers,
      },
      signal: AbortSignal.timeout(this.config.timeout),
    };

    let lastError: Error | null = null;

    // Retry logic with different proxies
    for (let attempt = 0; attempt <= this.config.maxRetries; attempt++) {
      try {
        let response: any;

        if (this.config.useProxy) {
          // Use WebShare proxy service for the request
          response = await webshareService.makeRequest({
            url,
            method: options.method as any,
            headers: requestOptions.headers as Record<string, string>,
            data: options.body,
            timeout: this.config.timeout
          });
          
          proxyUsed = response.proxyUsed;
          
          const responseTime = Date.now() - startTime;

          // Record metrics
          this.recordMetrics({
            timestamp: new Date(),
            url,
            method: options.method || 'GET',
            statusCode: response.status,
            responseTime,
            proxyUsed,
          });

          // Update rate limit
          this.updateRateLimit();

          return {
            success: true,
            data: response.data,
            statusCode: response.status,
            responseTime,
            proxyUsed,
          };
        } else {
          // Direct request without proxy
          const fetchResponse = await fetch(url, requestOptions);
          const responseTime = Date.now() - startTime;

          // Record metrics
          this.recordMetrics({
            timestamp: new Date(),
            url,
            method: options.method || 'GET',
            statusCode: fetchResponse.status,
            responseTime,
          });

          // Update rate limit
          this.updateRateLimit();

          if (fetchResponse.ok) {
            const data = await fetchResponse.json();
            return {
              success: true,
              data,
              statusCode: fetchResponse.status,
              responseTime,
            };
          } else {
            // Handle HTTP errors
            const errorText = await fetchResponse.text().catch(() => 'Unknown error');
            lastError = new Error(`HTTP ${fetchResponse.status}: ${errorText}`);
            
            // Don't retry on client errors (4xx), except 429 (rate limit)
            if (fetchResponse.status >= 400 && fetchResponse.status < 500 && fetchResponse.status !== 429) {
              break;
            }
          }
        }
      } catch (error) {
        lastError = error as Error;
        
        // Record failed metrics
        this.recordMetrics({
          timestamp: new Date(),
          url,
          method: options.method || 'GET',
          statusCode: 0,
          responseTime: Date.now() - startTime,
          proxyUsed,
          error: lastError.message,
        });
      }

      // Wait before retry (exponential backoff)
      if (attempt < this.config.maxRetries) {
        await this.delay(Math.pow(2, attempt) * 1000);
      }
    }

    return {
      success: false,
      error: lastError?.message || 'Request failed',
      statusCode: 0,
      responseTime: Date.now() - startTime,
      proxyUsed,
    };
  }

  /**
   * Make request through proxy (this would be implemented in your backend)
   */
  private async makeProxyRequest(
    url: string,
    options: RequestInit,
    proxy: any
  ): Promise<Response> {
    // In a real implementation, this would call your backend API endpoint
    // that handles proxy requests. For example:
    const proxyRequestUrl = '/api/proxy-request';
    
    const proxyRequest = {
      url,
      method: options.method || 'GET',
      headers: options.headers,
      body: options.body,
      proxy: {
        host: proxy.proxy_address,
        port: proxy.port,
        username: proxy.username,
        password: proxy.password,
      },
    };

    return fetch(proxyRequestUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(proxyRequest),
    });
  }

  /**
   * Delay function for retry logic
   */
  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Record request metrics
   */
  private recordMetrics(metrics: RequestMetrics): void {
    this.requestMetrics.push(metrics);
    
    // Keep only last 1000 metrics
    if (this.requestMetrics.length > 1000) {
      this.requestMetrics.shift();
    }
  }

  /**
   * Get request metrics and statistics
   */
  getMetrics(): {
    totalRequests: number;
    successfulRequests: number;
    failedRequests: number;
    averageResponseTime: number;
    errorRate: number;
    recentMetrics: RequestMetrics[];
  } {
    const totalRequests = this.requestMetrics.length;
    const successfulRequests = this.requestMetrics.filter(m => m.statusCode >= 200 && m.statusCode < 300).length;
    const failedRequests = totalRequests - successfulRequests;
    const averageResponseTime = totalRequests > 0 
      ? this.requestMetrics.reduce((sum, m) => sum + m.responseTime, 0) / totalRequests 
      : 0;
    const errorRate = totalRequests > 0 ? (failedRequests / totalRequests) * 100 : 0;

    return {
      totalRequests,
      successfulRequests,
      failedRequests,
      averageResponseTime,
      errorRate,
      recentMetrics: this.requestMetrics.slice(-50), // Last 50 requests
    };
  }

  /**
   * Takealot-specific API methods
   */

  /**
   * Fetch product data from Takealot
   */
  async fetchProducts(page = 1, pageSize = 100): Promise<TakealotApiResponse> {
    const url = `/api/takealot/products?page=${page}&page_size=${pageSize}`;
    return this.makeRequest(url);
  }

  /**
   * Fetch sales data from Takealot
   */
  async fetchSales(startDate?: string, endDate?: string): Promise<TakealotApiResponse> {
    let url = '/api/takealot/sales';
    const params = new URLSearchParams();
    
    if (startDate) params.append('start_date', startDate);
    if (endDate) params.append('end_date', endDate);
    
    if (params.toString()) {
      url += `?${params.toString()}`;
    }
    
    return this.makeRequest(url);
  }

  /**
   * Fetch order data from Takealot
   */
  async fetchOrders(status?: string): Promise<TakealotApiResponse> {
    let url = '/api/takealot/orders';
    if (status) {
      url += `?status=${status}`;
    }
    
    return this.makeRequest(url);
  }

  /**
   * Sync all Takealot data (products, sales, orders)
   */
  async syncAllData(): Promise<{
    products: TakealotApiResponse;
    sales: TakealotApiResponse;
    orders: TakealotApiResponse;
    totalTime: number;
  }> {
    const startTime = Date.now();

    const [products, sales, orders] = await Promise.allSettled([
      this.fetchProducts(),
      this.fetchSales(),
      this.fetchOrders(),
    ]);

    const totalTime = Date.now() - startTime;

    return {
      products: products.status === 'fulfilled' ? products.value : { success: false, error: 'Products sync failed' },
      sales: sales.status === 'fulfilled' ? sales.value : { success: false, error: 'Sales sync failed' },
      orders: orders.status === 'fulfilled' ? orders.value : { success: false, error: 'Orders sync failed' },
      totalTime,
    };
  }

  /**
   * Clear metrics history
   */
  clearMetrics(): void {
    this.requestMetrics = [];
  }

  /**
   * Get current rate limit status
   */
  getRateLimitStatus(): {
    perMinute: { current: number; limit: number; resetTime: number };
    perHour: { current: number; limit: number; resetTime: number };
  } {
    const now = Date.now();
    const minuteKey = Math.floor(now / 60000);
    const hourKey = Math.floor(now / 3600000);

    const minuteTracker = this.rateLimitTracker.get(`minute_${minuteKey}`);
    const hourTracker = this.rateLimitTracker.get(`hour_${hourKey}`);

    return {
      perMinute: {
        current: minuteTracker?.count || 0,
        limit: this.config.rateLimit.requestsPerMinute,
        resetTime: minuteTracker?.resetTime || now + 60000,
      },
      perHour: {
        current: hourTracker?.count || 0,
        limit: this.config.rateLimit.requestsPerHour,
        resetTime: hourTracker?.resetTime || now + 3600000,
      },
    };
  }
}

export default TakealotEnhancedApiService;
