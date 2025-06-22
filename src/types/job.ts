// src/types/job.ts
import { Timestamp } from 'firebase/firestore';

export interface FirebaseJobLog {
  jobId: string;
  dataType: 'products' | 'sales' | 'offers' | string;
  strategyId?: string;
  strategyDescription?: string;
  startTime: Timestamp;
  endTime?: Timestamp;
  status: 'running' | 'completed' | 'error' | 'queued' | 'success' | 'failed' | string;
  progress?: number;
  currentPage?: number;
  totalPages?: number;
  successfulItems?: number;
  errorItems?: number;
  statusMessage?: string;
  overallMessage?: string;
  userId?: string;
  // New enhanced fields
  totalRecordsFetched?: number;
  totalRecordsSaved?: number;
  totalRequestsSent?: number;
  apiEndpoint?: string;
  requestHeaders?: Record<string, string>;
  lastApiResponse?: string; // First 20 lines of API response
  errorDetails?: string;
  duration?: number; // in milliseconds
  averageResponseTime?: number;
}

export interface JobLogUI extends FirebaseJobLog {
  isLoading?: boolean;
}
