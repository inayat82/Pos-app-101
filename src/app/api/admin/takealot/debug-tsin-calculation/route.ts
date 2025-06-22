// src/app/api/admin/takealot/debug-tsin-calculation/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { calculateTsinBasedMetrics } from '@/lib/tsinBasedCalculationService';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { integrationId, testProduct } = body;

    if (!integrationId) {
      return NextResponse.json(
        { error: 'Integration ID is required' },
        { status: 400 }
      );
    }

    console.log('Testing TSIN calculation for integration:', integrationId);

    // Test with a sample product or the provided test product
    const sampleProduct = testProduct || {
      tsin_id: '12345',
      sku: 'TEST-SKU',
      selling_price: 100,
      stock_at_takealot_total: 10,
      title: 'Test Product'
    };

    console.log('Testing with product:', sampleProduct);

    // Calculate metrics using TSIN-based approach
    const metrics = await calculateTsinBasedMetrics(integrationId, sampleProduct);

    return NextResponse.json({
      success: true,
      integrationId,
      testProduct: sampleProduct,
      calculatedMetrics: metrics,
      message: 'TSIN calculation test completed successfully'
    });

  } catch (error) {
    console.error('Error testing TSIN calculation:', error);
    return NextResponse.json(
      { 
        error: 'TSIN calculation test failed', 
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}
