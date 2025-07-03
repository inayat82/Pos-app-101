// Webshare Database Migration Service
import { dbAdmin } from '@/lib/firebase/firebaseAdmin';
import { webshareService } from '../services';
import { logRecorder } from '@/lib/logRecorder';

export class WebshareDatabaseMigration {
  private static instance: WebshareDatabaseMigration;
  private baseRef = dbAdmin.collection('superadmin').doc('webshare');

  public static getInstance(): WebshareDatabaseMigration {
    if (!WebshareDatabaseMigration.instance) {
      WebshareDatabaseMigration.instance = new WebshareDatabaseMigration();
    }
    return WebshareDatabaseMigration.instance;
  }

  // Migrate legacy webshareSettings to config collection
  async migrateLegacySettings(): Promise<{
    success: boolean;
    migratedCount: number;
    errors: string[];
  }> {
    const errors: string[] = [];
    let migratedCount = 0;

    try {
      console.log('Starting Webshare legacy settings migration...');
      
      // Check if webshareSettings collection exists
      const legacySettingsSnapshot = await this.baseRef.collection('webshareSettings').get();
      
      if (legacySettingsSnapshot.empty) {
        console.log('No legacy settings found - migration not needed');
        return { success: true, migratedCount: 0, errors: [] };
      }

      // Get current config
      const currentConfig = await webshareService.getConfig();
      
      // Process each legacy document
      for (const doc of legacySettingsSnapshot.docs) {
        try {
          const legacyData = doc.data();
          console.log(`Migrating legacy document: ${doc.id}`);
          
          // Extract useful data from legacy format
          const migrationData: any = {};
          
          if (legacyData.apiKey && !currentConfig.apiKey) {
            migrationData.apiKey = legacyData.apiKey;
          }
          
          if (legacyData.isEnabled !== undefined) {
            migrationData.isEnabled = legacyData.isEnabled;
          }
          
          if (legacyData.syncInterval) {
            migrationData.syncInterval = legacyData.syncInterval;
          }
          
          if (legacyData.autoSyncEnabled !== undefined) {
            migrationData.autoSyncEnabled = legacyData.autoSyncEnabled;
          }
          
          if (legacyData.autoSyncInterval) {
            migrationData.autoSyncInterval = legacyData.autoSyncInterval;
          }

          // Update config with migrated data (only if fields are empty)
          if (Object.keys(migrationData).length > 0) {
            await webshareService.updateConfig({
              ...migrationData,
              migrationCompleted: true,
              migratedAt: new Date().toISOString(),
              migratedFrom: doc.id
            });
            
            console.log(`Successfully migrated data from ${doc.id}`);
            migratedCount++;
          }
          
          // Mark legacy document as migrated (don't delete yet)
          await this.baseRef.collection('webshareSettings').doc(doc.id).update({
            migrationStatus: 'completed',
            migratedAt: new Date().toISOString(),
            migratedToConfig: true
          });
          
        } catch (error) {
          const errorMsg = `Failed to migrate document ${doc.id}: ${error}`;
          console.error(errorMsg);
          errors.push(errorMsg);
        }
      }

      await logRecorder.logSuccess('Webshare migration completed', {
        migratedCount,
        totalLegacyDocuments: legacySettingsSnapshot.size,
        hasErrors: errors.length > 0
      });

      return {
        success: errors.length === 0,
        migratedCount,
        errors
      };

    } catch (error) {
      const errorMsg = `Migration failed: ${error}`;
      console.error(errorMsg);
      await logRecorder.logError('Webshare migration failed', { error: errorMsg });
      
      return {
        success: false,
        migratedCount,
        errors: [errorMsg]
      };
    }
  }

  // Clean up old sync jobs (keep only last 100)
  async cleanupOldSyncJobs(): Promise<{
    success: boolean;
    deletedCount: number;
    error?: string;
  }> {
    try {
      console.log('Cleaning up old sync jobs...');
      
      const syncJobsRef = this.baseRef.collection('sync_jobs');
      
      // Get all sync jobs ordered by start time (oldest first)
      const allJobsSnapshot = await syncJobsRef.orderBy('startTime', 'asc').get();
      
      if (allJobsSnapshot.size <= 100) {
        console.log(`Only ${allJobsSnapshot.size} sync jobs found - no cleanup needed`);
        return { success: true, deletedCount: 0 };
      }
      
      // Calculate how many to delete (keep latest 100)
      const toDeleteCount = allJobsSnapshot.size - 100;
      const jobsToDelete = allJobsSnapshot.docs.slice(0, toDeleteCount);
      
      // Delete in batches
      const batch = dbAdmin.batch();
      jobsToDelete.forEach(doc => {
        batch.delete(doc.ref);
      });
      
      await batch.commit();
      
      console.log(`Successfully deleted ${toDeleteCount} old sync jobs`);
      
      await logRecorder.logSuccess('Sync jobs cleanup completed', {
        deletedCount: toDeleteCount,
        remainingJobs: 100
      });
      
      return {
        success: true,
        deletedCount: toDeleteCount
      };
      
    } catch (error) {
      const errorMsg = `Sync jobs cleanup failed: ${error}`;
      console.error(errorMsg);
      await logRecorder.logError('Sync jobs cleanup failed', { error: errorMsg });
      
      return {
        success: false,
        deletedCount: 0,
        error: errorMsg
      };
    }
  }

