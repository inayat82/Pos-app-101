// Enhanced WebShare Types - Complete API Coverage
// Includes all available data from WebShare API v2

export interface WebshareConfig {
  apiKey: string;
  isEnabled: boolean;
  lastSyncAt: string | null;
  syncInterval: number;
  maxRetries: number;
  timeout: number;
  testStatus: 'connected' | 'failed' | 'testing' | 'not_tested';
  lastTestError: string | null;
  autoSyncEnabled: boolean;
  autoSyncInterval: number;
  lastAutoSyncAt: string | null;
  createdAt: string;
  updatedAt: string;
}

// ENHANCED: Complete proxy data structure
export interface WebshareProxyEnhanced {
  // Basic proxy info (current)
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
  
  // MISSING: Extended proxy information
  asn_number?: string;              // ISP identifier
  asn_name?: string;                // ISP name
  region?: string;                  // Geographic region
  timezone?: string;                // Local timezone
  
  // MISSING: Performance metrics
  uptime_percentage?: number;       // Historical uptime
  avg_response_time?: number;       // Average response time (ms)
  success_rate?: number;            // Request success rate %
  last_health_check?: string;       // Last health check time
  health_score?: number;            // Overall health score (0-100)
  
  // MISSING: Usage statistics
  total_requests?: number;          // Total requests made
  successful_requests?: number;     // Successful requests
  failed_requests?: number;         // Failed requests
  bandwidth_used?: number;          // Bandwidth used (bytes)
  last_used?: string;               // Last time proxy was used
  
  // MISSING: Configuration
  max_concurrent_connections?: number; // Connection limit
  rotation_interval?: number;       // Rotation frequency
  sticky_session_duration?: number; // Session persistence time
}

// MISSING: Detailed usage statistics
export interface ProxyUsageStats {
  proxy_id: string;
  timestamp: string;
  
  // Request metrics
  total_requests: number;
  successful_requests: number;
  failed_requests: number;
  success_rate: number;
  
  // Performance metrics
  avg_response_time: number;
  min_response_time: number;
  max_response_time: number;
  
  // Bandwidth metrics
  bandwidth_used: number;           // in bytes
  bandwidth_limit: number;
  bandwidth_remaining: number;
  
  // Geographic distribution
  requests_by_country: Record<string, number>;
  most_used_locations: Array<{
    country: string;
    city: string;
    request_count: number;
  }>;
  
  // Time-based analytics
  hourly_usage: Array<{
    hour: number;
    request_count: number;
    bandwidth: number;
  }>;
  
  // Error analysis
  error_breakdown: Record<string, number>;
  retry_statistics: {
    total_retries: number;
    avg_retries_per_request: number;
    max_retries: number;
  };
  blocked_requests: number;
}

// MISSING: Subscription information
export interface WebshareSubscription {
  id: string;
  
  // Plan details
  plan_name: string;                // e.g., "500 Proxy Server"
  plan_type: string;                // e.g., "datacenter", "residential"
  proxy_limit: number;              // Maximum proxies allowed
  bandwidth_limit: number;          // Bandwidth limit (bytes)
  concurrent_connections: number;   // Max concurrent connections
  
  // Billing information
  billing_cycle: 'monthly' | 'yearly' | 'lifetime';
  amount: number;                   // Cost amount
  currency: string;                 // e.g., "USD"
  next_billing_date: string;        // Next billing date
  auto_renew: boolean;              // Auto-renewal enabled
  
  // Usage tracking
  proxy_usage_count: number;        // Current proxies used
  proxy_usage_percentage: number;   // Usage vs limit %
  bandwidth_used: number;           // Current bandwidth used
  bandwidth_usage_percentage: number; // Bandwidth usage %
  
  // Plan status
  status: 'active' | 'suspended' | 'cancelled' | 'expired';
  started_at: string;               // Subscription start date
  expires_at: string;               // Subscription expiry
  days_remaining: number;           // Days until expiry
  
