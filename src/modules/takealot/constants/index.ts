// Takealot Constants - Main exports

// API Configuration
export const TAKEALOT_API_BASE_URL = 'https://seller-api.takealot.com';
export const TAKEALOT_API_VERSION = 'v2';

// Default pagination settings
export const DEFAULT_PAGE_SIZE = 100;
export const DEFAULT_MAX_PAGES = 50;

// Sync strategies
export const SYNC_STRATEGIES = {
  PRODUCTS_ALL: 'prod_all',
  PRODUCTS_100: 'prod_100', 
  SALES_100: 'sls_100',
  SALES_30D: 'sls_30d',
  SALES_6M: 'sls_6m',
  SALES_ALL: 'sls_all'
} as const;

// Request types
export const REQUEST_TYPES = {
  MANUAL: 'manual',
  CRON: 'cron'
} as const;

// Data types
export const DATA_TYPES = {
  PRODUCTS: 'products',
  SALES: 'sales'
} as const;

// Collection names
export const COLLECTIONS = {
  TAKEALOT_INTEGRATIONS: 'takealotIntegrations',
  TAKEALOT_OFFERS: 'takealot_offers',
  TAKEALOT_SALES: 'takealot_sales',
  TAKEALOT_JOB_LOGS: 'takealotJobLogs'
} as const;

// Status values
export const INTEGRATION_STATUS = {
  ACTIVE: 'active',
  INACTIVE: 'inactive',
  ERROR: 'error'
} as const;

export const SYNC_STATUS = {
  IDLE: 'idle',
  RUNNING: 'running',
  COMPLETED: 'completed',
  ERROR: 'error'
} as const;

export const TAKEALOT_API_CONFIG = {
  BASE_URL: 'https://seller-api.takealot.com',
  VERSION: 'v2',
  TIMEOUT: 30000,
  MAX_RETRIES: 3,
} as const;

export const TAKEALOT_ENDPOINTS = {
  PRODUCTS: '/products',
  SALES: '/sales',
  OFFERS: '/offers',
  ORDERS: '/orders',
} as const;

// Default headers for Takealot API requests
export const DEFAULT_TAKEALOT_HEADERS = {
  'Accept': 'application/json',
  'Content-Type': 'application/json',
  'User-Agent': 'POS-App/1.0',
} as const;
