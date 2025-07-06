// src/lib/changeDetectionService.ts
import { dbAdmin as db } from '@/lib/firebase/firebaseAdmin';
import { takealotProxyService } from '@/modules/takealot/services';

interface SyncCheckpoint {
  integrationId: string;
  syncType: 'sales' | 'products';
  strategy: string;
  lastSyncTimestamp: string;
  lastRecordCount: number;
  lastDataChecksum: string;
  lastModifiedDate?: string;
  consecutiveUnchangedSyncs: number;
  skipNextSync: boolean;
  createdAt: string;
  updatedAt: string;
}

interface ChangeDetectionResult {
  shouldSkipSync: boolean;
  reason: string;
  recommendedAction: 'skip' | 'sample' | 'full';
  confidenceLevel: number; // 0-100
  estimatedChanges: number;
  lastChangeDetected?: string;
}

interface SampleValidationResult {
  hasChanges: boolean;
  changePercentage: number;
  significantChanges: number;
  totalSampled: number;
  recommendation: 'skip' | 'continue' | 'limited';
}

export class ChangeDetectionService {
  private static readonly CHECKSUM_COLLECTION = 'syncCheckpoints';
  private static readonly MAX_UNCHANGED_SYNCS = 3; // Skip after 3 consecutive unchanged syncs
  private static readonly SAMPLE_SIZE = 10; // Sample first 10 records for validation
  private static readonly SIGNIFICANT_CHANGE_THRESHOLD = 5; // 5% of records must change

  /**
   * Check if a sync should be skipped based on change detection
   */
  static async shouldSkipSync(
    integrationId: string,
    syncType: 'sales' | 'products',
    strategy: string
  ): Promise<ChangeDetectionResult> {
    try {
      const checkpointId = `${integrationId}_${syncType}_${strategy}`;
      const checkpointDoc = await db.collection(this.CHECKSUM_COLLECTION).doc(checkpointId).get();

      if (!checkpointDoc.exists) {
        // First sync - never skip
        return {
          shouldSkipSync: false,
          reason: 'First sync for this strategy',
          recommendedAction: 'full',
          confidenceLevel: 100,
          estimatedChanges: -1
        };
      }

      const checkpoint = checkpointDoc.data() as SyncCheckpoint;
      
      // Check if we've had too many consecutive unchanged syncs
      if (checkpoint.consecutiveUnchangedSyncs >= this.MAX_UNCHANGED_SYNCS) {
        // Implement adaptive scheduling - skip every other sync
        const hoursSinceLastSync = (Date.now() - new Date(checkpoint.lastSyncTimestamp).getTime()) / (1000 * 60 * 60);
        
        if (hoursSinceLastSync < 2) { // If last sync was less than 2 hours ago
          return {
            shouldSkipSync: true,
            reason: `${checkpoint.consecutiveUnchangedSyncs} consecutive unchanged syncs, implementing adaptive scheduling`,
            recommendedAction: 'skip',
            confidenceLevel: 85,
            estimatedChanges: 0,
            lastChangeDetected: checkpoint.updatedAt
          };
        }
      }

      // Check time-based heuristics
      const hoursSinceLastSync = (Date.now() - new Date(checkpoint.lastSyncTimestamp).getTime()) / (1000 * 60 * 60);
      
      // For sales: Less likely to have changes during night hours (10 PM - 6 AM)
      if (syncType === 'sales') {
        const currentHour = new Date().getHours();
        if ((currentHour >= 22 || currentHour <= 6) && checkpoint.consecutiveUnchangedSyncs >= 1) {
          return {
            shouldSkipSync: false, // Still sync but use sampling
            reason: 'Low-activity hours detected, recommend sampling',
            recommendedAction: 'sample',
            confidenceLevel: 70,
            estimatedChanges: Math.max(1, checkpoint.lastRecordCount * 0.05) // Estimate 5% changes
          };
        }
      }

      // Default to sample-based validation for efficiency
      return {
        shouldSkipSync: false,
        reason: 'Proceeding with sample-based validation',
        recommendedAction: 'sample',
        confidenceLevel: 60,
        estimatedChanges: Math.max(1, checkpoint.lastRecordCount * 0.1) // Estimate 10% changes
      };

    } catch (error) {
      console.error('[ChangeDetectionService] Error in shouldSkipSync:', error);
      // On error, default to full sync for safety
      return {
        shouldSkipSync: false,
        reason: 'Error in change detection, defaulting to full sync',
        recommendedAction: 'full',
        confidenceLevel: 100,
        estimatedChanges: -1
      };
    }
  }

