// API Route for scraping user's own Takealot products with JSON response
import { NextRequest, NextResponse } from 'next/server';
import { dbAdmin as db } from '@/lib/firebase/firebaseAdmin';
import { takealotApiService } from '@/modules/auto-price/services/takealot-api.service';

// Helper function to calculate title similarity
function calculateTitleSimilarity(expected: string, scraped: string): number {
  const normalizeText = (text: string) => text.toLowerCase().replace(/[^\w\s]/g, '').trim();
  
  const expectedNorm = normalizeText(expected);
  const scrapedNorm = normalizeText(scraped);
  
  if (expectedNorm === scrapedNorm) return 1.0;
  
  // Split into words and find common words
  const expectedWords = expectedNorm.split(/\s+/);
  const scrapedWords = scrapedNorm.split(/\s+/);
  
  if (expectedWords.length === 0 || scrapedWords.length === 0) return 0;
  
  const commonWords = expectedWords.filter(word => 
    word.length > 2 && scrapedWords.includes(word)
  );
  
  // Calculate similarity based on common words ratio
  const maxWords = Math.max(expectedWords.length, scrapedWords.length);
  return commonWords.length / maxWords;
}

export async function POST(request: NextRequest) {
  try {
    const { integrationId, maxProducts = 10 } = await request.json();

    if (!integrationId) {
      return NextResponse.json({
        success: false,
        error: 'Integration ID is required'
      }, { status: 400 });
    }

    console.log(`[User Products Scraper] Starting scrape for integration: ${integrationId}`);

    // Fetch user's products from their integration
    let userProducts: any[] = [];
    
    try {
      // Try takealot_offers first (newer collection)
      const offersSnapshot = await db.collection('takealot_offers')
        .where('integrationId', '==', integrationId)
        .where('status', '==', 'Buyable')
        .limit(maxProducts)
        .get();
      
      if (!offersSnapshot.empty) {
        userProducts = offersSnapshot.docs.map((doc: any) => {
          const data = doc.data();
          return {
            id: doc.id,
            tsin: data.tsin_id || data.tsin, // Handle both field names
            title: data.title || 'Unknown Product',
            sku: data.sku || data.product_label_number || 'N/A',
            currentPrice: data.selling_price || 0,
            status: data.status || 'Unknown',
            imageUrl: data.image_url,
            offer_url: data.offer_url // CRITICAL: Include actual product URL
          };
        }).filter((product: any) => product.tsin && product.offer_url); // Only include products with TSIN AND offer_url
        console.log(`[User Products Scraper] Found ${userProducts.length} products in takealot_offers`);
      } else {
        // Fallback to takealotProducts collection
        const productsSnapshot = await db.collection('takealotProducts')
          .where('integrationId', '==', integrationId)
          .where('status', '==', 'Buyable')
          .limit(maxProducts)
          .get();
        
        if (!productsSnapshot.empty) {
          userProducts = productsSnapshot.docs.map((doc: any) => {
            const data = doc.data();
            return {
              id: doc.id,
              tsin: data.tsin_id || data.tsin, // Handle both field names
              title: data.title || 'Unknown Product',
              sku: data.sku || 'N/A',
              currentPrice: data.price || data.selling_price || 0,
              status: data.status || 'Unknown',
              imageUrl: data.image_url,
              offer_url: data.offer_url // CRITICAL: Include actual product URL
            };
          }).filter((product: any) => product.tsin && product.offer_url); // Only include products with TSIN AND offer_url
          console.log(`[User Products Scraper] Found ${userProducts.length} products in takealotProducts`);
        }
      }
    } catch (dbError) {
      console.error('[User Products Scraper] Database error:', dbError);
      return NextResponse.json({
        success: false,
        error: 'Database connection error',
        details: dbError instanceof Error ? dbError.message : 'Unknown database error'
      }, { status: 500 });
    }

    if (userProducts.length === 0) {
      return NextResponse.json({
        success: false,
        error: 'No buyable products found for this integration',
        suggestion: 'Please sync your products first from Settings page. Searched in both takealot_offers and takealotProducts collections.'
      }, { status: 404 });
    }

    console.log(`[User Products Scraper] Found ${userProducts.length} products to scrape`);

    // Helper function to scrape a single product
    const scrapeProduct = async (product: any) => {
      const startTime = Date.now();
      
      try {
        if (!product.tsin) {
          console.warn(`[User Products Scraper] Skipping product without TSIN: ${product.title}`);
          return {
            userProduct: product,
            scrapingSuccess: false,
            scrapedData: null,
            scrapingError: 'Product missing TSIN identifier',
            rawApiResponse: null,
            scrapingDuration: Date.now() - startTime,
            scrapedAt: new Date().toISOString(),
            proxyDetails: {
              ip: "Direct Connection",
              location: "Local", 
              provider: "None"
            }
          };
        }

        console.log(`[User Products Scraper] Scraping TSIN: ${product.tsin} - ${product.title}`);
        console.log(`[User Products Scraper] Using URL: ${product.offer_url}`);
        
        const scrapingResult = await takealotApiService.scrapeProductByTsinAndUrl(product.tsin, product.offer_url);
        
        // Validate scraped data matches expected product
        if (scrapingResult.success && scrapingResult.data) {
          const expectedTitle = product.title.toLowerCase();
          const scrapedTitle = scrapingResult.data.title.toLowerCase();
          
          // Check if titles are completely different (possible mismatch)
          const titleSimilarity = calculateTitleSimilarity(expectedTitle, scrapedTitle);
          if (titleSimilarity < 0.3) { // Less than 30% similarity
            console.warn(`[User Products Scraper] ⚠️ Title mismatch for TSIN ${product.tsin}:`);
            console.warn(`[User Products Scraper] Expected: "${product.title}"`);
            console.warn(`[User Products Scraper] Scraped: "${scrapingResult.data.title}"`);
            console.warn(`[User Products Scraper] Similarity: ${(titleSimilarity * 100).toFixed(1)}%`);
            
            // Add warning to the result
            scrapingResult.data.titleMismatchWarning = {
              expected: product.title,
              scraped: scrapingResult.data.title,
              similarity: titleSimilarity
            };
          }
        }
        
        return {
          userProduct: product,
          scrapingSuccess: scrapingResult.success,
          scrapedData: scrapingResult.data || null,
          scrapingError: scrapingResult.error || null,
          rawApiResponse: scrapingResult.rawResponses || null,
          scrapingDuration: scrapingResult.duration,
          scrapedAt: new Date().toISOString(),
          proxyDetails: {
            ip: scrapingResult.proxyInfo?.address || "Direct Connection",
            location: scrapingResult.proxyInfo?.usedProxy 
              ? `${scrapingResult.proxyInfo.city}, ${scrapingResult.proxyInfo.country}`
              : "Local",
            provider: scrapingResult.proxyInfo?.usedProxy ? "WebShare" : "None"
          }
        };
        
      } catch (error) {
        console.error(`[User Products Scraper] Error scraping product ${product.tsin}:`, error);
        
        return {
          userProduct: product,
          scrapingSuccess: false,
          scrapedData: null,
          scrapingError: error instanceof Error ? error.message : 'Unknown error',
          rawApiResponse: null,
          scrapingDuration: Date.now() - startTime,
          scrapedAt: new Date().toISOString(),
          proxyDetails: {
            ip: "Direct Connection",
            location: "Local",
            provider: "None"
          }
        };
      }
    };

    // 🚀 FAST PARALLEL SCRAPING with controlled concurrency
    const BATCH_SIZE = 5; // Process 5 products simultaneously
    const scrapingResults = [];
    
    console.log(`[User Products Scraper] 🚀 Starting FAST parallel scraping with batches of ${BATCH_SIZE}`);
    
    for (let i = 0; i < userProducts.length; i += BATCH_SIZE) {
      const batch = userProducts.slice(i, i + BATCH_SIZE);
      console.log(`[User Products Scraper] Processing batch ${Math.floor(i/BATCH_SIZE) + 1}/${Math.ceil(userProducts.length/BATCH_SIZE)} (${batch.length} products)`);
      
      // Process batch in parallel
      const batchResults = await Promise.allSettled(
        batch.map(product => scrapeProduct(product))
      );
      
      // Extract results from Promise.allSettled
      const batchData = batchResults.map(result => 
        result.status === 'fulfilled' ? result.value : {
          userProduct: { title: 'Unknown', tsin: 'Unknown' },
          scrapingSuccess: false,
          scrapedData: null,
          scrapingError: result.status === 'rejected' ? result.reason : 'Batch processing failed',
          rawApiResponse: null,
          scrapingDuration: 0,
          scrapedAt: new Date().toISOString(),
          proxyDetails: { ip: "Error", location: "Error", provider: "Error" }
        }
      );
      
      scrapingResults.push(...batchData);
      
      // Short delay between batches only (instead of per product)
      if (i + BATCH_SIZE < userProducts.length) {
        console.log(`[User Products Scraper] ⏳ Brief pause between batches (250ms)...`);
        await new Promise(resolve => setTimeout(resolve, 250));
      }
    }

    const successfulScrapes = scrapingResults.filter(r => r.scrapingSuccess).length;
    const failedScrapes = scrapingResults.length - successfulScrapes;

    console.log(`[User Products Scraper] ✅ Completed scraping. Success: ${successfulScrapes}, Failed: ${failedScrapes}`);

    return NextResponse.json({
      success: true,
      integrationId,
      summary: {
        totalProducts: userProducts.length,
        successfulScrapes,
        failedScrapes,
        scrapingMethod: 'parallel-api' // Updated to reflect fast parallel processing
      },
      scrapingResults,
      metadata: {
        scrapedAt: new Date().toISOString(),
        maxProductsRequested: maxProducts,
        actualProductsFound: userProducts.length
      }
    });

  } catch (error) {
    console.error('[User Products Scraper] Error:', error);
    
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred'
    }, { status: 500 });
  }
}
