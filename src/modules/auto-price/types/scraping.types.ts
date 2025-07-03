// Scraping Service Type Definitions
export interface ScrapingRequest {
  tsin: string;
  productTitle: string;
  integrationId: string;
  adminId: string;
  priority: ScrapingPriority;
  retryCount?: number;
  maxRetries?: number;
}

export type ScrapingPriority = 'low' | 'normal' | 'high' | 'urgent';

export interface ScrapingResponse {
  success: boolean;
  data?: TakealotScrapedData;
  error?: ScrapingErrorDetails;
  metadata: ScrapingMetadata;
}

export interface TakealotScrapedData {
  // Product rating and reviews
  rating?: number;
  reviewCount?: number;
  reviewsBreakdown?: {
    fiveStars: number;
    fourStars: number;
    threeStars: number;
    twoStars: number;
    oneStar: number;
  };
  
  // Seller information
  winnerSeller?: string;
  winnerSellerPrice?: number;
  totalSellers?: number;
  sellerDetails?: SellerInfo[];
  
  // Additional product details
  availability?: 'in_stock' | 'out_of_stock' | 'limited_stock';
  shippingInfo?: string;
  promotions?: string[];
  
  // Scraped timestamp
  scrapedAt: Date;
}

export interface SellerInfo {
  name: string;
  price: number;
  rating?: number;
  isWinner: boolean;
  shippingCost?: number;
  deliveryTime?: string;
}

export interface ScrapingErrorDetails {
  code: ScrapingErrorCode;
  message: string;
  details?: string;
  retryable: boolean;
  proxyRelated: boolean;
}

export type ScrapingErrorCode = 
  | 'NETWORK_ERROR'          // Network connectivity issues
  | 'PROXY_ERROR'            // Proxy-related failures
  | 'RATE_LIMITED'           // Rate limiting by Takealot
  | 'PAGE_NOT_FOUND'         // Product page not found (404)
  | 'PARSING_ERROR'          // Failed to parse page content
  | 'BLOCKED_REQUEST'        // Request blocked/forbidden
  | 'TIMEOUT'                // Request timeout
  | 'INVALID_TSIN'           // Invalid TSIN format
  | 'CAPTCHA_REQUIRED'       // CAPTCHA challenge
  | 'PROXY_BANNED'           // Proxy IP banned
  | 'UNKNOWN_ERROR';         // Unexpected error

export interface ScrapingMetadata {
  requestId: string;
  proxyUsed: string;
  proxyRegion: string;
  userAgent: string;
  startTime: Date;
  endTime: Date;
  duration: number; // milliseconds
  retryCount: number;
  httpStatusCode?: number;
  responseSize?: number; // bytes
}

export interface ProxyInfo {
  id: string;
  ip: string;
  port: number;
  username: string;
  password: string;
  country: string;
  city: string;
  isHealthy: boolean;
  lastUsed?: Date;
  successRate: number; // 0-100
  averageResponseTime: number; // milliseconds
}

export interface ScrapingQueue {
  id: string;
  items: ScrapingQueueItem[];
  status: 'idle' | 'processing' | 'paused';
  createdAt: Date;
  updatedAt: Date;
  estimatedCompletionTime?: Date;
}

export interface ScrapingQueueItem {
  id: string;
  request: ScrapingRequest;
  status: 'pending' | 'processing' | 'completed' | 'failed' | 'skipped';
  attempts: number;
  lastAttempt?: Date;
  nextAttempt?: Date;
  result?: ScrapingResponse;
  addedAt: Date;
}

export interface ScrapingJobConfig {
  concurrency: number; // Number of simultaneous scraping requests
  delayBetweenRequests: number; // Milliseconds
  maxRetries: number;
  timeout: number; // Milliseconds
  proxyRotation: boolean;
  userAgentRotation: boolean;
  respectRobotsTxt: boolean;
  enableJavaScript: boolean;
}

export interface ScrapingStatistics {
  totalRequests: number;
  successfulRequests: number;
  failedRequests: number;
  averageResponseTime: number;
  successRate: number;
  errorBreakdown: Record<ScrapingErrorCode, number>;
  proxyPerformance: Record<string, {
    requests: number;
    successes: number;
    failures: number;
    averageResponseTime: number;
  }>;
  dailyStats: Array<{
    date: string;
    requests: number;
    successes: number;
    failures: number;
  }>;
}

export interface WebshareProxyIntegration {
  apiKey: string;
  endpointUrl: string;
  proxyList: ProxyInfo[];
  lastSync: Date;
  isEnabled: boolean;
  rateLimits: {
    requestsPerMinute: number;
    requestsPerHour: number;
  };
  healthCheck: {
    interval: number; // minutes
    timeout: number;  // milliseconds
    lastCheck: Date;
    healthyProxies: number;
    totalProxies: number;
  };
}

export interface ScrapingLog {
  id: string;
  integrationId: string;
  adminId: string;
  productTsin: string;
  productTitle: string;
  scrapingStatus: 'success' | 'error' | 'retry' | 'skipped';
  proxyUsed: string;
  duration: number;
  errorMessage?: string;
  dataExtracted: {
    rating: boolean;
    reviews: boolean;
    sellers: boolean;
    pricing: boolean;
  };
  createdAt: Date;
  metadata?: Record<string, any>;
}
