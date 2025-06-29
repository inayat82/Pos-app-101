// Environment configuration for Webshare proxy service
export const WEBSHARE_CONFIG = {
  // Get API token from environment variable
  API_TOKEN: process.env.WEBSHARE_API_TOKEN || '',
  
  // Base URL for Webshare API
  BASE_URL: 'https://proxy.webshare.io',
  
  // Default configuration for production
  DEFAULT_CONFIG: {
    enablePagination: true,
    pageSize: 100,
    maxProxiesToLoad: 0, // 0 = unlimited
    enableCaching: true,
    cacheExpiryMinutes: 30,
    rotationInterval: 5,
    retryAttempts: 3,
    requestTimeout: 30000,
  },
  
  // Pool configurations for different use cases
  POOL_CONFIGS: {
    // High-performance pool for critical operations
    'high-performance': {
      country: 'ZA', // South Africa for Takealot
      maxProxiesToLoad: 100,
      pageSize: 50,
      rotationInterval: 2,
    },
    
    // General purpose pool
    'general': {
      maxProxiesToLoad: 500,
      pageSize: 100,
      rotationInterval: 5,
    },
    
    // Bulk operations pool
    'bulk': {
      maxProxiesToLoad: 0, // Load all available
      pageSize: 200,
      rotationInterval: 10,
    },
    
    // Geographic-specific pools
    'south-africa': {
      country: 'ZA',
      maxProxiesToLoad: 200,
      pageSize: 50,
    },
    
    'united-states': {
      country: 'US',
      maxProxiesToLoad: 300,
      pageSize: 100,
    },
    
    'europe': {
      country: 'GB', // Can be extended to multiple countries
      maxProxiesToLoad: 200,
      pageSize: 100,
    },
  },
  
  // Rate limiting configuration
  RATE_LIMITS: {
    // Requests per minute for different services
    takealot: 60,
    general: 120,
    bulk: 300,
    
    // Requests per hour
    takealot_hourly: 1000,
    general_hourly: 2000,
    bulk_hourly: 5000,
  },
  
  // Proxy selection strategies
  STRATEGIES: {
    // For Takealot scraping
    takealot: 'geographic',
    
    // For general web scraping
    general: 'round-robin',
    
    // For bulk operations
    bulk: 'least-used',
    
    // For performance-critical operations
    performance: 'fastest',
  },
  
  // Health check configuration
  HEALTH_CHECK: {
    // URL to test proxy connectivity
    testUrl: 'https://httpbin.org/ip',
    
    // Number of proxies to test in health check
    sampleSize: 20,
    
    // Health check interval in minutes
    interval: 15,
    
    // Timeout for health check requests
    timeout: 10000,
  },
  
  // Cache configuration
  CACHE: {
    // Cache keys and expiry times
    proxy_list: 30, // 30 minutes
    proxy_stats: 10, // 10 minutes
    health_check: 5, // 5 minutes
    
    // Maximum cache size (number of entries)
    maxSize: 1000,
  },
  
  // Monitoring and alerting
  MONITORING: {
    // Thresholds for alerts
    thresholds: {
      success_rate: 85, // Alert if success rate drops below 85%
      response_time: 5000, // Alert if avg response time > 5 seconds
      failed_proxies: 10, // Alert if more than 10% of proxies fail
    },
    
    // Metrics to track
    metrics: [
      'total_requests',
      'success_rate',
      'average_response_time',
      'proxy_health',
      'rate_limit_hits',
      'error_rate',
    ],
  },
};

// Validation function for environment setup
export function validateWebshareConfig(): {
  isValid: boolean;
  errors: string[];
  warnings: string[];
} {
  const errors: string[] = [];
  const warnings: string[] = [];

  // Check for required API token
  if (!WEBSHARE_CONFIG.API_TOKEN) {
    errors.push('WEBSHARE_API_TOKEN environment variable is required');
  }

  // Validate API token format (basic check)
  if (WEBSHARE_CONFIG.API_TOKEN && WEBSHARE_CONFIG.API_TOKEN.length < 20) {
    warnings.push('WEBSHARE_API_TOKEN appears to be too short, please verify');
  }

  // Check environment-specific configurations
  const env = process.env.NODE_ENV || 'development';
  
  if (env === 'production') {
    if (!process.env.WEBSHARE_API_TOKEN) {
      errors.push('Production environment requires WEBSHARE_API_TOKEN');
    }
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings,
  };
}

// Helper function to get pool configuration
export function getPoolConfig(poolName: string): any {
  return WEBSHARE_CONFIG.POOL_CONFIGS[poolName as keyof typeof WEBSHARE_CONFIG.POOL_CONFIGS] || 
         WEBSHARE_CONFIG.POOL_CONFIGS.general;
}

// Helper function to get rate limit for service
export function getRateLimit(service: string): { perMinute: number; perHour: number } {
  const key = service as keyof typeof WEBSHARE_CONFIG.RATE_LIMITS;
  const perMinute = WEBSHARE_CONFIG.RATE_LIMITS[key] || WEBSHARE_CONFIG.RATE_LIMITS.general;
  const hourlyKey = `${service}_hourly` as keyof typeof WEBSHARE_CONFIG.RATE_LIMITS;
  const perHour = WEBSHARE_CONFIG.RATE_LIMITS[hourlyKey] || WEBSHARE_CONFIG.RATE_LIMITS.general_hourly;
  
  return { perMinute, perHour };
}

// Helper function to get selection strategy
export function getSelectionStrategy(service: string): string {
  const key = service as keyof typeof WEBSHARE_CONFIG.STRATEGIES;
  return WEBSHARE_CONFIG.STRATEGIES[key] || WEBSHARE_CONFIG.STRATEGIES.general;
}
