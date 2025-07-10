// Search Products API for Auto Price Playground
import { NextRequest, NextResponse } from 'next/server';
import { dbAdmin as db } from '@/lib/firebase/firebaseAdmin';
import { TakealotUrlValidator, getSafeProductUrl } from '@/lib/takealot-url-validator';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const integrationId = searchParams.get('integrationId');
    const searchQuery = searchParams.get('query');

    if (!integrationId || !searchQuery) {
      return NextResponse.json({ error: 'Integration ID and search query are required' }, { status: 400 });
    }

    const products: any[] = [];
    const cleanQuery = searchQuery.trim().toLowerCase();

    try {
      // Search in main takealot_offers collection (primary data source)
      // CRITICAL: Filter by integrationId to prevent data mixing between integrations
      const offersRef = db.collection('takealot_offers');
      
      // Search by TSIN ID (exact match) - FILTERED BY INTEGRATION
      const tsinQuery = await offersRef
        .where('integrationId', '==', integrationId)
        .where('tsin_id', '==', parseInt(cleanQuery))
        .limit(10)
        .get();
      
      // Search by SKU (exact match) - FILTERED BY INTEGRATION  
      const skuQuery = await offersRef
        .where('integrationId', '==', integrationId)
        .where('sku', '==', cleanQuery)
        .limit(10)
        .get();

      // Search by offer_id as fallback - FILTERED BY INTEGRATION
      const offerIdQuery = await offersRef
        .where('integrationId', '==', integrationId)
        .where('offer_id', '==', parseInt(cleanQuery))
        .limit(10)
        .get();

      // Collect unique products
      const seenIds = new Set<string>();
      
      // Process TSIN ID results (primary) - FILTER FOR BUYABLE STATUS ONLY
      tsinQuery.docs.forEach((doc: any) => {
        const data = doc.data();
        
        // CRITICAL: Only include buyable products that can actually be scraped
        if (data.status !== 'Buyable') {
          console.log(`⚠️ Skipping non-buyable product TSIN ${data.tsin_id} with status: ${data.status}`);
          return;
        }
        
        const uniqueId = `${data.tsin_id}_${data.offer_id}`;
        if (!seenIds.has(uniqueId)) {
          seenIds.add(uniqueId);
          
          // Generate safe URL with validation
          const safeUrl = getSafeProductUrl({
            offer_url: data.offer_url,
            tsin: data.tsin_id
          });
          
          // Validate the URL and log warnings if needed
          if (data.offer_url) {
            const validation = TakealotUrlValidator.validateUrl(data.offer_url);
            if (!validation.isValid) {
              console.warn(`⚠️ Invalid offer_url in database for TSIN ${data.tsin_id}: ${data.offer_url}`);
            }
          } else {
            console.warn(`⚠️ Missing offer_url for TSIN ${data.tsin_id} - using fallback URL`);
          }
          
          products.push({
            id: doc.id,
            tsin: data.tsin_id || data.offer_id, // Use tsin_id as the TSIN value
            title: data.title || `Product ${data.tsin_id}`,
            url: safeUrl,
            offer_url: data.offer_url,
            imageUrl: data.image_url,
            currentPrice: data.selling_price,
            sku: data.sku,
            offer_id: data.offer_id,
            barcode: data.barcode,
            status: data.status, // Include status for debugging
          });
        }
      });

      // Process SKU results - FILTER FOR BUYABLE STATUS ONLY
      skuQuery.docs.forEach((doc: any) => {
        const data = doc.data();
        
        // CRITICAL: Only include buyable products that can actually be scraped
        if (data.status !== 'Buyable') {
          console.log(`⚠️ Skipping non-buyable product SKU ${data.sku} with status: ${data.status}`);
          return;
        }
        
        const uniqueId = `${data.tsin_id}_${data.offer_id}`;
        if (!seenIds.has(uniqueId)) {
          seenIds.add(uniqueId);
          
          // Generate safe URL with validation
          const safeUrl = getSafeProductUrl({
            offer_url: data.offer_url,
            tsin: data.tsin_id
          });
          
          products.push({
            id: doc.id,
            tsin: data.tsin_id || data.offer_id,
            title: data.title || `Product ${data.tsin_id}`,
            url: safeUrl,
            offer_url: data.offer_url,
            imageUrl: data.image_url,
            currentPrice: data.selling_price,
            sku: data.sku,
            offer_id: data.offer_id,
            barcode: data.barcode,
          });
        }
      });

      // Process offer_id results
      offerIdQuery.docs.forEach((doc: any) => {
        const data = doc.data();
        const uniqueId = `${data.tsin_id}_${data.offer_id}`;
        if (!seenIds.has(uniqueId)) {
          seenIds.add(uniqueId);
          
          // Generate safe URL with validation
          const safeUrl = getSafeProductUrl({
            offer_url: data.offer_url,
            tsin: data.tsin_id
          });
          
          products.push({
            id: doc.id,
            tsin: data.tsin_id || data.offer_id,
            title: data.title || `Product ${data.tsin_id}`,
            url: safeUrl,
            offer_url: data.offer_url,
            imageUrl: data.image_url,
            currentPrice: data.selling_price,
            sku: data.sku,
            offer_id: data.offer_id,
            barcode: data.barcode,
          });
        }
      });

      // If no exact matches, try title search (more expensive but thorough)
      if (products.length === 0 && cleanQuery.length > 2) {
        const titleQuery = await offersRef.orderBy('title').limit(100).get();
        
        titleQuery.docs.forEach((doc: any) => {
          const data = doc.data();
          const title = (data.title || '').toLowerCase();
          const uniqueId = `${data.tsin_id}_${data.offer_id}`;
          
          if (title.includes(cleanQuery) && !seenIds.has(uniqueId)) {
            seenIds.add(uniqueId);
            
            // Generate safe URL with validation
            const safeUrl = getSafeProductUrl({
              offer_url: data.offer_url,
              tsin: data.tsin_id
            });
            
            products.push({
              id: doc.id,
              tsin: data.tsin_id || data.offer_id,
              title: data.title || `Product ${data.tsin_id}`,
              url: safeUrl,
              offer_url: data.offer_url,
              imageUrl: data.image_url,
              currentPrice: data.selling_price,
              sku: data.sku,
              offer_id: data.offer_id,
              barcode: data.barcode,
            });
          }
        });
      }

      // Sort by relevance (exact TSIN matches first, then title matches)
      products.sort((a, b) => {
        if (a.tsin.toString() === cleanQuery) return -1;
        if (b.tsin.toString() === cleanQuery) return 1;
        if (a.sku === cleanQuery) return -1;
        if (b.sku === cleanQuery) return 1;
        return 0;
      });

      return NextResponse.json(products.slice(0, 20)); // Limit to top 20 results

    } catch (firestoreError: any) {
      console.error('Firestore search error:', firestoreError);
      return NextResponse.json([]); // Return empty array instead of error
    }

  } catch (error: any) {
    console.error('Error in search products API:', error);
    return NextResponse.json({ 
      error: 'Failed to search products',
      details: error.message 
    }, { status: 500 });
  }
}
