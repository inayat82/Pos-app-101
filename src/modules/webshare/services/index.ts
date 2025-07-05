// WebShare Service - Enhanced version with centralized logging
import { dbAdmin } from '@/lib/firebase/firebaseAdmin';
import axios from 'axios';
import { cronJobLogger } from '@/lib/cronJobLogger';
import { 
  WebshareConfig, 
  WebshareProxy, 
  WebshareDashboardData, 
  WebshareSyncJob, 
  SystemStatus,
  ProxyListResponse,
  TestResult,
  AdvancedSyncOptions,
  CrudOptimizationResult,
  ProxyCrudOperation
} from '../types';
import { WEBSHARE_ENDPOINTS, DEFAULT_CONFIG } from '../constants';

class WebshareService {
  private static instance: WebshareService;
  private baseRef = dbAdmin.collection('superadmin').doc('webshare');

  public static getInstance(): WebshareService {
    if (!WebshareService.instance) {
      WebshareService.instance = new WebshareService();
    }
    return WebshareService.instance;
  }

  // Utility function to sanitize objects for Firestore
  private sanitizeForFirestore(obj: any): any {
    if (obj === null || obj === undefined) {
      return null;
    }
    
    if (Array.isArray(obj)) {
      return obj.map(item => this.sanitizeForFirestore(item));
    }
    
    if (typeof obj === 'object') {
      const sanitized: any = {};
      for (const [key, value] of Object.entries(obj)) {
        if (value !== undefined) {
          sanitized[key] = this.sanitizeForFirestore(value);
        }
      }
      return sanitized;
    }
    
    return obj;
  }

  async getConfig(): Promise<WebshareConfig> {
    try {
      const configDoc = await this.baseRef.collection('config').doc('main').get();
      
      if (!configDoc.exists) {
        const now = new Date().toISOString();
        const defaultConfig: WebshareConfig = {
          apiKey: '',
          isEnabled: false,
          lastSyncAt: null,
          syncInterval: 60,
          maxRetries: 3,
          timeout: 30000,
          testStatus: 'not_tested',
          lastTestError: null,
          autoSyncEnabled: false,
          autoSyncInterval: 60,
          lastAutoSyncAt: null,
          profile: null,
          subscription: null,
          cronSettings: {
            // Enhanced scheduling
            proxySyncSchedule: {
              enabled: false,
              interval: 'hourly',
              customInterval: undefined,
              lastSync: null,
              nextSync: null,
            },
            accountSyncSchedule: {
              enabled: false,
              interval: '24hours',
              customInterval: undefined,
              lastSync: null,
              nextSync: null,
            },
            statsUpdateSchedule: {
              enabled: false,
              interval: '6hours',
              customInterval: undefined,
              lastUpdate: null,
              nextUpdate: null,
            },
            healthCheckSchedule: {
              enabled: false,
              interval: '3hours',
              customInterval: undefined,
              lastCheck: null,
              nextCheck: null,
            },
            // Legacy fields
            statsUpdateInterval: 60,
            lastStatsUpdate: null,
            autoRefreshProxies: true,
            proxyHealthCheckInterval: 30,
          },
          preferences: {
            timezone: 'UTC',
            notifications: {
              email: false,
              lowBalance: false,
              proxyExpiry: false,
              syncErrors: false,
            },
            dashboard: {
              defaultTab: 'account',
              refreshInterval: 30,
              showAdvancedMetrics: false,
            },
          },
          createdAt: now,
          updatedAt: now,
        };
        
        await this.baseRef.collection('config').doc('main').set(defaultConfig);
        return defaultConfig;
      }
      
      return configDoc.data() as WebshareConfig;
    } catch (error) {
      console.error('Error getting WebShare config:', error);
      const now = new Date().toISOString();
      return {
        apiKey: '',
        isEnabled: false,
        lastSyncAt: null,
        syncInterval: 60,
        maxRetries: 3,
        timeout: 30000,
        testStatus: 'not_tested',
        lastTestError: error instanceof Error ? error.message : 'Unknown error',
        autoSyncEnabled: false,
        autoSyncInterval: 60,
        lastAutoSyncAt: null,
        profile: null,
        subscription: null,
        cronSettings: {
          // Enhanced scheduling
          proxySyncSchedule: {
            enabled: false,
            interval: 'hourly',
            customInterval: undefined,
            lastSync: null,
            nextSync: null,
          },
          accountSyncSchedule: {
            enabled: false,
            interval: '24hours',
            customInterval: undefined,
            lastSync: null,
            nextSync: null,
          },
          statsUpdateSchedule: {
            enabled: false,
            interval: '6hours',
            customInterval: undefined,
            lastUpdate: null,
            nextUpdate: null,
          },
          healthCheckSchedule: {
            enabled: false,
            interval: '3hours',
            customInterval: undefined,
            lastCheck: null,
            nextCheck: null,
          },
          // Legacy fields
          statsUpdateInterval: 60,
          lastStatsUpdate: null,
          autoRefreshProxies: true,
          proxyHealthCheckInterval: 30,
        },
        preferences: {
          timezone: 'UTC',
          notifications: {
            email: false,
            lowBalance: false,
            proxyExpiry: false,
            syncErrors: false,
          },
          dashboard: {
            defaultTab: 'account',
            refreshInterval: 30,
            showAdvancedMetrics: false,
          },
        },
        createdAt: now,
        updatedAt: now,
      };
    }
  }

  async updateConfig(updates: Partial<WebshareConfig>): Promise<WebshareConfig> {
    try {
      const now = new Date().toISOString();
      const configRef = this.baseRef.collection('config').doc('main');
      
      // Sanitize the updates to remove undefined values
      const sanitizedUpdates = this.sanitizeForFirestore({
        ...updates,
        updatedAt: now
      });
      
      await configRef.update(sanitizedUpdates);
      
      return await this.getConfig();
    } catch (error) {
      console.error('Error updating WebShare config:', error);
      throw new Error('Could not update WebShare configuration');
    }
  }

