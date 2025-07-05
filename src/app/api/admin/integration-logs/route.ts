// Admin API endpoint for viewing logs specific to their integrations
import { NextRequest, NextResponse } from 'next/server';
import { cronJobLogger } from '@/lib/cronJobLogger';
import { getUserAuth } from '@/lib/firebase/authUtils';

export async function GET(request: NextRequest) {
  try {
    // Get the current session to identify the admin
    const authResult = await getUserAuth();
    
    if (!authResult.session?.user?.id) {
      return NextResponse.json(
        { success: false, message: 'Unauthorized' },
        { status: 401 }
      );
    }

    const adminId = authResult.session.user.id;
    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get('limit') || '50');
    const offset = parseInt(searchParams.get('offset') || '0');
    const status = searchParams.get('status') as any;
    const apiSource = searchParams.get('apiSource'); // 'Takealot', 'Webshare', etc.
    const triggerType = searchParams.get('triggerType') as any;
    const startDate = searchParams.get('startDate') ? new Date(searchParams.get('startDate')!) : undefined;
    const endDate = searchParams.get('endDate') ? new Date(searchParams.get('endDate')!) : undefined;

    // Get logs for this admin only, with optional filtering by API source
    const result = await cronJobLogger.getAdminLogs(adminId, {
      limit,
      offset,
      status,
      cronJobName: apiSource?.toLowerCase(), // Filter by source if provided
      startDate,
      endDate
    });

    // Transform logs to include categorization by API source
    const categorizedLogs = result.logs.map(log => ({
      ...log,
      category: determineLogCategory(log),
      displayName: getDisplayName(log),
      integration: getIntegrationInfo(log)
    }));

    // Filter by API source if requested
    const filteredLogs = apiSource 
      ? categorizedLogs.filter(log => log.category.toLowerCase() === apiSource.toLowerCase())
      : categorizedLogs;

    return NextResponse.json({
      success: true,
      logs: filteredLogs,
      total: result.total,
      hasMore: result.hasMore,
      pagination: {
        limit,
        offset,
        total: result.total,
        hasMore: result.hasMore
      },
      categories: {
        takealot: categorizedLogs.filter(log => log.category === 'Takealot').length,
        webshare: categorizedLogs.filter(log => log.category === 'Webshare').length,
        system: categorizedLogs.filter(log => log.category === 'System').length,
        cleanup: categorizedLogs.filter(log => log.category === 'Cleanup').length
      },
      adminId,
      timestamp: new Date().toISOString()
    });

  } catch (error: any) {
    console.error('Error fetching admin integration logs:', error);
    return NextResponse.json(
      { 
        success: false, 
        message: 'Failed to fetch integration logs',
        error: error.message 
      },
      { status: 500 }
    );
  }
}

/**
 * Determine the category/source of the log entry
 */
function determineLogCategory(log: any): 'Takealot' | 'Webshare' | 'System' | 'Cleanup' | 'Unknown' {
  const cronJobName = log.cronJobName?.toLowerCase() || '';
  const apiSource = log.apiSource?.toLowerCase() || '';
  const message = log.message?.toLowerCase() || '';

  if (cronJobName.includes('takealot') || apiSource.includes('takealot')) {
    return 'Takealot';
  }
  if (cronJobName.includes('webshare') || apiSource.includes('webshare')) {
    return 'Webshare';
  }
  if (cronJobName.includes('cleanup') || message.includes('cleanup')) {
    return 'Cleanup';
  }
  if (log.cronJobType === 'system') {
    return 'System';
  }
  
  return 'Unknown';
}

/**
 * Get a user-friendly display name for the log operation
 */
function getDisplayName(log: any): string {
  const category = determineLogCategory(log);
  const operation = log.cronJobName || log.message || 'Unknown Operation';
  
  if (category === 'Takealot') {
    if (operation.includes('product')) return 'Product Sync';
    if (operation.includes('sales')) return 'Sales Sync';
    if (operation.includes('offers')) return 'Offers Sync';
    return 'Takealot API Operation';
  }
  
  if (category === 'Webshare') {
    if (operation.includes('proxy')) return 'Proxy Management';
    if (operation.includes('account')) return 'Account Sync';
    if (operation.includes('sync')) return 'Webshare Sync';
    return 'Webshare Operation';
  }
  
  if (category === 'Cleanup') {
    return 'Data Cleanup';
  }
  
  return operation;
}

/**
 * Extract integration information from the log
 */
function getIntegrationInfo(log: any) {
  return {
    accountId: log.accountId || log.integrationId,
    accountName: log.accountName || 'Unknown Account',
    apiSource: log.apiSource || 'Unknown'
  };
}
