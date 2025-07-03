// src/modules/takealot/services/proxy.service.ts
// Takealot Proxy Service - Handles API requests through WebShare proxies

import { webshareService } from '@/modules/webshare/services';

export interface TakealotProxyResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  statusCode?: number;
  proxyUsed?: string;
}

export interface TakealotRequestOptions {
  adminId: string;
  integrationId: string;
  requestType: 'manual' | 'cron';
  dataType: 'products' | 'sales';
  timeout?: number;
}

export class TakealotProxyService {
  private static instance: TakealotProxyService;
  private baseUrl = 'https://seller-api.takealot.com';

  public static getInstance(): TakealotProxyService {
    if (!TakealotProxyService.instance) {
      TakealotProxyService.instance = new TakealotProxyService();
    }
    return TakealotProxyService.instance;
  }

  /**
   * Make a GET request to Takealot API through proxy
   */
  async get(
    endpoint: string,
    apiKey: string,
    params?: Record<string, any>,
    options?: TakealotRequestOptions
  ): Promise<TakealotProxyResponse> {
    return this.makeRequest('GET', endpoint, apiKey, params, undefined, options);
  }

  /**
   * Make a POST request to Takealot API through proxy
   */
  async post(
    endpoint: string,
    apiKey: string,
    data?: any,
    options?: TakealotRequestOptions
  ): Promise<TakealotProxyResponse> {
    return this.makeRequest('POST', endpoint, apiKey, undefined, data, options);
  }

  /**
   * Make a generic request to Takealot API through proxy
   */
  async makeRequest(
    method: 'GET' | 'POST' | 'PUT' | 'DELETE' = 'GET',
    endpoint: string,
    apiKey: string,
    params?: Record<string, any>,
    data?: any,
    options?: TakealotRequestOptions
  ): Promise<TakealotProxyResponse> {
    try {
      let url = `${this.baseUrl}${endpoint}`;
      
      // Add query parameters for GET requests
      if (params && method === 'GET') {
        const queryParams = new URLSearchParams();
        for (const [key, value] of Object.entries(params)) {
          queryParams.append(key, String(value));
        }
        if (queryParams.toString()) {
          url += `?${queryParams.toString()}`;
        }
      }

      console.log(`[TakealotProxyService] Making ${method} request to ${url}`);

      const response = await webshareService.makeRequest({
        url,
        method,
        headers: {
          'Authorization': `Key ${apiKey}`,
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
        },
        data: data ? JSON.stringify(data) : undefined,
        timeout: options?.timeout || 30000
      });

      console.log(`[TakealotProxyService] Request successful, proxy used: ${response.proxyUsed}`);

      return {
        success: true,
        data: response.data,
        statusCode: response.statusCode,
        proxyUsed: response.proxyUsed
      };

    } catch (error: any) {
      console.error(`[TakealotProxyService] Error making ${method} request to ${endpoint}:`, error);
      
      return {
        success: false,
        error: error.message || 'Request failed',
        statusCode: error.statusCode || 0
      };
    }
  }

  /**
   * Fetch products from Takealot API
   */
  async fetchProducts(
    apiKey: string,
    pageNumber: number = 1,
    pageSize: number = 100,
    options?: TakealotRequestOptions
  ): Promise<TakealotProxyResponse> {
    return this.get('/v2/offers', apiKey, {
      page_number: pageNumber,
      page_size: pageSize
    }, options);
  }

  /**
   * Fetch sales from Takealot API
   */
  async fetchSales(
    apiKey: string,
    pageNumber: number = 1,
    pageSize: number = 100,
    options?: TakealotRequestOptions
  ): Promise<TakealotProxyResponse> {
    return this.get('/v2/sales', apiKey, {
      page_number: pageNumber,
      page_size: pageSize
    }, options);
  }

  /**
   * Check API connection
   */
  async checkConnection(
    apiKey: string,
    options?: TakealotRequestOptions
  ): Promise<TakealotProxyResponse> {
    return this.get('/v2/offers/count', apiKey, undefined, options);
  }
}

// Export singleton instance
export const takealotProxyService = TakealotProxyService.getInstance();