  /**
   * Perform sample-based validation on first page of data
   */
  static async validateSampleChanges(
    integrationId: string,
    syncType: 'sales' | 'products',
    strategy: string,
    sampleData: any[],
    apiKey: string
  ): Promise<SampleValidationResult> {
    try {
      const sampleSize = Math.min(this.SAMPLE_SIZE, sampleData.length);
      const samplesToCheck = sampleData.slice(0, sampleSize);
      
      let significantChanges = 0;
      let totalChanges = 0;

      for (const record of samplesToCheck) {
        const hasChange = await this.checkRecordForChanges(integrationId, syncType, record);
        if (hasChange.hasSignificantChange) {
          significantChanges++;
        }
        if (hasChange.hasAnyChange) {
          totalChanges++;
        }
      }

      const changePercentage = (totalChanges / sampleSize) * 100;
      const significantChangePercentage = (significantChanges / sampleSize) * 100;

      let recommendation: 'skip' | 'continue' | 'limited' = 'continue';
      
      if (significantChangePercentage === 0) {
        recommendation = 'skip';
      } else if (significantChangePercentage < this.SIGNIFICANT_CHANGE_THRESHOLD) {
        recommendation = 'limited'; // Process only a few pages
      } else {
        recommendation = 'continue'; // Full sync
      }

      console.log(`[ChangeDetectionService] Sample validation for ${integrationId}: ${changePercentage}% changed, ${significantChangePercentage}% significant changes`);

      return {
        hasChanges: totalChanges > 0,
        changePercentage,
        significantChanges,
        totalSampled: sampleSize,
        recommendation
      };

    } catch (error) {
      console.error('[ChangeDetectionService] Error in validateSampleChanges:', error);
      // On error, recommend continuing for safety
      return {
        hasChanges: true,
        changePercentage: 100,
        significantChanges: sampleData.length,
        totalSampled: sampleData.length,
        recommendation: 'continue'
      };
    }
  }

  /**
   * Check a single record for changes against existing data (public method)
   */
  static async checkRecordForChanges(
    integrationId: string,
    syncType: 'sales' | 'products',
    record: any
  ): Promise<{ hasAnyChange: boolean; hasSignificantChange: boolean }> {
    try {
      const collectionName = syncType === 'sales' ? 'takealot_sales' : 'takealot_offers';
      const idField = syncType === 'sales' ? 'order_id' : 'tsin_id';
      
      if (!record[idField]) {
        return { hasAnyChange: true, hasSignificantChange: true };
      }

      // Check if record exists
      const existingQuery = await db.collection(collectionName)
        .where(idField, '==', record[idField])
        .where('integrationId', '==', integrationId)
        .limit(1)
        .get();

      if (existingQuery.empty) {
        // New record
        return { hasAnyChange: true, hasSignificantChange: true };
      }

      const existingData = existingQuery.docs[0].data();
      
      // Define significant fields for each type
      const significantFields = syncType === 'sales' 
        ? ['selling_price', 'order_status', 'total_fee', 'quantity']
        : ['selling_price', 'rrp', 'quantity_available', 'status'];

      const anyChangeFields = syncType === 'sales'
        ? [...significantFields, 'customer_name', 'delivery_date', 'tracking_number']
        : [...significantFields, 'image_url', 'title', 'description'];

      let hasAnyChange = false;
      let hasSignificantChange = false;

      // Check for any changes
      for (const field of anyChangeFields) {
        if (this.isFieldChanged(existingData[field], record[field])) {
          hasAnyChange = true;
          break;
        }
      }

      // Check for significant changes
      for (const field of significantFields) {
        if (this.isFieldChanged(existingData[field], record[field], true)) {
          hasSignificantChange = true;
          break;
        }
      }

      return { hasAnyChange, hasSignificantChange };

    } catch (error) {
      console.error('[ChangeDetectionService] Error checking record changes:', error);
      return { hasAnyChange: true, hasSignificantChange: true };
    }
  }

