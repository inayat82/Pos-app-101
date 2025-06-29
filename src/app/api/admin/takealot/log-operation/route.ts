// src/app/api/admin/takealot/log-operation/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { cronJobLogger } from '@/lib/cronJobLogger';

export async function POST(request: NextRequest) {
  let logData: any = {};
  
  try {
    logData = await request.json();

    if (!logData.integrationId || !logData.operation) {
      return NextResponse.json(
        { error: 'Integration ID and operation are required' },
        { status: 400 }
      );
    }

    // Use enhanced centralized logging system (auto-fetches admin details)
    await cronJobLogger.logManualFetchEnhanced({
      adminId: logData.integrationId,
      integrationId: logData.integrationId,
      apiSource: 'log-operation-endpoint',
      operation: logData.operation,
      itemsProcessed: logData.itemsProcessed || 0,
      status: 'success',
      message: `Manual operation: ${logData.operation}`,
      details: JSON.stringify({
        operation: logData.operation,
        integrationId: logData.integrationId,
        originalLogData: logData.details || {}
      })
    });

    return NextResponse.json({
      message: 'Operation logged successfully',
      operation: logData.operation,
      integrationId: logData.integrationId
    });

  } catch (error: any) {
    console.error('Error logging operation:', error);
    
    // Log error case with enhanced logging
    try {
      await cronJobLogger.logManualFetchEnhanced({
        adminId: logData?.integrationId || 'unknown',
        integrationId: logData?.integrationId,
        apiSource: 'log-operation-endpoint',
        operation: logData?.operation || 'unknown-operation',
        status: 'failure',
        message: `Failed to log operation: ${error.message}`,
        errorDetails: error.stack || error.message
      });
    } catch (logError) {
      console.error('Failed to log error case:', logError);
    }
    
    return NextResponse.json(
      { error: `Failed to log operation: ${error.message}` },
      { status: 500 }
    );
  }
}
