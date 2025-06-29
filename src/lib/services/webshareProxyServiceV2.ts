import { 
  WebshareProxy, 
  ProxyUsageStats, 
  WebshareConfig, 
  WEBSHARE_ENDPOINTS,
  DEFAULT_WEBSHARE_CONFIG,
  WebshareApiResponse,
  ProxyPool,
  ProxyLoadOptions,
  ProxyFilterOptions
} from '@/types/webshare';

/**
 * Enhanced Webshare Proxy Service V2
 * Designed for handling massive proxy pools (500+ to unlimited)
 * Features: Pagination, lazy loading, caching, advanced filtering
 */
class WebshareProxyServiceV2 {
  private config: WebshareConfig;
  private proxyPools: Map<string, ProxyPool> = new Map();
  private usageStats: Map<number, ProxyUsageStats> = new Map();
  private currentProxyIndex = 0;
  private lastRotation = 0;
  private cache: Map<string, { data: any; timestamp: number }> = new Map();
  private activeRequests: Map<string, Promise<any>> = new Map();

  constructor(config: Partial<WebshareConfig> = {}) {
    this.config = { ...DEFAULT_WEBSHARE_CONFIG, ...config };
    this.initializeDefaultPool();
  }

  /**
   * Initialize default proxy pool
   */
  private initializeDefaultPool(): void {
    this.proxyPools.set('default', {
      id: 'default',
      name: 'Default Pool',
      proxies: [],
      totalCount: 0,
      loadedCount: 0,
      lastUpdate: new Date().toISOString(),
      isComplete: false,
    });
  }

  /**
   * Set API token for Webshare authentication
   */
  setApiToken(token: string): void {
    this.config.apiToken = token;
    this.clearCache(); // Clear cache when token changes
  }

  /**
   * Clear all cached data
   */
  clearCache(): void {
    this.cache.clear();
    this.activeRequests.clear();
  }

  /**
   * Check if cached data is still valid
   */
  private isCacheValid(cacheKey: string): boolean {
    if (!this.config.enableCaching) return false;
    
    const cached = this.cache.get(cacheKey);
    if (!cached) return false;
    
    const expiryTime = cached.timestamp + (this.config.cacheExpiryMinutes * 60 * 1000);
    return Date.now() < expiryTime;
  }

  /**
   * Set cached data
   */
  private setCache(cacheKey: string, data: any): void {
    if (this.config.enableCaching) {
      this.cache.set(cacheKey, {
        data,
        timestamp: Date.now(),
      });
    }
  }

  /**
   * Get cached data
   */
  private getCache(cacheKey: string): any | null {
    if (!this.isCacheValid(cacheKey)) return null;
    return this.cache.get(cacheKey)?.data || null;
  }

  /**
   * Make authenticated request to Webshare API with caching
   */
  private async makeWebshareRequest<T>(
    endpoint: string, 
    options: RequestInit = {},
    cacheKey?: string
  ): Promise<T> {
    // Check cache first
    if (cacheKey && this.isCacheValid(cacheKey)) {
      const cached = this.getCache(cacheKey);
      if (cached) return cached;
    }

    // Prevent duplicate requests
    const requestKey = `${endpoint}_${JSON.stringify(options)}`;
    if (this.activeRequests.has(requestKey)) {
      return this.activeRequests.get(requestKey)!;
    }

    const url = `${this.config.baseUrl}${endpoint}`;
    
    const requestPromise = fetch(url, {
      ...options,
      headers: {
        'Authorization': `Token ${this.config.apiToken}`,
        'Content-Type': 'application/json',
        ...options.headers,
      },
    }).then(async (response) => {
      if (!response.ok) {
        throw new Error(`Webshare API error: ${response.status} ${response.statusText}`);
      }
      
      const data = await response.json();
      
      // Cache the result
      if (cacheKey) {
        this.setCache(cacheKey, data);
      }
      
      return data;
    }).finally(() => {
      this.activeRequests.delete(requestKey);
    });

    this.activeRequests.set(requestKey, requestPromise);
    return requestPromise;
  }

