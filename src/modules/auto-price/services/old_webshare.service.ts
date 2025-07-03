// Webshare Proxy Service for Auto Price Module

// Define WebshareProxy interface locally to avoid import issues
interface WebshareProxy {
  id: string;
  username: string;
  password: string;
  proxy_address: string;
  port: number;
  country_code: string;
  city_name: string;
  created_at: string;
  last_verification: string;
  valid: boolean;
}

export interface WebshareProxyResponse {
  success: boolean;
  data?: any;
  error?: string;
  proxyUsed?: WebshareProxy;
  responseTime?: number;
  statusCode?: number;
}

export interface WebshareRequest {
  url: string;
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE';
  headers?: Record<string, string>;
  body?: any;
  timeout?: number;
}

class AutoPriceWebshareService {
  private apiToken: string = '';
  private proxies: WebshareProxy[] = [];
  private currentProxyIndex: number = 0;
  private lastProxyRefresh: number = 0;
  private proxyRefreshInterval: number = 5 * 60 * 1000; // 5 minutes

  /**
   * Set API token for Webshare
   */
  setApiToken(token: string): void {
    this.apiToken = token;
  }

  /**
   * Get API token from environment or localStorage
   */
  private getApiToken(): string {
    if (this.apiToken) return this.apiToken;
    
    // Try to get from environment variables (server-side)
    if (typeof process !== 'undefined' && process.env) {
      return process.env.WEBSHARE_API_TOKEN || '';
    }
    
    // Try to get from localStorage (client-side)
    if (typeof window !== 'undefined' && window.localStorage) {
      return localStorage.getItem('webshare_api_token') || '';
    }
    
    return '';
  }

  /**
   * Refresh proxy list from Webshare API
   */
  async refreshProxies(): Promise<boolean> {
    const token = this.getApiToken();
    if (!token) {
      console.warn('No Webshare API token available');
      return false;
    }

    try {
      // Use the existing Webshare API endpoint
      const response = await fetch(`/api/superadmin/webshare?apiToken=${encodeURIComponent(token)}&action=list&page=1&page_size=100`);
      const result = await response.json();

      if (result.success && result.data?.results) {
        // Filter for valid proxies only
        this.proxies = result.data.results.filter((proxy: WebshareProxy) => proxy.valid);
        this.lastProxyRefresh = Date.now();
        console.log(`Auto Price: Refreshed ${this.proxies.length} valid proxies from Webshare`);
        return true;
      } else {
        console.error('Auto Price: Failed to refresh proxies:', result.error);
        return false;
      }
    } catch (error) {
      console.error('Auto Price: Error refreshing proxies:', error);
      return false;
    }
  }

  /**
   * Get next proxy using round-robin strategy
   */
  public getNextProxy(): WebshareProxy | null {
    if (this.proxies.length === 0) {
      return null;
    }

    const proxy = this.proxies[this.currentProxyIndex];
    this.currentProxyIndex = (this.currentProxyIndex + 1) % this.proxies.length;
    return proxy;
  }

  /**
   * Check if proxies need refreshing
   */
  private shouldRefreshProxies(): boolean {
    return (
      this.proxies.length === 0 || 
      (Date.now() - this.lastProxyRefresh) > this.proxyRefreshInterval
    );
  }