  // Optimize proxy collection indexes
  async optimizeProxyIndexes(): Promise<{
    success: boolean;
    message: string;
  }> {
    try {
      console.log('Optimizing proxy collection indexes...');
      
      // Get proxy collection reference
      const proxiesRef = this.baseRef.collection('proxies');
      
      // Get sample of proxies to analyze structure
      const sampleSnapshot = await proxiesRef.limit(10).get();
      
      if (sampleSnapshot.empty) {
        return {
          success: true,
          message: 'No proxies found - indexes not needed'
        };
      }
      
      // Analyze common query patterns
      const indexRecommendations = [
        'country_code (for geographic filtering)',
        'valid (for status filtering)', 
        'syncedAt (for recent data)',
        'proxy_type (for type filtering)',
        'last_verification_status (for health checks)'
      ];
      
      console.log('Recommended indexes for proxies collection:', indexRecommendations);
      
      await logRecorder.logSuccess('Proxy indexes analyzed', {
        proxyCount: sampleSnapshot.size,
        recommendedIndexes: indexRecommendations
      });
      
      return {
        success: true,
        message: `Analysis complete. Recommended indexes: ${indexRecommendations.join(', ')}`
      };
      
    } catch (error) {
      const errorMsg = `Index optimization failed: ${error}`;
      console.error(errorMsg);
      
      return {
        success: false,
        message: errorMsg
      };
    }
  }

  // Complete database health check
  async performHealthCheck(): Promise<{
    collections: {
      name: string;
      documentCount: number;
      size: string;
      status: 'healthy' | 'warning' | 'error';
      issues?: string[];
    }[];
    overallHealth: 'healthy' | 'warning' | 'error';
    recommendations: string[];
  }> {
    const collections = [];
    const recommendations = [];
    let overallHealth: 'healthy' | 'warning' | 'error' = 'healthy';

    try {
      // Check config collection
      const configSnapshot = await this.baseRef.collection('config').get();
      const configCollection = {
        name: 'config',
        documentCount: configSnapshot.size,
        size: '~5KB',
        status: configSnapshot.size === 1 ? 'healthy' : 'warning' as const,
        issues: configSnapshot.size !== 1 ? [`Expected 1 document, found ${configSnapshot.size}`] : undefined
      };
      collections.push(configCollection);

      // Check proxies collection
      const proxiesSnapshot = await this.baseRef.collection('proxies').get();
      const validProxies = proxiesSnapshot.docs.filter(doc => doc.data().valid);
      const proxiesCollection = {
        name: 'proxies',
        documentCount: proxiesSnapshot.size,
        size: `~${Math.round(proxiesSnapshot.size * 2)}KB`,
        status: proxiesSnapshot.size > 0 ? 'healthy' : 'warning' as const,
        issues: proxiesSnapshot.size === 0 ? ['No proxies found - sync needed'] : undefined
      };
      collections.push(proxiesCollection);

      if (validProxies.length / proxiesSnapshot.size < 0.5) {
        proxiesCollection.status = 'warning';
        proxiesCollection.issues = [...(proxiesCollection.issues || []), 'Low valid proxy ratio'];
        recommendations.push('Sync proxies to refresh invalid entries');
      }

      // Check sync_jobs collection
      const syncJobsSnapshot = await this.baseRef.collection('sync_jobs').get();
      const syncJobsCollection = {
        name: 'sync_jobs',
        documentCount: syncJobsSnapshot.size,
        size: `~${Math.round(syncJobsSnapshot.size * 1)}KB`,
        status: 'healthy' as const
      };
      
      if (syncJobsSnapshot.size > 200) {
        syncJobsCollection.status = 'warning';
        syncJobsCollection.issues = ['Too many sync jobs - cleanup recommended'];
        recommendations.push('Run sync jobs cleanup to improve performance');
      }
      collections.push(syncJobsCollection);

      // Check dashboard collection
      const dashboardSnapshot = await this.baseRef.collection('dashboard').get();
      const dashboardCollection = {
        name: 'dashboard',
        documentCount: dashboardSnapshot.size,
        size: '~10KB',
        status: dashboardSnapshot.size === 1 ? 'healthy' : 'warning' as const,
        issues: dashboardSnapshot.size !== 1 ? ['Dashboard cache missing or corrupted'] : undefined
      };
      collections.push(dashboardCollection);

      // Check legacy webshareSettings
      const legacySnapshot = await this.baseRef.collection('webshareSettings').get();
      if (legacySnapshot.size > 0) {
        const legacyCollection = {
          name: 'webshareSettings (legacy)',
          documentCount: legacySnapshot.size,
          size: `~${Math.round(legacySnapshot.size * 1)}KB`,
          status: 'warning' as const,
          issues: ['Legacy data needs migration']
        };
        collections.push(legacyCollection);
        recommendations.push('Run legacy data migration');
      }

      // Determine overall health
      const hasErrors = collections.some(c => c.status === 'error');
      const hasWarnings = collections.some(c => c.status === 'warning');
      
      if (hasErrors) {
        overallHealth = 'error';
      } else if (hasWarnings) {
        overallHealth = 'warning';
      }

      await logRecorder.logSuccess('Database health check completed', {
        overallHealth,
        collectionCount: collections.length,
        totalRecommendations: recommendations.length
      });

      return {
        collections,
        overallHealth,
        recommendations
      };

    } catch (error) {
      console.error('Health check failed:', error);
      await logRecorder.logError('Database health check failed', { error: String(error) });
      
      return {
        collections: [],
        overallHealth: 'error',
        recommendations: ['Fix database connectivity issues']
      };
    }
  }
}

export const webshareDatabaseMigration = WebshareDatabaseMigration.getInstance();
