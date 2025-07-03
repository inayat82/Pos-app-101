// src/app/api/cron/calculate-product-metrics/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { calculateAllProductMetrics } from '@/lib/productMetricsCalculator';
import { cronJobLogger } from '@/lib/cronJobLogger';
import { dbAdmin as db } from '@/lib/firebase/firebaseAdmin';

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
  let executionId: string | null = null;
  
  try {
    // Verify authorization
    if (!isAuthorizedCronJob(request)) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    console.log('Starting scheduled product metrics calculation...');
    
    // Start centralized logging
    executionId = await cronJobLogger.startExecution({
      cronJobName: 'calculate-product-metrics',
      cronJobType: 'scheduled',
      cronSchedule: '0 */6 * * *', // Every 6 hours (as per vercel.json)
      apiSource: 'Internal Calculation',
      triggerType: 'cron',
      triggerSource: 'Vercel Cron',
      message: 'Starting product metrics calculation for all integrations'
    });
    
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

    // Complete centralized logging
    if (executionId) {
      await cronJobLogger.completeExecution(executionId, {
        status: totalErrors > 0 && totalSuccess === 0 ? 'failure' : 'success',
        message: `Product metrics calculation completed: ${totalSuccess} products updated, ${totalErrors} errors across ${integrationIds.size} integrations`,
        totalPages: integrationIds.size, // Each integration is like a "page"
        totalReads: integrationIds.size, // Each integration read
        totalWrites: totalSuccess, // Each product updated is a write
        itemsProcessed: totalSuccess,
        details: `Processed ${integrationIds.size} integrations. Success rate: ${Math.round((totalSuccess / (totalSuccess + totalErrors)) * 100)}%`,
        errorDetails: totalErrors > 0 ? `${totalErrors} errors occurred during processing` : undefined
      });
    }

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
    
    // Complete centralized logging with error
    if (executionId) {
      await cronJobLogger.completeExecution(executionId, {
        status: 'failure',
        message: 'Product metrics calculation failed',
        errorDetails: error instanceof Error ? error.message : 'Unknown error',
        stackTrace: error instanceof Error ? error.stack : undefined
      });
    }
    
    return NextResponse.json(
      { 
        error: 'Cron job failed',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

// Also support GET for Vercel cron (Vercel uses GET by default)
export async function GET(request: NextRequest) {
  // Allow both development testing and production cron execution
  return POST(request);
}
