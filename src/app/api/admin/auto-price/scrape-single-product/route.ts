// API Route for scraping a single user product with JSON response using proxy
import { NextRequest, NextResponse } from 'next/server';
import { takealotApiService } from '@/modules/auto-price/services/takealot-api.service';

export async function POST(request: NextRequest) {
  try {
    const { integrationId, tsin, productTitle, productSku, useProxy = true } = await request.json();

    if (!integrationId) {
      return NextResponse.json({
        success: false,
        error: 'Integration ID is required'
      }, { status: 400 });
    }

    if (!tsin) {
      return NextResponse.json({
        success: false,
        error: 'Product TSIN is required'
      }, { status: 400 });
    }

    console.log(`[Single Product Scraper] Starting scrape for TSIN: ${tsin}`);
    console.log(`[Single Product Scraper] Product: ${productTitle || 'Unknown'}`);
    console.log(`[Single Product Scraper] Using Proxy: ${useProxy}`);

    const startTime = Date.now();

    try {
      // Use the same takealotApiService as bulk scraper for consistency
      const scrapingResult = await takealotApiService.scrapeProductByTsin(tsin);
      
      const scrapingDuration = Date.now() - startTime;

      if (scrapingResult.success) {
        console.log(`[Single Product Scraper] ✅ Successfully scraped TSIN: ${tsin} in ${scrapingDuration}ms`);
        
        return NextResponse.json({
          success: true,
          integrationId,
          productInfo: {
            tsin,
            title: productTitle,
            sku: productSku
          },
          scrapingResult: {
            success: true,
            scrapedData: scrapingResult.data,
            scrapingError: null,
            rawApiResponse: scrapingResult.rawResponses,
            scrapingDuration,
            scrapedAt: new Date().toISOString(),
            proxyUsed: useProxy ? 'webshare' : 'direct',
            scrapingMethod: 'api'
          },
          metadata: {
            scrapedAt: new Date().toISOString(),
            requestedProxy: useProxy,
            actualDuration: scrapingDuration
          }
        });
      } else {
        console.error(`[Single Product Scraper] ❌ Failed to scrape TSIN: ${tsin}`, scrapingResult.error);
        
        return NextResponse.json({
          success: false,
          integrationId,
          productInfo: {
            tsin,
            title: productTitle,
            sku: productSku
          },
          scrapingResult: {
            success: false,
            scrapedData: null,
            scrapingError: scrapingResult.error || 'Unknown scraping error',
            rawApiResponse: scrapingResult.rawResponses,
            scrapingDuration,
            scrapedAt: new Date().toISOString(),
            proxyUsed: useProxy ? 'webshare' : 'direct',
            scrapingMethod: 'api'
          },
          metadata: {
            scrapedAt: new Date().toISOString(),
            requestedProxy: useProxy,
            actualDuration: scrapingDuration
          }
        });
      }
      
    } catch (scrapingError) {
      const scrapingDuration = Date.now() - startTime;
      console.error(`[Single Product Scraper] ❌ Scraping error for TSIN: ${tsin}`, scrapingError);
      
      return NextResponse.json({
        success: false,
        integrationId,
        productInfo: {
          tsin,
          title: productTitle,
          sku: productSku
        },
        scrapingResult: {
          success: false,
          scrapedData: null,
          scrapingError: scrapingError instanceof Error ? scrapingError.message : 'Unknown scraping error',
          rawApiResponse: null,
          scrapingDuration,
          scrapedAt: new Date().toISOString(),
          proxyUsed: useProxy ? 'webshare' : 'direct',
          scrapingMethod: 'api'
        },
        metadata: {
          scrapedAt: new Date().toISOString(),
          requestedProxy: useProxy,
          actualDuration: scrapingDuration
        }
      }, { status: 500 });
    }

  } catch (error) {
    console.error('[Single Product Scraper] Error:', error);
    
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred',
      details: 'Check server logs for more information'
    }, { status: 500 });
  }
}
