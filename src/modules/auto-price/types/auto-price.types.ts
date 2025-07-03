// Auto Price Module Type Definitions
import { Timestamp } from 'firebase/firestore';

export interface AutoPriceProduct {
  // Existing Takealot product data
  id: string;
  integrationId: string;
  adminId: string;
  tsin: string;
  sku: string;
  title: string;
  imageUrl?: string;
  status: ProductStatus;
  ourPrice: number;
  rrp: number;
  createdAt: Date | Timestamp;
  updatedAt: Date | Timestamp;
  
  // Stock information (from takealot_offers/takealotProducts)
  stock?: number;
  stock_dbn?: number;
  stock_cpt?: number;
  stock_jhb?: number;
  
  // Sales metrics (from takealot_offers/takealotProducts)
  sold_30_days?: number;
  total_sold?: number;
  
  // Scraped data fields
  scrapedRating?: number;
  scrapedReviewCount?: number;
  scrapedWinnerSeller?: string;
  scrapedWinnerSellerPrice?: number;
  scrapedTotalSellers?: number;
  lastScrapedAt?: Date | Timestamp;
  scrapingStatus: ScrapingStatus;
  scrapingErrorMessage?: string;
  proxyUsed?: string;
  scrapingDuration?: number;
  
  // Enhanced seller data (from Enhanced Seller Data Plan)
  productDescription?: string;
  productBrand?: string;
  productCategory?: string;
  productAvailability?: string;
  
  // Winner seller details
  winnerShipping?: string;
  winnerDelivery?: string;
  winnerIsOurAccount?: boolean;
  
  // Our account tracking
  ourAccountName?: string;
  ourAccountPosition?: number;
  ourAccountActive?: boolean;
  ourAccountIsWinner?: boolean;
  
  // Seller summary metrics
  totalActiveSellers?: number;
  priceRange?: {
    min: number;
    max: number;
  };
  averagePrice?: number;
  medianPrice?: number;
  sellersLastUpdated?: Date | Timestamp;
  
  // Calculated fields (computed on frontend or backend)
  winDifference?: number; // ourPrice - scrapedWinnerSellerPrice
  winPrice?: number; // scrapedWinnerSellerPrice
  posBarcode?: string;
  posPrice?: number;
  profitLoss?: number;
  minPrice?: number;
  maxPrice?: number;
  competitiveStatus?: 'winning' | 'competitive' | 'losing' | 'unknown';
  competitivenessScore?: number; // 0-1 scale
  pricePosition?: 'lowest' | 'competitive' | 'premium' | 'overpriced';
  recommendedAction?: 'maintain' | 'reduce' | 'increase' | 'investigate';
}

export type ProductStatus = 'buyable' | 'loading' | 'out_of_stock' | 'unavailable';

export type ScrapingStatus = 
  | 'idle'           // Not scraped yet
  | 'queued'         // In scraping queue
  | 'scraping'       // Currently being scraped
  | 'success'        // Successfully scraped
  | 'error'          // Scraping failed
  | 'retry'          // Scheduled for retry
  | 'skip';          // Skipped (e.g., invalid TSIN)

export interface ScrapedData {
  rating?: number;
  reviewCount?: number;
  winnerSeller?: string;
  winnerSellerPrice?: number;
  totalSellers?: number;
  scrapedAt: Date;
  proxyUsed: string;
  scrapingDuration: number;
}

// Individual seller data for detailed breakdown (Enhanced Seller Data Plan)
export interface ProductSeller {
  // Identifiers
  adminId: string;
  tsin: string;
  productTitle: string;
  
  // Seller identity
  sellerName: string;
  sellerDisplayName: string;
  sellerId: string;
  sellerSlug: string;
  
  // Position & status
  position: number;
  isWinner: boolean;
  isOurAccount: boolean;
  isActive: boolean;
  
  // Pricing details
  price: number;
  originalPrice?: number;
  isOnSale: boolean;
  discountPercentage?: number;
  
  // Shipping & delivery
  shippingCost: number;
  freeShipping: boolean;
  deliveryTime: string;
  deliveryOptions: string[];
  
  // Seller performance
  sellerRating?: number;
  sellerReviewCount?: number;
  sellerLocation?: string;
  
  // Stock information
  availability: string;
  stockLevel: string;
  
  // Metadata
  scrapedAt: Date | Timestamp;
  lastUpdated: Date | Timestamp;
}

export interface AutoPriceStats {
  totalProducts: number;
  scrapedToday: number;
  pendingScraping: number;
  averageWinDifference: number;
  successRate24h: number;
  competitiveProducts: number;
  overPricedProducts: number;
  potentialSavings: number;
  lastScrapingActivity?: Date;
}

export interface AutoPriceFilters {
  search?: string;
  status?: ProductStatus[];
  scrapingStatus?: ScrapingStatus[];
  hasScrapedData?: boolean;
  priceRange?: {
    min: number;
    max: number;
  };
  lastScrapedRange?: {
    from: Date;
    to: Date;
  };
}

export interface AutoPriceSortOptions {
  field: 'title' | 'ourPrice' | 'rrp' | 'scrapedWinnerSellerPrice' | 'winDifference' | 'lastScrapedAt';
  direction: 'asc' | 'desc';
}

export interface BulkScrapingRequest {
  productIds: string[];
  integrationId: string;
  priority?: 'low' | 'normal' | 'high';
}

export interface ScrapingJobStatus {
  jobId: string;
  status: 'queued' | 'processing' | 'completed' | 'failed';
  totalProducts: number;
  processedProducts: number;
  successfulScrapes: number;
  failedScrapes: number;
  estimatedTimeRemaining?: number;
  startedAt: Date;
  completedAt?: Date;
  errors: ScrapingError[];
}

export interface ScrapingError {
  productId: string;
  productTitle: string;
  tsin: string;
  errorMessage: string;
  errorCode: string;
  timestamp: Date;
  proxyUsed?: string;
  retryCount: number;
}

export interface AutoPriceConfig {
  integrationId: string;
  autoScrapeNewProducts: boolean;
  scrapeInterval: number; // hours
  maxRetries: number;
  enableProxyRotation: boolean;
  preferredProxyRegions: string[];
  rateLimiting: {
    requestsPerMinute: number;
    delayBetweenRequests: number; // milliseconds
  };
  scrapingHours: {
    start: number; // 0-23
    end: number;   // 0-23
  };
  notifications: {
    onScrapingComplete: boolean;
    onErrors: boolean;
    onLowSuccessRate: boolean;
  };
}

export interface PaginatedAutoPriceResponse {
  products: AutoPriceProduct[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
  stats: AutoPriceStats;
}
