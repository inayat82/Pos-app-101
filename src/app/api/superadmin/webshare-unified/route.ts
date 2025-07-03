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
        const limit = parseInt(searchParams.get('limit') || '10000'); // Default to getting all proxies
        const offset = parseInt(searchParams.get('offset') || '0');
        const proxiesData = await webshareService.getProxies(limit, offset);
        return NextResponse.json({ success: true, data: proxiesData });

      case 'sync-jobs':
        const syncJobs = await webshareService.getSyncJobs();
        return NextResponse.json({ success: true, data: syncJobs });

      case 'dashboard':
        const dashboardData = await webshareService.getEnhancedDashboardData();
        return NextResponse.json({ success: true, data: dashboardData });

      case 'dashboard-cache':
        const cachedData = await webshareService.getDashboardData();
        return NextResponse.json({ success: true, data: cachedData });

      case 'status':
        const status = await webshareService.getSystemStatus();
        return NextResponse.json({ success: true, data: status });

      case 'auto-sync-status':
        const autoSyncStatus = await webshareService.getAutoSyncStatus();
        return NextResponse.json({ success: true, data: autoSyncStatus });

      case 'cron-status':
        return NextResponse.json({ 
          success: true, 
          data: { status: 'not_implemented', message: 'Cron status not available' }
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
        const syncJob = await webshareService.syncProxies();
        return NextResponse.json({ 
          success: true, 
          message: 'Proxy synchronization completed',
          data: syncJob 
        });

      case 'sync-proxies-with-refresh':
        const refreshSyncJob = await webshareService.syncProxiesWithRefresh(true);
        return NextResponse.json({ 
          success: true, 
          message: 'Proxy synchronization with refresh completed',
          data: refreshSyncJob 
        });

      case 'refresh-proxies':
        const refreshResult = await webshareService.refreshProxyList();
        return NextResponse.json({ 
          success: true, 
          message: 'Proxy list refresh initiated',
          data: refreshResult 
        });

      case 'proxy-config':
        const proxyConfig = await webshareService.getProxyConfig();
        return NextResponse.json({ 
          success: true, 
          data: proxyConfig 
        });

      case 'download-proxies':
        const downloadOptions = body as any || {};
        const proxyListText = await webshareService.downloadProxyList(downloadOptions);
        return NextResponse.json({ 
          success: true, 
          data: { proxyList: proxyListText }
        });

      case 'proxy-statistics':
        const stats = await webshareService.getProxyStatistics();
        return NextResponse.json({ 
          success: true, 
          data: stats 
        });

      case 'sync-account':
        const accountData = await webshareService.syncAccountInfo();
        return NextResponse.json({ 
          success: true, 
          message: 'Account information synchronized',
          data: accountData 
        });

      case 'sync-all':
        const allData = await webshareService.syncAllData();
        return NextResponse.json({ 
          success: true, 
          message: 'All data synchronized successfully',
          data: allData 
        });

      case 'auto-sync':
        const autoSyncJob = await webshareService.performAutoSync();
        return NextResponse.json({ 
          success: true, 
          message: 'Auto-sync completed',
          data: autoSyncJob 
        });

      case 'save-dashboard':
        await webshareService.saveDashboardData(body as any);
        return NextResponse.json({ 
          success: true, 
          message: 'Dashboard data saved successfully' 
        });

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