// Auto Price Service - Main service for handling Auto Price functionality
import { 
  AutoPriceProduct, 
  AutoPriceFilters, 
  AutoPriceSortOptions,
  AutoPriceStats,
  PaginatedAutoPriceResponse,
  BulkScrapingRequest,
  ScrapingJobStatus
} from '../types/auto-price.types';

export class AutoPriceService {
  
  /**
   * Fetch paginated auto price products for a specific integration
   */
  static async getProducts(
    integrationId: string,
    page: number = 1,
    limit: number = 50,
    filters?: AutoPriceFilters,
    sort?: AutoPriceSortOptions
  ): Promise<PaginatedAutoPriceResponse> {
    try {
      const queryParams = new URLSearchParams({
        page: page.toString(),
        limit: limit.toString(),
        integrationId,
        ...(filters && { filters: JSON.stringify(filters) }),
        ...(sort && { sort: JSON.stringify(sort) })
      });

      const response = await fetch(`/api/admin/auto-price/products?${queryParams}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch products: ${response.statusText}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Error fetching auto price products:', error);
      throw error;
    }
  }

  /**
   * Get auto price statistics for an integration
   */
  static async getStats(integrationId: string): Promise<AutoPriceStats> {
    try {
      const response = await fetch(`/api/admin/auto-price/stats?integrationId=${integrationId}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch stats: ${response.statusText}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Error fetching auto price stats:', error);
      throw error;
    }
  }

  /**
   * Scrape a single product
   */
  static async scrapeProduct(
    integrationId: string, 
    productId: string,
    priority: 'low' | 'normal' | 'high' = 'normal'
  ): Promise<{ success: boolean; message: string; jobId?: string }> {
    try {
      const response = await fetch('/api/admin/auto-price/scrape/single', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          integrationId,
          productId,
          priority
        }),
      });

      if (!response.ok) {
        throw new Error(`Failed to start scraping: ${response.statusText}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Error starting single product scrape:', error);
      throw error;
    }
  }

  /**
   * Bulk scrape multiple products
   */
  static async bulkScrapeProducts(request: BulkScrapingRequest): Promise<ScrapingJobStatus> {
    try {
      const response = await fetch('/api/admin/auto-price/scrape/bulk', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(request),
      });

      if (!response.ok) {
        throw new Error(`Failed to start bulk scraping: ${response.statusText}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Error starting bulk scraping:', error);
      throw error;
    }
  }

  /**
   * Get scraping job status
   */
  static async getScrapingJobStatus(jobId: string): Promise<ScrapingJobStatus> {
    try {
      const response = await fetch(`/api/admin/auto-price/scrape/status/${jobId}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch job status: ${response.statusText}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Error fetching scraping job status:', error);
      throw error;
    }
  }

  /**
   * Cancel a scraping job
   */
  static async cancelScrapingJob(jobId: string): Promise<{ success: boolean; message: string }> {
    try {
      const response = await fetch(`/api/admin/auto-price/scrape/cancel/${jobId}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error(`Failed to cancel job: ${response.statusText}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Error canceling scraping job:', error);
      throw error;
    }
  }

  /**
   * Update product's scraped data manually
   */
  static async updateProductScrapedData(
    productId: string, 
    scrapedData: Partial<AutoPriceProduct>
  ): Promise<{ success: boolean; message: string }> {
    try {
      const response = await fetch(`/api/admin/auto-price/products/${productId}/scraped-data`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(scrapedData),
      });

      if (!response.ok) {
        throw new Error(`Failed to update scraped data: ${response.statusText}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Error updating scraped data:', error);
      throw error;
    }
  }

  /**
   * Clear scraped data for a product
   */
  static async clearScrapedData(productId: string): Promise<{ success: boolean; message: string }> {
    try {
      const response = await fetch(`/api/admin/auto-price/products/${productId}/scraped-data`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error(`Failed to clear scraped data: ${response.statusText}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Error clearing scraped data:', error);
      throw error;
    }
  }

  /**
   * Export auto price data to CSV
   */
  static async exportData(
    integrationId: string,
    filters?: AutoPriceFilters,
    format: 'csv' | 'xlsx' = 'csv'
  ): Promise<Blob> {
    try {
      const queryParams = new URLSearchParams({
        integrationId,
        format,
        ...(filters && { filters: JSON.stringify(filters) })
      });

      const response = await fetch(`/api/admin/auto-price/export?${queryParams}`, {
        method: 'GET',
      });

      if (!response.ok) {
        throw new Error(`Failed to export data: ${response.statusText}`);
      }

      return await response.blob();
    } catch (error) {
      console.error('Error exporting auto price data:', error);
      throw error;
    }
  }

  /**
   * Get scraping queue status
   */
  static async getQueueStatus(integrationId: string): Promise<{
    queueLength: number;
    processing: number;
    estimatedWaitTime: number; // minutes
    recentJobs: ScrapingJobStatus[];
  }> {
    try {
      const response = await fetch(`/api/admin/auto-price/queue/status?integrationId=${integrationId}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch queue status: ${response.statusText}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Error fetching queue status:', error);
      throw error;
    }
  }

  /**
   * Retry failed scraping for specific products
   */
  static async retryFailedScraping(
    integrationId: string,
    productIds: string[]
  ): Promise<{ success: boolean; message: string; jobId?: string }> {
    try {
      const response = await fetch('/api/admin/auto-price/scrape/retry', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          integrationId,
          productIds
        }),
      });

      if (!response.ok) {
        throw new Error(`Failed to retry scraping: ${response.statusText}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Error retrying scraping:', error);
      throw error;
    }
  }
}