  /**
   * Check if a field has changed with optional significance threshold
   */
  private static isFieldChanged(existingValue: any, newValue: any, requireSignificant: boolean = false): boolean {
    // Handle null/undefined
    if (existingValue === newValue) return false;
    if (existingValue == null && newValue == null) return false;
    if (existingValue == null || newValue == null) return true;

    // For numbers (prices), check if change is significant
    if (typeof existingValue === 'number' && typeof newValue === 'number' && requireSignificant) {
      const percentageChange = Math.abs((newValue - existingValue) / existingValue) * 100;
      return percentageChange >= 1; // 1% threshold for significant price changes
    }

    // For strings, check if different
    return String(existingValue).trim() !== String(newValue).trim();
  }

  /**
   * Update sync checkpoint after completion
   */
  static async updateSyncCheckpoint(
    integrationId: string,
    syncType: 'sales' | 'products',
    strategy: string,
    recordCount: number,
    dataChecksum: string,
    hasChanges: boolean
  ): Promise<void> {
    try {
      const checkpointId = `${integrationId}_${syncType}_${strategy}`;
      const now = new Date().toISOString();

      const checkpointData: Partial<SyncCheckpoint> = {
        integrationId,
        syncType,
        strategy,
        lastSyncTimestamp: now,
        lastRecordCount: recordCount,
        lastDataChecksum: dataChecksum,
        consecutiveUnchangedSyncs: hasChanges ? 0 : await this.getConsecutiveUnchangedCount(checkpointId) + 1,
        updatedAt: now
      };

      // Create or update checkpoint
      await db.collection(this.CHECKSUM_COLLECTION).doc(checkpointId).set(checkpointData, { merge: true });

      console.log(`[ChangeDetectionService] Updated checkpoint for ${checkpointId}: ${recordCount} records, changes: ${hasChanges}`);

    } catch (error) {
      console.error('[ChangeDetectionService] Error updating checkpoint:', error);
    }
  }

  /**
   * Get consecutive unchanged sync count
   */
  private static async getConsecutiveUnchangedCount(checkpointId: string): Promise<number> {
    try {
      const doc = await db.collection(this.CHECKSUM_COLLECTION).doc(checkpointId).get();
      return doc.exists ? (doc.data()?.consecutiveUnchangedSyncs || 0) : 0;
    } catch {
      return 0;
    }
  }

  /**
   * Generate a simple checksum for data validation
   */
  static generateDataChecksum(data: any[]): string {
    if (!data || data.length === 0) return '';
    
    // Create a simple hash based on record count and first/last record key fields
    const firstRecord = data[0];
    const lastRecord = data[data.length - 1];
    
    const key1 = firstRecord?.order_id || firstRecord?.tsin_id || '';
    const key2 = lastRecord?.order_id || lastRecord?.tsin_id || '';
    const count = data.length;
    
    return `${count}_${key1}_${key2}`.replace(/[^a-zA-Z0-9_]/g, '');
  }

  /**
   * Get cost savings statistics
   */
  static async getCostSavingsStats(integrationId: string, days: number = 7): Promise<{
    totalSyncsSkipped: number;
    totalApiCallsSaved: number;
    totalRecordsNotProcessed: number;
    estimatedCostSavings: number;
  }> {
    try {
      const sevenDaysAgo = new Date(Date.now() - (days * 24 * 60 * 60 * 1000)).toISOString();
      
      const checkpointsQuery = await db.collection(this.CHECKSUM_COLLECTION)
        .where('integrationId', '==', integrationId)
        .where('updatedAt', '>=', sevenDaysAgo)
        .get();

      let totalSyncsSkipped = 0;
      let totalApiCallsSaved = 0;
      let totalRecordsNotProcessed = 0;

      checkpointsQuery.docs.forEach(doc => {
        const data = doc.data() as SyncCheckpoint;
        if (data.consecutiveUnchangedSyncs > 0) {
          totalSyncsSkipped += Math.min(data.consecutiveUnchangedSyncs, 3); // Max 3 skips per strategy
          totalApiCallsSaved += Math.min(data.consecutiveUnchangedSyncs, 3);
          totalRecordsNotProcessed += data.lastRecordCount * Math.min(data.consecutiveUnchangedSyncs, 3);
        }
      });

      // Rough cost estimate: $0.001 per API call + $0.0001 per record processed
      const estimatedCostSavings = (totalApiCallsSaved * 0.001) + (totalRecordsNotProcessed * 0.0001);

      return {
        totalSyncsSkipped,
        totalApiCallsSaved,
        totalRecordsNotProcessed,
        estimatedCostSavings
      };

    } catch (error) {
      console.error('[ChangeDetectionService] Error calculating savings:', error);
      return {
        totalSyncsSkipped: 0,
        totalApiCallsSaved: 0,
        totalRecordsNotProcessed: 0,
        estimatedCostSavings: 0
      };
    }
  }

