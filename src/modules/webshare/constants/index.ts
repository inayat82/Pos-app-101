// WebShare Constants
export const WEBSHARE_ENDPOINTS = {
  BASE_URL: 'https://proxy.webshare.io/api/v2',
  PROXY_LIST: '/proxy/list/',
  PROXY_CONFIG: '/proxy/config/',
  PROXY_REFRESH: '/proxy/list/refresh/',
  PROFILE: '/profile/',
  SUBSCRIPTION: '/subscription/',
  STATS: '/stats/',
  IP_AUTH: '/ip-authorization/',
  DOWNLOAD_TOKEN: '/proxy/config/',
} as const;

export const DEFAULT_CONFIG = {
  syncInterval: 60,
  maxRetries: 3,
  timeout: 30000,
  isEnabled: false,
  testStatus: 'not_tested' as const,
  autoSyncEnabled: false,
  autoSyncInterval: 60, // 1 hour in minutes
} as const;

export const API_ROUTES = {
  CONFIG: '/api/superadmin/webshare/config',
  PROXIES: '/api/superadmin/webshare/proxies',
  SYNC: '/api/superadmin/webshare/sync',
  TEST: '/api/superadmin/webshare/test',
  STATUS: '/api/superadmin/webshare/status',
} as const;

export const ROUTES = {
  MAIN: '/superadmin/webshare',
  PROXY_MANAGEMENT: '/superadmin/webshare/proxy',
  SETTINGS: '/superadmin/webshare/settings',
  TESTING: '/superadmin/webshare/testing',
} as const;

export const STATUS_COLORS = {
  connected: 'green',
  failed: 'red',
  testing: 'blue',
  not_tested: 'gray',
} as const;

export const SYNC_STATUS = {
  STARTED: 'started',
  COMPLETED: 'completed',
  FAILED: 'failed',
} as const;
