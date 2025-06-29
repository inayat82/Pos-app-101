export interface ApiCallLog {
  id: string; // Unique ID for the log entry
  timestamp: number; // Unix timestamp of the call
  adminId: string; // ID of the admin user
  adminName: string; // Name of the admin user for quick display
  takealotAccountId: string; // ID of the Takealot account being synced
  takealotAccountName: string; // Name of the Takealot account
  apiSource: 'Takealot' | 'Webshare' | 'Unknown';
  triggerType: 'cron' | 'manual';
  status: 'success' | 'failure' | 'in-progress';
  stats: {
    totalPages?: number; // Total pages discovered for pagination
    apiReads: number; // Number of API read operations
    dbWrites: number; // Number of database write/update operations
    durationMs: number; // Duration of the entire operation in milliseconds
  };
  error?: {
    message: string;
    code?: string; // e.g., 'FIRESTORE_PERMISSION_DENIED'
    details?: string; // Stack trace or other details
  };
  metadata?: {
    [key: string]: any; // For any other contextual data
  };
}
