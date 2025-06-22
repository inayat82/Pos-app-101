// src/app/api/cron/calculate-product-metrics/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { calculateAllProductMetrics } from '@/lib/productMetricsCalculator';
import { getFirestore } from 'firebase-admin/firestore';
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

const db = getFirestore();

// Verify cron job authorization
function isAuthorizedCronJob(request: NextRequest): boolean {
  const authHeader = request.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;
  
  if (!cronSecret) {
    console.error('CRON_SECRET not configured');
    return false;
  }
  
  return authHeader === `Bearer ${cronSecret}`;
}

export async function POST(request: NextRequest) {
  try {
    // Verify authorization
    if (!isAuthorizedCronJob(request)) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    console.log('Starting scheduled product metrics calculation...');
    
    // Get all unique integration IDs
    const integrationsSnapshot = await db.collection('takealot_offers')
      .select('integrationId')
      .get();
      const integrationIds = new Set<string>();
    integrationsSnapshot.docs.forEach((doc: any) => {
      const data = doc.data();
      if (data.integrationId) {
        integrationIds.add(data.integrationId);
      }
    });

    console.log(`Found ${integrationIds.size} integrations to process`);

    const results = [];
    
    // Process each integration
    for (const integrationId of integrationIds) {
      console.log(`Processing integration: ${integrationId}`);
      
      try {
        const result = await calculateAllProductMetrics(integrationId);
        results.push({
          integrationId,
          success: result.success,
          errors: result.errors.length,
          errorDetails: result.errors.slice(0, 5) // Limit error details
        });
        
        console.log(`Integration ${integrationId}: ${result.success} products updated, ${result.errors.length} errors`);
      } catch (error) {
        console.error(`Failed to process integration ${integrationId}:`, error);
        results.push({
          integrationId,
          success: 0,
          errors: 1,
          errorDetails: [error instanceof Error ? error.message : 'Unknown error']
        });
      }
    }

    const totalSuccess = results.reduce((sum, r) => sum + r.success, 0);
    const totalErrors = results.reduce((sum, r) => sum + r.errors, 0);

    console.log(`Cron job complete. Total: ${totalSuccess} updated, ${totalErrors} errors`);

    return NextResponse.json({
      success: true,
      summary: {
        integrationsProcessed: integrationIds.size,
        totalProductsUpdated: totalSuccess,
        totalErrors: totalErrors
      },
      details: results
    });

  } catch (error) {
    console.error('Cron job failed:', error);
    return NextResponse.json(
      { 
        error: 'Cron job failed',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

// Also support GET for manual testing
export async function GET(request: NextRequest) {
  // Only allow in development
  if (process.env.NODE_ENV === 'production') {
    return NextResponse.json(
      { error: 'Manual execution not allowed in production' },
      { status: 403 }
    );
  }

  return POST(request);
}
