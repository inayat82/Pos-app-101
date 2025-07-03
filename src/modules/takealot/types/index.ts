// Takealot Module Types - Main exports
// TODO: Create and export from individual type files as we migrate existing types

// Base Takealot interfaces
export interface TakealotProduct {
  id: string;
  title: string;
  price: number;
  currency: string;
  availability: string;
  url: string;
}

export interface TakealotSyncOptions {
  userId: string;
  syncType: 'manual' | 'cron';
  limit?: number;
}

// Placeholder for other Takealot types to be migrated
export interface TakealotApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
}
