// Auto Price Database Service for Firebase Integration
import { dbAdmin } from '@/lib/firebase/firebaseAdmin';
import { FieldValue } from 'firebase-admin/firestore';
import { ScrapedProductData } from './scraping.service';
import { AutoPriceProduct } from '../types/auto-price.types';

export class AutoPriceDatabaseService {
  private static instance: AutoPriceDatabaseService;

  public static getInstance(): AutoPriceDatabaseService {
    if (!AutoPriceDatabaseService.instance) {
      AutoPriceDatabaseService.instance = new AutoPriceDatabaseService();
    }
    return AutoPriceDatabaseService.instance;
  }

  /**
   * Update product with scraped data
   */
  async updateProductWithScrapedData(
    adminUid: string,
    tsin: string,
    scrapedData: ScrapedProductData
  ): Promise<void> {
    try {
      const productRef = dbAdmin
        .collection('admins')
        .doc(adminUid)
        .collection('takealot_products')
        .doc(tsin);

      const updateData = {
        // Scraped data fields
        'scraped.rating': scrapedData.rating,
        'scraped.reviewCount': scrapedData.reviewCount,
        'scraped.winnerSeller': scrapedData.winnerSeller,
        'scraped.winnerPrice': scrapedData.winnerPrice,
        'scraped.totalSellers': scrapedData.totalSellers,
        'scraped.competitors': scrapedData.competitors,
        'scraped.availability': scrapedData.availability,
        'scraped.scrapedAt': scrapedData.scrapedAt,
        'scraped.proxyUsed': scrapedData.proxyUsed,
        'scraped.duration': scrapedData.duration,
        
        // Meta fields
        'meta.lastScrapedAt': FieldValue.serverTimestamp(),
        'meta.scrapingStatus': 'completed',
        'meta.scrapingAttempts': FieldValue.increment(1),
        'meta.updatedAt': FieldValue.serverTimestamp()
      };

      await productRef.update(updateData);
      
      console.log(`Updated product ${tsin} with scraped data`);
    } catch (error) {
      console.error(`Error updating product ${tsin} with scraped data:`, error);
      throw error;
    }
  }

  /**
   * Mark product scraping as failed
   */
  async markScrapingFailed(
    adminUid: string,
    tsin: string,
    error: string
  ): Promise<void> {
    try {
      const productRef = dbAdmin
        .collection('admins')
        .doc(adminUid)
        .collection('takealot_products')
        .doc(tsin);

      const updateData = {
        'meta.scrapingStatus': 'failed',
        'meta.lastScrapingError': error,
        'meta.scrapingAttempts': FieldValue.increment(1),
        'meta.lastScrapedAt': FieldValue.serverTimestamp(),
        'meta.updatedAt': FieldValue.serverTimestamp()
      };

      await productRef.update(updateData);
      
      console.log(`Marked scraping as failed for product ${tsin}: ${error}`);
    } catch (updateError) {
      console.error(`Error marking scraping as failed for product ${tsin}:`, updateError);
      throw updateError;
    }
  }

  /**
   * Mark product scraping as in progress
   */
  async markScrapingInProgress(
    adminUid: string,
    tsin: string
  ): Promise<void> {
    try {
      const productRef = dbAdmin
        .collection('admins')
        .doc(adminUid)
        .collection('takealot_products')
        .doc(tsin);

      const updateData = {
        'meta.scrapingStatus': 'in-progress',
        'meta.scrapingStartedAt': FieldValue.serverTimestamp(),
        'meta.updatedAt': FieldValue.serverTimestamp()
      };

      await productRef.update(updateData);
      
      console.log(`Marked scraping as in progress for product ${tsin}`);
    } catch (error) {
      console.error(`Error marking scraping as in progress for product ${tsin}:`, error);
      throw error;
    }
  }

  /**
   * Get products for Auto Price processing with filters
   */
  async getProductsForAutoPrice(
    adminUid: string,
    options: {
      limit?: number;
      offset?: number;
      filters?: {
        scrapingStatus?: string;
        hasRating?: boolean;
        minPrice?: number;
        maxPrice?: number;
        category?: string;
      };
      sortBy?: 'lastScrapedAt' | 'rating' | 'price' | 'name';
      sortOrder?: 'asc' | 'desc';
    } = {}
  ): Promise<{
    products: AutoPriceProduct[];
    total: number;
    hasMore: boolean;
  }> {
    try {
      const {
        limit = 50,
        offset = 0,
        filters = {},
        sortBy = 'lastScrapedAt',
        sortOrder = 'desc'
      } = options;

      let query = dbAdmin
        .collection('admins')
        .doc(adminUid)
        .collection('takealot_products')
        .orderBy(`meta.${sortBy}`, sortOrder);

      // Apply filters
      if (filters.scrapingStatus) {
        query = query.where('meta.scrapingStatus', '==', filters.scrapingStatus);
      }

      if (filters.hasRating !== undefined) {
        if (filters.hasRating) {
          query = query.where('scraped.rating', '>', 0);
        } else {
          query = query.where('scraped.rating', '==', null);
        }
      }

      if (filters.minPrice) {
        query = query.where('offering_price', '>=', filters.minPrice);
      }

      if (filters.maxPrice) {
        query = query.where('offering_price', '<=', filters.maxPrice);
      }

      if (filters.category) {
        query = query.where('category', '==', filters.category);
      }

      // Get total count for pagination
      const totalQuery = await query.get();
      const total = totalQuery.size;

      // Apply pagination
      const paginatedQuery = query.limit(limit).offset(offset);
      const snapshot = await paginatedQuery.get();

      const products: AutoPriceProduct[] = snapshot.docs.map(doc => {
        const data = doc.data();
        return {
          tsin: doc.id,
          title: data.title || '',
          offering_price: data.offering_price || 0,
          category: data.category || '',
          brand: data.brand || '',
          availability: data.availability || 'unknown',
          ...data.scraped || {},
          meta: {
            lastScrapedAt: data.meta?.lastScrapedAt?.toDate() || null,
            scrapingStatus: data.meta?.scrapingStatus || 'pending',
            scrapingAttempts: data.meta?.scrapingAttempts || 0,
            lastScrapingError: data.meta?.lastScrapingError || null,
            ...data.meta
          }
        } as AutoPriceProduct;
      });

      return {
        products,
        total,
        hasMore: offset + limit < total
      };

    } catch (error) {
      console.error('Error getting products for Auto Price:', error);
      throw error;
    }
  }

