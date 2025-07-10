// API Route for Enhanced Takealot API Scraping - Phase 1
import { NextRequest, NextResponse } from 'next/server';
import { takealotApiService } from '@/modules/auto-price/services/takealot-api.service';

export async function POST(request: NextRequest) {
  try {
    const { tsin, method = 'api' } = await request.json();

    if (!tsin) {
      return NextResponse.json({
        success: false,
        error: 'TSIN is required'
      }, { status: 400 });
    }

    console.log(`[API] Starting enhanced scraping for TSIN: ${tsin} using method: ${method}`);

    let result;
    
    if (method === 'api') {
      // Use new API-based scraping
      result = await takealotApiService.scrapeProductByTsin(tsin);
    } else {
      // Fallback to original HTML scraping
      const { autoPriceWebshareService } = await import('@/modules/auto-price/services/webshare.service');
      const { TakealotScrapingService } = await import('@/modules/auto-price/services/scraping.service');
      
      const scrapingService = new TakealotScrapingService();
      result = await scrapingService.scrapeProduct(tsin, true);
    }

    if (!result.success) {
      console.error(`[API] Scraping failed for TSIN ${tsin}:`, result.error);
      return NextResponse.json({
        success: false,
        error: result.error || 'Scraping failed',
        method,
        tsin
      }, { status: 500 });
    }

    console.log(`[API] ✅ Successfully scraped TSIN ${tsin} using ${method} method`);

    return NextResponse.json({
      success: true,
      data: result.data,
      metadata: {
        method,
        tsin,
        duration: result.duration,
        scrapedAt: new Date().toISOString(),
        apiCallsMade: result.apiCallsMade || 1
      },
      // Include raw responses for field analysis
      rawResponses: result.rawResponses || null
    });

  } catch (error) {
    console.error('[API] Enhanced scraping error:', error);
    
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred'
    }, { status: 500 });
  }
}
