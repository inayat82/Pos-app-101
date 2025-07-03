// Auto Price Products API
import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/firebase/firebase';
import { collection, query, where, getDocs, orderBy, limit, startAfter, DocumentSnapshot } from 'firebase/firestore';
import { AutoPriceProduct } from '@/modules/auto-price/types/auto-price.types';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const adminId = searchParams.get('adminId');
    const page = parseInt(searchParams.get('page') || '1');
    const pageSize = parseInt(searchParams.get('pageSize') || '20');
    const searchTerm = searchParams.get('search') || '';
    const status = searchParams.get('status');
    const scrapingStatus = searchParams.get('scrapingStatus');
    const priceMin = searchParams.get('priceMin');
    const priceMax = searchParams.get('priceMax');
    const lastVisible = searchParams.get('lastVisible');

    if (!adminId) {
      return NextResponse.json({ error: 'Admin ID is required' }, { status: 400 });
    }

    // Build query
    let queryRef = query(
      collection(db, 'takealot_offers'),
      where('integrationId', '==', adminId),
      orderBy('updatedAt', 'desc')
    );

    // Apply filters
    if (status) {
      queryRef = query(queryRef, where('status', '==', status));
    }

    if (scrapingStatus) {
      queryRef = query(queryRef, where('scrapingStatus', '==', scrapingStatus));
    }

    // Add pagination
    if (lastVisible) {
      // For pagination, we need to get the document snapshot
      // This is a simplified version - in production you'd store the actual DocumentSnapshot
      queryRef = query(queryRef, startAfter(lastVisible));
    }

    queryRef = query(queryRef, limit(pageSize));

    const snapshot = await getDocs(queryRef);
    const products: AutoPriceProduct[] = [];

    snapshot.forEach((doc) => {
      const data = doc.data();
      
      // Transform Takealot product data to AutoPriceProduct format
      const product: AutoPriceProduct = {
        id: doc.id,
        integrationId: data.integrationId,
        adminId: data.integrationId,
        tsin: data.tsin_id || data.tsin || '',
        sku: data.sku || '',
        title: data.product_title || data.title || '',
        imageUrl: data.image_url,
        status: data.status || 'unavailable',
        ourPrice: data.selling_price || 0,
        rrp: data.rrp || data.recommended_retail_price || 0,
        createdAt: data.createdAt || data.fetchedAt,
        updatedAt: data.updatedAt || data.lastUpdated,
        
        // Scraped data (will be null initially)
        scrapedRating: data.scrapedRating,
        scrapedReviewCount: data.scrapedReviewCount,
        scrapedWinnerSeller: data.scrapedWinnerSeller,
        scrapedWinnerSellerPrice: data.scrapedWinnerSellerPrice,
        scrapedTotalSellers: data.scrapedTotalSellers,
        lastScrapedAt: data.lastScrapedAt,
        scrapingStatus: data.scrapingStatus || 'idle',
        scrapingErrorMessage: data.scrapingErrorMessage,
        proxyUsed: data.proxyUsed,
        scrapingDuration: data.scrapingDuration,
      };

      // Apply client-side filters for search and price range
      if (searchTerm) {
        const searchLower = searchTerm.toLowerCase();
        const matchesSearch = 
          product.title.toLowerCase().includes(searchLower) ||
          product.sku.toLowerCase().includes(searchLower) ||
          product.tsin.toLowerCase().includes(searchLower);
        
        if (!matchesSearch) return;
      }

      if (priceMin && product.ourPrice < parseFloat(priceMin)) return;
      if (priceMax && product.ourPrice > parseFloat(priceMax)) return;

      products.push(product);
    });

    // Get last document for pagination
    const lastDoc = snapshot.docs[snapshot.docs.length - 1];

    return NextResponse.json({
      success: true,
      data: {
        products,
        pagination: {
          page,
          pageSize,
          hasMore: snapshot.docs.length === pageSize,
          lastVisible: lastDoc?.id || null,
        }
      }
    });

  } catch (error) {
    console.error('Error fetching auto-price products:', error);
    return NextResponse.json(
      { error: 'Failed to fetch products' },
      { status: 500 }
    );
  }
}
