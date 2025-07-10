// API Route for searching user's own Takealot products
import { NextRequest, NextResponse } from 'next/server';
import { dbAdmin as db } from '@/lib/firebase/firebaseAdmin';

export async function POST(request: NextRequest) {
  try {
    const { integrationId, searchQuery = '', limit = 20 } = await request.json();

    if (!integrationId) {
      return NextResponse.json({
        success: false,
        error: 'Integration ID is required'
      }, { status: 400 });
    }

    console.log(`[Search User Products] Searching for: "${searchQuery}" in integration: ${integrationId}`);

    let userProducts: any[] = [];
    
    try {
      // Build query for both collections
      const buildQuery = (collection: any) => {
        let query = collection.where('integrationId', '==', integrationId);
        
        // Add search filter if provided
        if (searchQuery.trim()) {
          // For Firebase, we'll get all products and filter client-side
          // In a production app, you might want to use Algolia or similar for better search
          return query.limit(100); // Get more to filter
        }
        
        return query.limit(limit);
      };

      // Try takealot_offers first (newer collection)
      const offersSnapshot = await buildQuery(db.collection('takealot_offers')).get();
      
      if (!offersSnapshot.empty) {
        let products = offersSnapshot.docs.map((doc: any) => {
          const data = doc.data();
          return {
            id: doc.id,
            tsin: data.tsin_id || data.tsin,
            title: data.title || 'Unknown Product',
            sku: data.sku || data.product_label_number || 'N/A',
            currentPrice: data.selling_price || 0,
            status: data.status || 'Unknown',
            imageUrl: data.image_url,
            url: data.offer_url || data.url,
            offer_url: data.offer_url,
            barcode: data.barcode,
            plid: data.plid
          };
        });

        // Client-side search filtering
        if (searchQuery.trim()) {
          const query = searchQuery.toLowerCase();
          products = products.filter((product: any) => 
            product.title.toLowerCase().includes(query) ||
            product.sku.toLowerCase().includes(query) ||
            product.tsin.toLowerCase().includes(query)
          );
        }

        userProducts = products.slice(0, limit);
        console.log(`[Search User Products] Found ${userProducts.length} products in takealot_offers`);
      } else {
        // Fallback to takealotProducts collection
        const productsSnapshot = await buildQuery(db.collection('takealotProducts')).get();
        
        if (!productsSnapshot.empty) {
          let products = productsSnapshot.docs.map((doc: any) => {
            const data = doc.data();
            return {
              id: doc.id,
              tsin: data.tsin_id || data.tsin,
              title: data.title || 'Unknown Product',
              sku: data.sku || 'N/A',
              currentPrice: data.price || data.selling_price || 0,
              status: data.status || 'Unknown',
              imageUrl: data.image_url,
              url: data.offer_url || data.url,
              offer_url: data.offer_url,
              barcode: data.barcode,
              plid: data.plid
            };
          });

          // Client-side search filtering
          if (searchQuery.trim()) {
            const query = searchQuery.toLowerCase();
            products = products.filter((product: any) => 
              product.title.toLowerCase().includes(query) ||
              product.sku.toLowerCase().includes(query) ||
              product.tsin.toLowerCase().includes(query)
            );
          }

          userProducts = products.slice(0, limit);
          console.log(`[Search User Products] Found ${userProducts.length} products in takealotProducts`);
        }
      }
    } catch (dbError) {
      console.error('[Search User Products] Database error:', dbError);
      return NextResponse.json({
        success: false,
        error: 'Database connection error',
        details: dbError instanceof Error ? dbError.message : 'Unknown database error'
      }, { status: 500 });
    }

    // Filter out products without TSIN
    userProducts = userProducts.filter((product: any) => product.tsin);

    console.log(`[Search User Products] ✅ Returning ${userProducts.length} products`);

    return NextResponse.json({
      success: true,
      integrationId,
      searchQuery,
      products: userProducts,
      metadata: {
        searchedAt: new Date().toISOString(),
        totalFound: userProducts.length,
        searchMethod: searchQuery.trim() ? 'filtered' : 'all'
      }
    });

  } catch (error) {
    console.error('[Search User Products] Error:', error);
    
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred'
    }, { status: 500 });
  }
}
