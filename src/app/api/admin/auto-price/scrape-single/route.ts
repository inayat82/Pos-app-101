// Single Product Scraping API for Auto Price Playground
import { NextRequest, NextResponse } from 'next/server';
import { takealotScrapingService } from '@/modules/auto-price/services/scraping.service';
import { dbAdmin as db } from '@/lib/firebase/firebaseAdmin';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { integrationId, tsin, testMode = true } = body;

    if (!integrationId || !tsin) {
      return NextResponse.json({ error: 'Integration ID and TSIN are required' }, { status: 400 });
    }

    // Validate TSIN format (should be numeric)
    if (!/^\d+$/.test(tsin)) {
      return NextResponse.json({ error: 'Invalid TSIN format' }, { status: 400 });
    }

    const startTime = Date.now();
    
    // Try to get offer_url from database
    let offer_url: string | null = null;
    try {
      console.log(`[DEBUG] Looking up offer_url for TSIN: ${tsin} in integration: ${integrationId}`);
      
      // Try different collection paths and field names to find the products
      const searchStrategies = [
        { collection: 'takealot_offers', field: 'tsin_id' }, // PRIMARY: TSIN is stored as tsin_id
        { collection: 'takealot_offers', field: 'offer_id' }, // SECONDARY: User might enter offer_id instead
        { collection: `takealot_integrations/${integrationId}/products`, field: 'tsin_id' },
        { collection: `takealotIntegrations/${integrationId}/products`, field: 'tsin_id' },
        { collection: 'takealot_offers', field: 'product_label_number' }, // FALLBACK: product label
      ];
      
      let productFound = false;
      
      for (const strategy of searchStrategies) {
        console.log(`[DEBUG] Trying ${strategy.collection} with field ${strategy.field}`);
        
        try {
          const productsRef = db.collection(strategy.collection);
          let queryValue = tsin;
          
          // Try both as string and number for offer_id and tsin_id  
          if (strategy.field === 'offer_id') {
            queryValue = parseInt(tsin);
            console.log(`[DEBUG] Searching for offer_id as number: ${queryValue}`);
          } else if (strategy.field === 'tsin_id') {
            queryValue = parseInt(tsin);
            console.log(`[DEBUG] Searching for tsin_id as number: ${queryValue}`);
          }
          
          const productQuery = await productsRef.where(strategy.field, '==', queryValue).limit(1).get();
          
          console.log(`[DEBUG] Query in ${strategy.collection} (${strategy.field}=${queryValue}) found ${productQuery.size} documents`);
          
          if (!productQuery.empty) {
            const productData = productQuery.docs[0].data();
            offer_url = productData.offer_url || null;
            console.log(`[DEBUG] Found product data in ${strategy.collection}:`, {
              offer_id: productData.offer_id,
              tsin_id: productData.tsin_id,
              offer_url: productData.offer_url,
              title: productData.title || 'No title',
              product_label_number: productData.product_label_number
            });
            console.log(`[DEBUG] Extracted offer_url:`, offer_url);
            productFound = true;
            break;
          }
        } catch (error) {
          console.log(`[DEBUG] Error searching ${strategy.collection} with ${strategy.field}:`, error);
        }
      }
      
      if (!productFound) {
        console.log(`[DEBUG] No product found with TSIN: ${tsin} using any strategy`);
        
        // Show sample data to understand the structure
        const offersRef = db.collection('takealot_offers');
        const sampleQuery = await offersRef.limit(3).get();
        console.log(`[DEBUG] Sample document structure from takealot_offers:`);
        sampleQuery.docs.forEach((doc: any, index: number) => {
          console.log(`[DEBUG] Document ${index + 1}:`, {
            id: doc.id,
            data: doc.data()
          });
        });
      }
    } catch (dbError) {
      console.warn(`[DEBUG] Database lookup failed for TSIN ${tsin}:`, dbError);
      // Continue without offer_url
    }
    
    try {
      // Use the real scraping service for playground testing
      const scrapingResult = await takealotScrapingService.scrapeProduct(tsin);

      const scrapingDuration = Date.now() - startTime;

      if (scrapingResult.success && scrapingResult.data) {
        // Extract title and image from scraping result, with fallbacks
        let title = scrapingResult.data.title || `Product TSIN: ${tsin}`;
        let imageUrl = scrapingResult.data.imageUrl || '';
        let breadcrumbs = scrapingResult.data.breadcrumbs || [];

        // Provide fallback images for development
        if (!imageUrl) {
          if (process.env.NODE_ENV === 'development') {
            // Generate realistic mock data based on TSIN
            const products = [
              { name: 'Apple MacBook Pro 13-inch', image: 'https://via.placeholder.com/500x500?text=Apple+MacBook+Pro' },
              { name: 'Samsung Galaxy S24 Ultra', image: 'https://via.placeholder.com/500x500?text=Samsung+Galaxy+S24' },
              { name: 'Sony WH-1000XM5 Headphones', image: 'https://via.placeholder.com/500x500?text=Sony+Headphones' },
              { name: 'Nintendo Switch OLED', image: 'https://via.placeholder.com/500x500?text=Nintendo+Switch' },
              { name: 'Dell XPS 15 Laptop', image: 'https://via.placeholder.com/500x500?text=Dell+XPS+15' }
            ];
            
            const product = products[parseInt(tsin.slice(-1)) % products.length];
            if (!title || title === `Product TSIN: ${tsin}`) {
              title = product.name;
            }
            imageUrl = product.image;
            if (breadcrumbs.length === 0) {
              breadcrumbs = ['Electronics', 'Computing', 'Test Category'];
            }
          } else {
            imageUrl = `https://via.placeholder.com/500x500?text=Product+${tsin}`;
          }
        }

        return NextResponse.json({
          tsin,
          url: `https://www.takealot.com/p/${tsin}`,
          offer_url,
          title,
          price: scrapingResult.data.winnerPrice || 0,
          rating: scrapingResult.data.rating || 0,
          reviewCount: scrapingResult.data.reviewCount || 0,
          winnerSeller: scrapingResult.data.winnerSeller || 'Unknown',
          winnerSellerPrice: scrapingResult.data.winnerPrice || 0,
          totalSellers: scrapingResult.data.totalSellers || 1,
          imageUrl,
          availability: scrapingResult.data.availability === 'in-stock' ? 'In Stock' : 
                       scrapingResult.data.availability === 'out-of-stock' ? 'Out of Stock' : 
                       scrapingResult.data.availability === 'limited' ? 'Limited Stock' : 'Unknown',
          breadcrumbs,
          competitors: scrapingResult.data.competitors.map(comp => ({
            name: comp.seller,
            price: comp.price,
            inStock: true // Default to true for now
          })) || [],
          scrapingDuration,
          proxyUsed: scrapingResult.data.proxyUsed || 'None',
          success: true,
        });
      } else {
        return NextResponse.json({
          tsin,
          url: `https://www.takealot.com/p/${tsin}`,
          offer_url,
          title: `Product TSIN: ${tsin}`,
          price: 0,
          rating: 0,
          reviewCount: 0,
          winnerSeller: '',
          winnerSellerPrice: 0,
          totalSellers: 0,
          imageUrl: '',
          availability: '',
          breadcrumbs: [],
          scrapingDuration,
          proxyUsed: 'None',
          success: false,
          errorMessage: scrapingResult.error || 'Unknown scraping error',
        });
      }
    } catch (scrapingError: any) {
      const scrapingDuration = Date.now() - startTime;
      
      return NextResponse.json({
        tsin,
        url: `https://www.takealot.com/p/${tsin}`,
        offer_url,
        title: `Product TSIN: ${tsin}`,
        price: 0,
        rating: 0,
        reviewCount: 0,
        winnerSeller: '',
        winnerSellerPrice: 0,
        totalSellers: 0,
        imageUrl: '',
        availability: '',
        breadcrumbs: [],
        scrapingDuration,
        proxyUsed: 'None',
        success: false,
        errorMessage: scrapingError.message || 'Scraping service error',
      });
    }
  } catch (error: any) {
    console.error('Error in single scrape API:', error);
    return NextResponse.json({ 
      error: 'Failed to scrape product',
      details: error.message 
    }, { status: 500 });
  }
}
