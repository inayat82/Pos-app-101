import { NextRequest, NextResponse } from 'next/server';
import { takealotScrapingService } from '@/modules/auto-price/services/scraping.service';
import { TakealotUrlValidator, getSafeProductUrl } from '@/lib/takealot-url-validator';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { integrationId, tsin, productTitle, useProxy = true, extractAllSellers = true, offerUrl } = body;

    if (!integrationId || !tsin) {
      return NextResponse.json({
        success: false,
        error: 'Missing required fields: integrationId and tsin'
      }, { status: 400 });
    }

    // Ensure tsin is a string
    const tsinString = String(tsin);
    console.log(`🔥 REAL SCRAPING MODE: Starting live scraping for TSIN: ${tsinString}`);
    console.log(`📍 URL to scrape: ${offerUrl || 'NOT PROVIDED'}`);

    // Validate URL if provided
    if (offerUrl) {
      const validation = TakealotUrlValidator.validateUrl(offerUrl);
      if (!validation.isValid) {
        console.error(`🚨 INVALID offer_url provided: ${offerUrl}`);
        console.error(`Error: ${validation.errorMessage}`);
        return NextResponse.json({
          success: false,
          error: `Invalid URL: ${validation.errorMessage}`
        }, { status: 400 });
      } else {
        console.log(`✅ Using valid offer_url: ${offerUrl}`);
      }
    } else {
      console.error(`🚨 CRITICAL: No offer_url provided for scraping`);
      return NextResponse.json({
        success: false,
        error: 'No valid offer_url provided. Real scraping requires a valid Takealot product URL.'
      }, { status: 400 });
    }

    // ALWAYS use live scraping - NO MOCK DATA
    const scrapingResult = await takealotScrapingService.scrapeProduct(tsinString, true, offerUrl);

    if (!scrapingResult.success) {
      console.error('Scraping service failed:', scrapingResult.error);
      return NextResponse.json({
        success: false,
        error: scrapingResult.error || 'Scraping failed'
      }, { status: 500 });
    }

    const scrapedData = scrapingResult.data;
    if (!scrapedData) {
      console.error('No data returned from scraping service');
      return NextResponse.json({
        success: false,
        error: 'No data returned from scraping service'
      }, { status: 500 });
    }

    console.log('Scraped data received:', {
      winnerSeller: scrapedData.winnerSeller,
      winnerPrice: scrapedData.winnerPrice,
      totalSellers: scrapedData.totalSellers,
      competitorsCount: scrapedData.competitors?.length || 0
    });

    // Transform the scraped data to match our expected format
    const transformedData = {
      tsin: tsinString,
      plid: `PLID${tsinString}`, // Generate PLID from TSIN if not available
      title: productTitle || `Product ${tsinString}`,
      brand: null, // This would need to be extracted from HTML if available
      barcode: null, // This would need to be extracted from HTML if available
      productUrl: offerUrl || `https://www.takealot.com/p/${tsinString}`, // Use provided URL or fallback
      imageUrl: null, // This would need to be extracted from HTML if available
      
      // Winner information
      winnerSeller: scrapedData.winnerSeller || 'Unknown',
      winnerPrice: scrapedData.winnerPrice || 0,
      winnerStock: 'In Stock', // Default value, would need to be extracted
      winDifference: 0, // Will be calculated based on our price
      winPrice: scrapedData.winnerPrice || 0,
      
      // Market data
      totalSellers: scrapedData.totalSellers || 0,
      reviewCount: scrapedData.reviewCount || 0,
      rating: scrapedData.rating || 0,
      
      // Competitive sellers
      sellers: scrapedData.competitors?.map((competitor, index) => ({
        name: competitor.seller,
        price: competitor.price,
        stock: 'In Stock', // Default value
        isWinner: index === 0, // Assume first competitor is winner
        rank: index + 1
      })) || [],
      
      // Scraping metadata
      proxyUsed: scrapedData.proxyUsed,
      scrapingDuration: scrapedData.duration,
    };

    return NextResponse.json({
      success: true,
      data: transformedData
    });

  } catch (error) {
    console.error('Error in live scraping API:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred'
    }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  return NextResponse.json({
    message: 'Live scraping API is running',
    endpoints: {
      'POST /api/admin/auto-price/scrape-live-data': 'Scrape live product data from Takealot'
    }
  });
}