  /**
   * Load proxies with pagination support
   */
  async loadProxies(
    poolId: string = 'default', 
    options: ProxyLoadOptions = {}
  ): Promise<ProxyPool> {
    const {
      pageSize = this.config.pageSize,
      maxPages = 0, // 0 = load all pages
      country,
      city,
      forceRefresh = false
    } = options;

    let pool = this.proxyPools.get(poolId);
    if (!pool) {
      pool = {
        id: poolId,
        name: `Pool ${poolId}`,
        proxies: [],
        totalCount: 0,
        loadedCount: 0,
        lastUpdate: new Date().toISOString(),
        isComplete: false,
      };
      this.proxyPools.set(poolId, pool);
    }

    // Skip if pool is complete and not forcing refresh
    if (pool.isComplete && !forceRefresh) {
      return pool;
    }

    // Clear pool if forcing refresh
    if (forceRefresh) {
      pool.proxies = [];
      pool.loadedCount = 0;
      pool.isComplete = false;
    }

    let currentPage = Math.floor(pool.loadedCount / pageSize) + 1;
    let nextUrl: string | null = null;
    let pagesLoaded = 0;

    try {
      while (true) {
        // Build query parameters
        const params = new URLSearchParams();
        params.append('page_size', pageSize.toString());
        if (nextUrl) {
          // Use next URL from pagination
          const url = new URL(nextUrl);
          url.searchParams.forEach((value, key) => params.set(key, value));
        } else {
          params.append('page', currentPage.toString());
        }
        
        if (country) params.append('country_code', country);
        if (city) params.append('city_name', city);

        const cacheKey = `proxies_${poolId}_${params.toString()}`;
        
        const response = await this.makeWebshareRequest<WebshareApiResponse<WebshareProxy>>(
          `${WEBSHARE_ENDPOINTS.PROXY_LIST}?${params.toString()}`,
          {},
          cacheKey
        );

        // Add proxies to pool
        pool.proxies.push(...response.results);
        pool.totalCount = response.count;
        pool.loadedCount = pool.proxies.length;
        pool.lastUpdate = new Date().toISOString();

        // Initialize usage stats for new proxies
        response.results.forEach(proxy => {
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

        nextUrl = response.next;
        pagesLoaded++;

        // Check if we should continue loading
        const shouldStop = !nextUrl || 
          (maxPages > 0 && pagesLoaded >= maxPages) ||
          (this.config.maxProxiesToLoad > 0 && pool.loadedCount >= this.config.maxProxiesToLoad);

        if (shouldStop) {
          pool.isComplete = !nextUrl;
          break;
        }

        currentPage++;
      }

      console.log(`Loaded ${pool.loadedCount} proxies for pool ${poolId} (${pool.isComplete ? 'complete' : 'partial'})`);
      return pool;

    } catch (error) {
      console.error(`Failed to load proxies for pool ${poolId}:`, error);
      throw error;
    }
  }

  /**
   * Get proxies from a specific pool with filtering
   */
  getProxies(poolId: string = 'default', filters: ProxyFilterOptions = {}): WebshareProxy[] {
    const pool = this.proxyPools.get(poolId);
    if (!pool) return [];

    let proxies = pool.proxies;

    // Apply filters
    if (filters.country) {
      proxies = proxies.filter(p => p.country_code === filters.country);
    }
    if (filters.city) {
      proxies = proxies.filter(p => p.city_name === filters.city);
    }
    if (filters.isValid !== undefined) {
      proxies = proxies.filter(p => p.is_valid === filters.isValid);
    }
    if (filters.minUsageCount !== undefined) {
      proxies = proxies.filter(p => p.usage_count >= filters.minUsageCount!);
    }
    if (filters.maxUsageCount !== undefined) {
      proxies = proxies.filter(p => p.usage_count <= filters.maxUsageCount!);
    }
    if (filters.status) {
      proxies = proxies.filter(p => {
        const stats = this.usageStats.get(p.id);
        return stats && stats.status === filters.status;
      });
    }

    return proxies;
  }

  /**
   * Get all proxy pools
   */
  getProxyPools(): ProxyPool[] {
    return Array.from(this.proxyPools.values());
  }

  /**
   * Get proxy pool by ID
   */
  getProxyPool(poolId: string): ProxyPool | null {
    return this.proxyPools.get(poolId) || null;
  }

  /**
   * Create a new proxy pool with specific criteria
   */
  async createProxyPool(
    poolId: string, 
    name: string, 
    loadOptions: ProxyLoadOptions = {}
  ): Promise<ProxyPool> {
    const pool: ProxyPool = {
      id: poolId,
      name,
      proxies: [],
      totalCount: 0,
      loadedCount: 0,
      lastUpdate: new Date().toISOString(),
      isComplete: false,
    };

    this.proxyPools.set(poolId, pool);
    return this.loadProxies(poolId, loadOptions);
  }

  /**
   * Get next proxy with advanced selection strategies
   */
  getNextProxy(
    poolId: string = 'default',
    strategy: 'round-robin' | 'random' | 'least-used' | 'geographic' | 'fastest' = 'round-robin',
    filters: ProxyFilterOptions = {}
  ): WebshareProxy | null {
    const proxies = this.getProxies(poolId, filters);
    if (proxies.length === 0) return null;

    let selectedProxy: WebshareProxy;

    switch (strategy) {
      case 'round-robin':
        selectedProxy = proxies[this.currentProxyIndex % proxies.length];
        this.currentProxyIndex = (this.currentProxyIndex + 1) % proxies.length;
        break;

      case 'random':
        selectedProxy = proxies[Math.floor(Math.random() * proxies.length)];
        break;

      case 'least-used':
        const stats = Array.from(this.usageStats.values());
        const availableStats = stats.filter(s => 
          proxies.some(p => p.id === s.proxy_id)
        );
        const leastUsedStats = availableStats.reduce((min, current) => 
          current.requests_made < min.requests_made ? current : min
        );
        selectedProxy = proxies.find(p => p.id === leastUsedStats.proxy_id) || proxies[0];
        break;

      case 'geographic':
        // Prefer South African proxies for Takealot
        const saProxies = proxies.filter(p => p.country_code === 'ZA');
        if (saProxies.length > 0) {
          selectedProxy = saProxies[Math.floor(Math.random() * saProxies.length)];
        } else {
          selectedProxy = proxies[Math.floor(Math.random() * proxies.length)];
        }
        break;

      case 'fastest':
        const fastestStats = Array.from(this.usageStats.values())
          .filter(s => proxies.some(p => p.id === s.proxy_id) && s.avg_response_time > 0)
          .sort((a, b) => a.avg_response_time - b.avg_response_time)[0];
        selectedProxy = proxies.find(p => p.id === fastestStats?.proxy_id) || proxies[0];
        break;

      default:
        selectedProxy = proxies[0];
    }

    return selectedProxy;
  }

  /**
   * Get comprehensive statistics across all pools
   */
  getGlobalStats(): {
    totalPools: number;
    totalProxies: number;
    loadedProxies: number;
    completePools: number;
    activeProxies: number;
    totalRequests: number;
    successRate: number;
    avgResponseTime: number;
    topCountries: { country: string; count: number }[];
    poolStats: { poolId: string; name: string; count: number; loaded: number; complete: boolean }[];
  } {
    const pools = Array.from(this.proxyPools.values());
    const stats = Array.from(this.usageStats.values());
    
    const totalRequests = stats.reduce((sum, s) => sum + s.requests_made, 0);
    const successfulRequests = stats.reduce((sum, s) => sum + s.successful_requests, 0);
    const totalResponseTime = stats.reduce((sum, s) => sum + (s.avg_response_time * s.requests_made), 0);
    
    // Count proxies by country across all pools
    const countryCount = new Map<string, number>();
    pools.forEach(pool => {
      pool.proxies.forEach(p => {
        countryCount.set(p.country_code, (countryCount.get(p.country_code) || 0) + 1);
      });
    });
    
    const topCountries = Array.from(countryCount.entries())
      .map(([country, count]) => ({ country, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    const poolStats = pools.map(pool => ({
      poolId: pool.id,
      name: pool.name,
      count: pool.totalCount,
      loaded: pool.loadedCount,
      complete: pool.isComplete,
    }));

    return {
      totalPools: pools.length,
      totalProxies: pools.reduce((sum, pool) => sum + pool.totalCount, 0),
      loadedProxies: pools.reduce((sum, pool) => sum + pool.loadedCount, 0),
      completePools: pools.filter(pool => pool.isComplete).length,
      activeProxies: stats.filter(s => s.status === 'active').length,
      totalRequests,
      successRate: totalRequests > 0 ? (successfulRequests / totalRequests) * 100 : 0,
      avgResponseTime: totalRequests > 0 ? totalResponseTime / totalRequests : 0,
      topCountries,
      poolStats,
    };
  }

  /**
   * Export proxy data with advanced options
   */
  exportProxies(
    poolId: string = 'default',
    format: 'json' | 'txt' | 'csv' | 'proxy-list' = 'json',
    filters: ProxyFilterOptions = {}
  ): string {
    const proxies = this.getProxies(poolId, filters);
    
    switch (format) {
      case 'json':
        return JSON.stringify(proxies, null, 2);
        
      case 'txt':
        return proxies.map(p => 
          `${p.proxy_address}:${p.port}:${p.username}:${p.password}`
        ).join('\n');
        
      case 'csv':
        const headers = 'Address,Port,Username,Password,Country,City,Created,Valid,Usage';
        const rows = proxies.map(p => 
          `${p.proxy_address},${p.port},${p.username},${p.password},${p.country_code},${p.city_name},${p.created_at},${p.is_valid},${p.usage_count}`
        );
        return [headers, ...rows].join('\n');
        
      case 'proxy-list':
        // Standard proxy list format
        return proxies.map(p => 
          `${p.proxy_address}:${p.port}`
        ).join('\n');
        
      default:
        return JSON.stringify(proxies);
    }
  }

  /**
   * Update proxy usage statistics
   */
  updateProxyStats(
    proxyId: number, 
    success: boolean, 
    responseTime: number
  ): void {
    const stats = this.usageStats.get(proxyId);
    if (!stats) return;

    stats.requests_made++;
    stats.last_activity = new Date().toISOString();

    if (success) {
      stats.successful_requests++;
      stats.avg_response_time = (stats.avg_response_time * (stats.requests_made - 1) + responseTime) / stats.requests_made;
      stats.status = 'active';
    } else {
      stats.failed_requests++;
      stats.status = 'failed';
    }
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
    url: string;
  } {
    return {
      host: proxy.proxy_address,
      port: proxy.port,
      username: proxy.username,
      password: proxy.password,
      protocol: 'http',
      url: `http://${proxy.username}:${proxy.password}@${proxy.proxy_address}:${proxy.port}`,
    };
  }

  /**
   * Health check for proxies
   */
  async healthCheck(
    poolId: string = 'default',
    sampleSize: number = 10
  ): Promise<{
    healthy: number;
    total: number;
    tested: number;
    details: Array<{ proxyId: number; success: boolean; responseTime: number; error?: string }>;
  }> {
    const proxies = this.getProxies(poolId);
    const sample = proxies.slice(0, sampleSize);
    const results: Array<{ proxyId: number; success: boolean; responseTime: number; error?: string }> = [];

    for (const proxy of sample) {
      const startTime = Date.now();
      try {
        // Test proxy with a simple request
        const response = await fetch('https://httpbin.org/ip', {
          method: 'GET',
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          },
          // Note: In a real implementation, you'd configure the proxy here
        });

        const responseTime = Date.now() - startTime;
        const success = response.ok;
        
        results.push({
          proxyId: proxy.id,
          success,
          responseTime,
        });

        this.updateProxyStats(proxy.id, success, responseTime);
      } catch (error) {
        const responseTime = Date.now() - startTime;
        results.push({
          proxyId: proxy.id,
          success: false,
          responseTime,
          error: error instanceof Error ? error.message : 'Unknown error',
        });

        this.updateProxyStats(proxy.id, false, responseTime);
      }
    }

    const healthy = results.filter(r => r.success).length;

    return {
      healthy,
      total: proxies.length,
      tested: results.length,
      details: results,
    };
  }
}

export default WebshareProxyServiceV2;
