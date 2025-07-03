// WebShare Service - Basic working version
import { dbAdmin } from '@/lib/firebase/firebaseAdmin';
import axios from 'axios';
import { 
  WebshareConfig, 
  WebshareProxy, 
  WebshareDashboardData, 
  WebshareSyncJob, 
  SystemStatus,
  ProxyListResponse,
  TestResult 
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

  async getProxies(limit: number = 50, offset: number = 0): Promise<ProxyListResponse> {
    try {
      console.log(`🔄 Getting ${limit} proxies starting from offset ${offset}...`);
      const startTime = Date.now();
      
      const proxiesSnapshot = await this.baseRef
        .collection('proxies')
        .limit(limit)
        .offset(offset)
        .get();

      const proxies: WebshareProxy[] = [];
      proxiesSnapshot.forEach(doc => {
        proxies.push({ id: doc.id, ...doc.data() } as WebshareProxy);
      });

      console.log(`📦 Retrieved ${proxies.length} proxy documents in ${Date.now() - startTime}ms`);

      // Use a more efficient method to get total count
      // Always try to get cached count first to avoid expensive queries
      let total = proxies.length;
      
      try {
        const metaDoc = await this.baseRef.collection('metadata').doc('proxy_count').get();
        if (metaDoc.exists && metaDoc.data()?.count) {
          total = metaDoc.data()!.count;
          console.log(`📊 Using cached proxy count: ${total}`);
        } else {
          console.log(`⚠️  No cached count found, using current batch size: ${proxies.length}`);
          // Only perform expensive count operation if we absolutely must
          if (limit >= 10000) {
            console.log(`🔄 Performing full count for large limit request...`);
            const totalSnapshot = await this.baseRef.collection('proxies').get();
            total = totalSnapshot.size;
            
            // Cache the count for future use
            await this.baseRef.collection('metadata').doc('proxy_count').set({
              count: total,
              lastUpdated: new Date().toISOString()
            });
            console.log(`📊 Cached proxy count: ${total}`);
          }
        }
      } catch (error) {
        console.warn('Error getting cached proxy count, using current batch size:', error);
        total = proxies.length;
      }
      
      console.log(`✅ getProxies completed: ${proxies.length} proxies, total: ${total} in ${Date.now() - startTime}ms`);
      
      return {
        proxies,
        total
      };
    } catch (error) {
      console.error('Error getting proxies:', error);
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

  async syncProxies(): Promise<WebshareSyncJob> {
    const syncJob: WebshareSyncJob = {
      id: Date.now().toString(),
      status: 'started',
      startTime: new Date().toISOString(),
      proxiesAdded: 0,
      proxiesUpdated: 0,
      proxiesRemoved: 0,
      totalProxies: 0
    };

    try {
      const config = await this.getConfig();
      if (!config.apiKey) {
        throw new Error('API key not configured');
      }

      // Save the started sync job
      await this.saveSyncJob(syncJob);

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
      
      // Save completed sync job
      await this.saveSyncJob(syncJob);
      
      return syncJob;
    } catch (error: any) {
      console.error('Proxy sync failed:', error);
      syncJob.status = 'failed';
      syncJob.error = error.message;
      syncJob.endTime = new Date().toISOString();
      
      // Save failed sync job
      await this.saveSyncJob(syncJob);
      
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

  async syncAccountInfo(): Promise<any> {
    try {
      const config = await this.getConfig();
      if (!config.apiKey) {
        throw new Error('API key not configured');
      }

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

      return {
        profile,
        subscription,
        synced: true
      };
    } catch (error: any) {
      console.error('Account sync error:', error);
      throw new Error(`Account sync failed: ${error.message}`);
    }
  }

  async syncAllData(): Promise<any> {
    try {
      const proxySync = await this.syncProxies();
      const accountSync = await this.syncAccountInfo();

      return {
        proxies: proxySync,
        account: accountSync,
        completed: true
      };
    } catch (error: any) {
      throw new Error(`Full sync failed: ${error.message}`);
    }
  }

  async getEnhancedDashboardData(): Promise<WebshareDashboardData> {
    try {
      const config = await this.getConfig();
      
      // Get a reasonable sample of proxies for statistics (don't fetch all)
      const sampleSize = 200; // Use a smaller sample for faster loading
      const proxiesData = await this.getProxies(sampleSize, 0);
      const totalProxies = proxiesData.total; // This uses the cached count
      
      // Calculate valid/invalid based on sample, but scale to total
      const validRatio = proxiesData.proxies.length > 0 ? 
        proxiesData.proxies.filter(p => p.valid).length / proxiesData.proxies.length : 1;
      const estimatedValid = Math.round(totalProxies * validRatio);
      const estimatedInvalid = totalProxies - estimatedValid;

      return {
        profile: config.profile,
        subscription: config.subscription,
        usageStats: null,
        proxySummary: {
          total: totalProxies,
          valid: estimatedValid,
          invalid: estimatedInvalid,
          countries: [...new Set(proxiesData.proxies.map(p => p.country_code))],
          avgResponseTime: 0
        },
        lastUpdated: new Date().toISOString()
      };
    } catch (error) {
      console.error('Error getting dashboard data:', error);
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

  async getSystemStatus(): Promise<SystemStatus> {
    try {
      const config = await this.getConfig();
      const proxies = await this.getProxies(1, 0);

      return {
        isConfigured: !!config.apiKey,
        isEnabled: config.isEnabled,
        testStatus: config.testStatus,
        lastSync: config.lastSyncAt,
        totalProxies: proxies.total,
        lastSyncJob: null
      };
    } catch (error) {
      console.error('Error getting system status:', error);
      return {
        isConfigured: false,
        isEnabled: false,
        testStatus: 'failed',
        lastSync: null,
        totalProxies: 0,
        lastSyncJob: null
      };
    }
  }

  async getAutoSyncStatus(): Promise<any> {
    try {
      const config = await this.getConfig();
      return {
        enabled: config.autoSyncEnabled,
        interval: config.autoSyncInterval,
        lastSync: config.lastAutoSyncAt
      };
    } catch (error) {
      return {
        enabled: false,
        interval: 60,
        lastSync: null
      };
    }
  }

  async performAutoSync(): Promise<any> {
    return await this.syncAllData();
  }

  async getSyncJobs(): Promise<WebshareSyncJob[]> {
    try {
      const syncJobsSnapshot = await this.baseRef.collection('sync_jobs').orderBy('startTime', 'desc').limit(10).get();
      const syncJobs: WebshareSyncJob[] = [];
      
      syncJobsSnapshot.forEach(doc => {
        syncJobs.push({ id: doc.id, ...doc.data() } as WebshareSyncJob);
      });
      
      return syncJobs;
    } catch (error) {
      console.error('Error getting sync jobs:', error);
      return [];
    }
  }

  async saveSyncJob(syncJob: WebshareSyncJob): Promise<void> {
    try {
      await this.baseRef.collection('sync_jobs').doc(syncJob.id).set(syncJob);
    } catch (error) {
      console.error('Error saving sync job:', error);
    }
  }

  async saveDashboardData(data: any): Promise<void> {
    try {
      const now = new Date().toISOString();
      await this.baseRef.collection('websharedata').doc('dashboard').set({
        ...data,
        lastUpdated: now,
        updatedAt: now
      });
      console.log('Dashboard data saved successfully');
    } catch (error) {
      console.error('Error saving dashboard data:', error);
    }
  }

  async getDashboardData(): Promise<any> {
    try {
      const dashboardDoc = await this.baseRef.collection('websharedata').doc('dashboard').get();
      if (dashboardDoc.exists) {
        return dashboardDoc.data();
      }
      return null;
    } catch (error) {
      console.error('Error getting dashboard data:', error);
      return null;
    }
  }

  // Get proxy configuration including download token
  async getProxyConfig(): Promise<any> {
    try {
      const config = await this.getConfig();
      if (!config.apiKey) {
        throw new Error('API key not configured');
      }

      const response = await axios.get(`${WEBSHARE_ENDPOINTS.BASE_URL}${WEBSHARE_ENDPOINTS.PROXY_CONFIG}`, {
        headers: {
          'Authorization': `Token ${config.apiKey}`,
          'Content-Type': 'application/json'
        },
        timeout: config.timeout || 30000
      });

      return response.data;
    } catch (error: any) {
      console.error('Error getting proxy config:', error);
      throw new Error(`Failed to get proxy config: ${error.message}`);
    }
  }

  // Download proxy list as formatted text file
  async downloadProxyList(options: {
    token?: string;
    countryCodes?: string;
    authMethod?: 'username' | 'sourceip';
    endpointMode?: 'direct' | 'backbone';
    search?: string;
    planId?: string;
  } = {}): Promise<string> {
    try {
      const config = await this.getConfig();
      
      // Get download token if not provided
      let downloadToken = options.token;
      if (!downloadToken) {
        const proxyConfig = await this.getProxyConfig();
        downloadToken = proxyConfig.proxy_list_download_token;
      }

      if (!downloadToken) {
        throw new Error('No download token available');
      }

      // Build download URL
      const countryCodes = options.countryCodes || '-';
      const authMethod = options.authMethod || 'username';
      const endpointMode = options.endpointMode || 'direct';
      const search = options.search || '-';
      
      let downloadUrl = `${WEBSHARE_ENDPOINTS.BASE_URL}/proxy/list/download/${downloadToken}/${countryCodes}/any/${authMethod}/${endpointMode}/${search}/`;
      
      if (options.planId) {
        downloadUrl += `?plan_id=${options.planId}`;
      }

      const response = await axios.get(downloadUrl, {
        timeout: config.timeout || 30000
      });

      return response.data;
    } catch (error: any) {
      console.error('Error downloading proxy list:', error);
      throw new Error(`Failed to download proxy list: ${error.message}`);
    }
  }

  // Refresh proxy list on-demand (requires available refreshes)
  async refreshProxyList(planId?: string): Promise<any> {
    try {
      const config = await this.getConfig();
      if (!config.apiKey) {
        throw new Error('API key not configured');
      }

      let refreshUrl = `${WEBSHARE_ENDPOINTS.BASE_URL}${WEBSHARE_ENDPOINTS.PROXY_REFRESH}`;
      if (planId) {
        refreshUrl += `?plan_id=${planId}`;
      }

      const response = await axios.post(refreshUrl, {}, {
        headers: {
          'Authorization': `Token ${config.apiKey}`,
          'Content-Type': 'application/json'
        },
        timeout: config.timeout || 30000
      });

      // API returns 204 No Content on success
      if (response.status === 204) {
        console.log('Proxy list refresh initiated successfully');
        
        // Update last refresh time in config
        await this.updateConfig({
          lastProxyRefresh: new Date().toISOString()
        });

        return {
          success: true,
          message: 'Proxy list refresh initiated',
          refreshedAt: new Date().toISOString()
        };
      }

      return response.data;
    } catch (error: any) {
      console.error('Error refreshing proxy list:', error);
      
      // Handle specific error messages
      if (error.response?.status === 429) {
        throw new Error('Rate limit exceeded. Please wait before requesting another refresh.');
      } else if (error.response?.status === 403) {
        throw new Error('No on-demand refreshes available for your plan.');
      }
      
      throw new Error(`Failed to refresh proxy list: ${error.message}`);
    }
  }

  // Enhanced sync with refresh option
  async syncProxiesWithRefresh(shouldRefresh: boolean = false): Promise<WebshareSyncJob> {
    const syncJob: WebshareSyncJob = {
      id: Date.now().toString(),
      status: 'started',
      startTime: new Date().toISOString(),
      proxiesAdded: 0,
      proxiesUpdated: 0,
      proxiesRemoved: 0,
      totalProxies: 0
    };

    try {
      // Optionally refresh the proxy list first
      if (shouldRefresh) {
        console.log('Refreshing proxy list before sync...');
        await this.refreshProxyList();
        
        // Wait a bit for the refresh to take effect
        await new Promise(resolve => setTimeout(resolve, 2000));
      }

      // Perform normal sync
      return await this.syncProxies();
    } catch (error: any) {
      console.error('Enhanced proxy sync failed:', error);
      syncJob.status = 'failed';
      syncJob.error = error.message;
      syncJob.endTime = new Date().toISOString();
      
      await this.saveSyncJob(syncJob);
      return syncJob;
    }
  }

  // Get comprehensive proxy statistics
  async getProxyStatistics(): Promise<any> {
    try {
      // Get total count first
      const totalSnapshot = await this.baseRef.collection('proxies').get();
      const totalProxies = totalSnapshot.size;
      
      // For statistics, we need all proxies to get accurate data
      const proxies = await this.getProxies(totalProxies || 10000, 0);
      
      const stats = {
        total: totalProxies, // Use actual count from snapshot
        valid: proxies.proxies.filter(p => p.valid).length,
        invalid: proxies.proxies.filter(p => !p.valid).length,
        countries: [...new Set(proxies.proxies.map(p => p.country_code))],
        cities: [...new Set(proxies.proxies.map(p => p.city_name))],
        types: [...new Set(proxies.proxies.map(p => p.proxy_type))],
        countryBreakdown: {},
        typeBreakdown: {},
        lastSyncedProxies: proxies.proxies
          .filter(p => p.syncedAt)
          .sort((a, b) => new Date(b.syncedAt).getTime() - new Date(a.syncedAt).getTime())
          .slice(0, 10)
      };

      // Country breakdown
      stats.countryBreakdown = proxies.proxies.reduce((acc: any, proxy) => {
        const country = proxy.country_code;
        acc[country] = (acc[country] || 0) + 1;
        return acc;
      }, {});

      // Type breakdown
      stats.typeBreakdown = proxies.proxies.reduce((acc: any, proxy) => {
        const type = proxy.proxy_type;
        acc[type] = (acc[type] || 0) + 1;
        return acc;
      }, {});

      console.log(`Proxy Statistics: ${stats.total} total, ${stats.valid} valid, ${stats.invalid} invalid`);

      return stats;
    } catch (error: any) {
      console.error('Error getting proxy statistics:', error);
      return {
        total: 0,
        valid: 0,
        invalid: 0,
        countries: [],
        cities: [],
        types: [],
        countryBreakdown: {},
        typeBreakdown: {},
        lastSyncedProxies: []
      };
    }
  }

  /**
   * Make HTTP request through Webshare proxy
   * This is the core method that routes external HTTP requests through available proxies
   * Supports both client-side (browser) and server-side (Node.js) environments
   */
  async makeRequest(config: {
    url: string;
    method?: 'GET' | 'POST' | 'PUT' | 'DELETE';
    headers?: Record<string, string>;
    data?: any;
    timeout?: number;
    retries?: number;
  }): Promise<{
    success: boolean;
    data?: any;
    error?: string;
    statusCode?: number;
    proxyUsed?: string;
    responseTime?: number;
  }> {
    const startTime = Date.now();
    const maxRetries = config.retries || 3;
    let lastError: string = '';

    // Check if we're running in a server environment
    const isServerSide = typeof window === 'undefined';

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        console.log(`[WebshareService] Making ${config.method || 'GET'} request to ${config.url} (attempt ${attempt}/${maxRetries})`);
        
        // Get optimal proxy for the request
        const proxy = await this.getOptimalProxy();
        if (!proxy) {
          return {
            success: false,
            error: 'No available proxies found',
            responseTime: Date.now() - startTime
          };
        }

        console.log(`[WebshareService] Using proxy: ${proxy.proxy_address}:${proxy.port} (${proxy.country_code})`);

        let result: any;
        
        if (isServerSide) {
          // Server-side: Use direct proxy implementation
          result = await this.makeServerSideProxyRequest(config, proxy);
        } else {
          // Client-side: Use /api/proxy-request endpoint
          const response = await fetch('/api/proxy-request', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              url: config.url,
              method: config.method || 'GET',
              headers: config.headers || {},
              data: config.data,
              timeout: config.timeout || 30000,
              proxy: {
                host: proxy.proxy_address,
                port: proxy.port,
                username: proxy.username,
                password: proxy.password
              }
            })
          });

          result = await response.json();
        }

        const responseTime = Date.now() - startTime;

        if (result.success) {
          // Log successful usage
          await this.logProxyUsage(proxy.id, 'success', responseTime);
          
          return {
            success: true,
            data: result.data,
            statusCode: result.statusCode,
            proxyUsed: `${proxy.proxy_address}:${proxy.port}`,
            responseTime
          };
        } else {
          lastError = result.error || 'Proxy request failed';
          console.warn(`[WebshareService] Proxy request failed (attempt ${attempt}): ${lastError}`);
          
          // Log failed usage
          await this.logProxyUsage(proxy.id, 'failed', responseTime, lastError);
          
          // Mark proxy as potentially problematic if multiple failures
          if (attempt >= 2) {
            await this.markProxyProblem(proxy.id, lastError);
          }
        }
      } catch (error: any) {
        lastError = error.message || 'Request failed';
        console.error(`[WebshareService] Request error (attempt ${attempt}):`, lastError);
      }

      // Wait before retry (exponential backoff)
      if (attempt < maxRetries) {
        const delay = Math.min(1000 * Math.pow(2, attempt - 1), 5000);
        console.log(`[WebshareService] Waiting ${delay}ms before retry...`);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }

    return {
      success: false,
      error: `All ${maxRetries} attempts failed. Last error: ${lastError}`,
      responseTime: Date.now() - startTime
    };
  }

  /**
   * Get optimal proxy for the request
   * Implements intelligent proxy selection based on health, usage, and geographic preferences
   */
  private async getOptimalProxy(): Promise<WebshareProxy | null> {
    try {
      // Get available proxies (prioritize valid ones)
      const proxiesData = await this.getProxies(100, 0); // Get first 100 proxies
      const availableProxies = proxiesData.proxies.filter(proxy => 
        proxy.valid && 
        proxy.proxy_address && 
        proxy.port && 
        proxy.username && 
        proxy.password
      );

      if (availableProxies.length === 0) {
        console.warn('[WebshareService] No valid proxies available');
        return null;
      }

      // Prefer South African proxies for Takealot (if available)
      const southAfricanProxies = availableProxies.filter(p => p.country_code === 'ZA');
      
      // Use round-robin selection (you can implement more sophisticated logic here)
      const targetProxies = southAfricanProxies.length > 0 ? southAfricanProxies : availableProxies;
      
      // Simple round-robin selection based on timestamp
      const index = Math.floor(Date.now() / 10000) % targetProxies.length;
      const selectedProxy = targetProxies[index];

      console.log(`[WebshareService] Selected proxy: ${selectedProxy.proxy_address}:${selectedProxy.port} (${selectedProxy.country_code})`);
      return selectedProxy;
    } catch (error) {
      console.error('[WebshareService] Error selecting optimal proxy:', error);
      return null;
    }
  }

  /**
   * Log proxy usage statistics
   */
  private async logProxyUsage(proxyId: string, status: 'success' | 'failed', responseTime: number, error?: string): Promise<void> {
    try {
      const usageLog = {
        proxyId,
        status,
        responseTime,
        error: error || null,
        timestamp: new Date().toISOString(),
        url: 'takealot-api', // Generalized for privacy
      };

      // Save to usage logs collection
      await this.baseRef.collection('usage_logs').add(usageLog);
      
      // Update proxy statistics
      const proxyRef = this.baseRef.collection('proxies').doc(proxyId);
      const proxyDoc = await proxyRef.get();
      
      if (proxyDoc.exists) {
        const currentStats = proxyDoc.data()?.stats || {};
        const newStats = {
          ...currentStats,
          totalRequests: (currentStats.totalRequests || 0) + 1,
          successfulRequests: status === 'success' ? (currentStats.successfulRequests || 0) + 1 : (currentStats.successfulRequests || 0),
          failedRequests: status === 'failed' ? (currentStats.failedRequests || 0) + 1 : (currentStats.failedRequests || 0),
          avgResponseTime: currentStats.avgResponseTime ? 
            ((currentStats.avgResponseTime * (currentStats.totalRequests || 0)) + responseTime) / ((currentStats.totalRequests || 0) + 1) :
            responseTime,
          lastUsed: new Date().toISOString()
        };

        await proxyRef.update({ stats: newStats });
      }
    } catch (error) {
      console.error('[WebshareService] Error logging proxy usage:', error);
      // Don't throw - we don't want logging errors to break the main request
    }
  }

  /**
   * Mark proxy as having problems for future selection optimization
   */
  private async markProxyProblem(proxyId: string, error: string): Promise<void> {
    try {
      const proxyRef = this.baseRef.collection('proxies').doc(proxyId);
      const proxyDoc = await proxyRef.get();
      
      if (proxyDoc.exists) {
        const currentProblems = proxyDoc.data()?.problems || [];
        const newProblem = {
          error,
          timestamp: new Date().toISOString(),
          severity: 'warning'
        };

        // Keep only last 10 problems
        const updatedProblems = [newProblem, ...currentProblems].slice(0, 10);
        
        await proxyRef.update({ 
          problems: updatedProblems,
          lastProblem: new Date().toISOString()
        });
      }
    } catch (error) {
      console.error('[WebshareService] Error marking proxy problem:', error);
    }
  }

  /**
   * Make server-side proxy request using Node.js HTTP agents
   * This is used when running in server environment (API routes, cron jobs)
   */
  private async makeServerSideProxyRequest(config: {
    url: string;
    method?: 'GET' | 'POST' | 'PUT' | 'DELETE';
    headers?: Record<string, string>;
    data?: any;
    timeout?: number;
  }, proxy: WebshareProxy): Promise<{
    success: boolean;
    data?: any;
    error?: string;
    statusCode?: number;
  }> {
    try {
      // Import required modules dynamically for server-side only
      const { HttpsProxyAgent } = await import('https-proxy-agent');
      const { HttpProxyAgent } = await import('http-proxy-agent');
      const https = await import('https');
      const http = await import('http');
      
      // Create proxy URL with authentication
      const proxyUrl = `http://${proxy.username}:${proxy.password}@${proxy.proxy_address}:${proxy.port}`;
      
      // Determine if we need HTTP or HTTPS proxy agent
      const isHttps = config.url.startsWith('https://');
      const agent = isHttps ? new HttpsProxyAgent(proxyUrl) : new HttpProxyAgent(proxyUrl);
      
      // Prepare request options
      const requestOptions = {
        method: config.method || 'GET',
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          ...config.headers
        },
        body: config.data ? JSON.stringify(config.data) : undefined,
        agent,
        timeout: config.timeout || 30000
      };

      console.log(`[WebshareService] Making server-side ${config.method || 'GET'} request to ${config.url} via proxy ${proxy.proxy_address}:${proxy.port}`);
      
      // Make the request using node-fetch equivalent
      const fetch = (await import('node-fetch')).default;
      const response = await fetch(config.url, requestOptions);
      
      // Parse response
      let responseData: any;
      const contentType = response.headers.get('content-type') || '';
      
      if (contentType.includes('application/json')) {
        responseData = await response.json();
      } else {
        responseData = await response.text();
      }

      console.log(`[WebshareService] Server-side request completed with status ${response.status}`);

      return {
        success: response.ok,
        data: responseData,
        statusCode: response.status,
        error: response.ok ? undefined : `HTTP ${response.status}: ${response.statusText}`
      };

    } catch (error: any) {
      console.error('[WebshareService] Server-side proxy request failed:', error);
      return {
        success: false,
        error: error.message || 'Server-side proxy request failed',
        statusCode: 0
      };
    }
  }
}

export const webshareService = WebshareService.getInstance();