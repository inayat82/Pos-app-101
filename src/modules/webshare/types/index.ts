// Enhanced WebShare Types - Modern Dashboard
export interface WebshareConfig {
  apiKey: string;
  isEnabled: boolean;
  lastSyncAt: string | null;
  syncInterval: number; // in minutes
  maxRetries: number;
  timeout: number; // in milliseconds
  testStatus: 'connected' | 'failed' | 'testing' | 'not_tested';
  lastTestError: string | null;
  autoSyncEnabled: boolean; // Enable automatic hourly proxy sync
  autoSyncInterval: number; // Auto-sync interval in minutes (default: 60)
  lastAutoSyncAt: string | null; // When the last auto-sync occurred
  lastProxyRefresh?: string | null; // When the last on-demand refresh was performed
  
  // Enhanced account information
  profile: WebshareProfile | null;
  subscription: WebshareSubscription | null;
  
  // Cron & automation settings - Enhanced with multiple intervals
  cronSettings: {
    // Proxy sync scheduling
    proxySyncSchedule: {
      enabled: boolean;
      interval: 'hourly' | '3hours' | '6hours' | '24hours' | 'custom';
      customInterval?: number; // minutes for custom interval
      lastSync: string | null;
      nextSync: string | null;
    };
    
    // Account info sync scheduling
    accountSyncSchedule: {
      enabled: boolean;
      interval: 'hourly' | '3hours' | '6hours' | '24hours' | 'custom';
      customInterval?: number; // minutes for custom interval
      lastSync: string | null;
      nextSync: string | null;
    };
    
    // Statistics update scheduling
    statsUpdateSchedule: {
      enabled: boolean;
      interval: 'hourly' | '3hours' | '6hours' | '24hours' | 'custom';
      customInterval?: number; // minutes for custom interval
      lastUpdate: string | null;
      nextUpdate: string | null;
    };
    
    // Proxy health check scheduling
    healthCheckSchedule: {
      enabled: boolean;
      interval: 'hourly' | '3hours' | '6hours' | '24hours' | 'custom';
      customInterval?: number; // minutes for custom interval
      lastCheck: string | null;
      nextCheck: string | null;
    };
    
    // Legacy fields for backward compatibility
    statsUpdateInterval: number; // minutes
    lastStatsUpdate: string | null;
    autoRefreshProxies: boolean;
    proxyHealthCheckInterval: number; // minutes
  };
  
  // User preferences
  preferences: {
    timezone: string;
    notifications: {
      email: boolean;
      lowBalance: boolean;
      proxyExpiry: boolean;
      syncErrors: boolean;
    };
    dashboard: {
      defaultTab: 'account' | 'proxies' | 'settings';
      refreshInterval: number;
      showAdvancedMetrics: boolean;
    };
  };
  
  createdAt: string;
  updatedAt: string;
}

// Account information from Webshare API
export interface WebshareProfile {
  id: number;
  email: string;
  username: string;
  first_name: string;
  last_name: string;
  created_at: string;
  last_login: string;
  timezone: string;
  is_verified: boolean;
}

// Subscription details from Webshare API
export interface WebshareSubscription {
  id: string;
  plan_name: string;
  plan_type: string;
  proxy_limit: number;
  bandwidth_limit: number;
  current_usage: {
    proxy_count: number;
    bandwidth_used: number;
    requests_made: number;
  };
  billing: {
    amount: number;
    currency: string;
    billing_cycle: string;
    next_billing_date: string;
    status: string;
  };
  expires_at: string;
  auto_renew: boolean;
}

export interface WebshareProxy {
  id: string;
  webshareId: string;
  username: string;
  password: string;
  proxy_address: string;
  port: number;
  valid: boolean;
  last_verification_status: string;
  country_code: string;
  city_name: string | null;
  created_at: string;
  updated_at: string;
  syncedAt: string;
  proxy_type: string;
  