  /**
   * Get proxies from our database (not from API)
   * This method fetches proxy data that was previously synced and stored locally
   */
  async getProxies(limit: number = 50, offset: number = 0): Promise<ProxyListResponse> {
    try {
      console.log(`�️  Getting ${limit} proxies from database starting from offset ${offset}...`);
      const startTime = Date.now();
      
      const proxiesSnapshot = await this.baseRef
        .collection('proxies')
        .orderBy('syncedAt', 'desc') // Order by most recently synced
        .limit(limit)
        .offset(offset)
        .get();

      const proxies: WebshareProxy[] = [];
      proxiesSnapshot.forEach(doc => {
        proxies.push({ id: doc.id, ...doc.data() } as WebshareProxy);
      });

      console.log(`📦 Retrieved ${proxies.length} proxy documents from database in ${Date.now() - startTime}ms`);

      // Use cached count for better performance
      let total = proxies.length;
      
      try {
        const metaDoc = await this.baseRef.collection('metadata').doc('proxy_count').get();
        if (metaDoc.exists && metaDoc.data()?.count) {
          total = metaDoc.data()!.count;
          console.log(`📊 Using cached proxy count: ${total}`);
        } else {
          console.log(`⚠️  No cached count found, performing count query...`);
          const totalSnapshot = await this.baseRef.collection('proxies').get();
          total = totalSnapshot.size;
          
          // Cache the count for future use
          await this.updateCachedProxyCount(total);
          console.log(`📊 Cached proxy count: ${total}`);
        }
      } catch (error) {
        console.warn('Error getting cached proxy count, using current batch size:', error);
        total = proxies.length;
      }
      
      console.log(`✅ getProxies from database completed: ${proxies.length} proxies, total: ${total} in ${Date.now() - startTime}ms`);
      
      return {
        proxies,
        total
      };
    } catch (error) {
      console.error('Error getting proxies from database:', error);
      return { proxies: [], total: 0 };
    }
  }

  // Helper method to update cached proxy count
  private async updateCachedProxyCount(count: number): Promise<void> {
    try {
      await this.baseRef.collection('metadata').doc('proxy_count').set({
        count,
        lastUpdated: new Date().toISOString()
      });
    } catch (error) {
      console.warn('Error updating cached proxy count:', error);
    }
  }

  async testApiKey(apiKey: string): Promise<TestResult> {
    try {
      const response = await axios.get(`${WEBSHARE_ENDPOINTS.BASE_URL}${WEBSHARE_ENDPOINTS.PROFILE}`, {
        headers: {
          'Authorization': `Token ${apiKey}`,
          'Content-Type': 'application/json'
        },
        timeout: 10000
      });

      if (response.status === 200) {
        // Try to get proxy count from proxy list endpoint
        try {
          const proxyResponse = await axios.get(`${WEBSHARE_ENDPOINTS.BASE_URL}${WEBSHARE_ENDPOINTS.PROXY_LIST}`, {
            headers: {
              'Authorization': `Token ${apiKey}`,
              'Content-Type': 'application/json'
            },
            params: {
              mode: 'direct',
              page: 1,
              page_size: 1
            },
            timeout: 10000
          });
          return { 
            success: true, 
            proxyCount: proxyResponse.data?.count || 0 
          };
        } catch (proxyError) {
          // Profile works but proxy list doesn't - still consider API key valid
          console.warn('Proxy list endpoint failed, but profile works:', proxyError);
          return { 
            success: true, 
            proxyCount: 0,
            warning: 'Profile accessible but proxy list failed'
          };
        }
      } else {
        return { success: false, error: 'Invalid API key or unauthorized access' };
      }
    } catch (error: any) {
      console.error('API test failed:', error);
      return {
        success: false,
        error: error.response?.data?.detail || error.message || 'Connection failed'
      };
    }
  }

