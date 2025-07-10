// src/app/api/admin/takealot/get-products-paginated/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { NewTakealotService } from '@/lib/paginatedTakealotService';
import { dbAdmin as db } from '@/lib/firebase/firebaseAdmin';

interface ProductFilters {
  search?: string;
  status?: string[];
  minPrice?: number;
  maxPrice?: number;
  hasStock?: boolean;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

export async function POST(request: NextRequest) {
  console.log('[GetProductsPaginated] API endpoint called');
  try {
    const { 
      integrationId, 
      adminId, 
      page = 1, 
      limit = 20, 
      filters = {} 
    } = await request.json();

    console.log('[GetProductsPaginated] Request:', { 
      integrationId, 
      adminId, 
      page, 
      limit, 
      filters 
    });

    if (!integrationId || !adminId) {
      return NextResponse.json({ 
        success: false, 
        error: 'Integration ID and Admin ID are required' 
      }, { status: 400 });
    }

    // Verify integration ownership
    const integrationDoc = await db.collection('takealotIntegrations').doc(integrationId).get();
    
    if (!integrationDoc.exists) {
      return NextResponse.json({ 
        success: false, 
        error: 'Integration not found' 
      }, { status: 404 });
    }

    const integrationData = integrationDoc.data();
    if (integrationData?.adminId !== adminId) {
      return NextResponse.json({ 
        success: false, 
        error: 'Unauthorized access to this integration' 
      }, { status: 403 });
    }

    const service = new NewTakealotService();
    
    try {
      // Get paginated and filtered data
      const result = await service.getPaginatedProductsWithAnalytics(
        adminId, 
        integrationId, 
        page, 
        limit, 
        filters
      );
      
      console.log(`[GetProductsPaginated] Found ${result.data.length} products, total: ${result.total}`);

      return NextResponse.json({
        success: true,
        data: result.data,
        pagination: {
          page: result.page,
          limit: result.limit,
          total: result.total,
          totalPages: result.totalPages,
          hasNextPage: result.hasNextPage,
          hasPrevPage: result.hasPrevPage
        },
        analytics: result.analytics,
        source: 'neon_paginated'
      });
      
    } finally {
      await service.close();
    }

  } catch (error: any) {
    console.error('[GetProductsPaginated] Error:', error);
    
    return NextResponse.json({
      success: false,
      error: 'Failed to fetch paginated products',
      message: error.message
    }, { status: 500 });
  }
}
