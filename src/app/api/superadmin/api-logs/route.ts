import { NextRequest, NextResponse } from 'next/server';
import admin from 'firebase-admin';

// Initialize Firebase Admin SDK if not already initialized
if (!admin.apps.length) {
  if (process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON) {
    const serviceAccount = JSON.parse(process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON);
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
    });
  } else if (process.env.FIREBASE_SERVICE_ACCOUNT_PROJECT_ID && process.env.FIREBASE_SERVICE_ACCOUNT_PRIVATE_KEY && process.env.FIREBASE_SERVICE_ACCOUNT_CLIENT_EMAIL) {
    admin.initializeApp({
      credential: admin.credential.cert({
        projectId: process.env.FIREBASE_SERVICE_ACCOUNT_PROJECT_ID,
        privateKey: process.env.FIREBASE_SERVICE_ACCOUNT_PRIVATE_KEY.replace(/\\n/g, '\n'),
        clientEmail: process.env.FIREBASE_SERVICE_ACCOUNT_CLIENT_EMAIL,
      }),
    });
  } else {
    admin.initializeApp();
  }
}

const db = admin.firestore();

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get('limit') || '100');
    const offset = parseInt(searchParams.get('offset') || '0');
    const status = searchParams.get('status'); // success, failure, in-progress
    const adminId = searchParams.get('adminId');
    const triggerType = searchParams.get('triggerType'); // cron, manual

    // Build query
    let query = db.collection('takealotSyncLogs')
      .orderBy('timestamp', 'desc');

    // Apply filters
    if (status) {
      query = query.where('status', '==', status);
    }
    if (adminId) {
      query = query.where('adminId', '==', adminId);
    }
    if (triggerType === 'cron') {
      query = query.where('cronLabel', '!=', null);
    }

    // Apply pagination
    query = query.limit(limit);
    if (offset > 0) {
      const offsetQuery = await db.collection('takealotSyncLogs')
        .orderBy('timestamp', 'desc')
        .limit(offset)
        .get();
      
      if (!offsetQuery.empty) {
        const lastDoc = offsetQuery.docs[offsetQuery.docs.length - 1];
        query = query.startAfter(lastDoc);
      }
    }

    const snapshot = await query.get();

    if (snapshot.empty) {
      return NextResponse.json({ 
        success: true, 
        logs: [], 
        total: 0,
        message: 'No API logs found' 
      });
    }

    // Get admin names for each log
    const adminIds = [...new Set(snapshot.docs.map(doc => doc.data().adminId).filter(Boolean))];
    const adminNames = new Map<string, string>();
    
    if (adminIds.length > 0) {
      // Fetch admin names from users collection
      const adminPromises = adminIds.map(async (id) => {
        try {
          const adminDoc = await db.collection('users').doc(id).get();
          if (adminDoc.exists) {
            const adminData = adminDoc.data();
            adminNames.set(id, adminData?.name || adminData?.email || 'Unknown Admin');
          }
        } catch (error) {
          console.warn(`Could not fetch admin name for ${id}:`, error);
          adminNames.set(id, 'Unknown Admin');
        }
      });
      await Promise.all(adminPromises);
    }

    // Get integration names for each log
    const integrationIds = [...new Set(snapshot.docs.map(doc => doc.data().integrationId).filter(Boolean))];
    const integrationNames = new Map<string, string>();
    
    if (integrationIds.length > 0) {
      const integrationPromises = integrationIds.map(async (id) => {
        try {
          const integrationDoc = await db.collection('takealotIntegrations').doc(id).get();
          if (integrationDoc.exists) {
            const integrationData = integrationDoc.data();
            integrationNames.set(id, integrationData?.accountName || integrationData?.name || 'Unknown Account');
          }
        } catch (error) {
          console.warn(`Could not fetch integration name for ${id}:`, error);
          integrationNames.set(id, 'Unknown Account');
        }
      });
      await Promise.all(integrationPromises);
    }

    // Transform logs to match API monitor format
    const logs = snapshot.docs.map(doc => {
      const data = doc.data();
      
      // Determine status from various fields
      let status: 'success' | 'failure' | 'in-progress' = 'success';
      if (data.error || data.type === 'error' || data.type === 'fatal_error') {
        status = 'failure';
      } else if (data.type === 'chunk_processed' || data.type === 'start') {
        status = 'in-progress';
      }

      // Determine API source
      let apiSource: 'Takealot' | 'Webshare' | 'Unknown' = 'Takealot';
      if (data.message && data.message.toLowerCase().includes('webshare')) {
        apiSource = 'Webshare';
      }

      // Calculate stats
      const stats = {
        totalPages: data.totalPages || data.pagesProcessed || 0,
        apiReads: data.apiReads || data.totalItemsProcessed || data.itemsProcessed || 0,
        dbWrites: data.dbWrites || data.totalNewRecords || data.newRecordsAdded || 0,
        durationMs: data.processingTimeMs || data.duration || 0,
      };

      return {
        id: doc.id,
        timestamp: data.timestamp?.toDate?.()?.getTime() || Date.now(),
        adminId: data.adminId || 'unknown',
        adminName: adminNames.get(data.adminId) || 'Unknown Admin',
        takealotAccountId: data.integrationId || 'unknown',
        takealotAccountName: integrationNames.get(data.integrationId) || 'Unknown Account',
        apiSource,
        triggerType: data.cronLabel ? 'cron' : 'manual',
        status,
        stats,
        error: data.error ? {
          message: data.error,
          code: data.errorCode || 'UNKNOWN_ERROR',
          details: data.errorDetails
        } : undefined,
        metadata: {
          cronLabel: data.cronLabel,
          dataType: data.dataType,
          jobId: data.jobId,
          type: data.type,
          message: data.message,
          duplicatesFound: data.duplicatesFound,
          duplicatesRemoved: data.duplicatesRemoved,
          originalData: data
        }
      };
    });

    // Get total count for pagination
    const totalSnapshot = await db.collection('takealotSyncLogs').get();
    const total = totalSnapshot.size;

    return NextResponse.json({
      success: true,
      logs,
      total,
      limit,
      offset,
      hasMore: logs.length === limit
    });

  } catch (error: any) {
    console.error('Error fetching API logs:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: 'Failed to fetch API logs',
        message: error.message 
      },
      { status: 500 }
    );
  }
}