  /**
   * Get Auto Price statistics
   */
  async getAutoPriceStats(adminUid: string): Promise<{
    totalProducts: number;
    scrapedProducts: number;
    pendingProducts: number;
    failedProducts: number;
    avgRating: number;
    productsWithCompetitors: number;
    lastScrapingRun: Date | null;
  }> {
    try {
      const productsRef = dbAdmin
        .collection('admins')
        .doc(adminUid)
        .collection('takealot_products');

      // Get all products
      const allProductsSnapshot = await productsRef.get();
      const totalProducts = allProductsSnapshot.size;

      // Get scraped products
      const scrapedSnapshot = await productsRef
        .where('meta.scrapingStatus', '==', 'completed')
        .get();
      const scrapedProducts = scrapedSnapshot.size;

      // Get pending products
      const pendingSnapshot = await productsRef
        .where('meta.scrapingStatus', 'in', ['pending', 'in-progress'])
        .get();
      const pendingProducts = pendingSnapshot.size;

      // Get failed products
      const failedSnapshot = await productsRef
        .where('meta.scrapingStatus', '==', 'failed')
        .get();
      const failedProducts = failedSnapshot.size;

      // Calculate average rating
      let totalRating = 0;
      let ratedProductsCount = 0;
      let productsWithCompetitors = 0;
      let lastScrapingRun: Date | null = null;

      scrapedSnapshot.docs.forEach(doc => {
        const data = doc.data();
        
        if (data.scraped?.rating && data.scraped.rating > 0) {
          totalRating += data.scraped.rating;
          ratedProductsCount++;
        }

        if (data.scraped?.competitors && data.scraped.competitors.length > 1) {
          productsWithCompetitors++;
        }

        if (data.meta?.lastScrapedAt) {
          const scrapedAt = data.meta.lastScrapedAt.toDate();
          if (!lastScrapingRun || scrapedAt > lastScrapingRun) {
            lastScrapingRun = scrapedAt;
          }
        }
      });

      const avgRating = ratedProductsCount > 0 ? totalRating / ratedProductsCount : 0;

      return {
        totalProducts,
        scrapedProducts,
        pendingProducts,
        failedProducts,
        avgRating: Math.round(avgRating * 10) / 10,
        productsWithCompetitors,
        lastScrapingRun
      };

    } catch (error) {
      console.error('Error getting Auto Price stats:', error);
      throw error;
    }
  }

  /**
   * Clear all scraped data for products
   */
  async clearScrapedData(
    adminUid: string,
    tsins?: string[]
  ): Promise<number> {
    try {
      let query = dbAdmin
        .collection('admins')
        .doc(adminUid)
        .collection('takealot_products');

      if (tsins && tsins.length > 0) {
        // Clear specific products
        const batch = dbAdmin.batch();
        let count = 0;

        for (const tsin of tsins) {
          const productRef = query.doc(tsin);
          batch.update(productRef, {
            'scraped': FieldValue.delete(),
            'meta.scrapingStatus': 'pending',
            'meta.lastScrapingError': FieldValue.delete(),
            'meta.scrapingAttempts': 0,
            'meta.updatedAt': FieldValue.serverTimestamp()
          });
          count++;
        }

        await batch.commit();
        return count;
      } else {
        // Clear all products
        const snapshot = await query.get();
        const batch = dbAdmin.batch();
        
        snapshot.docs.forEach(doc => {
          batch.update(doc.ref, {
            'scraped': FieldValue.delete(),
            'meta.scrapingStatus': 'pending',
            'meta.lastScrapingError': FieldValue.delete(),
            'meta.scrapingAttempts': 0,
            'meta.updatedAt': FieldValue.serverTimestamp()
          });
        });

        await batch.commit();
        return snapshot.size;
      }

    } catch (error) {
      console.error('Error clearing scraped data:', error);
      throw error;
    }
  }

  /**
   * Export scraped data to JSON
   */
  async exportScrapedData(adminUid: string): Promise<any[]> {
    try {
      const snapshot = await dbAdmin
        .collection('admins')
        .doc(adminUid)
        .collection('takealot_products')
        .where('meta.scrapingStatus', '==', 'completed')
        .get();

      return snapshot.docs.map(doc => ({
        tsin: doc.id,
        title: doc.data().title,
        offering_price: doc.data().offering_price,
        scraped: doc.data().scraped,
        exportedAt: new Date().toISOString()
      }));

    } catch (error) {
      console.error('Error exporting scraped data:', error);
      throw error;
    }
  }
}

export const autoPriceDatabaseService = AutoPriceDatabaseService.getInstance();
