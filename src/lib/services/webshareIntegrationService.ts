// Webshare Proxy Integration Service for Takealot APIs
import { WebshareProxy } from '@/types/webshare';

export interface ProxyRequest {
  url: string;
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE';
  headers?: Record<string, string>;
  body?: any;
  timeout?: number;
}

export interface ProxyResponse {
  success: boolean;
  data?: any;
  error?: string;
  proxyUsed?: WebshareProxy;
  responseTime?: number;
  statusCode?: number;
}

class WebshareIntegrationService {
  private apiToken: string = '';
  private proxies: WebshareProxy[] = [];
  private currentProxyIndex: number = 0;
  private lastProxyRefresh: number = 0;
  private proxyRefreshInterval: number = 5 * 60 * 1000; // 5 minutes

  /**
   * Set the Webshare API token
   */
  setApiToken(token: string): void {
    this.apiToken = token;
  }

  /**
   * Get API token from localStorage if available
   */
  private getApiToken(): string {
    if (this.apiToken) return this.apiToken;
    
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem('webshare_api_token');
      if (stored) {
        this.apiToken = stored;
        return stored;
      }
    }
    
    return '';
  }

  /**
   * Fetch available proxies from Webshare API
   */
  async refreshProxies(): Promise<boolean> {
    const token = this.getApiToken();
    if (!token) {
      console.warn('No Webshare API token available');
      return false;
    }

    try {
      const response = await fetch(`/api/superadmin/webshare?apiToken=${encodeURIComponent(token)}&action=list&page=1&page_size=100`);
      const result = await response.json();

      if (result.success && result.data?.results) {
        // Filter for valid proxies only
        this.proxies = result.data.results.filter((proxy: WebshareProxy) => proxy.is_valid);
        this.lastProxyRefresh = Date.now();
        console.log(`Refreshed ${this.proxies.length} valid proxies from Webshare`);
        return true;
      } else {
        console.error('Failed to refresh proxies:', result.error);
        return false;
      }
    } catch (error) {
      console.error('Error refreshing proxies:', error);
      return false;
    }
  }

  /**
   * Get next proxy using round-robin strategy
   */
  private getNextProxy(): WebshareProxy | null {
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
   * Note: This creates a server-side proxy request since browsers can't directly use SOCKS/HTTP proxies
   */
  async makeProxyRequest(requestConfig: ProxyRequest): Promise<ProxyResponse> {
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

      if (result.success) {
        return {
          success: true,
          data: result.data,
          proxyUsed: proxy,
          responseTime,
          statusCode: result.statusCode
        };
      } else {
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
   * Make Takealot API request through proxy
   */
  async makeTakealotRequest(
    endpoint: string,
    apiKey: string,
    options: {
      method?: 'GET' | 'POST';
      body?: any;
      timeout?: number;
    } = {}
  ): Promise<ProxyResponse> {
    const url = `https://api.takealot.com/seller${endpoint}`;
    
    return this.makeProxyRequest({
      url,
      method: options.method || 'GET',
      headers: {
        'Authorization': `Key ${apiKey}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
      },
      body: options.body,
      timeout: options.timeout || 30000
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

    const testPromises = this.proxies.slice(0, 10).map(async (proxy) => {
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
      totalProxies: Math.min(this.proxies.length, 10),
      errors: []
    };
  }
}

// Export singleton instance
export const webshareService = new WebshareIntegrationService();
export default WebshareIntegrationService;
