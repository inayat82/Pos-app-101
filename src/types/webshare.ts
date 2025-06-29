// Webshare Proxy Service Configuration and Types
export interface WebshareProxy {
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
  asn_number?: string;
  asn_name?: string;
}

export interface WebshareUsageStats {
  timestamp: string;
  is_projected: boolean;
  bandwidth_total: number;
  bandwidth_average: number;
  requests_total: number;
  requests_successful: number;
  requests_failed: number;
  error_reasons: ErrorReason[];
  countries_used: { [key: string]: number };
  number_of_proxies_used: number;
  protocols_used: { [key: string]: number };
  average_concurrency: number;
  average_rps: number;
  last_request_sent_at: string;
}

export interface WebshareStatsAggregated {
  total_bandwidth: number;
  total_requests: number;
  successful_requests: number;
  failed_requests: number;
  success_rate: number;
  avg_response_time: number;
  total_proxies_used: number;
  countries_breakdown: { [key: string]: number };
  protocols_breakdown: { [key: string]: number };
  error_breakdown: { [key: string]: number };
  peak_concurrency: number;
  avg_rps: number;
  last_activity: string;
}

export interface ErrorReason {
  reason: string;
  type: string;
  how_to_fix: string;
  http_status: number;
  count: number;
}

export interface WebshareProfile {
  id: number;
  email: string;
  first_name: string;
  last_name: string;
  last_login: string;
  timezone: string;
}

export interface WebshareSubscription {
  id: string;
  name: string;
  proxy_count: number;
  bandwidth_gb: number;
  expires_at: string;
  is_active: boolean;
  usage_bandwidth: number;
  usage_requests: number;
}

export interface WebshareIPAuth {
  authorized_ips: string[];
  current_ip: string;
  is_authorized: boolean;
}

export interface ProxyUsageStats {
  proxy_id: number;
  requests_made: number;
  successful_requests: number;
  failed_requests: number;
  avg_response_time: number;
  last_activity: string;
  status: 'active' | 'inactive' | 'blocked' | 'failed';
}

export interface WebshareApiResponse<T> {
  count: number;
  next: string | null;
  previous: string | null;
  results: T[];
}

export interface ProxyPool {
  id: string;
  name: string;
  proxies: WebshareProxy[];
  totalCount: number;
  loadedCount: number;
  lastUpdate: string;
  isComplete: boolean;
}

export interface ProxyLoadOptions {
  pageSize?: number;
  maxPages?: number;
  country?: string;
  city?: string;
  forceRefresh?: boolean;
}

export interface ProxyFilterOptions {
  country?: string;
  city?: string;
  isValid?: boolean;
  minUsageCount?: number;
  maxUsageCount?: number;
  status?: ProxyUsageStats['status'];
}

export interface WebshareConfig {
  apiToken: string;
  baseUrl: string;
  maxProxiesPerRequest: number;
  rotationInterval: number; // in minutes
  retryAttempts: number;
  requestTimeout: number; // in milliseconds
  enablePagination: boolean; // For handling large proxy pools
  pageSize: number; // Number of proxies per page
  maxProxiesToLoad: number; // Maximum proxies to load in memory (0 = unlimited)
  enableCaching: boolean; // Cache proxy data
  cacheExpiryMinutes: number; // Cache expiry time
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

export const WEBSHARE_ENDPOINTS = {
  PROXY_LIST: '/api/v2/proxy/list/',
  PROXY_STATS: '/api/v2/proxy/stats/',
  IP_AUTH: '/api/v2/ipauth/',
  PROFILE: '/api/v2/profile/',
  DOWNLOAD: '/api/v2/proxy/download/',
} as const;

export const DEFAULT_WEBSHARE_CONFIG: WebshareConfig = {
  apiToken: '',
  baseUrl: 'https://proxy.webshare.io',
  maxProxiesPerRequest: 100,
  rotationInterval: 5, // rotate every 5 minutes
  retryAttempts: 3,
  requestTimeout: 30000, // 30 seconds
  enablePagination: true,
  pageSize: 100,
  maxProxiesToLoad: 0, // 0 = unlimited
  enableCaching: true,
  cacheExpiryMinutes: 30,
};

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