  // Features
  features_included: string[];      // Available features
  country_restrictions: string[];   // Allowed countries
  protocol_support: string[];       // Supported protocols
  
  // Limits and quotas
  daily_bandwidth_limit: number;
  monthly_bandwidth_limit: number;
  request_rate_limit: number;       // Requests per minute
}

// MISSING: IP Authorization management
export interface WebshareIPAuthorization {
  id: string;
  ip_address: string;
  description: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  last_used: string | null;
  usage_count: number;
  location: {
    country: string;
    region: string;
    city: string;
  };
  
  // Security features
  auto_detect_ip: boolean;
  whitelist_subnets: string[];
  access_restrictions: {
    time_based: boolean;
    geo_restrictions: string[];
    usage_limits: {
      daily_requests: number;
      monthly_requests: number;
    };
  };
}

// MISSING: Proxy configuration options
export interface WebshareProxyConfiguration {
  // Rotation settings
  rotation_strategy: 'round-robin' | 'random' | 'least-used' | 'geographic' | 'performance';
  rotation_interval: number;        // seconds
  sticky_session_duration: number; // seconds
  auto_retry_failed: boolean;
  max_retry_attempts: number;
  
  // Geographic preferences
  preferred_countries: string[];
  excluded_countries: string[];
  city_preferences: string[];
  region_preferences: string[];
  
  // Protocol settings
  supported_protocols: ('http' | 'https' | 'socks4' | 'socks5')[];
  default_protocol: string;
  ssl_support: boolean;
  authentication_method: 'username_password' | 'ip_whitelist';
  
  // Performance settings
  connection_timeout: number;       // milliseconds
  request_timeout: number;          // milliseconds
  max_concurrent_connections: number;
  keep_alive_enabled: boolean;
  
  // Health monitoring
  health_check_enabled: boolean;
  health_check_interval: number;    // minutes
  health_check_url: string;
  failure_threshold: number;        // consecutive failures before marking unhealthy
  
  // Load balancing
  load_balancing_enabled: boolean;
  load_balancing_strategy: 'least_connections' | 'round_robin' | 'weighted';
  proxy_weights: Record<string, number>; // proxy_id -> weight
}

// MISSING: Proxy replacement system
export interface WebshareProxyReplacement {
  id: string;
  original_proxy_id: string;
  replacement_proxy_id: string;
  reason: 'failed_health_check' | 'user_request' | 'automatic' | 'performance_issue';
  replaced_at: string;
  replacement_count: number;
  auto_replace_enabled: boolean;
  
  // Replacement criteria
  replacement_criteria: {
    max_failed_requests: number;
    min_success_rate: number;       // percentage
    max_response_time: number;      // milliseconds
    min_uptime: number;             // percentage
  };
  
  // Replacement preferences
  replacement_preferences: {
    same_country: boolean;
    same_region: boolean;
    similar_performance: boolean;
    maintain_session: boolean;
  };
}

// MISSING: Comprehensive account profile
export interface WebshareProfileEnhanced {
  // Basic profile (current limited data)
  id: string;
  username: string;
  email: string;
  
  // MISSING: Extended profile information
  account_type: 'individual' | 'business' | 'enterprise';
  verification_status: 'verified' | 'pending' | 'unverified';
  account_created: string;
  last_login: string;
  timezone: string;
  preferred_currency: string;
  
  // MISSING: Account limits and quotas
  limits: {
    max_proxies: number;
    max_bandwidth: number;           // bytes per month
    max_concurrent_connections: number;
    max_api_requests_per_minute: number;
    max_subusers: number;
  };
  
  // MISSING: Usage summary
  current_usage: {
    active_proxies: number;
    bandwidth_used_this_month: number;
    api_requests_today: number;
    concurrent_connections: number;
    subusers_count: number;
  };
  
  // MISSING: Security settings
  security: {
    two_factor_enabled: boolean;
    ip_restrictions_enabled: boolean;
    api_key_restrictions: Record<string, string[]>; // key_id -> allowed_ips
    session_timeout: number;         // minutes
    password_last_changed: string;
  };
  