  async syncProxies(triggerType: 'cron' | 'manual' = 'manual'): Promise<WebshareSyncJob> {
    const syncJob: WebshareSyncJob = {
      id: Date.now().toString(),
      status: 'started',
      startTime: new Date().toISOString(),
      proxiesAdded: 0,
      proxiesUpdated: 0,
      proxiesRemoved: 0,
      totalProxies: 0
    };

    // Start centralized logging
    let logId: string | null = null;
    
    try {
      const config = await this.getConfig();
      if (!config.apiKey) {
        throw new Error('API key not configured');
      }

      // Start centralized logging for this operation
      logId = await cronJobLogger.startExecution({
        cronJobName: `webshare-proxy-sync`,
        cronJobType: triggerType === 'cron' ? 'scheduled' : 'manual',
        cronSchedule: triggerType === 'cron' ? 'every 60 minutes' : undefined,
        triggerType: triggerType === 'cron' ? 'cron' : 'manual',
        triggerSource: triggerType === 'cron' ? 'vercel-cron' : 'manual-button',
        apiSource: 'Webshare API',
        adminId: 'superadmin',
        adminName: 'Super Administrator',
        adminEmail: 'superadmin@system',
        accountName: 'Webshare Proxy Service',
        message: 'Starting Webshare proxy synchronization',
        details: `Syncing proxies via ${triggerType} trigger`
      });

      console.log('Starting complete proxy synchronization...');

      // Get ALL proxies using pagination
      const allProxies = await this.getAllProxiesFromAPI(config.apiKey, config.timeout || 30000);
      
      console.log(`Found ${allProxies.length} total proxies from Webshare API`);
      syncJob.totalProxies = allProxies.length;

      if (allProxies.length > 0) {
        // Process proxies in batches for better performance
        const batchSize = 25; // Increase batch size since we're handling larger volumes
        
        for (let i = 0; i < allProxies.length; i += batchSize) {
          const batch = allProxies.slice(i, i + batchSize);
          console.log(`Processing batch ${Math.floor(i / batchSize) + 1} of ${Math.ceil(allProxies.length / batchSize)} (${batch.length} proxies)`);
          
          // Process batch in parallel for better performance
          const batchPromises = batch.map(async (proxyData) => {
            const proxy: WebshareProxy = {
              id: proxyData.id?.toString() || `proxy-${Date.now()}-${Math.random()}`,
              webshareId: proxyData.id?.toString() || '',
              proxy_address: proxyData.proxy_address || '',
              port: proxyData.port || 0,
              username: proxyData.username || '',
              password: proxyData.password || '',
              proxy_type: proxyData.proxy_type || 'http',
              country_code: proxyData.country_code || '',
              city_name: proxyData.city_name || '',
              created_at: proxyData.created_at || new Date().toISOString(),
              updated_at: proxyData.updated_at || new Date().toISOString(),
              syncedAt: new Date().toISOString(),
              valid: proxyData.valid !== false,
              last_verification_status: proxyData.last_verification || 'unknown'
            };

            // Check if proxy exists
            const existingProxy = await this.baseRef.collection('proxies').doc(proxy.id).get();
            
            if (existingProxy.exists) {
              // Create a copy without the id field for updating
              const { id, ...updateData } = proxy;
              
              // Sanitize the update data
              const sanitizedUpdate = this.sanitizeForFirestore(updateData);
              
              await this.baseRef.collection('proxies').doc(proxy.id).update(sanitizedUpdate);
              return 'updated';
            } else {
              // Sanitize the proxy data before setting
              const sanitizedProxy = this.sanitizeForFirestore(proxy);
              
              await this.baseRef.collection('proxies').doc(proxy.id).set(sanitizedProxy);
              return 'added';
            }
          });

          // Wait for batch to complete
          const batchResults = await Promise.all(batchPromises);
          
          // Count results
          syncJob.proxiesAdded += batchResults.filter(r => r === 'added').length;
          syncJob.proxiesUpdated += batchResults.filter(r => r === 'updated').length;
        }

        // Update config with last sync time and clear any errors
        await this.updateConfig({
          lastSyncAt: new Date().toISOString(),
          testStatus: 'connected',
          lastTestError: null // Clear any previous errors on successful sync
        });
        
        // Update cached proxy count for performance
        await this.updateCachedProxyCount(allProxies.length);
      }

      syncJob.status = 'completed';
      syncJob.endTime = new Date().toISOString();
      
      console.log(`Proxy sync completed: ${syncJob.proxiesAdded} added, ${syncJob.proxiesUpdated} updated`);
      
      // Complete centralized logging
      if (logId) {
        await cronJobLogger.completeExecution(logId, {
          status: 'success',
          totalPages: Math.ceil(allProxies.length / 100),
          totalReads: allProxies.length,
          totalWrites: syncJob.proxiesAdded + syncJob.proxiesUpdated,
          itemsProcessed: allProxies.length,
          message: `Proxy sync completed successfully: ${syncJob.proxiesAdded} added, ${syncJob.proxiesUpdated} updated`,
          details: `Total proxies processed: ${allProxies.length}, Cache updated`
        });
      }
      
      return syncJob;
    } catch (error: any) {
      console.error('Proxy sync failed:', error);
      syncJob.status = 'failed';
      syncJob.error = error.message;
      syncJob.endTime = new Date().toISOString();
      
      // Complete centralized logging with error
      if (logId) {
        await cronJobLogger.completeExecution(logId, {
          status: 'failure',
          message: `Proxy sync failed: ${error.message}`,
          errorDetails: error.message,
          stackTrace: error.stack
        });
      }
      
      return syncJob;
    }
  }

  // New method to get ALL proxies using pagination
  private async getAllProxiesFromAPI(apiKey: string, timeout: number = 30000): Promise<any[]> {
    const allProxies: any[] = [];
    let page = 1;
    let hasMorePages = true;
    const pageSize = 100; // Maximum page size according to API docs

    while (hasMorePages) {
      try {
        console.log(`Fetching page ${page} of proxies...`);
        
        const response = await axios.get(`${WEBSHARE_ENDPOINTS.BASE_URL}${WEBSHARE_ENDPOINTS.PROXY_LIST}`, {
          headers: {
            'Authorization': `Token ${apiKey}`,
            'Content-Type': 'application/json'
          },
          params: {
            mode: 'direct', // Required parameter for Webshare API
            page: page,
            page_size: pageSize
          },
          timeout: timeout
        });

        if (response.data && response.data.results) {
          const proxies = response.data.results;
          allProxies.push(...proxies);
          
          console.log(`Page ${page}: ${proxies.length} proxies, Total so far: ${allProxies.length}`);
          
          // Check if there are more pages
          hasMorePages = !!response.data.next;
          page++;
          
          // Add a small delay between requests to be respectful to the API
          if (hasMorePages) {
            await new Promise(resolve => setTimeout(resolve, 100));
          }
        } else {
          hasMorePages = false;
        }
      } catch (error: any) {
        console.error(`Error fetching page ${page}:`, error.message);
        hasMorePages = false;
        throw error;
      }
    }

    return allProxies;
  }

