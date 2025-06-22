// src/app/api/admin/takealot/recalculate-metrics/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { calculateAllProductMetrics } from '@/lib/productMetricsCalculator';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { integrationId } = body;

    if (!integrationId) {
      return NextResponse.json(
        { error: 'Integration ID is required' },
        { status: 400 }
      );
    }

    console.log(`Starting manual recalculation for integration: ${integrationId}`);

    const result = await calculateAllProductMetrics(integrationId, (progress) => {
      console.log(`Progress: ${progress.processed}/${progress.total} - ${progress.currentProduct}`);
    });

    return NextResponse.json({
      success: true,
      integrationId,
      productsUpdated: result.success,
      errors: result.errors
    });

  } catch (error) {
    console.error('Manual recalculation failed:', error);
    return NextResponse.json(
      { 
        error: 'Recalculation failed',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}
