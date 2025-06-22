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

    if (!integrationId) {
      return NextResponse.json({ error: 'Missing integrationId parameter' }, { status: 400 });
    }

    console.log(`Fetching logs for integration: ${integrationId}, page: ${page}, limit: ${limit}`);

    // Verify integration exists
    const integrationRef = db.collection('takealotIntegrations').doc(integrationId);
    const integrationSnap = await integrationRef.get();
    
    if (!integrationSnap.exists) {
      return NextResponse.json({ error: 'Integration not found' }, { status: 404 });
    }

    // First, get total count of logs for this integration
    const totalSnapshot = await db
      .collection('fetch_logs')
      .where('integrationId', '==', integrationId)
      .get();
    
    const totalLogs = totalSnapshot.docs.length;
    const totalPages = Math.ceil(totalLogs / limit);

    // Fetch all logs and sort them (since we can't use orderBy with composite index)
    let allLogs = totalSnapshot.docs.map(doc => {
      const data = doc.data();
      return {
        id: doc.id,
        ...data,
        // Convert Firestore timestamps to ISO strings for JSON serialization
        createdAt: data.createdAt?.toDate?.()?.toISOString() || data.createdAt || null,
        timestamp: data.timestamp?.toDate?.()?.toISOString() || data.timestamp || null
      };
    });

    // Sort by createdAt descending (newest first)
    allLogs = allLogs.sort((a, b) => {
      const dateA = new Date(a.createdAt || 0);
      const dateB = new Date(b.createdAt || 0);
      return dateB.getTime() - dateA.getTime();
    });

    // Apply pagination
    const paginatedLogs = allLogs.slice(offset, offset + limit);

    console.log(`Found ${totalLogs} total logs, showing ${paginatedLogs.length} for page ${page}`);

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
