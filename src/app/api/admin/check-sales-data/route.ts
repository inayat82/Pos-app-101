// Check what sales data exists in the database
// API route to diagnose sales data structure

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

    console.log(`🔍 Checking sales data structure for integration: ${integrationId || 'ALL'}`);

    const result: any = {
      success: true,
      integrationId: integrationId || 'ALL',
      collections: {}
    };

    // Check takealot_sales collection
    try {
      const salesQuery = integrationId 
        ? db.collection('takealot_sales').where('integrationId', '==', integrationId)
        : db.collection('takealot_sales').limit(10);
      
      const salesSnapshot = await salesQuery.get();
      
      result.collections.takealot_sales = {
        total: salesSnapshot.size,
        sample: []
      };

      if (salesSnapshot.size > 0) {
        salesSnapshot.docs.slice(0, 3).forEach(doc => {
          const data = doc.data();
          result.collections.takealot_sales.sample.push({
            docId: doc.id,
            order_id: data.order_id,
            integrationId: data.integrationId,
            product_title: data.product_title,
            order_date: data.order_date,
            hasFields: Object.keys(data).length
          });
        });
      }    } catch (error: any) {
      result.collections.takealot_sales = { error: error?.message || 'Unknown error' };
    }

    // Check old structure (if exists)
    try {
      const oldSalesQuery = integrationId 
        ? db.collection('takealotSales').where('adminId', '==', integrationId)
        : db.collection('takealotSales').limit(10);
      
      const oldSalesSnapshot = await oldSalesQuery.get();
      
      result.collections.takealotSales = {
        total: oldSalesSnapshot.size,
        sample: []
      };

      if (oldSalesSnapshot.size > 0) {
        oldSalesSnapshot.docs.slice(0, 3).forEach(doc => {
          const data = doc.data();
          result.collections.takealotSales.sample.push({
            docId: doc.id,
            adminId: data.adminId,
            salesCount: data.sales?.length || 0,
            lastUpdated: data.lastUpdated?.toDate?.()?.toISOString() || 'unknown'
          });
        });
      }
    } catch (error: any) {
      result.collections.takealotSales = { error: error?.message || 'Unknown error' };
    }

    // Check for documents by adminId pattern (old structure)
    if (integrationId) {
      try {
        const oldDocRef = db.collection('takealotSales').doc(integrationId);
        const oldDoc = await oldDocRef.get();
        
        if (oldDoc.exists) {
          const data = oldDoc.data();
          result.oldStructureFound = {
            docId: oldDoc.id,
            salesCount: data?.sales?.length || 0,
            lastUpdated: data?.lastUpdated?.toDate?.()?.toISOString() || 'unknown',
            sampleSale: data?.sales?.[0] || null
          };
        }
      } catch (error: any) {
        result.oldStructureError = error?.message || 'Unknown error';
      }
    }

    // Get all integration IDs we can find
    try {
      const allSalesSnapshot = await db.collection('takealot_sales').limit(50).get();
      const integrationIds = new Set();
      
      allSalesSnapshot.forEach(doc => {
        const data = doc.data();
        if (data.integrationId) {
          integrationIds.add(data.integrationId);
        }
      });

      result.foundIntegrationIds = Array.from(integrationIds);
    } catch (error: any) {
      result.integrationIdsError = error?.message || 'Unknown error';
    }

    return NextResponse.json(result);

  } catch (error: any) {
    console.error('❌ Error during diagnosis:', error);
    return NextResponse.json({
      success: false,
      error: error.message,
      details: 'Check server logs for more information'
    }, { status: 500 });
  }
}
