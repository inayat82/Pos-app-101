// Auto Price Bulk Actions API
import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/firebase/firebase';
import { doc, updateDoc, writeBatch, collection, query, where, getDocs } from 'firebase/firestore';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action, productIds, integrationId, filters } = body;

    if (!action || !integrationId) {
      return NextResponse.json({ 
        error: 'Action and Integration ID are required' 
      }, { status: 400 });
    }

    let targetProductIds = productIds;

    // If no specific product IDs provided, use filters to select products
    if (!targetProductIds && filters) {
      targetProductIds = await getProductIdsByFilters(integrationId, filters);
    }

    if (!targetProductIds || targetProductIds.length === 0) {
      return NextResponse.json({ 
        error: 'No products to process' 
      }, { status: 400 });
    }

    let result;
    switch (action) {
      case 'bulk-scrape':
        result = await performBulkScrape(targetProductIds, integrationId);
        break;
      case 'clear-scraped-data':
        result = await clearScrapedData(targetProductIds);
        break;
      case 'retry-failed':
        result = await retryFailedScraping(targetProductIds);
        break;
      case 'export-data':
        result = await exportProductData(targetProductIds, integrationId);
        break;
      default:
        return NextResponse.json({ 
          error: 'Invalid action' 
        }, { status: 400 });
    }

    return NextResponse.json({
      success: true,
      action,
      processedCount: targetProductIds.length,
      ...result
    });

  } catch (error) {
    console.error('Error in bulk action:', error);
    return NextResponse.json(
      { error: 'Failed to perform bulk action' },
      { status: 500 }
    );
  }
}

async function getProductIdsByFilters(integrationId: string, filters: any): Promise<string[]> {
  let queryRef = query(
    collection(db, 'takealot_offers'),
    where('integrationId', '==', integrationId)
  );

  // Apply filters
  if (filters.scrapingStatus) {
    queryRef = query(queryRef, where('scrapingStatus', 'in', filters.scrapingStatus));
  }

  if (filters.status) {
    queryRef = query(queryRef, where('status', 'in', filters.status));
  }

  const snapshot = await getDocs(queryRef);
  return snapshot.docs.map(doc => doc.id);
}

async function performBulkScrape(productIds: string[], integrationId: string) {
  const batchSize = 500; // Firestore batch limit
  const batches = [];

  for (let i = 0; i < productIds.length; i += batchSize) {
    const batch = writeBatch(db);
    const batchProductIds = productIds.slice(i, i + batchSize);

    for (const productId of batchProductIds) {
      const productRef = doc(db, 'takealot_offers', productId);
      batch.update(productRef, {
        scrapingStatus: 'queued',
        scrapingQueuedAt: new Date(),
        scrapingPriority: 'normal'
      });
    }

    batches.push(batch);
  }

  // Commit all batches
  await Promise.all(batches.map(batch => batch.commit()));

  return {
    message: `${productIds.length} products queued for scraping`,
    queuedCount: productIds.length
  };
}

async function clearScrapedData(productIds: string[]) {
  const batchSize = 500;
  const batches = [];

  for (let i = 0; i < productIds.length; i += batchSize) {
    const batch = writeBatch(db);
    const batchProductIds = productIds.slice(i, i + batchSize);

    for (const productId of batchProductIds) {
      const productRef = doc(db, 'takealot_offers', productId);
      batch.update(productRef, {
        scrapingStatus: 'idle',
        scrapedRating: null,
        scrapedReviewCount: null,
        scrapedWinnerSeller: null,
        scrapedWinnerSellerPrice: null,
        scrapedTotalSellers: null,
        lastScrapedAt: null,
        scrapingErrorMessage: null,
        proxyUsed: null,
        scrapingDuration: null
      });
    }

    batches.push(batch);
  }

  await Promise.all(batches.map(batch => batch.commit()));

  return {
    message: `Scraped data cleared for ${productIds.length} products`,
    clearedCount: productIds.length
  };
}

async function retryFailedScraping(productIds: string[]) {
  const batchSize = 500;
  const batches = [];

  for (let i = 0; i < productIds.length; i += batchSize) {
    const batch = writeBatch(db);
    const batchProductIds = productIds.slice(i, i + batchSize);

    for (const productId of batchProductIds) {
      const productRef = doc(db, 'takealot_offers', productId);
      batch.update(productRef, {
        scrapingStatus: 'retry',
        scrapingQueuedAt: new Date(),
        scrapingPriority: 'high',
        scrapingErrorMessage: null
      });
    }

    batches.push(batch);
  }

  await Promise.all(batches.map(batch => batch.commit()));

  return {
    message: `${productIds.length} products queued for retry`,
    retryCount: productIds.length
  };
}

async function exportProductData(productIds: string[], integrationId: string) {
  // Get product data
  const products: any[] = [];
  
  // Process in batches to avoid overwhelming Firestore
  const batchSize = 100;
  for (let i = 0; i < productIds.length; i += batchSize) {
    const batchIds = productIds.slice(i, i + batchSize);
    const batchQuery = query(
      collection(db, 'takealot_offers'),
      where('__name__', 'in', batchIds)
    );
    
    const snapshot = await getDocs(batchQuery);
    snapshot.forEach(doc => {
      const data = doc.data();
      products.push({
        id: doc.id,
        tsin: data.tsin_id || data.tsin,
        sku: data.sku,
        title: data.product_title || data.title,
        ourPrice: data.selling_price,
        rrp: data.rrp || data.recommended_retail_price,
        scrapedRating: data.scrapedRating,
        scrapedReviewCount: data.scrapedReviewCount,
        scrapedWinnerSeller: data.scrapedWinnerSeller,
        scrapedWinnerSellerPrice: data.scrapedWinnerSellerPrice,
        scrapedTotalSellers: data.scrapedTotalSellers,
        lastScrapedAt: data.lastScrapedAt,
        scrapingStatus: data.scrapingStatus || 'idle',
        winDifference: data.scrapedWinnerSellerPrice ? 
          (data.selling_price || 0) - data.scrapedWinnerSellerPrice : null
      });
    });
  }

  // Create CSV content
  const headers = [
    'ID', 'TSIN', 'SKU', 'Title', 'Our Price', 'RRP', 
    'Scraped Rating', 'Review Count', 'Winner Seller', 'Winner Price', 
    'Total Sellers', 'Win Difference', 'Last Scraped', 'Scraping Status'
  ];

  const csvRows = [
    headers.join(','),
    ...products.map(product => [
      product.id,
      product.tsin,
      product.sku,
      `"${product.title.replace(/"/g, '""')}"`, // Escape quotes in title
      product.ourPrice || 0,
      product.rrp || 0,
      product.scrapedRating || '',
      product.scrapedReviewCount || '',
      product.scrapedWinnerSeller || '',
      product.scrapedWinnerSellerPrice || '',
      product.scrapedTotalSellers || '',
      product.winDifference || '',
      product.lastScrapedAt || '',
      product.scrapingStatus
    ].join(','))
  ];

  const csvContent = csvRows.join('\n');

  return {
    message: `Export data prepared for ${products.length} products`,
    exportCount: products.length,
    csvData: csvContent,
    filename: `auto-price-export-${new Date().toISOString().split('T')[0]}.csv`
  };
}
