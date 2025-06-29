// src/lib/cronJobLogger.ts
import admin from 'firebase-admin';
import { CronJobLog } from '@/types/cron-logs';
import { v4 as uuidv4 } from 'uuid';

// Initialize Firebase Admin SDK if not already initialized
if (!admin.apps.length) {
  if (process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON) {
    const serviceAccount = JSON.parse(process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON);
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
    });
  } else if (process.env.FIREBASE_SERVICE_ACCOUNT_PROJECT_ID && process.env.FIREBASE_SERVICE_ACCOUNT_PRIVATE_KEY && process.env.FIREBASE_SERVICE_ACCOUNT_CLIENT_EMAIL) {
    admin.initializeApp({
      credential: admin.credential.cert({
        projectId: process.env.FIREBASE_SERVICE_ACCOUNT_PROJECT_ID,
        privateKey: process.env.FIREBASE_SERVICE_ACCOUNT_PRIVATE_KEY.replace(/\\n/g, '\n'),
        clientEmail: process.env.FIREBASE_SERVICE_ACCOUNT_CLIENT_EMAIL,
      }),
    });
  } else {
    admin.initializeApp();
  }
}

const db = admin.firestore();

export class CronJobLogger {
  private static instance: CronJobLogger;
  
  public static getInstance(): CronJobLogger {
    if (!CronJobLogger.instance) {
      CronJobLogger.instance = new CronJobLogger();
    }
    return CronJobLogger.instance;
  }

  /**
   * Start logging a cron job execution
   */
  async startExecution(params: {
    cronJobName: string;
    cronJobType: CronJobLog['cronJobType'];
    cronSchedule?: string;
    adminId?: string;
    adminName?: string;
    adminEmail?: string;
    accountId?: string;
    accountName?: string;
    integrationId?: string;
    apiSource: string;
    triggerType: CronJobLog['triggerType'];
    triggerSource?: string;
    message: string;
    details?: string;
  }): Promise<string> {
    const executionId = uuidv4();
    const now = new Date();
    
    const logEntry: Omit<CronJobLog, 'id'> = {
      cronJobName: params.cronJobName,
      cronJobType: params.cronJobType,
      cronSchedule: params.cronSchedule,
      
      // Admin and Account Information
      adminId: params.adminId,
      adminName: params.adminName,
      adminEmail: params.adminEmail,
      accountId: params.accountId,
      accountName: params.accountName,
      integrationId: params.integrationId,
      
      // Execution Details
      executionId,
      status: 'running',
      startTime: now,
      
      // Performance Metrics (will be updated later)
      apiSource: params.apiSource,
      totalPages: 0,
      totalReads: 0,
      totalWrites: 0,
      itemsProcessed: 0,
      
      // Detailed Information
      message: params.message,
      details: params.details,
      
      // Metadata
      triggerType: params.triggerType,
      triggerSource: params.triggerSource,
      version: process.env.npm_package_version || '1.0.0',
      environment: (process.env.NODE_ENV as any) || 'development',
      
      // Timestamps
      createdAt: now,
      updatedAt: now
    };

    try {
      // Create a clean object without undefined values
      const cleanLogEntry = Object.fromEntries(
        Object.entries({
          ...logEntry,
          startTime: admin.firestore.Timestamp.fromDate(logEntry.startTime),
          createdAt: admin.firestore.Timestamp.fromDate(logEntry.createdAt),
          updatedAt: admin.firestore.Timestamp.fromDate(logEntry.updatedAt)
        }).filter(([_, value]) => value !== undefined)
      );

      await db.collection('cronJobLogs').add(cleanLogEntry);

      console.log(`[CronLogger] Started execution: ${executionId} for ${params.cronJobName}`);
      return executionId;
    } catch (error) {
      console.error('[CronLogger] Failed to start execution logging:', error);
      throw error;
    }
  }