  async syncAccountInfo(triggerType: 'cron' | 'manual' = 'manual'): Promise<any> {
    let logId: string | null = null;
    
    try {
      const config = await this.getConfig();
      if (!config.apiKey) {
        throw new Error('API key not configured');
      }

      // Start centralized logging
      logId = await cronJobLogger.startExecution({
        cronJobName: `webshare-account-sync`,
        cronJobType: triggerType === 'cron' ? 'scheduled' : 'manual',
        cronSchedule: triggerType === 'cron' ? 'every 60 minutes' : undefined,
        triggerType: triggerType === 'cron' ? 'cron' : 'manual',
        triggerSource: triggerType === 'cron' ? 'vercel-cron' : 'manual-button',
        apiSource: 'Webshare API',
        adminId: 'superadmin',
        adminName: 'Super Administrator',
        adminEmail: 'superadmin@system',
        accountName: 'Webshare Proxy Service',
        message: 'Starting Webshare account synchronization',
        details: `Syncing account info via ${triggerType} trigger`
      });

      // Get profile information
      const profileResponse = await axios.get(`${WEBSHARE_ENDPOINTS.BASE_URL}${WEBSHARE_ENDPOINTS.PROFILE}`, {
        headers: {
          'Authorization': `Token ${config.apiKey}`,
          'Content-Type': 'application/json'
        },
        timeout: config.timeout || 30000
      });

      // Get subscription information
      const subscriptionResponse = await axios.get(`${WEBSHARE_ENDPOINTS.BASE_URL}${WEBSHARE_ENDPOINTS.SUBSCRIPTION}`, {
        headers: {
          'Authorization': `Token ${config.apiKey}`,
          'Content-Type': 'application/json'
        },
        timeout: config.timeout || 30000
      });

      const profile = profileResponse.data;
      const subscription = subscriptionResponse.data;

      // Update config with account data
      await this.updateConfig({
        profile: profile ? {
          id: profile.id || null,
          email: profile.email || null,
          username: profile.username || null,
          first_name: profile.first_name || null,
          last_name: profile.last_name || null,
          created_at: profile.created_at || null,
          last_login: profile.last_login || null,
          timezone: profile.timezone || 'UTC',
          is_verified: profile.is_verified || false
        } : null,
        subscription: subscription.results?.[0] ? {
          id: subscription.results[0].id || null,
          plan_name: subscription.results[0].plan_name || null,
          plan_type: subscription.results[0].plan_type || null,
          proxy_limit: subscription.results[0].proxy_limit || 0,
          bandwidth_limit: subscription.results[0].bandwidth_limit || 0,
          current_usage: {
            proxy_count: subscription.results[0].current_usage?.proxy_count || 0,
            bandwidth_used: subscription.results[0].current_usage?.bandwidth_used || 0,
            requests_made: subscription.results[0].current_usage?.requests_made || 0
          },
          billing: {
            amount: subscription.results[0].billing?.amount || 0,
            currency: subscription.results[0].billing?.currency || 'USD',
            billing_cycle: subscription.results[0].billing?.billing_cycle || 'monthly',
            next_billing_date: subscription.results[0].billing?.next_billing_date || null,
            status: subscription.results[0].billing?.status || 'unknown'
          },
          expires_at: subscription.results[0].expires_at || null,
          auto_renew: subscription.results[0].auto_renew || false
        } : null
      });

      // Complete centralized logging
      if (logId) {
        await cronJobLogger.completeExecution(logId, {
          status: 'success',
          totalReads: 2, // profile + subscription calls
          totalWrites: 1, // config update
          itemsProcessed: 1,
          message: 'Account sync completed successfully',
          details: `Profile and subscription data synchronized`
        });
      }

      return {
        profile,
        subscription,
        synced: true
      };
    } catch (error: any) {
      console.error('Account sync error:', error);
      
      // Complete centralized logging with error
      if (logId) {
        await cronJobLogger.completeExecution(logId, {
          status: 'failure',
          message: `Account sync failed: ${error.message}`,
          errorDetails: error.message,
          stackTrace: error.stack
        });
      }
      
      throw new Error(`Account sync failed: ${error.message}`);
    }
  }

  async syncAllData(triggerType: 'cron' | 'manual' = 'manual'): Promise<any> {
    let logId: string | null = null;
    
    try {
      // Start centralized logging for full sync
      logId = await cronJobLogger.startExecution({
        cronJobName: `webshare-full-sync`,
        cronJobType: triggerType === 'cron' ? 'scheduled' : 'manual',
        cronSchedule: triggerType === 'cron' ? 'every 60 minutes' : undefined,
        triggerType: triggerType === 'cron' ? 'cron' : 'manual',
        triggerSource: triggerType === 'cron' ? 'vercel-cron' : 'manual-button',
        apiSource: 'Webshare API',
        adminId: 'superadmin',
        adminName: 'Super Administrator',
        adminEmail: 'superadmin@system',
        accountName: 'Webshare Proxy Service',
        message: 'Starting Webshare full synchronization',
        details: `Full sync (proxies + account) via ${triggerType} trigger`
      });

      const proxySync = await this.syncProxies(triggerType);
      const accountSync = await this.syncAccountInfo(triggerType);

      // Complete centralized logging
      if (logId) {
        await cronJobLogger.completeExecution(logId, {
          status: 'success',
          totalReads: (proxySync.totalProxies || 0) + 2, // proxies + profile + subscription
          totalWrites: (proxySync.proxiesAdded || 0) + (proxySync.proxiesUpdated || 0) + 1, // proxy writes + config update
          itemsProcessed: (proxySync.totalProxies || 0) + 1,
          message: 'Full sync completed successfully',
          details: `Proxies: ${proxySync.proxiesAdded} added, ${proxySync.proxiesUpdated} updated. Account data synchronized.`
        });
      }

      return {
        proxies: proxySync,
        account: accountSync,
        completed: true
      };
    } catch (error: any) {
      // Complete centralized logging with error
      if (logId) {
        await cronJobLogger.completeExecution(logId, {
          status: 'failure',
          message: `Full sync failed: ${error.message}`,
          errorDetails: error.message,
          stackTrace: error.stack
        });
      }
      
      throw new Error(`Full sync failed: ${error.message}`);
    }
  }