  /**
   * Make HTTP request through Webshare proxy
   */
  async makeProxyRequest(requestConfig: WebshareRequest): Promise<WebshareProxyResponse> {
    const startTime = Date.now();

    // Refresh proxies if needed
    if (this.shouldRefreshProxies()) {
      const refreshed = await this.refreshProxies();
      if (!refreshed && this.proxies.length === 0) {
        return {
          success: false,
          error: 'No valid proxies available and refresh failed'
        };
      }
    }

    const proxy = this.getNextProxy();
    if (!proxy) {
      return {
        success: false,
        error: 'No proxies available'
      };
    }

    try {
      // Create proxy request through our API endpoint
      const response = await fetch('/api/superadmin/webshare-request', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          proxy: {
            host: proxy.proxy_address,
            port: proxy.port,
            username: proxy.username,
            password: proxy.password
          },
          request: requestConfig
        }),
      });

      const result = await response.json();
      const responseTime = Date.now() - startTime;

      // Log the request
      await this.logRequest({
        url: requestConfig.url,
        proxyId: proxy.id,
        proxyAddress: `${proxy.proxy_address}:${proxy.port}`,
        success: result.success,
        responseTime,
        statusCode: result.statusCode || 0,
        error: result.error || null,
        timestamp: new Date().toISOString()
      });

      if (result.success) {
        return {
          success: true,
          data: result.data,
          proxyUsed: proxy,
          responseTime,
          statusCode: result.statusCode
        };
      } else {
        // Mark proxy as problematic if request failed
        await this.markProxyAsProblematic(proxy.id);
        return {
          success: false,
          error: result.error || 'Proxy request failed',
          proxyUsed: proxy,
          responseTime,
          statusCode: result.statusCode
        };
      }

    } catch (error) {
      const responseTime = Date.now() - startTime;
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        proxyUsed: proxy,
        responseTime
      };
    }
  }

  /**
   * Log proxy request for monitoring
   */
  async logRequest(logData: {
    url: string;
    proxyId: string;
    proxyAddress: string;
    success: boolean;
    responseTime: number;
    statusCode: number;
    error: string | null;
    timestamp: string;
  }): Promise<void> {
    try {
      // In a real implementation, this would save to Firestore
      console.log('Auto Price Proxy Request Log:', logData);
      
      // For now, just log to console
      // TODO: Implement Firestore logging when database structure is ready
    } catch (error) {
      console.error('Error logging proxy request:', error);
    }
  }

  /**
   * Mark a proxy as problematic
   */
  async markProxyAsProblematic(proxyId: string): Promise<void> {
    try {
      // Find and remove the problematic proxy from our list
      this.proxies = this.proxies.filter(proxy => proxy.id !== proxyId);
      console.log(`Auto Price: Marked proxy ${proxyId} as problematic and removed from rotation`);
      
      // TODO: Implement Firestore logging for problematic proxies
    } catch (error) {
      console.error('Error marking proxy as problematic:', error);
    }
  }

  /**
   * Make Takealot scraping request through proxy
   */
  async scrapeTakealotProduct(tsin: string): Promise<WebshareProxyResponse> {
    const url = `https://www.takealot.com/p/${tsin}`;
    
    return this.makeProxyRequest({
      url,
      method: 'GET',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5',
        'Accept-Encoding': 'gzip, deflate, br',
        'DNT': '1',
        'Connection': 'keep-alive',
        'Upgrade-Insecure-Requests': '1',
        'Sec-Fetch-Dest': 'document',
        'Sec-Fetch-Mode': 'navigate',
        'Sec-Fetch-Site': 'none',
      },
      timeout: 30000
    });
  }

  /**
   * Get proxy statistics
   */
  getProxyStats(): {
    totalProxies: number;
    lastRefresh: Date | null;
    currentProxyIndex: number;
  } {
    return {
      totalProxies: this.proxies.length,
      lastRefresh: this.lastProxyRefresh ? new Date(this.lastProxyRefresh) : null,
      currentProxyIndex: this.currentProxyIndex
    };
  }

  /**
   * Test proxy connectivity
   */
  async testProxyConnectivity(): Promise<{
    success: boolean;
    workingProxies: number;
    totalProxies: number;
    errors: string[];
  }> {
    if (this.proxies.length === 0) {
      await this.refreshProxies();
    }

    const testPromises = this.proxies.slice(0, 5).map(async (proxy) => {
      try {
        const result = await this.makeProxyRequest({
          url: 'https://httpbin.org/ip',
          timeout: 10000
        });
        return result.success;
      } catch {
        return false;
      }
    });

    const results = await Promise.all(testPromises);
    const workingProxies = results.filter(Boolean).length;

    return {
      success: workingProxies > 0,
      workingProxies,
      totalProxies: Math.min(this.proxies.length, 5),
      errors: []
    };
  }

  /**
   * Get request logs with pagination
   */
  async getRequestLogs(page: number = 1, limit: number = 50): Promise<{
    logs: any[];
    total: number;
    page: number;
    totalPages: number;
  }> {
    try {
      // TODO: Implement actual Firestore query when database structure is ready
      return {
        logs: [],
        total: 0,
        page,
        totalPages: 0
      };
    } catch (error) {
      console.error('Error getting request logs:', error);
      return {
        logs: [],
        total: 0,
        page,
        totalPages: 0
      };
    }
  }
}

// Export singleton instance
export const autoPriceWebshareService = new AutoPriceWebshareService();
export default AutoPriceWebshareService;
