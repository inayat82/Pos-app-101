// WebShare API Handler - Unified API for all WebShare operations
import { NextRequest, NextResponse } from 'next/server';
import { webshareService } from '../services';
import { ApiResponse } from '../types';

export async function handleGetRequest(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const action = searchParams.get('action');

    switch (action) {
      case 'config':
        const config = await webshareService.getConfig();
        return NextResponse.json({ success: true, data: config } as ApiResponse);

      case 'proxies':
        const limit = parseInt(searchParams.get('limit') || '50');
        const offset = parseInt(searchParams.get('offset') || '0');
        const proxiesData = await webshareService.getProxies(limit, offset);
        return NextResponse.json({ success: true, data: proxiesData } as ApiResponse);

      case 'sync-jobs':
        const syncJobs = await webshareService.getSyncJobs();
        return NextResponse.json({ success: true, data: syncJobs } as ApiResponse);

      case 'dashboard':
        const dashboardData = await webshareService.getDashboardData();
        return NextResponse.json({ success: true, data: dashboardData } as ApiResponse);

      case 'status':
        const status = await webshareService.getSystemStatus();
        return NextResponse.json({ success: true, data: status } as ApiResponse);

      default:
        return NextResponse.json({
          success: false,
          error: 'Invalid action. Use: config, proxies, sync-jobs, dashboard, or status'
        } as ApiResponse, { status: 400 });
    }
  } catch (error: any) {
    console.error('WebShare API GET Error:', error);
    return NextResponse.json({
      success: false,
      error: error.message || 'Internal server error'
    } as ApiResponse, { status: 500 });
  }
}

export async function handlePostRequest(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const action = searchParams.get('action');
    const body = await request.json();

    switch (action) {
      case 'save-config':
        const updatedConfig = await webshareService.updateConfig(body);
        return NextResponse.json({ 
          success: true, 
          message: 'Configuration saved successfully',
          data: updatedConfig 
        } as ApiResponse);

      case 'test-api':
        if (!body.apiKey) {
          return NextResponse.json({ 
            success: false,
            error: 'API key is required' 
          } as ApiResponse, { status: 400 });
        }
        
        const testResult = await webshareService.testApiKey(body.apiKey);
        return NextResponse.json({ 
          success: true, 
          data: testResult 
        } as ApiResponse);

      case 'sync-proxies':
        const syncJob = await webshareService.syncProxies();
        return NextResponse.json({ 
          success: true, 
          message: 'Proxy synchronization completed',
          data: syncJob 
        } as ApiResponse);

      case 'save-dashboard':
        await webshareService.saveDashboardData(body);
        return NextResponse.json({ 
          success: true, 
          message: 'Dashboard data saved successfully' 
        } as ApiResponse);

      default:
        return NextResponse.json({
          success: false,
          error: 'Invalid action. Use: save-config, test-api, sync-proxies, or save-dashboard'
        } as ApiResponse, { status: 400 });
    }
  } catch (error: any) {
    console.error('WebShare API POST Error:', error);
    return NextResponse.json({
      success: false,
      error: error.message || 'Internal server error'
    } as ApiResponse, { status: 500 });
  }
}
