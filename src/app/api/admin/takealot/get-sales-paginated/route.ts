// src/app/api/admin/takealot/get-sales-paginated/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { NewTakealotService } from '@/lib/paginatedTakealotService';
import { dbAdmin as db } from '@/lib/firebase/firebaseAdmin';

interface SalesFilters {
  search?: string;
  dateFrom?: string;
  dateTo?: string;
  status?: string[];
  minAmount?: number;
  maxAmount?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

export async function POST(request: NextRequest) {
  console.log('[GetSalesPaginated] API endpoint called');
  try {
    const { 
      integrationId, 
      adminId, 
      page = 1, 
      limit = 20, 
      filters = {} 
    } = await request.json();

    console.log('[GetSalesPaginated] Request:', { 
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
      // Get paginated and filtered sales data
      const result = await service.getPaginatedSalesWithAnalytics(
        adminId, 
        integrationId, 
        page, 
        limit, 
        filters
      );
      
      console.log(`[GetSalesPaginated] Found ${result.data.length} sales, total: ${result.total}`);

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
    console.error('[GetSalesPaginated] Error:', error);
    
    return NextResponse.json({
      success: false,
      error: 'Failed to fetch paginated sales',
      message: error.message
    }, { status: 500 });
  }
}
