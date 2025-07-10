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
    const category = searchParams.get('category');
    const brand = searchParams.get('brand');
    const stockLevel = searchParams.get('stock_level') as 'all' | 'in_stock' | 'out_of_stock';
    
    const priceMin = searchParams.get('price_min');
    const priceMax = searchParams.get('price_max');
    
    const neonDataService = NeonDataService.getInstance();
    
    // Build filters object
    const filters: any = {};
    
    if (search) filters.search = search;
    if (status.length > 0) filters.status = status;
    if (category) filters.category = category;
    if (brand) filters.brand = brand;
    if (stockLevel) filters.stock_level = stockLevel;
    if (priceMin && priceMax) {
      filters.price_range = {
        min: parseFloat(priceMin),
        max: parseFloat(priceMax)
      };
    }

    let products;
    if (Object.keys(filters).length > 0) {
      products = await neonDataService.getProductsWithFilters(integrationId, filters);
    } else {
      products = await neonDataService.getProducts(integrationId);
    }

    return NextResponse.json({
      success: true,
      products,
      count: products.length,
      source: 'neon'
    });

  } catch (error) {
    console.error('Error fetching products from Neon:', error);
    return NextResponse.json(
      { 
        error: 'Failed to fetch products', 
        details: error instanceof Error ? error.message : 'Unknown error',
        source: 'neon'
      },
      { status: 500 }
    );
  }
}
