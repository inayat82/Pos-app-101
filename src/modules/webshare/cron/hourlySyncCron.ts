// Webshare Hourly Sync Cron Job
import { webshareService } from '../services';
import { logRecorder } from '@/lib/logRecorder';

export class WebshareHourlySyncCron {
  private static instance: WebshareHourlySyncCron;
  private intervalId: NodeJS.Timeout | null = null;
  private isRunning = false;

  public static getInstance(): WebshareHourlySyncCron {
    if (!WebshareHourlySyncCron.instance) {
      WebshareHourlySyncCron.instance = new WebshareHourlySyncCron();
    }
    return WebshareHourlySyncCron.instance;
  }

  async start(): Promise<void> {
    if (this.isRunning) {
      console.log('Webshare hourly sync cron is already running');
      return;
    }

    try {
      const config = await webshareService.getConfig();
      
      if (!config.autoSyncEnabled) {
        console.log('Auto-sync is disabled, skipping cron start');
        return;
      }

      const intervalMs = config.autoSyncInterval * 60 * 1000; // Convert minutes to milliseconds
      
      console.log(`Starting Webshare hourly sync cron with ${config.autoSyncInterval} minute interval`);
      
      // Run immediately on start
      await this.runSync();
      
      // Schedule recurring sync
      this.intervalId = setInterval(async () => {
        await this.runSync();
      }, intervalMs);
      
      this.isRunning = true;
      
      await logRecorder.logSuccess('Hourly sync cron started', {
        intervalMinutes: config.autoSyncInterval,
        autoSyncEnabled: config.autoSyncEnabled
      });
      
    } catch (error) {
      console.error('Error starting Webshare hourly sync cron:', error);
      await logRecorder.logError('Failed to start hourly sync cron', {
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  async stop(): Promise<void> {
    if (!this.isRunning) {
      console.log('Webshare hourly sync cron is not running');
      return;
    }

    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    
    this.isRunning = false;
    
    console.log('Webshare hourly sync cron stopped');
    await logRecorder.logSuccess('Hourly sync cron stopped');
  }

  async restart(): Promise<void> {
    await this.stop();
    await this.start();
  }

  private async runSync(): Promise<void> {
    try {
      const config = await webshareService.getConfig();
      
      if (!config.autoSyncEnabled || !config.isEnabled) {
        console.log('Auto-sync or Webshare integration is disabled, skipping sync');
        return;
      }

      console.log('Running Webshare hourly sync...');
      
      const startTime = Date.now();
      
      // Perform full sync (account info, subscription, and proxies)
      const syncResult = await webshareService.syncAllData();
      
      const duration = Date.now() - startTime;
      
      console.log(`Webshare hourly sync completed in ${duration}ms`);
      
      await logRecorder.logSuccess('Hourly sync completed successfully', {
        duration,
        profileSynced: !!syncResult.profile,
        subscriptionSynced: !!syncResult.subscription,
        proxiesSynced: !!syncResult.proxies,
        statsSynced: !!syncResult.stats
      });
      
    } catch (error) {
      console.error('Error during Webshare hourly sync:', error);
      
      await logRecorder.logError('Hourly sync failed', {
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  getStatus(): { isRunning: boolean; intervalId: NodeJS.Timeout | null } {
    return {
      isRunning: this.isRunning,
      intervalId: this.intervalId
    };
  }
}

export const webshareHourlySyncCron = WebshareHourlySyncCron.getInstance();
