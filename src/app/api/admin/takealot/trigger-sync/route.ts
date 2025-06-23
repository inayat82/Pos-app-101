// src/app/api/admin/takealot/trigger-sync/route.ts
import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { integrationId, syncType, strategy } = body;

    if (!integrationId || !syncType) {
      return NextResponse.json({ error: 'Missing required parameters' }, { status: 400 });
    }

    // Determine which API endpoint to call based on strategy
    let apiPath = '';
    
    if (syncType === 'sales') {
      switch (strategy) {
        case 'sls_100':
          // Use the existing takealot data manager for optimized fetching
          apiPath = `/api/admin/takealot/fetch-sales?integrationId=${integrationId}&limit=100&optimized=true`;
          break;
        case 'sls_30d':
          apiPath = `/api/admin/takealot/fetch-sales?integrationId=${integrationId}&days=30&optimized=true`;
          break;
        case 'sls_6m':
          apiPath = `/api/admin/takealot/fetch-sales?integrationId=${integrationId}&days=180&optimized=true`;
          break;
        case 'sls_all':
          apiPath = `/api/admin/takealot/fetch-sales?integrationId=${integrationId}&optimized=true`;
          break;
        default:
          return NextResponse.json({ error: 'Invalid sales strategy' }, { status: 400 });
      }
    } else if (syncType === 'products') {
      switch (strategy) {
        case 'prd_100_3h':
          apiPath = `/api/admin/takealot/fetch-offers?integrationId=${integrationId}&limit=100&optimized=true`;
          break;
        case 'prd_200_man':
          apiPath = `/api/admin/takealot/fetch-offers?integrationId=${integrationId}&limit=200&optimized=true`;
          break;
        case 'prd_all_6h':
        case 'prd_all_12h':
          apiPath = `/api/admin/takealot/fetch-offers?integrationId=${integrationId}&optimized=true`;
          break;
        default:
          return NextResponse.json({ error: 'Invalid product strategy' }, { status: 400 });
      }
    } else {
      return NextResponse.json({ error: 'Invalid sync type' }, { status: 400 });
    }

    // Get the base URL for the API call
    const baseUrl = process.env.VERCEL_URL 
      ? `https://${process.env.VERCEL_URL}` 
      : process.env.NEXTAUTH_URL || 'http://localhost:3000';

    // Make the API call
    const response = await fetch(`${baseUrl}${apiPath}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      return NextResponse.json({ 
        error: 'Sync operation failed', 
        details: errorText,
        status: response.status 
      }, { status: 500 });
    }

    const result = await response.json();
    
    return NextResponse.json({
      success: true,
      message: `${syncType} sync completed successfully`,
      data: result
    });

  } catch (error: any) {
    console.error('Error triggering sync:', error);
    return NextResponse.json({
      error: 'Failed to trigger sync',
      details: error.message
    }, { status: 500 });
  }
}
