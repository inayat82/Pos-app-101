import { NextRequest, NextResponse } from 'next/server';
import { NeonDataService } from '@/lib/neonDataService';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ integrationId: string }> }
) {
  try {
    const { integrationId } = await params;
    
    if (!integrationId) {
      return NextResponse.json(
        { error: 'Integration ID is required' },
        { status: 400 }
      );
    }

    // Get search parameters for filtering
    const searchParams = request.nextUrl.searchParams;
    const search = searchParams.get('search');
    const status = searchParams.getAll('status');
    const customerDc = searchParams.get('customer_dc');
    const orderStatus = searchParams.getAll('order_status');
    
    const dateStart = searchParams.get('date_start');
    const dateEnd = searchParams.get('date_end');
    
    const neonDataService = NeonDataService.getInstance();
    
    // Build filters object
    const filters: any = {};
    
    if (search) filters.search = search;
    if (status.length > 0) filters.status = status;
    if (customerDc) filters.customer_dc = customerDc;
    if (orderStatus.length > 0) filters.order_status = orderStatus;
    if (dateStart && dateEnd) {
      filters.date_range = {
        start: new Date(dateStart),
        end: new Date(dateEnd)
      };
    }

    let sales;
    if (Object.keys(filters).length > 0) {
      sales = await neonDataService.getSalesWithFilters(integrationId, filters);
    } else {
      sales = await neonDataService.getSales(integrationId);
    }

    return NextResponse.json({
      success: true,
      sales,
      count: sales.length,
      source: 'neon'
    });

  } catch (error) {
    console.error('Error fetching sales from Neon:', error);
    return NextResponse.json(
      { 
        error: 'Failed to fetch sales', 
        details: error instanceof Error ? error.message : 'Unknown error',
        source: 'neon'
      },
      { status: 500 }
    );
  }
}