  /**
   * Update execution progress
   */
  async updateExecution(
    executionId: string,
    updates: {
      status?: CronJobLog['status'];
      totalPages?: number;
      totalReads?: number;
      totalWrites?: number;
      itemsProcessed?: number;
      message?: string;
      details?: string;
      errorDetails?: string;
      stackTrace?: string;
    }
  ): Promise<void> {
    try {
      const query = await db.collection('cronJobLogs')
        .where('executionId', '==', executionId)
        .orderBy('createdAt', 'desc')
        .limit(1)
        .get();

      if (query.empty) {
        console.warn(`[CronLogger] No execution found with ID: ${executionId}`);
        return;
      }

      const doc = query.docs[0];
      const updateData: any = Object.fromEntries(
        Object.entries({
          ...updates,
          updatedAt: admin.firestore.Timestamp.now()
        }).filter(([_, value]) => value !== undefined)
      );

      await doc.ref.update(updateData);
      console.log(`[CronLogger] Updated execution: ${executionId}`);
    } catch (error) {
      console.error('[CronLogger] Failed to update execution:', error);
    }
  }

  /**
   * Complete a cron job execution
   */
  async completeExecution(
    executionId: string,
    params: {
      status: 'success' | 'failure' | 'timeout' | 'cancelled';
      totalPages?: number;
      totalReads?: number;
      totalWrites?: number;
      itemsProcessed?: number;
      message: string;
      details?: string;
      errorDetails?: string;
      stackTrace?: string;
    }
  ): Promise<void> {
    const endTime = new Date();
    
    try {
      const query = await db.collection('cronJobLogs')
        .where('executionId', '==', executionId)
        .orderBy('createdAt', 'desc')
        .limit(1)
        .get();

      if (query.empty) {
        console.warn(`[CronLogger] No execution found with ID: ${executionId}`);
        return;
      }

      const doc = query.docs[0];
      const docData = doc.data();
      const startTime = docData.startTime?.toDate() || new Date();
      const duration = endTime.getTime() - startTime.getTime();

      const updateData: any = Object.fromEntries(
        Object.entries({
          status: params.status,
          endTime: admin.firestore.Timestamp.fromDate(endTime),
          duration,
          totalPages: params.totalPages || docData.totalPages || 0,
          totalReads: params.totalReads || docData.totalReads || 0,
          totalWrites: params.totalWrites || docData.totalWrites || 0,
          itemsProcessed: params.itemsProcessed || docData.itemsProcessed || 0,
          message: params.message,
          details: params.details,
          errorDetails: params.errorDetails,
          stackTrace: params.stackTrace,
          updatedAt: admin.firestore.Timestamp.now()
        }).filter(([_, value]) => value !== undefined)
      );

      await doc.ref.update(updateData);
      console.log(`[CronLogger] Completed execution: ${executionId} with status: ${params.status} (${duration}ms)`);
    } catch (error) {
      console.error('[CronLogger] Failed to complete execution:', error);
    }
  }

  /**
   * Log a manual data fetch operation
   */
  async logManualFetch(params: {
    adminId: string;
    adminName: string;
    adminEmail: string;
    accountId?: string;
    accountName?: string;
    integrationId?: string;
    apiSource: string;
    operation: string; // e.g., "Manual Product Sync", "Manual Sales Fetch"
    totalPages?: number;
    totalReads?: number;
    totalWrites?: number;
    itemsProcessed?: number;
    status: 'success' | 'failure';
    message: string;
    details?: string;
    errorDetails?: string;
    duration?: number;
  }): Promise<string> {
    const executionId = uuidv4();
    const now = new Date();
    
    const logEntry: Omit<CronJobLog, 'id'> = {
      cronJobName: `Manual: ${params.operation}`,
      cronJobType: 'manual',
      
      // Admin and Account Information
      adminId: params.adminId,
      adminName: params.adminName,
      adminEmail: params.adminEmail,
      accountId: params.accountId,
      accountName: params.accountName,
      integrationId: params.integrationId,
      
      // Execution Details
      executionId,
      status: params.status,
      startTime: now,
      endTime: params.duration ? new Date(now.getTime() + params.duration) : now,
      duration: params.duration,
      
      // Performance Metrics
      apiSource: params.apiSource,
      totalPages: params.totalPages || 0,
      totalReads: params.totalReads || 0,
      totalWrites: params.totalWrites || 0,
      itemsProcessed: params.itemsProcessed || 0,
      
      // Detailed Information
      message: params.message,
      details: params.details,
      errorDetails: params.errorDetails,
      
      // Metadata
      triggerType: 'manual',
      triggerSource: `${params.adminName} (${params.adminEmail})`,
      version: process.env.npm_package_version || '1.0.0',
      environment: (process.env.NODE_ENV as any) || 'development',
      
      // Timestamps
      createdAt: now,
      updatedAt: now
    };

    try {
      await db.collection('cronJobLogs').add({
        ...logEntry,
        startTime: admin.firestore.Timestamp.fromDate(logEntry.startTime),
        endTime: logEntry.endTime ? admin.firestore.Timestamp.fromDate(logEntry.endTime) : null,
        createdAt: admin.firestore.Timestamp.fromDate(logEntry.createdAt),
        updatedAt: admin.firestore.Timestamp.fromDate(logEntry.updatedAt)
      });

      console.log(`[CronLogger] Logged manual operation: ${executionId} for ${params.operation}`);
      return executionId;
    } catch (error) {
      console.error('[CronLogger] Failed to log manual operation:', error);
      throw error;
    }
  }

