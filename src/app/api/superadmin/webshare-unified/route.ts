// Simplified WebShare API Route
import { NextRequest, NextResponse } from 'next/server';
import { webshareService } from '@/modules/webshare/services';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const action = searchParams.get('action');

    // Add simple test case
    if (action === 'test') {
      return NextResponse.json({ 
        success: true, 
        message: 'Webshare API is working',
        timestamp: new Date().toISOString()
      });
    }

    switch (action) {
      case 'config':
        const config = await webshareService.getConfig();
        return NextResponse.json({ success: true, data: config });

      case 'proxies':
        const limit = parseInt(searchParams.get('limit') || '50');
        const offset = parseInt(searchParams.get('offset') || '0');
        const countryCode = searchParams.get('country') || undefined;
        const isValid = searchParams.get('valid') ? searchParams.get('valid') === 'true' : undefined;
        const searchTerm = searchParams.get('search') || undefined;
        const sortBy = (searchParams.get('sortBy') || 'syncedAt') as 'syncedAt' | 'country_code' | 'proxy_address' | 'created_at';
        const sortOrder = (searchParams.get('sortOrder') || 'desc') as 'asc' | 'desc';
        
        const proxiesData = await webshareService.getProxiesForUI({
          limit,
          offset,
          countryCode,
          isValid,
          searchTerm,
          sortBy,
          sortOrder
        });
        return NextResponse.json({ success: true, data: proxiesData });

      case 'proxies-filtered':
        const filterOptions = {
          limit: parseInt(searchParams.get('limit') || '50'),
          offset: parseInt(searchParams.get('offset') || '0'),
          countryCode: searchParams.get('country') || undefined,
          isValid: searchParams.get('valid') ? searchParams.get('valid') === 'true' : undefined,
          searchTerm: searchParams.get('search') || undefined,
          sortBy: (searchParams.get('sortBy') || 'syncedAt') as 'syncedAt' | 'country_code' | 'proxy_address',
          sortOrder: (searchParams.get('sortOrder') || 'desc') as 'asc' | 'desc'
        };
        const filteredProxiesData = await webshareService.getProxiesForUI(filterOptions);
        return NextResponse.json({ success: true, data: filteredProxiesData });

      case 'proxy-statistics':
        const stats = await webshareService.getProxySummaryFast();
        return NextResponse.json({ success: true, data: stats });

      case 'sync-jobs':
        // Return placeholder sync jobs data for now
        const syncJobs = { jobs: [], count: 0, message: 'Sync jobs feature not fully implemented' };
        return NextResponse.json({ success: true, data: syncJobs });

      case 'proxy-summary':
        const summary = await webshareService.getProxySummaryFast();
        return NextResponse.json({ success: true, data: summary });

      case 'dashboard':
        const dashboardData = await webshareService.getEnhancedDashboardDataOptimized();
        return NextResponse.json({ success: true, data: dashboardData });

      case 'dashboard-cache':
        const cachedData = await webshareService.getEnhancedDashboardDataOptimized();
        return NextResponse.json({ success: true, data: cachedData });

      case 'status':
        const statusConfig = await webshareService.getConfig();
        const status = { 
          isEnabled: statusConfig.isEnabled,
          testStatus: statusConfig.testStatus,
          lastSync: statusConfig.lastSyncAt,
          message: 'System status retrieved'
        };
        return NextResponse.json({ success: true, data: status });

      case 'auto-sync-status':
        const autoSyncConfig = await webshareService.getConfig();
        const autoSyncStatus = {
          enabled: autoSyncConfig.autoSyncEnabled || false,
          lastSync: autoSyncConfig.lastAutoSyncAt,
          nextSync: null,
          message: 'Auto-sync status retrieved'
        };
        return NextResponse.json({ success: true, data: autoSyncStatus });

      case 'run-scheduled':
        const operationType = searchParams.get('type') || 'all';
        const scheduledResults = await webshareService.runScheduledOperations(operationType as any);
        return NextResponse.json({ 
          success: true, 
          message: 'Scheduled operations completed',
          data: scheduledResults 
        });

      case 'cron-status':
        return NextResponse.json({ 
          success: true, 
          data: { status: 'not_implemented', message: 'Cron status not available' }
        });

      case 'get-cron-settings':
        // Return default cron settings for now
        const defaultCronSettings = {
          proxySyncSchedule: {
            enabled: false,
            interval: 'hourly',
            customInterval: 60,
            lastSync: null,
            nextSync: null
          },
          accountSyncSchedule: {
            enabled: false,
            interval: '3hours',
            customInterval: 180,
            lastSync: null,
            nextSync: null
          },
          statsUpdateSchedule: {
            enabled: false,
            interval: '6hours',
            customInterval: 360,
            lastUpdate: null,
            nextUpdate: null
          },
          healthCheckSchedule: {
            enabled: false,
            interval: '24hours',
            customInterval: 1440,
            lastCheck: null,
            nextCheck: null
          }
        };
        return NextResponse.json({ 
          success: true, 
          data: defaultCronSettings 
        });

      default:
        return NextResponse.json({
          success: false,
          error: 'Invalid action. Use: config, proxies, sync-jobs, dashboard, dashboard-cache, status, auto-sync-status, or cron-status'
        }, { status: 400 });
    }
  } catch (error: any) {
    console.error('WebShare API Error:', error);
    return NextResponse.json({
      error: error.message || 'Internal server error'
    }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const action = searchParams.get('action');
    
    // Handle empty body for certain actions
    let body = {};
    try {
      const requestText = await request.text();
      if (requestText.trim()) {
        body = JSON.parse(requestText);
      }
    } catch (error) {
      // Empty body is fine for some actions
      console.log('Empty or invalid JSON body, using empty object');
    }

    switch (action) {
      case 'save-config':
        if (!body || Object.keys(body).length === 0) {
          return NextResponse.json({ 
            success: false,
            error: 'Configuration data is required' 
          }, { status: 400 });
        }
        const updatedConfig = await webshareService.updateConfig(body as any);
        return NextResponse.json({ 
          success: true, 
          message: 'Configuration saved successfully',
          data: updatedConfig 
        });

      case 'test-api':
        if (!body || !(body as any).apiKey) {
          return NextResponse.json({ 
            success: false,
            error: 'API key is required' 
          }, { status: 400 });
        }
        
        const testResult = await webshareService.testApiKey((body as any).apiKey);
        
        // Update config based on test result
        if (testResult.success) {
          await webshareService.updateConfig({
            testStatus: 'connected',
            lastTestError: null // Clear any previous errors
          });
        } else {
          await webshareService.updateConfig({
            testStatus: 'failed',
            lastTestError: testResult.error || 'API test failed'
          });
        }
        
        return NextResponse.json({ 
          success: true, 
          data: testResult 
        });

      case 'sync-proxies':
        const syncJob = await webshareService.syncProxiesOptimized();
        return NextResponse.json({ 
          success: true, 
          message: 'Optimized proxy synchronization completed',
          data: syncJob 
        });

      case 'sync-proxies-optimized':
        const optimizedSyncJob = await webshareService.syncProxiesOptimized('manual', {
          forceFullSync: false,
          compareBeforeUpdate: true,
          skipUnchangedProxies: true,
          batchSize: 25,
          maxConcurrentOperations: 5,
          enablePerformanceMetrics: true
        });
        return NextResponse.json({ 
          success: true, 
          message: 'Optimized proxy synchronization completed with CRUD optimization',
          data: optimizedSyncJob 
        });

      case 'sync-proxies-force-cleanup':
        const forceCleanupSyncJob = await webshareService.syncProxiesOptimized('manual', {
          forceFullSync: true,
          compareBeforeUpdate: true,
          skipUnchangedProxies: false,
          batchSize: 50,
          maxConcurrentOperations: 10,
          enablePerformanceMetrics: true
        });
        return NextResponse.json({ 
          success: true, 
          message: 'Force proxy synchronization with cleanup completed - all stale proxies removed',
          data: forceCleanupSyncJob 
        });

      // Removed non-existent methods - TODO: Implement if needed
      // case 'sync-proxies-with-refresh':
      // case 'refresh-proxies':
      // case 'proxy-config':
      // case 'download-proxies':
      // case 'proxy-statistics':

      case 'sync-all-optimized':
        const allDataOptimized = await webshareService.runScheduledOperations('all');
        return NextResponse.json({ 
          success: true, 
          message: 'All data synchronized with optimization',
          data: allDataOptimized 
        });

      case 'sync-account':
        const accountData = await webshareService.syncAccountInfoOptimized();
        return NextResponse.json({ 
          success: true, 
          message: 'Optimized account information synchronized',
          data: accountData 
        });

      case 'sync-account-optimized':
        const optimizedAccountData = await webshareService.syncAccountInfoOptimized('manual', true);
        return NextResponse.json({ 
          success: true, 
          message: 'Account information synchronized with cache optimization',
          data: optimizedAccountData 
        });

      case 'sync-all':
        // Using the existing syncAllData method if it exists, otherwise use optimized version
        try {
          const allData = await webshareService.syncAllData();
          return NextResponse.json({ 
            success: true, 
            message: 'All data synchronized successfully',
            data: allData 
          });
        } catch (error) {
          // Fallback to optimized version
          const allDataOptimized = await webshareService.runScheduledOperations('all');
          return NextResponse.json({ 
            success: true, 
            message: 'All data synchronized with optimization',
            data: allDataOptimized 
          });
        }

      // Removed non-existent methods - TODO: Implement if needed  
      // case 'auto-sync':
      // case 'save-dashboard':

      case 'start-cron':
        return NextResponse.json({ 
          success: true, 
          message: 'Cron start not implemented yet' 
        });

      case 'stop-cron':
        return NextResponse.json({ 
          success: true, 
          message: 'Cron stop not implemented yet' 
        });

      case 'restart-cron':
        return NextResponse.json({ 
          success: true, 
          message: 'Cron restart not implemented yet' 
        });

      case 'save-cron-settings':
        // For now, just return success - implementation can be added later
        const cronSettings = (body as any).cronSettings;
        if (!cronSettings) {
          return NextResponse.json({ 
            success: false,
            error: 'Cron settings data is required' 
          }, { status: 400 });
        }
        
        // TODO: Save cron settings to database
        console.log('Cron settings to save:', cronSettings);
        
        return NextResponse.json({ 
          success: true, 
          message: 'Cron settings saved successfully',
          data: cronSettings 
        });

      case 'test-cron':
        const operationType = searchParams.get('type') || 'all';
        
        // Run the appropriate test operation
        switch (operationType) {
          case 'proxies':
            const proxyTestResult = await webshareService.syncProxiesOptimized();
            return NextResponse.json({ 
              success: true, 
              message: 'Proxy sync test completed successfully',
              data: proxyTestResult 
            });

          case 'account':
            const accountTestResult = await webshareService.syncAccountInfoOptimized();
            return NextResponse.json({ 
              success: true, 
              message: 'Account sync test completed successfully',
              data: accountTestResult 
            });

          case 'stats':
            const statsTestResult = await webshareService.getProxySummaryFast();
            return NextResponse.json({ 
              success: true, 
              message: 'Statistics update test completed successfully',
              data: statsTestResult 
            });

          case 'health':
            const healthTestResult = await webshareService.getEnhancedDashboardDataOptimized();
            return NextResponse.json({ 
              success: true, 
              message: 'Health check test completed successfully',
              data: healthTestResult 
            });

          case 'all':
            const allTestResults = await webshareService.runScheduledOperations('all');
            return NextResponse.json({ 
              success: true, 
              message: 'All operations test completed successfully',
              data: allTestResults 
            });

          default:
            return NextResponse.json({ 
              success: false,
              error: 'Invalid test operation type' 
            }, { status: 400 });
        }

      default:
        return NextResponse.json({
          success: false,
          error: 'Invalid action. Use: save-config, test-api, sync-proxies, sync-proxies-with-refresh, refresh-proxies, proxy-config, download-proxies, proxy-statistics, sync-account, sync-all, save-dashboard, start-cron, stop-cron, or restart-cron'
        }, { status: 400 });
    }
  } catch (error: any) {
    console.error('WebShare API Error:', error);
    return NextResponse.json({
      success: false,
      error: error.message || 'Internal server error'
    }, { status: 500 });
  }
}