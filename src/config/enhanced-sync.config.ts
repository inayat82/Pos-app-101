// src/config/enhanced-sync.config.ts
// Configuration file for Enhanced Sync Strategy

export interface EnhancedSyncConfig {
  // Default concurrency settings
  defaultConcurrency: {
    maxConcurrentPages: number;
    batchSize: number;
    retryAttempts: number;
    delayBetweenBatches: number;
  };
  
  // Performance settings
  performance: {
    maxPagesPerSync: number;
    timeoutPerPage: number;
    maxRetryDelay: number;
  };
  
  // Database preferences
  database: {
    preferNeon: boolean;
    fallbackToFirebase: boolean;
    batchWriteSize: number;
  };
  
  // Monitoring and logging
  monitoring: {
    enableDetailedLogging: boolean;
    logPerformanceMetrics: boolean;
    alertOnFallback: boolean;
  };
}

export const ENHANCED_SYNC_CONFIG: EnhancedSyncConfig = {
  defaultConcurrency: {
    maxConcurrentPages: 4,
    batchSize: 50,
    retryAttempts: 3,
    delayBetweenBatches: 1000, // 1 second
  },
  
  performance: {
    maxPagesPerSync: 100,
    timeoutPerPage: 30000, // 30 seconds
    maxRetryDelay: 5000, // 5 seconds
  },
  
  database: {
    preferNeon: true,
    fallbackToFirebase: true,
    batchWriteSize: 100,
  },
  
  monitoring: {
    enableDetailedLogging: true,
    logPerformanceMetrics: true,
    alertOnFallback: true,
  },
};

// Environment-specific overrides
export const getEnhancedSyncConfig = (): EnhancedSyncConfig => {
  const config = { ...ENHANCED_SYNC_CONFIG };
  
  // Production optimizations
  if (process.env.NODE_ENV === 'production') {
    config.defaultConcurrency.maxConcurrentPages = 6;
    config.defaultConcurrency.batchSize = 100;
    config.monitoring.enableDetailedLogging = false;
  }
  
  // Development settings
  if (process.env.NODE_ENV === 'development') {
    config.defaultConcurrency.maxConcurrentPages = 2;
    config.performance.maxPagesPerSync = 10;
    config.monitoring.enableDetailedLogging = true;
  }
  
  // Override with environment variables if provided
  if (process.env.ENHANCED_SYNC_MAX_CONCURRENT) {
    config.defaultConcurrency.maxConcurrentPages = parseInt(process.env.ENHANCED_SYNC_MAX_CONCURRENT);
  }
  
  if (process.env.ENHANCED_SYNC_BATCH_SIZE) {
    config.defaultConcurrency.batchSize = parseInt(process.env.ENHANCED_SYNC_BATCH_SIZE);
  }
  
  return config;
};