  /**
   * Get enhanced dashboard data from our database (fast, no API calls)
   */
  async getEnhancedDashboardData(): Promise<WebshareDashboardData> {
    try {
      console.log('📊 Loading dashboard data from database...');
      const startTime = Date.now();
      
      const config = await this.getConfig();
      
      // Get proxy statistics from our database instead of API
      const proxyStats = await this.getProxySummaryFast();
      
      console.log(`✅ Dashboard data loaded from database in ${Date.now() - startTime}ms`);
      
      return {
        profile: config.profile,
        subscription: config.subscription,
        usageStats: null, // This would require API call, so we'll leave it null for dashboard display
        proxySummary: {
          total: proxyStats.total,
          valid: proxyStats.valid,
          invalid: proxyStats.invalid,
          countries: proxyStats.countries,
          avgResponseTime: 0 // This would require real-time testing
        },
        lastUpdated: new Date().toISOString()
      };
    } catch (error) {
      console.error('Error getting dashboard data from database:', error);
      return {
        profile: null,
        subscription: null,
        usageStats: null,
        proxySummary: {
          total: 0,
          valid: 0,
          invalid: 0,
          countries: [],
          avgResponseTime: 0
        },
        lastUpdated: new Date().toISOString()
      };
    }
  }

  /**
   * Optimized account synchronization with caching and schedule management
   * Reduces API calls and improves performance for account information
   */
  async syncAccountInfoOptimized(
    triggerType: 'cron' | 'manual' = 'manual',
    forceRefresh: boolean = false
  ): Promise<any> {
    let logId: string | null = null;
    
    try {
      const config = await this.getConfig();
      if (!config.apiKey) {
        throw new Error('API key not configured');
      }

      // Check if sync should run based on schedule
      if (triggerType === 'cron' && !forceRefresh) {
        const shouldRun = this.shouldExecuteCronJob(config.cronSettings.accountSyncSchedule);
        if (!shouldRun) {
          console.log('⏭️ Skipping account sync - not yet time for next execution');
          return { skipped: true, reason: 'Schedule not due' };
        }
      }

      // Check if we have recent cached data (< 1 hour old) and don't force refresh
      if (!forceRefresh && config.profile && config.subscription) {
        const lastUpdate = new Date(config.updatedAt);
        const now = new Date();
        const timeSinceUpdate = (now.getTime() - lastUpdate.getTime()) / (1000 * 60); // minutes
        
        if (timeSinceUpdate < 60) { // Less than 1 hour
          console.log(`📋 Using cached account data (${Math.round(timeSinceUpdate)} minutes old)`);
          return {
            profile: config.profile,
            subscription: config.subscription,
            cached: true,
            cacheAge: timeSinceUpdate
          };
        }
      }

      // Start centralized logging
      logId = await cronJobLogger.startExecution({
        cronJobName: `webshare-account-sync-optimized`,
        cronJobType: triggerType === 'cron' ? 'scheduled' : 'manual',
        cronSchedule: triggerType === 'cron' ? `every ${config.cronSettings.accountSyncSchedule.interval}` : undefined,
        triggerType: triggerType === 'cron' ? 'cron' : 'manual',
        triggerSource: triggerType === 'cron' ? 'vercel-cron' : 'manual-button',
        apiSource: 'Webshare API',
        adminId: 'superadmin',
        adminName: 'Super Administrator',
        adminEmail: 'superadmin@system',
        accountName: 'Webshare Proxy Service',
        message: 'Starting optimized Webshare account synchronization',
        details: `Optimized account sync via ${triggerType} trigger`
      });

      console.log('🔄 Fetching fresh account data from Webshare API...');

      // Get profile and subscription information in parallel
      const [profileResponse, subscriptionResponse] = await Promise.all([
        axios.get(`${WEBSHARE_ENDPOINTS.BASE_URL}${WEBSHARE_ENDPOINTS.PROFILE}`, {
          headers: {
            'Authorization': `Token ${config.apiKey}`,
            'Content-Type': 'application/json'
          },
          timeout: config.timeout || 30000
        }),
        axios.get(`${WEBSHARE_ENDPOINTS.BASE_URL}${WEBSHARE_ENDPOINTS.SUBSCRIPTION}`, {
          headers: {
            'Authorization': `Token ${config.apiKey}`,
            'Content-Type': 'application/json'
          },
          timeout: config.timeout || 30000
        })
      ]);

      const profile = profileResponse.data;
      const subscription = subscriptionResponse.data;

      // Update config with account data and schedule info
      await this.updateConfig({
        profile: profile ? {
          id: profile.id || null,
          email: profile.email || null,
          username: profile.username || null,
          first_name: profile.first_name || null,
          last_name: profile.last_name || null,
          created_at: profile.created_at || null,
          last_login: profile.last_login || null,
          timezone: profile.timezone || 'UTC',
          is_verified: profile.is_verified || false
        } : null,
        subscription: subscription.results?.[0] ? {
          id: subscription.results[0].id || null,
          plan_name: subscription.results[0].plan_name || null,
          plan_type: subscription.results[0].plan_type || null,
          proxy_limit: subscription.results[0].proxy_limit || 0,
          bandwidth_limit: subscription.results[0].bandwidth_limit || 0,
          current_usage: {
            proxy_count: subscription.results[0].current_usage?.proxy_count || 0,
            bandwidth_used: subscription.results[0].current_usage?.bandwidth_used || 0,
            requests_made: subscription.results[0].current_usage?.requests_made || 0
          },
          billing: {
            amount: subscription.results[0].billing?.amount || 0,
            currency: subscription.results[0].billing?.currency || 'USD',
            billing_cycle: subscription.results[0].billing?.billing_cycle || 'monthly',
            next_billing_date: subscription.results[0].billing?.next_billing_date || null,
            status: subscription.results[0].billing?.status || 'unknown'
          },
          expires_at: subscription.results[0].expires_at || null,
          auto_renew: subscription.results[0].auto_renew || false
        } : null,
        cronSettings: {
          ...config.cronSettings,
          accountSyncSchedule: {
            ...config.cronSettings.accountSyncSchedule,
            lastSync: new Date().toISOString(),
            nextSync: this.calculateNextExecution(
              config.cronSettings.accountSyncSchedule.interval,
              config.cronSettings.accountSyncSchedule.customInterval
            )
          }
        }
      });

      // Complete centralized logging
      if (logId) {
        await cronJobLogger.completeExecution(logId, {
          status: 'success',
          totalReads: 2, // profile + subscription calls
          totalWrites: 1, // config update
          itemsProcessed: 1,
          message: 'Optimized account sync completed successfully',
          details: `Profile and subscription data synchronized and cached`
        });
      }

      console.log('✅ Account data synchronized and cached successfully');

      return {
        profile,
        subscription,
        cached: false,
        synced: true
      };
    } catch (error: any) {
      console.error('Optimized account sync error:', error);
      
      // Complete centralized logging with error
      if (logId) {
        await cronJobLogger.completeExecution(logId, {
          status: 'failure',
          message: `Optimized account sync failed: ${error.message}`,
          errorDetails: error.message,
          stackTrace: error.stack
        });
      }
      
      throw new Error(`Optimized account sync failed: ${error.message}`);
    }
  }

