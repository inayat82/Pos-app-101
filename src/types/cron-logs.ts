// src/types/cron-logs.ts
export interface CronJobLog {
  id?: string;
  cronJobName: string;
  cronJobType: 'scheduled' | 'manual' | 'triggered';
  cronSchedule?: string; // Cron expression if scheduled
  
  // Admin and Account Information
  adminId?: string;
  adminName?: string;
  adminEmail?: string;
  accountId?: string;
  accountName?: string;
  integrationId?: string;
  
  // Execution Details
  executionId: string; // Unique ID for this execution
  status: 'pending' | 'running' | 'success' | 'failure' | 'timeout' | 'cancelled';
  startTime: Date;
  endTime?: Date;
  duration?: number; // in milliseconds
  
  // Performance Metrics
  apiSource: string; // e.g., 'Takealot API', 'Webshare API'
  totalPages?: number;
  totalReads?: number;
  totalWrites?: number;
  itemsProcessed?: number;
  
  // Detailed Information
  message: string;
  details?: string;
  errorDetails?: string;
  stackTrace?: string;
  
  // Metadata
  triggerType: 'cron' | 'manual' | 'api' | 'webhook';
  triggerSource?: string; // Who/what triggered this
  version?: string; // App version
  environment: 'development' | 'staging' | 'production';
  
  // Timestamps
  createdAt: Date;
  updatedAt: Date;
}

export interface CronJobDefinition {
  id: string;
  name: string;
  displayName: string;
  description: string;
  schedule: string; // Cron expression
  endpoint: string;
  isActive: boolean;
  category: 'sync' | 'analytics' | 'maintenance' | 'reporting';
  expectedDuration: number; // in minutes
  timeoutDuration: number; // in minutes
  maxRetries: number;
  notifyOnFailure: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface CronJobExecution {
  executionId: string;
  jobId: string;
  status: CronJobLog['status'];
  startTime: Date;
  endTime?: Date;
  logs: CronJobLog[];
  metrics: {
    totalPages: number;
    totalReads: number;
    totalWrites: number;
    itemsProcessed: number;
    errors: number;
    warnings: number;
  };
}
