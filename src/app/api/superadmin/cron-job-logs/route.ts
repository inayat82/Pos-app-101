// src/app/api/superadmin/cron-job-logs/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { cronJobLogger } from '@/lib/cronJobLogger';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get('limit') || '50');
    const offset = parseInt(searchParams.get('offset') || '0');
    const status = searchParams.get('status') as any;
    const cronJobName = searchParams.get('cronJobName');
    const adminId = searchParams.get('adminId');
    const triggerType = searchParams.get('triggerType') as any;
    const startDate = searchParams.get('startDate') ? new Date(searchParams.get('startDate')!) : undefined;
    const endDate = searchParams.get('endDate') ? new Date(searchParams.get('endDate')!) : undefined;

    // Get all logs (Super Admin only)
    const result = await cronJobLogger.getAllLogs({
      limit,
      offset,
      status,
      cronJobName: cronJobName || undefined,
      adminId: adminId || undefined,
      triggerType,
      startDate,
      endDate
    });

    return NextResponse.json({
      success: true,
      logs: result.logs,
      total: result.total,
      hasMore: result.hasMore,
      pagination: {
        limit,
        offset,
        total: result.total,
        hasMore: result.hasMore
      },
      timestamp: new Date().toISOString()
    });

  } catch (error: any) {
    console.error('Error fetching cron job logs:', error);
    return NextResponse.json(
      { 
        success: false, 
        message: 'Failed to fetch cron job logs',
        error: error.message 
      },
      { status: 500 }
    );
  }
}
