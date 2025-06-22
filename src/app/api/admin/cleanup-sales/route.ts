// API route to clean up duplicate sales records
// Call with: GET /api/admin/cleanup-sales?integrationId=YOUR_INTEGRATION_ID

import { NextRequest, NextResponse } from 'next/server';
import admin from 'firebase-admin';

// Initialize Firebase Admin if not already initialized
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
    const integrationId = searchParams.get('integrationId');
    const action = searchParams.get('action') || 'cleanup'; // 'cleanup' or 'deleteAll'

    if (!integrationId) {
      return NextResponse.json({
        success: false,
        error: 'Integration ID is required',
        usage: 'GET /api/admin/cleanup-sales?integrationId=YOUR_ID&action=cleanup'
      }, { status: 400 });
    }

    console.log(`🧹 Starting ${action} for integration:`, integrationId);

    // Get all sales for this integration
    const salesQuery = db.collection('takealot_sales').where('integrationId', '==', integrationId);
    const salesSnapshot = await salesQuery.get();

    console.log(`📊 Found ${salesSnapshot.size} sales documents`);

    if (salesSnapshot.size === 0) {
      return NextResponse.json({
        success: true,
        message: 'No sales found for this integration ID',
        deleted: 0,
        integrationId
      });
    }

    let docsToDelete = [];

    if (action === 'deleteAll') {
      // Delete ALL sales for this integration
      salesSnapshot.forEach((doc) => {
        docsToDelete.push(doc.id);
      });
    } else {
      // Default: Remove duplicates only (keep most recent)
      const salesByOrderId = new Map();

      salesSnapshot.forEach((docSnapshot) => {
        const data = docSnapshot.data();
        const orderId = data.order_id;

        if (!salesByOrderId.has(orderId)) {
          salesByOrderId.set(orderId, []);
        }
        salesByOrderId.get(orderId).push({
          docId: docSnapshot.id,
          data: data,
          fetchedAt: data.fetchedAt || data.lastUpdated || admin.firestore.Timestamp.now()
        });
      });

      // Find duplicates and keep most recent
      for (const [orderId, salesDocs] of salesByOrderId) {
        if (salesDocs.length > 1) {          // Sort by fetchedAt date (keep the most recent one)
          salesDocs.sort((a: any, b: any) => {
            const dateA = a.fetchedAt?.toDate?.() || new Date(0);
            const dateB = b.fetchedAt?.toDate?.() || new Date(0);
            return dateB.getTime() - dateA.getTime();
          });

          // Mark older duplicates for deletion
          for (let i = 1; i < salesDocs.length; i++) {
            docsToDelete.push(salesDocs[i].docId);
          }
        }
      }
    }

    if (docsToDelete.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'No duplicates found - database is clean',
        deleted: 0,
        total: salesSnapshot.size,
        integrationId
      });
    }

    // Delete in batches
    const batchSize = 500;
    let deletedCount = 0;

    for (let i = 0; i < docsToDelete.length; i += batchSize) {
      const batch = db.batch();
      const batchDocs = docsToDelete.slice(i, i + batchSize);

      batchDocs.forEach(docId => {
        batch.delete(db.collection('takealot_sales').doc(docId));
      });

      await batch.commit();
      deletedCount += batchDocs.length;
      console.log(`✅ Deleted batch: ${batchDocs.length} documents (${deletedCount}/${docsToDelete.length} total)`);
    }

    return NextResponse.json({
      success: true,
      message: `Successfully ${action === 'deleteAll' ? 'deleted all' : 'cleaned up duplicates'}`,
      deleted: deletedCount,
      remaining: salesSnapshot.size - deletedCount,
      integrationId,
      action
    });

  } catch (error: any) {
    console.error('❌ Error during cleanup:', error);
    return NextResponse.json({
      success: false,
      error: error.message,
      details: 'Check server logs for more information'
    }, { status: 500 });
  }
}