  /**
   * Helper function to fetch admin details from Firestore
   */
  private async fetchAdminDetails(adminId: string): Promise<{
    adminName: string;
    adminEmail: string;
    accountId?: string;
    accountName?: string;
  }> {
    try {
      console.log(`[CronLogger] Fetching admin details for: ${adminId}`);
      
      // First try admins collection
      const adminDoc = await db.collection('admins').doc(adminId).get();
      if (adminDoc.exists) {
        const adminData = adminDoc.data();
        console.log(`[CronLogger] Found admin in admins collection: ${adminData?.name || adminData?.email}`);
        return {
          adminName: adminData?.name || adminData?.displayName || 'Unknown Admin',
          adminEmail: adminData?.email || 'unknown@example.com',
          accountId: adminData?.accountId,
          accountName: adminData?.accountName || adminData?.companyName
        };
      }
      
      // Try users collection as fallback
      const userDoc = await db.collection('users').doc(adminId).get();
      if (userDoc.exists) {
        const userData = userDoc.data();
        console.log(`[CronLogger] Found admin in users collection: ${userData?.name || userData?.email}`);
        return {
          adminName: userData?.name || userData?.displayName || 'Unknown Admin',
          adminEmail: userData?.email || 'unknown@example.com',
          accountId: userData?.accountId,
          accountName: userData?.accountName || userData?.companyName
        };
      }
      
      console.warn(`[CronLogger] Admin not found in any collection: ${adminId}`);
      return {
        adminName: `Unknown Admin (${adminId})`,
        adminEmail: 'unknown@example.com'
      };
      
    } catch (error) {
      console.error(`[CronLogger] Error fetching admin details for ${adminId}:`, error);
      return {
        adminName: `Unknown Admin (${adminId})`,
        adminEmail: 'unknown@example.com'
      };
    }
  }

  /**
   * Enhanced manual fetch logging with automatic admin detail fetching
   */
  async logManualFetchEnhanced(params: {
    adminId: string;
    integrationId?: string;
    apiSource: string;
    operation: string;
    totalPages?: number;
    totalReads?: number;
    totalWrites?: number;
    itemsProcessed?: number;
    status: 'success' | 'failure';
    message: string;
    details?: string;
    errorDetails?: string;
    duration?: number;
  }): Promise<string> {
    // Fetch admin details automatically
    const adminDetails = await this.fetchAdminDetails(params.adminId);
    
    // Use the existing logManualFetch with enhanced details
    return this.logManualFetch({
      ...params,
      adminName: adminDetails.adminName,
      adminEmail: adminDetails.adminEmail,
      accountId: adminDetails.accountId,
      accountName: adminDetails.accountName
    });
  }