  // MISSING: Notifications and preferences
  notifications: {
    email_alerts: boolean;
    sms_alerts: boolean;
    webhook_url: string | null;
    alert_types: ('billing' | 'usage' | 'security' | 'maintenance')[];
  };
}

// MISSING: Billing and transaction data
export interface WebshareBillingInfo {
  // Current billing
  current_balance: number;
  currency: string;
  billing_cycle: 'monthly' | 'yearly';
  next_billing_date: string;
  auto_pay_enabled: boolean;
  
  // Payment methods
  payment_methods: Array<{
    id: string;
    type: 'credit_card' | 'paypal' | 'bank_transfer' | 'crypto';
    is_default: boolean;
    last_four: string;               // Last 4 digits for cards
    expires_at: string;              // For cards
    created_at: string;
  }>;
  
  // Billing history
  recent_transactions: Array<{
    id: string;
    type: 'charge' | 'refund' | 'credit' | 'adjustment';
    amount: number;
    currency: string;
    status: 'completed' | 'pending' | 'failed' | 'cancelled';
    description: string;
    created_at: string;
    invoice_url?: string;
  }>;
  
  // Usage-based billing
  usage_charges: {
    bandwidth_overage: number;
    additional_proxies: number;
    premium_features: number;
    total: number;
  };
}

// MISSING: Advanced analytics aggregation
export interface WebshareAnalytics {
  time_period: {
    start: string;
    end: string;
    granularity: 'hour' | 'day' | 'week' | 'month';
  };
  
  // Aggregate metrics
  total_requests: number;
  successful_requests: number;
  failed_requests: number;
  success_rate: number;
  total_bandwidth: number;
  avg_response_time: number;
  
  // Performance trends
  performance_trends: Array<{
    timestamp: string;
    requests: number;
    success_rate: number;
    avg_response_time: number;
    bandwidth: number;
  }>;
  
  // Geographic distribution
  geographic_stats: Array<{
    country: string;
    city: string;
    requests: number;
    success_rate: number;
    avg_response_time: number;
  }>;
  
  // Top performing proxies
  top_proxies: Array<{
    proxy_id: string;
    proxy_address: string;
    country: string;
    requests: number;
    success_rate: number;
    avg_response_time: number;
    uptime: number;
  }>;
  
  // Error analysis
  error_analysis: {
    timeout_errors: number;
    connection_errors: number;
    authentication_errors: number;
    rate_limit_errors: number;
    other_errors: number;
    error_breakdown: Record<string, number>;
  };
}

// Enhanced dashboard data with complete metrics
export interface WebshareDashboardDataEnhanced {
  profile: WebshareProfileEnhanced;
  subscription: WebshareSubscription;
  billing: WebshareBillingInfo;
  usage_stats: ProxyUsageStats;
  analytics: WebshareAnalytics;
  ip_authorizations: WebshareIPAuthorization[];
  proxy_config: WebshareProxyConfiguration;
  recent_replacements: WebshareProxyReplacement[];
  lastUpdated: string;
  
  // Real-time status
  system_status: {
    api_operational: boolean;
    proxy_network_status: 'operational' | 'degraded' | 'outage';
    maintenance_scheduled: boolean;
    last_status_check: string;
  };
  
  // Alerts and notifications
  active_alerts: Array<{
    id: string;
    type: 'warning' | 'error' | 'info';
    message: string;
    created_at: string;
    acknowledged: boolean;
  }>;
}

// Export existing types for backward compatibility
export {
  WebshareConfig,
  WebshareProxy,
  WebshareDashboardData,
  WebshareSyncJob,
  SystemStatus,
  ApiResponse,
  ProxyListResponse,
  TestResult,
  TakealotRequestConfig,
  DEFAULT_TAKEALOT_CONFIG
} from '../types';

// Export enhanced versions
export type WebshareProxyComplete = WebshareProxyEnhanced;
export type WebshareDashboardComplete = WebshareDashboardDataEnhanced;