  /**
   * Get enhanced dashboard data with optimized caching
   * Uses cached data whenever possible to reduce database queries
   */
  async getEnhancedDashboardDataOptimized(): Promise<WebshareDashboardData> {
    try {
      console.log('📊 Loading optimized dashboard data...');
      const startTime = Date.now();
      
      const config = await this.getConfig();
      
      // Use cached proxy statistics first
      let proxyStats = null;
      try {
        const statsDoc = await this.baseRef.collection('metadata').doc('proxy_stats').get();
        if (statsDoc.exists) {
          const stats = statsDoc.data();
          const cacheAge = Date.now() - new Date(stats?.lastUpdated || 0).getTime();
          
          // Use cached stats if they're less than 5 minutes old
          if (cacheAge < 5 * 60 * 1000) {
            proxyStats = stats;
            console.log(`📋 Using cached proxy statistics (${Math.round(cacheAge / 1000)}s old)`);
          }
        }
      } catch (error) {
        console.warn('Error getting cached proxy stats:', error);
      }
      
      // If no cached stats, calculate them quickly
      if (!proxyStats) {
        proxyStats = await this.getProxySummaryFast();
      }
      
      console.log(`✅ Optimized dashboard data loaded in ${Date.now() - startTime}ms`);
      
      return {
        profile: config.profile,
        subscription: config.subscription,
        usageStats: null, // This would require API call, so we'll leave it null for dashboard display
        proxySummary: {
          total: proxyStats.total || 0,
          valid: proxyStats.valid || 0,
          invalid: proxyStats.invalid || 0,
          countries: proxyStats.countries || [],
          avgResponseTime: 0 // This would require real-time testing
        },
        lastUpdated: new Date().toISOString()
      };
    } catch (error) {
      console.error('Error getting optimized dashboard data:', error);
      return {
        profile: null,
        subscription: null,
        usageStats: null,
        proxySummary: {
          total: 0,
          valid: 0,
          invalid: 0,
          countries: [],
          avgResponseTime: 0
        },
        lastUpdated: new Date().toISOString()
      };
    }
  }

  /**
   * Smart cron job scheduler that runs different operations at different intervals
   */
  async runScheduledOperations(operationType: 'all' | 'proxies' | 'account' | 'stats' | 'health' = 'all'): Promise<any> {
    const results: any = {};
    const config = await this.getConfig();
    
    console.log(`🕐 Running scheduled operations: ${operationType}`);
    
    try {
      // Proxy synchronization
      if ((operationType === 'all' || operationType === 'proxies') && config.cronSettings.proxySyncSchedule.enabled) {
        if (this.shouldExecuteCronJob(config.cronSettings.proxySyncSchedule)) {
          console.log('🔄 Running scheduled proxy synchronization...');
          results.proxies = await this.syncProxies('cron');
        }
      }
      
      // Account synchronization
      if ((operationType === 'all' || operationType === 'account') && config.cronSettings.accountSyncSchedule.enabled) {
        if (this.shouldExecuteCronJob(config.cronSettings.accountSyncSchedule)) {
          console.log('👤 Running scheduled account synchronization...');
          results.account = await this.syncAccountInfoOptimized('cron');
        }
      }
      
      // Statistics update
      if ((operationType === 'all' || operationType === 'stats') && config.cronSettings.statsUpdateSchedule.enabled) {
        if (this.shouldExecuteCronJob(config.cronSettings.statsUpdateSchedule)) {
          console.log('📊 Running scheduled statistics update...');
          results.stats = await this.updateProxyStatisticsCache();
        }
      }
      
      // Health check
      if ((operationType === 'all' || operationType === 'health') && config.cronSettings.healthCheckSchedule.enabled) {
        if (this.shouldExecuteCronJob(config.cronSettings.healthCheckSchedule)) {
          console.log('🏥 Running scheduled health check...');
          results.health = await this.performHealthCheck();
        }
      }
      
      console.log('✅ Scheduled operations completed successfully');
      return { success: true, results };
      
    } catch (error: any) {
      console.error('❌ Scheduled operations failed:', error);
      return { success: false, error: error.message, results };
    }
  }

