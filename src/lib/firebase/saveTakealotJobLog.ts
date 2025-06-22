import { doc, setDoc, serverTimestamp, Timestamp } from 'firebase/firestore';
import { db } from './firebase';

// Standardized JobLog interface (aligns with page.tsx)
// This interface is now primarily for reference as the component using it was removed.
// Consider removing this file if no other part of the application uses saveTakealotJobLog.
export interface JobLog {
  jobId: string; // Unique ID for the job
  dataType: 'products' | 'sales' | 'offers' | string; // Type of data being fetched
  strategyId?: string; // Optional: if the job was triggered by a predefined strategy
  strategyDescription?: string; // Optional: description of the strategy
  startTime: Timestamp; // Firestore Timestamp
  endTime?: Timestamp; // Firestore Timestamp, set when job completes or errors
  status: 'running' | 'completed' | 'error' | 'queued' | string; // Current status of the job
  progress?: number; // Optional: overall progress percentage (0-100)
  currentPage?: number; // Optional: current page being fetched
  totalPages?: number; // Optional: total pages to fetch
  successfulItems?: number; // Optional: count of successfully fetched/processed items
  errorItems?: number; // Optional: count of items that resulted in an error
  statusMessage?: string; // Optional: detailed status message for the current operation
  overallMessage?: string; // Optional: final message upon completion or error
  userId?: string; // To associate log with a user
}

/**
 * Saves a Takealot job log to Firestore for a specific admin user.
 * This function may no longer be needed if ApiCallLogTable and related manual fetch UIs are removed.
 * @param adminId The ID of the admin user.
 * @param jobLog The job log object to save.
 */
export const saveTakealotJobLog = async (adminId: string, jobLog: JobLog): Promise<void> => {
  if (!adminId) {
    // console.warn('Admin ID is required to save job log. Log will not be saved.');
    // throw new Error('Admin ID is required to save job log.');
    return; // Opting to silently fail or log to console instead of throwing error
  }
  if (!jobLog.jobId) {
    // console.warn('Job ID (jobId) is required in job log. Log will not be saved.');
    // throw new Error('Job ID (jobId) is required in job log.');
    return; // Opting to silently fail or log to console
  }
  
  const jobLogRef = doc(db, `admins/${adminId}/takealotJobLogs`, jobLog.jobId);

  const dataToSave: Partial<JobLog> = { ...jobLog };

  if (typeof dataToSave.startTime === 'number') {
    dataToSave.startTime = Timestamp.fromMillis(dataToSave.startTime);
  }

  if (dataToSave.endTime && typeof dataToSave.endTime === 'number') {
    dataToSave.endTime = Timestamp.fromMillis(dataToSave.endTime);
  } else if ((dataToSave.status === 'completed' || dataToSave.status === 'error') && !dataToSave.endTime) {
    dataToSave.endTime = serverTimestamp() as Timestamp; 
  }

  dataToSave.userId = adminId;

  try {
    await setDoc(jobLogRef, dataToSave, { merge: true }); 
    // console.log(`Job log ${jobLog.jobId} saved for user ${adminId}`);
  } catch (error) {
    // console.error('Error saving Takealot job log:', error);
    // throw error; // Decide if re-throwing is appropriate or handle silently/log
  }
};
