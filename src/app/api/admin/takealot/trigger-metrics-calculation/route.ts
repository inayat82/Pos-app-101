// src/app/api/admin/takealot/trigger-metrics-calculation/route.ts
import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { integrationId } = body;

    if (!integrationId) {
      return NextResponse.json({ error: 'Missing integrationId' }, { status: 400 });
    }

    // Get the base URL for the API call
    const baseUrl = process.env.VERCEL_URL 
      ? `https://${process.env.VERCEL_URL}` 
      : process.env.NEXTAUTH_URL || 'http://localhost:3000';

    // Call the existing metrics recalculation API
    const response = await fetch(`${baseUrl}/api/admin/takealot/recalculate-metrics`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ integrationId }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      return NextResponse.json({ 
        error: 'Metrics calculation failed', 
        details: errorText,
        status: response.status 
      }, { status: 500 });
    }

    const result = await response.json();
    
    return NextResponse.json({
      success: true,
      message: 'Product metrics recalculated successfully',
      data: result
    });

  } catch (error: any) {
    console.error('Error triggering metrics calculation:', error);
    return NextResponse.json({
      error: 'Failed to trigger metrics calculation',
      details: error.message
    }, { status: 500 });
  }
}
