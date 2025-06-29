// src/app/api/admin/takealot/demo-sync/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { cronJobLogger } from '@/lib/cronJobLogger';

export async function POST(request: NextRequest) {
  try {
    const { integrationId, type } = await request.json() as {
      integrationId: string;
      type: 'sales' | 'products';
    };

    if (!integrationId || !type) {
      return NextResponse.json({ 
        error: 'Missing required parameters: integrationId, type' 
      }, { status: 400 });
    }

    // Create some demo logs to show the system is working
    const logId = await cronJobLogger.logManualFetch({
      adminId: integrationId,
      adminName: 'Demo User',
      adminEmail: 'demo@example.com',
      operation: `Demo ${type} Sync`,
      apiSource: 'Demo API',
      status: 'success',
      message: `Demo sync completed successfully for ${type}`,
      details: `This is a demonstration of the logging system. In production, this would show real API calls and data synchronization.`
    });

    // Simulate some processing time
    await new Promise(resolve => setTimeout(resolve, 1000));

    // Create a few more demo log entries
    await cronJobLogger.logManualFetchEnhanced({
      adminId: integrationId,
      integrationId,
      apiSource: 'Demo API',
      operation: `demo_${type}_processing`,
      status: 'success',
      message: `Processed demo ${type} data`,
      details: `Demo: Processed 25 ${type} records, 15 new, 8 updated, 2 duplicates`
    });

    const demoData = {
      success: true,
      message: `Demo ${type} sync completed successfully!`,
      data: {
        totalRecords: 25,
        newRecords: 15,
        updatedRecords: 8,
        duplicates: 2,
        errors: 0,
        processingTime: '1.2s'
      },
      logs: {
        message: 'Demo logs have been created. Check the API Call Logs section to see them.',
        logId: logId
      },
      note: 'This is a demo sync. To use real Takealot data, please configure your Takealot API key in the integration settings.'
    };

    return NextResponse.json(demoData);

  } catch (error: any) {
    console.error('Demo sync error:', error);
    return NextResponse.json({ 
      error: 'Demo sync failed', 
      details: error.message 
    }, { status: 500 });
  }
}
