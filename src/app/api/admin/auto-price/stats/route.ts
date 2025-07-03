// Auto Price Stats API
import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/firebase/firebase';
import { collection, query, where, getDocs, Timestamp } from 'firebase/firestore';
import { AutoPriceStats } from '@/modules/auto-price/types/auto-price.types';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const adminId = searchParams.get('adminId');

    if (!adminId) {
      return NextResponse.json({ error: 'Admin ID is required' }, { status: 400 });
    }

    // Get all products for this admin
    const productsQuery = query(
      collection(db, 'takealot_offers'),
      where('integrationId', '==', adminId)
    );

    const snapshot = await getDocs(productsQuery);
    
    let totalProducts = 0;
    let scrapedProducts = 0;
    let pendingProducts = 0;
    let errorProducts = 0;
    let lastScrapedCount = 0;
    let scrapingQueueCount = 0;

    const now = Date.now();
    const oneDayAgo = now - (24 * 60 * 60 * 1000);

    snapshot.forEach((doc) => {
      const data = doc.data();
      totalProducts++;

      const scrapingStatus = data.scrapingStatus || 'idle';
      
      switch (scrapingStatus) {
        case 'success':
          scrapedProducts++;
          break;
        case 'queued':
        case 'scraping':
          pendingProducts++;
          scrapingQueueCount++;
          break;
        case 'error':
          errorProducts++;
          break;
        case 'retry':
          pendingProducts++;
          break;
      }

      // Check if scraped in last 24 hours
      if (data.lastScrapedAt) {
        let scrapedTime: number;
        if (data.lastScrapedAt instanceof Timestamp) {
          scrapedTime = data.lastScrapedAt.toMillis();
        } else if (data.lastScrapedAt instanceof Date) {
          scrapedTime = data.lastScrapedAt.getTime();
        } else {
          scrapedTime = new Date(data.lastScrapedAt).getTime();
        }

        if (scrapedTime > oneDayAgo) {
          lastScrapedCount++;
        }
      }
    });

    const stats: AutoPriceStats = {
      totalProducts,
      scrapedToday: lastScrapedCount,
      pendingScraping: pendingProducts,
      averageWinDifference: 0, // TODO: Calculate based on scraped data
      successRate24h: lastScrapedCount > 0 ? Math.round((lastScrapedCount / (lastScrapedCount + errorProducts)) * 100) : 0,
      lastScrapingActivity: lastScrapedCount > 0 ? new Date() : undefined,
    };

    return NextResponse.json({
      success: true,
      data: stats
    });

  } catch (error) {
    console.error('Error fetching auto-price stats:', error);
    return NextResponse.json(
      { error: 'Failed to fetch stats' },
      { status: 500 }
    );
  }
}