  /**
   * Update proxy statistics cache for better performance
   */
  private async updateProxyStatisticsCache(): Promise<any> {
    try {
      const stats = await this.getProxySummaryFast();
      
      await this.baseRef.collection('metadata').doc('proxy_stats').set({
        ...stats,
        lastUpdated: new Date().toISOString()
      });
      
      return { updated: true, stats };
    } catch (error) {
      console.error('Error updating proxy statistics cache:', error);
      return { updated: false, error: (error as Error).message };
    }
  }

  /**
   * Perform basic health check on proxy system
   */
  private async performHealthCheck(): Promise<any> {
    try {
      const config = await this.getConfig();
      const proxyCount = await this.getProxies(1, 0);
      
      const health = {
        timestamp: new Date().toISOString(),
        configValid: !!config.apiKey,
        proxyCount: proxyCount.total,
        lastSync: config.lastSyncAt,
        status: config.testStatus
      };
      
      await this.baseRef.collection('metadata').doc('health_check').set(health);
      
      return health;
    } catch (error) {
      console.error('Error performing health check:', error);
      return { error: (error as Error).message };
    }
  }

  /**
   * Get proxies from our database with enhanced filtering and performance optimizations
   * This method is specifically optimized for UI loading scenarios
   */
  async getProxiesForUI(options: {
    limit?: number;
    offset?: number;
    countryCode?: string;
    isValid?: boolean;
    searchTerm?: string;
    sortBy?: 'syncedAt' | 'country_code' | 'proxy_address' | 'created_at';
    sortOrder?: 'asc' | 'desc';
  } = {}): Promise<ProxyListResponse> {
    try {
      const {
        limit = 50,
        offset = 0,
        countryCode,
        isValid,
        searchTerm,
        sortBy = 'syncedAt',
        sortOrder = 'desc'
      } = options;

      console.log(`🔄 Loading proxies for UI with options:`, options);
      const startTime = Date.now();
      
      // Build query with filters
      let query: any = this.baseRef.collection('proxies');
      
      // Apply filters
      if (countryCode) {
        query = query.where('country_code', '==', countryCode);
      }
      
      if (isValid !== undefined) {
        query = query.where('valid', '==', isValid);
      }
      
      if (searchTerm) {
        // For search, we'll filter in memory since Firestore doesn't support partial text search
        // This is acceptable for UI use cases where we're loading reasonable amounts of data
      }
      
      // Apply sorting
      query = query.orderBy(sortBy, sortOrder);
      
      // Apply pagination
      query = query.limit(limit).offset(offset);
      
      const proxiesSnapshot = await query.get();
      
      let proxies: WebshareProxy[] = [];
      proxiesSnapshot.forEach((doc: any) => {
        const proxy = { id: doc.id, ...doc.data() } as WebshareProxy;
        
        // Apply search filter if provided
        if (searchTerm) {
          const searchLower = searchTerm.toLowerCase();
          if (
            proxy.proxy_address?.toLowerCase().includes(searchLower) ||
            proxy.country_code?.toLowerCase().includes(searchLower) ||
            proxy.city_name?.toLowerCase().includes(searchLower) ||
            proxy.username?.toLowerCase().includes(searchLower)
          ) {
            proxies.push(proxy);
          }
        } else {
          proxies.push(proxy);
        }
      });
      
      // Get total count efficiently
      let total = 0;
      if (countryCode || isValid !== undefined) {
        // For filtered queries, we need to count
        let countQuery: any = this.baseRef.collection('proxies');
        if (countryCode) {
          countQuery = countQuery.where('country_code', '==', countryCode);
        }
        if (isValid !== undefined) {
          countQuery = countQuery.where('valid', '==', isValid);
        }
        const countSnapshot = await countQuery.get();
        total = countSnapshot.size;
      } else {
        // Use cached total for unfiltered queries
        const metaDoc = await this.baseRef.collection('metadata').doc('proxy_count').get();
        total = metaDoc.exists ? metaDoc.data()?.count || 0 : proxies.length;
      }
      
      console.log(`✅ UI proxy loading completed: ${proxies.length} proxies, total: ${total} in ${Date.now() - startTime}ms`);
      
      return {
        proxies,
        total
      };
    } catch (error) {
      console.error('Error getting proxies for UI:', error);
      return { proxies: [], total: 0 };
    }
  }

  /**
   * Get proxy summary statistics quickly for dashboard display
   */
  async getProxySummaryFast(): Promise<{
    total: number;
    valid: number;
    invalid: number;
    countries: string[];
    lastSyncTime: string | null;
  }> {
    try {
      console.log('📊 Getting fast proxy summary...');
      const startTime = Date.now();
      
      // Try to get cached statistics first
      const statsDoc = await this.baseRef.collection('metadata').doc('proxy_stats').get();
      
      if (statsDoc.exists) {
        const stats = statsDoc.data();
        const cacheAge = Date.now() - new Date(stats?.lastUpdated || 0).getTime();
        
        // Use cached stats if they're less than 5 minutes old
        if (cacheAge < 5 * 60 * 1000) {
          console.log(`✅ Using cached proxy summary (${Math.round(cacheAge / 1000)}s old)`);
          return {
            total: stats?.total || 0,
            valid: stats?.valid || 0,
            invalid: stats?.invalid || 0,
            countries: stats?.countries || [],
            lastSyncTime: stats?.lastSyncTime || null
          };
        }
      }
      
      // Calculate fresh statistics with efficient sampling
      const sampleSize = 200; // Use a sample for quick statistics
      const proxySnapshot = await this.baseRef
        .collection('proxies')
        .orderBy('syncedAt', 'desc')
        .limit(sampleSize)
        .get();
      
      let validCount = 0;
      const countries = new Set<string>();
      
      proxySnapshot.forEach((doc: any) => {
        const proxy = doc.data() as WebshareProxy;
        if (proxy.valid) validCount++;
        if (proxy.country_code) countries.add(proxy.country_code);
      });
      
      // Get total count from cache
      const metaDoc = await this.baseRef.collection('metadata').doc('proxy_count').get();
      const total = metaDoc.exists ? metaDoc.data()?.count || 0 : proxySnapshot.size;
      
      // Estimate statistics based on sample
      const sampleRatio = proxySnapshot.size > 0 ? proxySnapshot.size / total : 1;
      const estimatedValid = Math.round(validCount / sampleRatio);
      
      const config = await this.getConfig();
      
      const summary = {
        total,
        valid: estimatedValid,
        invalid: total - estimatedValid,
        countries: Array.from(countries),
        lastSyncTime: config.lastSyncAt
      };
      
      // Cache the statistics for future use
      await this.baseRef.collection('metadata').doc('proxy_stats').set({
        ...summary,
        lastUpdated: new Date().toISOString()
      });
      
      console.log(`✅ Fresh proxy summary calculated in ${Date.now() - startTime}ms`);
      return summary;
    } catch (error) {
      console.error('Error getting proxy summary:', error);
      return {
        total: 0,
        valid: 0,
        invalid: 0,
        countries: [],
        lastSyncTime: null
      };
    }
  }