  /**
   * Enhanced change detection specifically for large dataset syncs (30-day sales)
   */
  static async shouldSkipLargeDatasetSync(
    integrationId: string,
    syncType: 'sales' | 'products',
    strategy: string,
    expectedRecordCount: number = 1000
  ): Promise<ChangeDetectionResult> {
    try {
      const checkpointId = `${integrationId}_${syncType}_${strategy}`;
      const checkpointDoc = await db.collection(this.CHECKSUM_COLLECTION).doc(checkpointId).get();

      if (!checkpointDoc.exists) {
        return {
          shouldSkipSync: false,
          reason: 'First sync for this strategy',
          recommendedAction: 'full',
          confidenceLevel: 100,
          estimatedChanges: expectedRecordCount
        };
      }

      const checkpoint = checkpointDoc.data() as SyncCheckpoint;
      
      // For large datasets, be more aggressive about skipping
      if (checkpoint.consecutiveUnchangedSyncs >= 2) { // Only need 2 unchanged for 30-day
        const hoursSinceLastSync = (Date.now() - new Date(checkpoint.lastSyncTimestamp).getTime()) / (1000 * 60 * 60);
        
        if (hoursSinceLastSync < 20) { // Less than 20 hours ago
          return {
            shouldSkipSync: true,
            reason: `${checkpoint.consecutiveUnchangedSyncs} consecutive unchanged large syncs, implementing aggressive scheduling`,
            recommendedAction: 'skip',
            confidenceLevel: 90,
            estimatedChanges: 0,
            lastChangeDetected: checkpoint.updatedAt
          };
        }
      }

      // For 30-day sales: Be smarter about timing
      if (syncType === 'sales' && strategy === 'Last 30 Days') {
        const currentHour = new Date().getHours();
        const dayOfWeek = new Date().getDay();
        
        // Skip during very low activity periods
        if ((currentHour >= 23 || currentHour <= 5) && checkpoint.consecutiveUnchangedSyncs >= 1) {
          // But not on Mondays (weekend sales might accumulate)
          if (dayOfWeek !== 1) {
            return {
              shouldSkipSync: false,
              reason: 'Low-activity night hours, recommend heavy sampling',
              recommendedAction: 'sample',
              confidenceLevel: 85,
              estimatedChanges: Math.max(5, checkpoint.lastRecordCount * 0.02) // Estimate 2% changes
            };
          }
        }
      }

      // Default to sample-based validation for large datasets
      return {
        shouldSkipSync: false,
        reason: 'Proceeding with intensive sample-based validation for large dataset',
        recommendedAction: 'sample',
        confidenceLevel: 75,
        estimatedChanges: Math.max(10, checkpoint.lastRecordCount * 0.05) // Estimate 5% changes
      };

    } catch (error) {
      console.error('[ChangeDetectionService] Error in shouldSkipLargeDatasetSync:', error);
      return {
        shouldSkipSync: false,
        reason: 'Error in change detection, defaulting to full sync',
        recommendedAction: 'full',
        confidenceLevel: 100,
        estimatedChanges: expectedRecordCount
      };
    }
  }

