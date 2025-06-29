import { 
  WebshareProxy, 
  ProxyUsageStats, 
  WebshareConfig, 
  WEBSHARE_ENDPOINTS,
  DEFAULT_WEBSHARE_CONFIG 
} from '@/types/webshare';

class WebshareProxyService {
  private config: WebshareConfig;
  private proxies: WebshareProxy[] = [];
  private usageStats: Map<number, ProxyUsageStats> = new Map();
  private currentProxyIndex = 0;
  private lastRotation = 0;

  constructor(config: Partial<WebshareConfig> = {}) {
    this.config = { ...DEFAULT_WEBSHARE_CONFIG, ...config };
  }

  /**
   * Set API token for Webshare authentication
   */
  setApiToken(token: string): void {
    this.config.apiToken = token;
  }

  /**
   * Make authenticated request to Webshare API
   */
  private async makeWebshareRequest<T>(
    endpoint: string, 
    options: RequestInit = {}
  ): Promise<T> {
    const url = `${this.config.baseUrl}${endpoint}`;
    
    const response = await fetch(url, {
      ...options,
      headers: {
        'Authorization': `Token ${this.config.apiToken}`,
        'Content-Type': 'application/json',
        ...options.headers,
      },
    });

    if (!response.ok) {
      throw new Error(`Webshare API error: ${response.status} ${response.statusText}`);
    }

    return response.json();
  }

  /**
   * Fetch all available proxies from Webshare
   */
  async fetchProxies(): Promise<WebshareProxy[]> {
    try {
      const response = await this.makeWebshareRequest<{
        count: number;
        next: string | null;
        previous: string | null;
        results: WebshareProxy[];
      }>(WEBSHARE_ENDPOINTS.PROXY_LIST + '?page_size=100');

      this.proxies = response.results;
      
      // Initialize usage stats for new proxies
      this.proxies.forEach(proxy => {
        if (!this.usageStats.has(proxy.id)) {
          this.usageStats.set(proxy.id, {
            proxy_id: proxy.id,
            requests_made: 0,
            successful_requests: 0,
            failed_requests: 0,
            avg_response_time: 0,
            last_activity: new Date().toISOString(),
            status: 'inactive',
          });
        }
      });

      return this.proxies;
    } catch (error) {
      console.error('Failed to fetch proxies:', error);
      throw error;
    }
  }

  /**
   * Get current proxy list
   */
  getProxies(): WebshareProxy[] {
    return this.proxies;
  }

  /**
   * Get proxy usage statistics
   */
  getUsageStats(): ProxyUsageStats[] {
    return Array.from(this.usageStats.values());
  }

  /**
   * Get next proxy based on rotation strategy
   */
  getNextProxy(strategy: 'round-robin' | 'random' | 'least-used' | 'geographic' = 'round-robin'): WebshareProxy | null {
    if (this.proxies.length === 0) {
      return null;
    }

    let selectedProxy: WebshareProxy;

    switch (strategy) {
      case 'round-robin':
        selectedProxy = this.proxies[this.currentProxyIndex];
        this.currentProxyIndex = (this.currentProxyIndex + 1) % this.proxies.length;
        break;

      case 'random':
        const randomIndex = Math.floor(Math.random() * this.proxies.length);
        selectedProxy = this.proxies[randomIndex];
        break;

      case 'least-used':
        const stats = Array.from(this.usageStats.values());
        const leastUsedStats = stats.reduce((min, current) => 
          current.requests_made < min.requests_made ? current : min
        );
        selectedProxy = this.proxies.find(p => p.id === leastUsedStats.proxy_id) || this.proxies[0];
        break;

      case 'geographic':
        // Prefer South African proxies for Takealot
        const saProxies = this.proxies.filter(p => p.country_code === 'ZA');
        if (saProxies.length > 0) {
          selectedProxy = saProxies[Math.floor(Math.random() * saProxies.length)];
        } else {
          selectedProxy = this.proxies[Math.floor(Math.random() * this.proxies.length)];
        }
        break;

      default:
        selectedProxy = this.proxies[0];
    }

    return selectedProxy;
  }