  /**
   * Enhanced cron schedule management utilities
   */
  private getIntervalInMinutes(interval: 'hourly' | '3hours' | '6hours' | '24hours' | 'custom', customInterval?: number): number {
    switch (interval) {
      case 'hourly': return 60;
      case '3hours': return 180;
      case '6hours': return 360;
      case '24hours': return 1440;
      case 'custom': return customInterval || 60;
      default: return 60;
    }
  }

  private calculateNextExecution(interval: 'hourly' | '3hours' | '6hours' | '24hours' | 'custom', customInterval?: number): string {
    const minutes = this.getIntervalInMinutes(interval, customInterval);
    const next = new Date();
    next.setMinutes(next.getMinutes() + minutes);
    return next.toISOString();
  }

  private shouldExecuteCronJob(schedule: any): boolean {
    if (!schedule.enabled || !schedule.lastSync) return true;
    
    const lastSync = new Date(schedule.lastSync);
    const now = new Date();
    const intervalMinutes = this.getIntervalInMinutes(schedule.interval, schedule.customInterval);
    const timeSinceLastSync = (now.getTime() - lastSync.getTime()) / (1000 * 60);
    
    return timeSinceLastSync >= intervalMinutes;
  }

  /**
   * Check if auto-sync should be performed based on schedule
   */
  async shouldPerformAutoSync(): Promise<boolean> {
    try {
      const config = await this.getConfig();
      
      // Check if proxy sync is enabled and due
      if (config.cronSettings.proxySyncSchedule.enabled) {
        return this.shouldExecuteCronJob(config.cronSettings.proxySyncSchedule);
      }
      
      return false;
    } catch (error) {
      console.error('Error checking auto-sync schedule:', error);
      return false;
    }
  }

  /**
   * Perform automatic sync triggered by cron
   */
  async performAutoSync(): Promise<WebshareSyncJob> {
    try {
      console.log('🕐 Performing automatic Webshare proxy sync...');
      
      // Use the optimized sync method
      const result = await this.syncProxies('cron');
      
      console.log('✅ Automatic sync completed:', {
        proxiesAdded: result.proxiesAdded,
        proxiesUpdated: result.proxiesUpdated,
        proxiesRemoved: result.proxiesRemoved,
        status: result.status
      });
      
      return result;
    } catch (error: any) {
      console.error('❌ Automatic sync failed:', error);
      throw error;
    }
  }

  /**
   * Make an HTTP request through a Webshare proxy
   */
  async makeRequest(options: {
    url: string;
    method: 'GET' | 'POST' | 'PUT' | 'DELETE';
    headers?: Record<string, string>;
    data?: string;
    timeout?: number;
  }): Promise<{
    success: boolean;
    data?: any;
    statusCode?: number;
    proxyUsed?: string;
    error?: string;
  }> {
    try {
      console.log(`🌐 Making ${options.method} request to ${options.url} through Webshare proxy...`);
      
      // Get a random proxy from our database
      const proxies = await this.getProxies(1, 0);
      if (!proxies.proxies || proxies.proxies.length === 0) {
        throw new Error('No proxies available for API request');
      }
      
      const proxy = proxies.proxies[0];
      console.log(`🔄 Using proxy: ${proxy.proxy_address}:${proxy.port} (${proxy.country_code})`);
      
      // Import axios dynamically to avoid server-side issues
      const axios = (await import('axios')).default;
      const HttpsProxyAgent = (await import('https-proxy-agent')).HttpsProxyAgent;
      
      // Create proxy agent
      const proxyUrl = `http://${proxy.username}:${proxy.password}@${proxy.proxy_address}:${proxy.port}`;
      const httpsAgent = new HttpsProxyAgent(proxyUrl);
      
      // Make the request
      const response = await axios({
        method: options.method,
        url: options.url,
        headers: options.headers || {},
        data: options.data,
        timeout: options.timeout || 30000,
        httpsAgent,
        validateStatus: () => true // Don't throw on HTTP errors
      });
      
      console.log(`✅ Request successful via proxy ${proxy.proxy_address}:${proxy.port}, status: ${response.status}`);
      
      return {
        success: response.status >= 200 && response.status < 300,
        data: response.data,
        statusCode: response.status,
        proxyUsed: `${proxy.proxy_address}:${proxy.port}`,
        error: response.status >= 400 ? `HTTP ${response.status}` : undefined
      };
      
    } catch (error: any) {
      console.error('❌ Proxy request failed:', error.message);
      
      return {
        success: false,
        error: error.message || 'Proxy request failed',
        statusCode: 0
      };
    }
  }
}

export const webshareService = WebshareService.getInstance();