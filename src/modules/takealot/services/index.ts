// Takealot Services - Main exports

// Core API Services
export * from './api.service';
export * from './enhanced-api.service';

// Data & Storage Services - Types
export type { 
  TakealotProduct,
  TakealotSale,
  DataRetrievalOptions,
  DataRetrievalResult
} from './data-manager.service';

// Data & Storage Services - Functions
export { 
  generateProductUniqueId,
  generateSaleUniqueId,
  findExistingRecord,
  mergeRecordData,
  retrieveTakealotDataWithDuplicateManagement,
  cleanupDuplicateRecords as cleanupDuplicatesFromDataManager
} from './data-manager.service';

// Sync & Strategy Services - Types
export type { 
  SyncStrategy as LegacySyncStrategy,
  FetchProgressState as LegacyFetchProgressState
} from './sync-strategy.service';

// Sync & Strategy Services - Functions
export { 
  fetchAndSaveTakealotData as fetchAndSaveDataLegacy,
  processSyncPreferencesForSchedule,
  getCronLabelFromSchedule
} from './sync-strategy.service';

// Basic Sync Services
export * from './sync.service';

// Infrastructure Services
export * from './proxy.service';

// Legacy exports for backward compatibility
export { TakealotApiError } from './api.service';
export { takealotProxyService } from './proxy.service';