  /**
   * Enhanced sample validation for larger datasets with statistical analysis
   */
  static async validateLargeDatasetSampleChanges(
    integrationId: string,
    syncType: 'sales' | 'products',
    strategy: string,
    sampleData: any[],
    apiKey: string,
    totalExpectedRecords: number = 1000
  ): Promise<SampleValidationResult & { 
    statisticalConfidence: number;
    recommendedPageLimit: number;
  }> {
    try {
      // Use larger sample size for large datasets
      const sampleSize = Math.min(50, sampleData.length); // Sample up to 50 records
      const samplesToCheck = sampleData.slice(0, sampleSize);
      
      let significantChanges = 0;
      let totalChanges = 0;
      let newRecords = 0;

      for (const record of samplesToCheck) {
        const changeResult = await this.checkRecordForChanges(integrationId, syncType, record);
        
        if (changeResult.hasSignificantChange) {
          significantChanges++;
        }
        if (changeResult.hasAnyChange) {
          totalChanges++;
        }
        
        // Check if it's a new record
        const idField = syncType === 'sales' ? 'order_id' : 'tsin_id';
        if (record[idField]) {
          const exists = await this.checkRecordExists(integrationId, syncType, record[idField]);
          if (!exists) {
            newRecords++;
          }
        }
      }

      const changePercentage = (totalChanges / sampleSize) * 100;
      const significantChangePercentage = (significantChanges / sampleSize) * 100;
      const newRecordPercentage = (newRecords / sampleSize) * 100;

      // Calculate statistical confidence based on sample size
      const statisticalConfidence = Math.min(95, 50 + (sampleSize * 0.9)); // Max 95% confidence

      let recommendation: 'skip' | 'continue' | 'limited' = 'continue';
      let recommendedPageLimit = -1; // No limit

      // More sophisticated decision logic for large datasets
      if (significantChangePercentage === 0 && newRecordPercentage === 0) {
        recommendation = 'skip';
      } else if (significantChangePercentage < 2 && newRecordPercentage < 1) {
        // Very few changes - limit to a small number of pages
        recommendation = 'limited';
        recommendedPageLimit = Math.max(2, Math.ceil(totalExpectedRecords * 0.1 / 100)); // 10% of expected pages
      } else if (significantChangePercentage < 10 && newRecordPercentage < 5) {
        // Moderate changes - limit to reasonable number of pages
        recommendation = 'limited';
        recommendedPageLimit = Math.max(5, Math.ceil(totalExpectedRecords * 0.3 / 100)); // 30% of expected pages
      } else {
        // Significant changes - full sync
        recommendation = 'continue';
      }

      console.log(`[ChangeDetectionService] Large dataset sample validation for ${integrationId}: ${changePercentage}% changed, ${significantChangePercentage}% significant, ${newRecordPercentage}% new records, confidence: ${statisticalConfidence}%`);

      return {
        hasChanges: totalChanges > 0,
        changePercentage,
        significantChanges,
        totalSampled: sampleSize,
        recommendation,
        statisticalConfidence,
        recommendedPageLimit
      };

    } catch (error) {
      console.error('[ChangeDetectionService] Error in validateLargeDatasetSampleChanges:', error);
      return {
        hasChanges: true,
        changePercentage: 100,
        significantChanges: sampleData.length,
        totalSampled: sampleData.length,
        recommendation: 'continue',
        statisticalConfidence: 50,
        recommendedPageLimit: -1
      };
    }
  }

  /**
   * Check if a record exists in the database
   */
  private static async checkRecordExists(
    integrationId: string,
    syncType: 'sales' | 'products',
    recordId: string
  ): Promise<boolean> {
    try {
      const collectionName = syncType === 'sales' ? 'takealot_sales' : 'takealot_offers';
      const idField = syncType === 'sales' ? 'order_id' : 'tsin_id';
      
      const existingQuery = await db.collection(collectionName)
        .where(idField, '==', recordId)
        .where('integrationId', '==', integrationId)
        .limit(1)
        .get();

      return !existingQuery.empty;
    } catch (error) {
      console.error('[ChangeDetectionService] Error checking record existence:', error);
      return false; // Assume it doesn't exist on error
    }
  }

  /**
   * Get the timestamp of the last successful sync
   */
  static async getLastSuccessfulSync(
    integrationId: string,
    syncType: 'sales' | 'products',
    strategy: string
  ): Promise<Date | null> {
    try {
      const checkpointId = `${integrationId}_${syncType}_${strategy}`;
      const checkpointDoc = await db.collection(this.CHECKSUM_COLLECTION).doc(checkpointId).get();
      
      if (!checkpointDoc.exists) {
        console.log(`No sync checkpoint found for ${checkpointId}`);
        return null;
      }
      
      const data = checkpointDoc.data() as SyncCheckpoint;
      return new Date(data.lastSyncTimestamp);
      
    } catch (error) {
      console.error('Error getting last successful sync:', error);
      return null;
    }
  }
}