  // Enhanced performance metrics
  performance?: {
    uptime_percentage: number;
    avg_response_time: number;
    success_rate: number;
    total_requests: number;
    successful_requests: number;
    failed_requests: number;
    bandwidth_used: number;
    last_used: string | null;
  };
  
  // Geographic & network details
  asn_number?: string;
  asn_name?: string;
  region?: string;
  timezone?: string;
}

// Usage statistics from Webshare API
export interface WebshareUsageStats {
  total_requests: number;
  successful_requests: number;
  failed_requests: number;
  success_rate: number;
  bandwidth_total: number;
  countries_used: Record<string, number>;
  last_30_days: Array<{
    date: string;
    requests: number;
    bandwidth: number;
    success_rate: number;
  }>;
  error_breakdown?: Record<string, number>;
}

export interface WebshareDashboardData {
  profile: WebshareProfile | null;
  subscription: WebshareSubscription | null;
  usageStats: WebshareUsageStats | null;
  proxySummary: {
    total: number;
    valid: number;
    invalid: number;
    countries: string[];
    avgResponseTime: number;
  };
  lastUpdated: string;
}

export interface WebshareSyncJob {
  id: string;
  status: 'started' | 'completed' | 'failed';
  startTime: string;
  endTime?: string;
  proxiesAdded: number;
  proxiesUpdated: number;
  proxiesRemoved: number;
  totalProxies: number;
  error?: string;
}

export interface SystemStatus {
  isConfigured: boolean;
  isEnabled: boolean;
  testStatus: string;
  lastSync: string | null;
  totalProxies: number;
  lastSyncJob: WebshareSyncJob | null;
}

export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

export interface ProxyListResponse {
  proxies: WebshareProxy[];
  total: number;
}

export interface TestResult {
  success: boolean;
  error?: string;
  proxyCount?: number;
  warning?: string;
}

export interface TakealotRequestConfig {
  useProxy: boolean;
  proxyRotation: 'round-robin' | 'random' | 'least-used' | 'geographic';
  maxRetries: number;
  timeout: number;
  headers: Record<string, string>;
  rateLimit: {
    requestsPerMinute: number;
    requestsPerHour: number;
  };
}

export const DEFAULT_TAKEALOT_CONFIG: TakealotRequestConfig = {
  useProxy: true,
  proxyRotation: 'round-robin',
  maxRetries: 3,
  timeout: 30000,
  headers: {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
    'Accept': 'application/json, text/plain, */*',
    'Accept-Language': 'en-US,en;q=0.9',
    'Accept-Encoding': 'gzip, deflate, br',
    'Connection': 'keep-alive',
    'Cache-Control': 'no-cache',
  },
  rateLimit: {
    requestsPerMinute: 60,
    requestsPerHour: 1000,
  },
};

// Enhanced CRUD optimization types
export interface ProxyCrudOperation {
  operation: 'create' | 'update' | 'delete' | 'skip';
  proxy: WebshareProxy;
  reason: string;
  changedFields?: string[];
}

export interface CrudOptimizationResult {
  operations: ProxyCrudOperation[];
  statistics: {
    total: number;
    created: number;
    updated: number;
    deleted: number;
    skipped: number;
    savedWrites: number;
    costSaving: number; // estimated percentage
  };
  performance: {
    comparisonTime: number;
    totalTime: number;
    averageTimePerProxy: number;
  };
}

export interface CronScheduleConfig {
  type: 'hourly' | '3hours' | '6hours' | '24hours' | 'custom';
  customInterval?: number; // minutes
  enabled: boolean;
  lastExecution: string | null;
  nextExecution: string | null;
  executionCount: number;
  lastError: string | null;
}

export interface AdvancedSyncOptions {
  forceFullSync: boolean;
  compareBeforeUpdate: boolean;
  skipUnchangedProxies: boolean;
  batchSize: number;
  maxConcurrentOperations: number;
  enablePerformanceMetrics: boolean;
}