  /**
   * Get execution logs for an admin (filtered by adminId)
   */
  async getAdminLogs(
    adminId: string,
    options: {
      limit?: number;
      offset?: number;
      status?: CronJobLog['status'];
      cronJobName?: string;
      startDate?: Date;
      endDate?: Date;
    } = {}
  ): Promise<{ logs: CronJobLog[]; total: number; hasMore: boolean }> {
    try {
      let query = db.collection('cronJobLogs')
        .where('adminId', '==', adminId)
        .orderBy('createdAt', 'desc');

      // Apply filters
      if (options.status) {
        query = query.where('status', '==', options.status);
      }
      if (options.cronJobName) {
        query = query.where('cronJobName', '==', options.cronJobName);
      }
      if (options.startDate) {
        query = query.where('createdAt', '>=', admin.firestore.Timestamp.fromDate(options.startDate));
      }
      if (options.endDate) {
        query = query.where('createdAt', '<=', admin.firestore.Timestamp.fromDate(options.endDate));
      }

      // Apply pagination
      const limit = options.limit || 50;
      const offset = options.offset || 0;
      
      if (offset > 0) {
        query = query.offset(offset);
      }
      query = query.limit(limit + 1); // Get one extra to check if there are more

      const snapshot = await query.get();
      const logs: CronJobLog[] = [];
      const hasMore = snapshot.docs.length > limit;
      
      const docsToProcess = hasMore ? snapshot.docs.slice(0, limit) : snapshot.docs;
      
      docsToProcess.forEach(doc => {
        const data = doc.data();
        logs.push({
          id: doc.id,
          ...data,
          startTime: data.startTime?.toDate() || new Date(),
          endTime: data.endTime?.toDate() || null,
          createdAt: data.createdAt?.toDate() || new Date(),
          updatedAt: data.updatedAt?.toDate() || new Date()
        } as CronJobLog);
      });

      // Get total count (this is approximate for performance)
      const countQuery = await db.collection('cronJobLogs')
        .where('adminId', '==', adminId)
        .get();
      const total = countQuery.size;

      return { logs, total, hasMore };
    } catch (error) {
      console.error('[CronLogger] Failed to get admin logs:', error);
      return { logs: [], total: 0, hasMore: false };
    }
  }

  /**
   * Get all execution logs (Super Admin only)
   */
  async getAllLogs(
    options: {
      limit?: number;
      offset?: number;
      status?: CronJobLog['status'];
      cronJobName?: string;
      adminId?: string;
      triggerType?: CronJobLog['triggerType'];
      startDate?: Date;
      endDate?: Date;
    } = {}
  ): Promise<{ logs: CronJobLog[]; total: number; hasMore: boolean }> {
    try {
      let query = db.collection('cronJobLogs')
        .orderBy('createdAt', 'desc');

      // Apply filters
      if (options.status) {
        query = query.where('status', '==', options.status);
      }
      if (options.cronJobName) {
        query = query.where('cronJobName', '==', options.cronJobName);
      }
      if (options.adminId) {
        query = query.where('adminId', '==', options.adminId);
      }
      if (options.triggerType) {
        query = query.where('triggerType', '==', options.triggerType);
      }
      if (options.startDate) {
        query = query.where('createdAt', '>=', admin.firestore.Timestamp.fromDate(options.startDate));
      }
      if (options.endDate) {
        query = query.where('createdAt', '<=', admin.firestore.Timestamp.fromDate(options.endDate));
      }

      // Apply pagination
      const limit = options.limit || 100;
      const offset = options.offset || 0;
      
      if (offset > 0) {
        query = query.offset(offset);
      }
      query = query.limit(limit + 1); // Get one extra to check if there are more

      const snapshot = await query.get();
      const logs: CronJobLog[] = [];
      const hasMore = snapshot.docs.length > limit;
      
      const docsToProcess = hasMore ? snapshot.docs.slice(0, limit) : snapshot.docs;
      
      docsToProcess.forEach(doc => {
        const data = doc.data();
        logs.push({
          id: doc.id,
          ...data,
          startTime: data.startTime?.toDate() || new Date(),
          endTime: data.endTime?.toDate() || null,
          createdAt: data.createdAt?.toDate() || new Date(),
          updatedAt: data.updatedAt?.toDate() || new Date()
        } as CronJobLog);
      });

      // Get total count (this is approximate for performance)
      const countSnapshot = await db.collection('cronJobLogs').get();
      const total = countSnapshot.size;

      return { logs, total, hasMore };
    } catch (error) {
      console.error('[CronLogger] Failed to get all logs:', error);
      return { logs: [], total: 0, hasMore: false };
    }
  }
}

// Export singleton instance
export const cronJobLogger = CronJobLogger.getInstance();
