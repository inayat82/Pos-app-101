// Check integration IDs and their relationship
// API route to check integration data

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
    const result: any = {
      success: true,
      integrations: [],
      salesByIntegration: {}
    };

    // Check takealotIntegrations collection
    const integrationsSnapshot = await db.collection('takealotIntegrations').get();
    
    integrationsSnapshot.forEach(doc => {
      const data = doc.data();
      result.integrations.push({
        docId: doc.id,
        adminId: data.adminId,
        accountName: data.accountName,
        createdAt: data.createdAt?.toDate?.()?.toISOString() || 'unknown'
      });
    });

    // Check sales count for each integration ID we found
    const integrationIds = ['HFQTUMDN21wkCONzv3', 'HFtQTUMDN21vbKCDNzv3'];
    
    for (const integrationId of integrationIds) {
      try {
        const salesSnapshot = await db.collection('takealot_sales')
          .where('integrationId', '==', integrationId)
          .get();
        
        result.salesByIntegration[integrationId] = {
          count: salesSnapshot.size,
          sample: salesSnapshot.docs.slice(0, 2).map(doc => ({
            docId: doc.id,
            order_id: doc.data().order_id,
            product_title: doc.data().product_title
          }))
        };
      } catch (error: any) {
        result.salesByIntegration[integrationId] = { error: error?.message || 'Unknown error' };
      }
    }

    return NextResponse.json(result);

  } catch (error: any) {
    console.error('❌ Error during check:', error);
    return NextResponse.json({
      success: false,
      error: error?.message || 'Unknown error'
    }, { status: 500 });
  }
}