  /**
   * Make HTTP request through proxy
   */
  async makeProxyRequest(
    url: string, 
    options: RequestInit = {}, 
    proxyStrategy: 'round-robin' | 'random' | 'least-used' | 'geographic' = 'round-robin'
  ): Promise<Response> {
    const proxy = this.getNextProxy(proxyStrategy);
    
    if (!proxy) {
      throw new Error('No proxies available');
    }

    const stats = this.usageStats.get(proxy.id)!;
    const startTime = Date.now();

    try {
      // Create proxy configuration
      const proxyUrl = `http://${proxy.username}:${proxy.password}@${proxy.proxy_address}:${proxy.port}`;
      
      // Note: In a real implementation, you'd use a HTTP client that supports proxies
      // For browser environments, you might need to use a proxy service endpoint
      const response = await fetch(url, {
        ...options,
        // In Node.js, you would configure the proxy here
        // For browser, this would go through your backend API that handles proxy requests
      });

      // Update success stats
      const responseTime = Date.now() - startTime;
      stats.requests_made++;
      stats.successful_requests++;
      stats.avg_response_time = (stats.avg_response_time * (stats.requests_made - 1) + responseTime) / stats.requests_made;
      stats.last_activity = new Date().toISOString();
      stats.status = 'active';

      return response;
    } catch (error) {
      // Update failure stats
      stats.requests_made++;
      stats.failed_requests++;
      stats.last_activity = new Date().toISOString();
      stats.status = 'failed';
      
      throw error;
    }
  }

  /**
   * Get proxy health status
   */
  async checkProxyHealth(): Promise<{ healthy: number; total: number; details: ProxyUsageStats[] }> {
    const stats = this.getUsageStats();
    const healthy = stats.filter(s => s.status === 'active' || s.status === 'inactive').length;
    
    return {
      healthy,
      total: stats.length,
      details: stats,
    };
  }

  /**
   * Rotate proxy if rotation interval has passed
   */
  shouldRotateProxy(): boolean {
    const now = Date.now();
    const rotationIntervalMs = this.config.rotationInterval * 60 * 1000;
    
    if (now - this.lastRotation >= rotationIntervalMs) {
      this.lastRotation = now;
      return true;
    }
    
    return false;
  }

  /**
   * Get proxy configuration for external use
   */
  getProxyConfig(proxy: WebshareProxy): {
    host: string;
    port: number;
    username: string;
    password: string;
    protocol: string;
  } {
    return {
      host: proxy.proxy_address,
      port: proxy.port,
      username: proxy.username,
      password: proxy.password,
      protocol: 'http',
    };
  }

  /**
   * Export proxy list in various formats
   */
  exportProxies(format: 'json' | 'txt' | 'csv'): string {
    switch (format) {
      case 'json':
        return JSON.stringify(this.proxies, null, 2);
        
      case 'txt':
        return this.proxies.map(p => 
          `${p.proxy_address}:${p.port}:${p.username}:${p.password}`
        ).join('\n');
        
      case 'csv':
        const headers = 'Address,Port,Username,Password,Country,City,Created,Valid';
        const rows = this.proxies.map(p => 
          `${p.proxy_address},${p.port},${p.username},${p.password},${p.country_code},${p.city_name},${p.created_at},${p.is_valid}`
        );
        return [headers, ...rows].join('\n');
        
      default:
        return JSON.stringify(this.proxies);
    }
  }

  /**
   * Get proxies by country
   */
  getProxiesByCountry(countryCode: string): WebshareProxy[] {
    return this.proxies.filter(p => p.country_code === countryCode);
  }

  /**
   * Get proxy statistics summary
   */
  getStatsSummary(): {
    totalProxies: number;
    activeProxies: number;
    totalRequests: number;
    successRate: number;
    avgResponseTime: number;
    topCountries: { country: string; count: number }[];
  } {
    const stats = this.getUsageStats();
    const totalRequests = stats.reduce((sum, s) => sum + s.requests_made, 0);
    const successfulRequests = stats.reduce((sum, s) => sum + s.successful_requests, 0);
    const totalResponseTime = stats.reduce((sum, s) => sum + (s.avg_response_time * s.requests_made), 0);
    
    // Count proxies by country
    const countryCount = new Map<string, number>();
    this.proxies.forEach(p => {
      countryCount.set(p.country_code, (countryCount.get(p.country_code) || 0) + 1);
    });
    
    const topCountries = Array.from(countryCount.entries())
      .map(([country, count]) => ({ country, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);

    return {
      totalProxies: this.proxies.length,
      activeProxies: stats.filter(s => s.status === 'active').length,
      totalRequests,
      successRate: totalRequests > 0 ? (successfulRequests / totalRequests) * 100 : 0,
      avgResponseTime: totalRequests > 0 ? totalResponseTime / totalRequests : 0,
      topCountries,
    };
  }
}

export default WebshareProxyService;
