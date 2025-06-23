// src/app/api/admin/takealot/recalculate-metrics/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { calculateAllProductsWithTsinServer } from '@/lib/tsinBasedCalculationServiceServer';
import { calculateAllProductMetricsServer } from '@/lib/productMetricsCalculatorServer';

export async function POST(request: NextRequest) {
  console.log('RECALCULATION API HIT');
  try {
    const authToken = request.headers.get('authorization');
    console.log('Auth Token:', authToken);

    const body = await request.json();
    console.log('Request Body:', body);
    const { integrationId, useTsinCalculation } = body;

    if (!integrationId) {
      console.error('Missing integrationId');
      return NextResponse.json(
        { error: 'Integration ID is required' },
        { status: 400 }
      );
    }

    console.log(`Starting ${useTsinCalculation ? 'TSIN-based' : 'legacy'} recalculation for integration: ${integrationId}`);

    let result;
      if (useTsinCalculation) {
      // Use new TSIN-based calculation (recommended)
      console.log('Using optimized TSIN-based calculation method...');
      result = await calculateAllProductsWithTsinServer(integrationId, (progress) => {
        console.log(`TSIN Progress: ${progress.processed}/${progress.total} (${Math.round(progress.processed/progress.total*100)}%) - Current: ${progress.currentProduct}`);
      });
      console.log('TSIN-based calculation finished. Result:', result);
    } else {
      // Use legacy calculation method (fallback)
      console.log('Using legacy calculation method...');
      let lastProgressUpdate = Date.now();
      result = await calculateAllProductMetricsServer(integrationId, (progress) => {
        const now = Date.now();
        if (now - lastProgressUpdate > 2000 || progress.processed % 10 === 0) {
          console.log(`Legacy Progress: ${progress.processed}/${progress.total} (${Math.round(progress.processed/progress.total*100)}%) - Current: ${progress.currentProduct}`);
          lastProgressUpdate = now;
        }
      });
      console.log('Legacy calculation finished. Result:', result);
    }

    console.log('Sending success response');
    return NextResponse.json({
      success: true,
      integrationId,
      calculationMethod: useTsinCalculation ? 'TSIN-based' : 'Legacy',
      productsUpdated: result.success,
      errors: result.errors,
      message: `Successfully updated ${result.success} products using ${useTsinCalculation ? 'TSIN-based' : 'legacy'} calculation${result.errors.length > 0 ? ` with ${result.errors.length} errors` : ''}`,
      details: result.errors.length > 0 ? `Errors: ${result.errors.slice(0, 3).join(', ')}${result.errors.length > 3 ? '...' : ''}` : 'All products processed successfully'
    });

  } catch (error) {
    console.error('Recalculation failed spectacularly:', error);
    return NextResponse.json(
      { 
        error: 'Recalculation failed',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}
