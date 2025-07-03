// API route for WebShare auto-sync cron job
import { NextRequest, NextResponse } from 'next/server';
import { webshareService } from '@/modules/webshare/services';

export async function POST(request: NextRequest) {
  try {
    console.log('WebShare Auto-Sync Cron Job - Starting...');
    
    // Check if auto-sync should run
    const shouldSync = await webshareService.shouldPerformAutoSync();
    
    if (!shouldSync) {
      console.log('WebShare Auto-Sync - Skipping: Not due yet or disabled');
      return NextResponse.json({
        success: true,
        message: 'Auto-sync not due yet or disabled',
        skipped: true
      });
    }
    
    console.log('WebShare Auto-Sync - Performing sync...');
    
    // Perform the auto-sync
    const syncJob = await webshareService.performAutoSync();
    
    console.log('WebShare Auto-Sync - Completed:', {
      jobId: syncJob.id,
      proxiesAdded: syncJob.proxiesAdded,
      proxiesUpdated: syncJob.proxiesUpdated,
      proxiesRemoved: syncJob.proxiesRemoved,
      totalProxies: syncJob.totalProxies,
      status: syncJob.status
    });
    
    return NextResponse.json({
      success: true,
      message: 'Auto-sync completed successfully',
      data: {
        jobId: syncJob.id,
        proxiesAdded: syncJob.proxiesAdded,
        proxiesUpdated: syncJob.proxiesUpdated,
        proxiesRemoved: syncJob.proxiesRemoved,
        totalProxies: syncJob.totalProxies,
        status: syncJob.status,
        timestamp: new Date().toISOString()
      }
    });
    
  } catch (error: any) {
    console.error('WebShare Auto-Sync Cron Job Error:', error);
    
    return NextResponse.json({
      success: false,
      error: error.message || 'Auto-sync failed',
      timestamp: new Date().toISOString()
    }, { status: 500 });
  }
}

// Health check endpoint
export async function GET(request: NextRequest) {
  try {
    const autoSyncStatus = await webshareService.getAutoSyncStatus();
    
    return NextResponse.json({
      success: true,
      message: 'WebShare auto-sync cron job is healthy',
      data: {
        autoSyncEnabled: autoSyncStatus.enabled,
        lastSync: autoSyncStatus.lastSync,
        nextSync: autoSyncStatus.nextSync,
        intervalMinutes: autoSyncStatus.intervalMinutes,
        timestamp: new Date().toISOString()
      }
    });
    
  } catch (error: any) {
    console.error('WebShare Auto-Sync Health Check Error:', error);
    
    return NextResponse.json({
      success: false,
      error: error.message || 'Health check failed',
      timestamp: new Date().toISOString()
    }, { status: 500 });
  }
}
