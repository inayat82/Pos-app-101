// src/app/api/admin/takealot/fetch-logs/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { dbAdmin as db } from '@/lib/firebase/firebaseAdmin';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const integrationId = searchParams.get('integrationId');
    const limit = parseInt(searchParams.get('limit') || '20'); // Default to 20 per page
    const page = parseInt(searchParams.get('page') || '1'); // Default to page 1
    const offset = (page - 1) * limit;
    
    console.log(`[fetch-logs] Request for integrationId: ${integrationId}, limit: ${limit}, page: ${page}`);

    if (!integrationId) {
      return NextResponse.json({ error: 'Missing integrationId parameter' }, { status: 400 });
    }

    // Verify integration exists and get admin ID
    const integrationRef = db.collection('takealotIntegrations').doc(integrationId);
    const integrationSnap = await integrationRef.get();
    
    if (!integrationSnap.exists) {
      return NextResponse.json({ error: 'Integration not found' }, { status: 404 });
    }
    
    const integrationData = integrationSnap.data();
    const adminId = integrationData?.adminId;

    // Query logs for this integration from centralized logs collection
    let totalSnapshot = await db
      .collection('logs')
      .where('integrationId', '==', integrationId)
      .get();
    
    // If no logs found by integrationId, try to find by adminId as fallback
    if (totalSnapshot.empty && adminId) {
      console.log(`No logs found for integrationId ${integrationId}, trying adminId ${adminId}`);
      totalSnapshot = await db
        .collection('logs')
        .where('adminId', '==', adminId)
        .get();
    }
    
    const totalLogs = totalSnapshot.docs.length;
    const totalPages = Math.ceil(totalLogs / limit);
    
    console.log(`[fetch-logs] Found ${totalLogs} total logs`);

    // Fetch all logs and sort them (since we can't use orderBy with composite index)
    let allLogs = totalSnapshot.docs.map(doc => {
      const data = doc.data();
      console.log(`[fetch-logs] Processing log ${doc.id}: cronJobName=${data.cronJobName}, status=${data.status}, totalReads=${data.totalReads}, totalWrites=${data.totalWrites}`);
      
      // Map cronJobLogs fields to UI expected format
      const mappedLog = {
        id: doc.id,
        createdAt: data.createdAt?.toDate?.()?.toISOString() || data.createdAt || new Date().toISOString(),
        timestamp: data.createdAt?.toDate?.()?.toISOString() || data.timestamp?.toDate?.()?.toISOString() || data.timestamp || new Date().toISOString(),
        // Map cronJobName to operation for UI display
        operation: data.cronJobName?.replace(/-/g, ' ').replace(/\b\w/g, (l: string) => l.toUpperCase()) || 'Manual Sync',
        // Extract type from cronJobName (e.g., "sales-sync-last-100" -> "sales")
        type: data.cronJobName?.includes('sales') ? 'sales' : 
              data.cronJobName?.includes('product') ? 'products' : 'sync',
        // Map trigger information
        trigger: data.triggerType === 'manual' ? 'Manual' : 
                data.triggerType === 'cron' ? 'Automated' : 'Unknown',
        // Map performance metrics
        recordsFetched: data.totalReads || 0,
        totalRecords: data.totalReads || 0,
        pagesFetched: data.totalPages || 0,
        totalPages: data.totalPages || 0,
        recordsSaved: data.totalWrites || 0,
        duplicates: data.itemsProcessed ? (data.itemsProcessed - (data.totalWrites || 0)) : 0,
        recordsUpdated: data.totalWrites || 0,
        updatedRecords: data.totalWrites || 0,
        newRecords: data.totalWrites || 0,
        // Calculate duration from start/end times
        duration: data.endTime && data.startTime ? 
          (data.endTime.toDate?.() || new Date(data.endTime)).getTime() - 
          (data.startTime.toDate?.() || new Date(data.startTime)).getTime() : 
          data.duration || 0,
        // Map status
        status: data.status === 'success' ? 'completed' : 
               data.status === 'failure' ? 'failed' : 
               data.status || 'running',
        // Include additional fields for debugging
        ...data,          // Ensure proper timestamp conversion with fallbacks
          startTime: data.startTime?.toDate?.()?.toISOString() || data.startTime || data.createdAt?.toDate?.()?.toISOString() || new Date().toISOString(),
          endTime: data.endTime?.toDate?.()?.toISOString() || data.endTime || data.updatedAt?.toDate?.()?.toISOString() || new Date().toISOString()
      };
      
      return mappedLog;
    });

    // Sort by createdAt descending (newest first)
    allLogs = allLogs.sort((a, b) => {
      const dateA = new Date(a.createdAt || 0);
      const dateB = new Date(b.createdAt || 0);
      return dateB.getTime() - dateA.getTime();
    });    // Apply pagination
    const paginatedLogs = allLogs.slice(offset, offset + limit);

    // If no logs exist, return empty result
    if (totalLogs === 0) {
      return NextResponse.json({ 
        logs: [],
        total: 0,
        totalPages: 0,
        currentPage: page,
        limit: limit,
        hasNextPage: false,
        hasPreviousPage: false,
        integrationId: integrationId,
        message: "No API logs found yet. Logs will appear here once you start using the sync features."
      });
    }

    return NextResponse.json({ 
      logs: paginatedLogs,
      total: totalLogs,
      totalPages: totalPages,
      currentPage: page,
      limit: limit,
      hasNextPage: page < totalPages,
      hasPreviousPage: page > 1,
      integrationId: integrationId
    });

  } catch (error: any) {
    console.error('Error fetching logs:', error);
    return NextResponse.json({ 
      error: 'Failed to fetch logs', 
      details: error.message 
    }, { status: 500 });
  }
}
