// Enhanced Scraping Service with Webshare Integration and Cheerio HTML Parsing
import * as cheerio from 'cheerio';
import { autoPriceWebshareService } from './webshare.service';

export interface ScrapedProductData {
  rating: number | null;
  reviewCount: number | null;
  winnerSeller: string | null;
  winnerPrice: number | null;
  totalSellers: number;
  competitors: Array<{
    seller: string;
    price: number;
    rating?: number;
  }>;
  availability: 'in-stock' | 'out-of-stock' | 'limited' | 'unknown';
  title?: string | null;
  imageUrl?: string | null;
  breadcrumbs?: string[];
  scrapedAt: Date;
  proxyUsed: string;
  duration: number;
}

export interface ScrapingResult {
  success: boolean;
  data?: ScrapedProductData;
  error?: string;
}

class TakealotScrapingService {
  
  /**
   * Scrape product data from Takealot using Webshare proxy
   */
  async scrapeProduct(tsin: string, forceLive: boolean = false, offerUrl?: string): Promise<ScrapingResult> {
    const startTime = Date.now();
    
    try {
      // Make request through Webshare proxy
      const proxyResponse = await autoPriceWebshareService.scrapeTakealotProduct(tsin, forceLive, offerUrl);
      
      if (!proxyResponse.success) {
        return {
          success: false,
          error: `Proxy request failed: ${proxyResponse.error}`
        };
      }

      // Parse HTML content
      const html = proxyResponse.data;
      if (!html) {
        return {
          success: false,
          error: 'No HTML content received from proxy'
        };
      }
      
      const scrapedData = await this.parseProductHTML(html, tsin);
      
      const duration = Date.now() - startTime;

      const result: ScrapedProductData = {
        ...scrapedData,
        scrapedAt: new Date(),
        proxyUsed: proxyResponse.proxyUsed?.id || 'unknown',
        duration
      };

      return {
        success: true,
        data: result
      };

    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Parse HTML content to extract product data using Cheerio
   */
  private async parseProductHTML(html: string, tsin: string): Promise<Omit<ScrapedProductData, 'scrapedAt' | 'proxyUsed' | 'duration'>> {
    try {
      const $ = cheerio.load(html);

      // Extract rating using multiple selectors
      const rating = this.extractRatingWithCheerio($);
      
      // Extract review count
      const reviewCount = this.extractReviewCountWithCheerio($);
      
      // Extract seller and pricing information
      const sellerInfo = this.extractSellerInfoWithCheerio($);
      
      // Extract availability
      const availability = this.extractAvailabilityWithCheerio($);

      // Extract title and image
      const title = this.extractTitleWithCheerio($);
      const imageUrl = this.extractImageUrlWithCheerio($);
      const breadcrumbs = this.extractBreadcrumbsWithCheerio($);

      return {
        rating,
        reviewCount,
        winnerSeller: sellerInfo.winnerSeller,
        winnerPrice: sellerInfo.winnerPrice,
        totalSellers: sellerInfo.totalSellers,
        competitors: sellerInfo.competitors,
        availability,
        title,
        imageUrl,
        breadcrumbs
      };

    } catch (parseError) {
      console.error('Error parsing product HTML:', parseError);
      return {
        rating: null,
        reviewCount: null,
        winnerSeller: null,
        winnerPrice: null,
        totalSellers: 0,
        competitors: [],
        availability: 'unknown',
        title: null,
        imageUrl: null,
        breadcrumbs: []
      };
    }
  }

  /**
   * Extract product rating using Cheerio
   */
  private extractRatingWithCheerio($: ReturnType<typeof cheerio.load>): number | null {
    // Check for mock data format first
    const mockRating = $('.rating-score').text().trim();
    if (mockRating) {
      const rating = parseFloat(mockRating);
      if (!isNaN(rating)) {
        return Math.round(rating * 10) / 10;
      }
    }

    // Try multiple selectors for rating
    const selectors = [
      '[data-ref="rating-value"]',
      '.rating-value',
      '.star-rating .value',
      '.stars .value',
      '[class*="rating"] .value',
      '[class*="rating"][data-value]',
      '.product-rating [data-value]',
      '[data-testid*="rating"]',
      'meta[property="product:rating:value"]',
      'script[type="application/ld+json"]' // JSON-LD structured data
    ];

    for (const selector of selectors) {
      try {
        const element = $(selector).first();
        
        if (element.length > 0) {
          let ratingValue: string | null = null;
          
          // Try different ways to extract the rating
          ratingValue = element.attr('data-value') || 
                       element.attr('content') || 
                       element.text().trim();

          if (ratingValue) {
            const rating = parseFloat(ratingValue);
            if (!isNaN(rating) && rating >= 0 && rating <= 5) {
              return Math.round(rating * 10) / 10;
            }
          }
        }
      } catch (e) {
        continue;
      }
    }

    // Try JSON-LD structured data
    try {
      $('script[type="application/ld+json"]').each((_, el) => {
        const jsonText = $(el).html();
        if (jsonText) {
          const data = JSON.parse(jsonText);
          if (data.aggregateRating?.ratingValue) {
            const rating = parseFloat(data.aggregateRating.ratingValue);
            if (!isNaN(rating) && rating >= 0 && rating <= 5) {
              return Math.round(rating * 10) / 10;
            }
          }
        }
      });
    } catch (e) {
      // JSON parsing failed, continue
    }

    // Fallback to regex patterns on the full HTML
    return this.extractRating($.html());
  }

  /**
   * Extract review count using Cheerio
   */
  private extractReviewCountWithCheerio($: ReturnType<typeof cheerio.load>): number | null {
    // Check for mock data format first
    const mockReviewCount = $('.rating-count').text().trim();
    if (mockReviewCount) {
      const count = parseInt(mockReviewCount.replace(/[^\d]/g, ''));
      if (!isNaN(count)) {
        return count;
      }
    }

    const selectors = [
      '[data-ref="review-count"]',
      '.review-count',
      '.reviews-count',
      '[class*="review"] .count',
      '[data-testid*="review-count"]',
      '.rating-summary .count',
      'meta[property="product:rating:count"]'
    ];

    for (const selector of selectors) {
      try {
        const element = $(selector).first();
        
        if (element.length > 0) {
          let countValue = element.attr('content') || element.text().trim();
          
          // Extract numbers from text like "123 reviews" or "(456)"
          const match = countValue.match(/(\d+(?:,\d{3})*)/);
          if (match) {
            const count = parseInt(match[1].replace(/,/g, ''));
            if (!isNaN(count) && count >= 0) {
              return count;
            }
          }
        }
      } catch (e) {
        continue;
      }
    }

    // Try JSON-LD structured data
    try {
      $('script[type="application/ld+json"]').each((_, el) => {
        const jsonText = $(el).html();
        if (jsonText) {
          const data = JSON.parse(jsonText);
          if (data.aggregateRating?.reviewCount) {
            const count = parseInt(data.aggregateRating.reviewCount);
            if (!isNaN(count) && count >= 0) {
              return count;
            }
          }
        }
      });
    } catch (e) {
      // JSON parsing failed, continue
    }

    // Fallback to regex patterns
    return this.extractReviewCount($.html());
  }

  /**
   * Extract product rating from HTML
   */
  private extractRating(html: string): number | null {
    // Look for various rating patterns
    const patterns = [
      /rating['":\s]*(\d+\.?\d*)/i,
      /stars?['":\s]*(\d+\.?\d*)/i,
      /score['":\s]*(\d+\.?\d*)/i,
      /"rating"\s*:\s*(\d+\.?\d*)/i,
      /data-rating=["'](\d+\.?\d*)["']/i,
      /star-rating[^>]*>[\s\S]*?(\d+\.?\d*)/i
    ];

    for (const pattern of patterns) {
      const match = html.match(pattern);
      if (match) {
        const rating = parseFloat(match[1]);
        if (rating >= 0 && rating <= 5) {
          return Math.round(rating * 10) / 10; // Round to 1 decimal place
        }
      }
    }

    return null;
  }

  /**
   * Extract review count from HTML
   */
  private extractReviewCount(html: string): number | null {
    const patterns = [
      /(\d+(?:,\d{3})*)\s*reviews?/i,
      /(\d+(?:,\d{3})*)\s*ratings?/i,
      /review[s]?['":\s]*(\d+(?:,\d{3})*)/i,
      /"reviewCount"\s*:\s*(\d+)/i,
      /data-review-count=["'](\d+(?:,\d{3})*)["']/i
    ];

    for (const pattern of patterns) {
      const match = html.match(pattern);
      if (match) {
        const count = parseInt(match[1].replace(/,/g, ''));
        if (!isNaN(count) && count >= 0) {
          return count;
        }
      }
    }

    return null;
  }

  /**
   * Extract seller and pricing information
   */
  private extractSellerInfo(html: string): {
    winnerSeller: string | null;
    winnerPrice: number | null;
    totalSellers: number;
    competitors: Array<{ seller: string; price: number; rating?: number }>;
  } {
    const competitors: Array<{ seller: string; price: number; rating?: number }> = [];
    
    // Extract all price patterns
    const pricePatterns = [
      /R[\s]*(\d+(?:,\d{3})*(?:\.\d{2})?)/g,
      /ZAR[\s]*(\d+(?:,\d{3})*(?:\.\d{2})?)/g,
      /"price"\s*:\s*(\d+(?:\.\d{2})?)/g
    ];

    const prices: number[] = [];
    
    for (const pattern of pricePatterns) {
      let match;
      while ((match = pattern.exec(html)) !== null) {
        const price = parseFloat(match[1].replace(/,/g, ''));
        if (!isNaN(price) && price > 0 && price < 1000000) { // Reasonable price range
          prices.push(price);
        }
      }
    }

    // Remove duplicates and sort
    const uniquePrices = [...new Set(prices)].sort((a, b) => a - b);
    
    // Extract seller names (simplified approach)
    const sellerPatterns = [
      /seller[^>]*>([^<]+)</gi,
      /sold by[^>]*>([^<]+)</gi,
      /vendor[^>]*>([^<]+)</gi
    ];

    const sellers: string[] = [];
    for (const pattern of sellerPatterns) {
      let match;
      while ((match = pattern.exec(html)) !== null) {
        const seller = match[1].trim();
        if (seller && seller.length > 0 && seller.length < 100) {
          sellers.push(seller);
        }
      }
    }

    // Default to Takealot if no specific sellers found
    if (sellers.length === 0 && uniquePrices.length > 0) {
      sellers.push('Takealot');
    }

    // Create competitors array
    const maxCompetitors = Math.min(uniquePrices.length, sellers.length, 5);
    for (let i = 0; i < maxCompetitors; i++) {
      competitors.push({
        seller: sellers[i] || `Seller ${i + 1}`,
        price: uniquePrices[i]
      });
    }

    return {
      winnerSeller: competitors.length > 0 ? competitors[0].seller : null,
      winnerPrice: competitors.length > 0 ? competitors[0].price : null,
      totalSellers: Math.max(competitors.length, sellers.length),
      competitors
    };
  }

  /**
   * Extract seller and pricing information using Cheerio
   */
  private extractSellerInfoWithCheerio($: ReturnType<typeof cheerio.load>): {
    winnerSeller: string | null;
    winnerPrice: number | null;
    totalSellers: number;
    competitors: Array<{ seller: string; price: number; rating?: number }>;
  } {
    const competitors: Array<{ seller: string; price: number; rating?: number }> = [];
    
    // Check for mock data format first
    const mockSellerName = $('.seller-name').text().trim();
    const mockSellerPriceText = $('.seller-price').text().trim();
    const mockMainPriceText = $('.price').text().trim();
    
    if (mockSellerName && (mockSellerPriceText || mockMainPriceText)) {
      const priceText = mockSellerPriceText || mockMainPriceText;
      const priceMatch = priceText.match(/R?[\s]*(\d+(?:,\d{3})*(?:\.\d{2})?)/);
      
      if (priceMatch) {
        const price = parseFloat(priceMatch[1].replace(/,/g, ''));
        if (!isNaN(price)) {
          return {
            winnerSeller: mockSellerName,
            winnerPrice: price,
            totalSellers: 1,
            competitors: [{
              seller: mockSellerName,
              price: price,
              rating: 4.5
            }]
          };
        }
      }
    }
    
    // Try to find price selectors
    const priceSelectors = [
      '[data-ref="price-current"]',
      '.price-current',
      '.current-price',
      '[class*="price"] .current',
      '[data-testid*="price"]',
      '.product-price .value',
      'meta[property="product:price:amount"]'
    ];

    const prices: number[] = [];
    
    for (const selector of priceSelectors) {
      try {
        $(selector).each((_, el) => {
          const priceText = $(el).attr('content') || $(el).text().trim();
          const match = priceText.match(/R?[\s]*(\d+(?:,\d{3})*(?:\.\d{2})?)/);
          
          if (match) {
            const price = parseFloat(match[1].replace(/,/g, ''));
            if (!isNaN(price) && price > 0 && price < 1000000) {
              prices.push(price);
            }
          }
        });
      } catch (e) {
        continue;
      }
    }

    // Try to find seller information
    const sellerSelectors = [
      '[data-ref="seller-name"]',
      '.seller-name',
      '.vendor-name',
      '[class*="seller"] .name',
      '[data-testid*="seller"]'
    ];

    const sellers: string[] = [];
    
    for (const selector of sellerSelectors) {
      try {
        $(selector).each((_, el) => {
          const sellerName = $(el).text().trim();
          if (sellerName && sellerName.length > 0 && sellerName.length < 100) {
            sellers.push(sellerName);
          }
        });
      } catch (e) {
        continue;
      }
    }

    // Default to Takealot if no sellers found
    if (sellers.length === 0 && prices.length > 0) {
      sellers.push('Takealot');
    }

    // Remove duplicates and sort prices
    const uniquePrices = [...new Set(prices)].sort((a, b) => a - b);
    
    // Create competitors array
    const maxCompetitors = Math.min(uniquePrices.length, Math.max(sellers.length, 1), 5);
    for (let i = 0; i < maxCompetitors; i++) {
      competitors.push({
        seller: sellers[i] || 'Takealot',
        price: uniquePrices[i] || uniquePrices[0]
      });
    }

    // If no structured data found, fallback to regex
    if (competitors.length === 0) {
      const fallbackInfo = this.extractSellerInfo($.html());
      return fallbackInfo;
    }

    return {
      winnerSeller: competitors.length > 0 ? competitors[0].seller : null,
      winnerPrice: competitors.length > 0 ? competitors[0].price : null,
      totalSellers: Math.max(competitors.length, sellers.length),
      competitors
    };
  }

  /**
   * Extract availability status using Cheerio
   */
  private extractAvailabilityWithCheerio($: ReturnType<typeof cheerio.load>): 'in-stock' | 'out-of-stock' | 'limited' | 'unknown' {
    // Check for mock data format first
    const mockStockStatus = $('.stock-status').text().trim();
    if (mockStockStatus) {
      const status = mockStockStatus.toLowerCase();
      if (status.includes('in-stock') || status === 'in-stock') {
        return 'in-stock';
      }
      if (status.includes('out-of-stock') || status === 'out-of-stock') {
        return 'out-of-stock';
      }
      if (status.includes('limited') || status === 'limited') {
        return 'limited';
      }
    }
    
    // Try specific selectors first
    const availabilitySelectors = [
      '[data-ref="availability"]',
      '.availability',
      '.stock-status',
      '[class*="stock"]',
      '[data-testid*="availability"]',
      '.product-availability'
    ];

    for (const selector of availabilitySelectors) {
      try {
        const element = $(selector).first();
        if (element.length > 0) {
          const text = element.text().toLowerCase().trim();
          
          if (text.includes('out of stock') || text.includes('not available') || text.includes('sold out')) {
            return 'out-of-stock';
          }
          
          if (text.includes('limited') || text.includes('few left') || text.includes('only') && text.includes('left')) {
            return 'limited';
          }
          
          if (text.includes('in stock') || text.includes('available')) {
            return 'in-stock';
          }
        }
      } catch (e) {
        continue;
      }
    }

    // Check for add to cart button
    const cartSelectors = [
      '[data-ref="add-to-cart"]',
      '.add-to-cart',
      '[data-testid*="add-cart"]',
      'button[class*="cart"]'
    ];

    for (const selector of cartSelectors) {
      if ($(selector).length > 0 && !$(selector).is(':disabled')) {
        return 'in-stock';
      }
    }

    // Fallback to text analysis of the full HTML
    const htmlLower = $.html().toLowerCase();

    // Out of stock indicators
    if (htmlLower.includes('out of stock') || 
        htmlLower.includes('not available') || 
        htmlLower.includes('temporarily unavailable') ||
        htmlLower.includes('sold out')) {
      return 'out-of-stock';
    }

    // Limited stock indicators
    if (htmlLower.includes('limited stock') || 
        htmlLower.includes('few left') || 
        htmlLower.includes('only') && htmlLower.includes('left')) {
      return 'limited';
    }

    // In stock indicators
    if (htmlLower.includes('in stock') || 
        htmlLower.includes('available') || 
        htmlLower.includes('add to cart') ||
        htmlLower.includes('buy now')) {
      return 'in-stock';
    }

    return 'unknown';
  }

  /**
   * Scrape multiple products with rate limiting
   */
  async scrapeMultipleProducts(
    tsins: string[], 
    options: {
      delayMs?: number;
      maxConcurrent?: number;
      onProgress?: (completed: number, total: number) => void;
    } = {}
  ): Promise<Array<{ tsin: string; result: ScrapingResult }>> {
    const { delayMs = 2000, maxConcurrent = 3, onProgress } = options;
    const results: Array<{ tsin: string; result: ScrapingResult }> = [];
    
    // Process in batches to respect rate limits
    for (let i = 0; i < tsins.length; i += maxConcurrent) {
      const batch = tsins.slice(i, i + maxConcurrent);
      
      const batchPromises = batch.map(async (tsin) => {
        const result = await this.scrapeProduct(tsin);
        
        // Add delay between requests
        if (delayMs > 0) {
          await new Promise(resolve => setTimeout(resolve, delayMs));
        }
        
        return { tsin, result };
      });

      const batchResults = await Promise.all(batchPromises);
      results.push(...batchResults);

      // Report progress
      if (onProgress) {
        onProgress(results.length, tsins.length);
      }
    }

    return results;
  }

  /**
   * Extract product title using Cheerio
   */
  private extractTitleWithCheerio($: ReturnType<typeof cheerio.load>): string | null {
    // Try multiple selectors for title
    const selectors = [
      'h1.product-title',
      'h1[data-ref="product-title"]',
      '.product-listing h1',
      'title',
      'h1',
      '[data-testid="product-title"]',
      '.pdp-product-title',
      'meta[property="og:title"]'
    ];

    for (const selector of selectors) {
      try {
        const element = $(selector).first();
        if (element.length > 0) {
          let title = element.text().trim();
          
          // If it's the title tag, remove "| Takealot" suffix
          if (selector === 'title') {
            title = title.replace(/\s*\|\s*Takealot.*$/i, '');
          }
          
          if (title && title.length > 3) {
            return title;
          }
        }
      } catch (e) {
        continue;
      }
    }

    return null;
  }

  /**
   * Extract product image URL using Cheerio
   */
  private extractImageUrlWithCheerio($: ReturnType<typeof cheerio.load>): string | null {
    // Try multiple selectors for main product image
    const selectors = [
      '.product-main-image img',
      '[data-ref="product-image"] img',
      '.product-listing img',
      '.pdp-product-image img',
      '.gallery-main img',
      'meta[property="og:image"]',
      'img[data-testid="product-image"]'
    ];

    for (const selector of selectors) {
      try {
        const element = $(selector).first();
        if (element.length > 0) {
          let imageUrl = element.attr('src') || element.attr('data-src') || element.attr('content');
          
          if (imageUrl) {
            // Ensure it's a full URL
            if (imageUrl.startsWith('//')) {
              imageUrl = 'https:' + imageUrl;
            } else if (imageUrl.startsWith('/')) {
              imageUrl = 'https://www.takealot.com' + imageUrl;
            }
            
            return imageUrl;
          }
        }
      } catch (e) {
        continue;
      }
    }

    return null;
  }

  /**
   * Extract breadcrumbs using Cheerio
   */
  private extractBreadcrumbsWithCheerio($: ReturnType<typeof cheerio.load>): string[] {
    const breadcrumbs: string[] = [];

    // Try multiple selectors for breadcrumbs
    const selectors = [
      '.breadcrumbs',
      '[data-ref="breadcrumbs"]',
      '.breadcrumb',
      '.navigation-breadcrumbs',
      'nav[aria-label="breadcrumb"]'
    ];

    for (const selector of selectors) {
      try {
        const element = $(selector).first();
        if (element.length > 0) {
          const text = element.text().trim();
          
          if (text.includes('>')) {
            // Split by > and clean up
            const parts = text.split('>').map(part => part.trim()).filter(part => part);
            if (parts.length > 0) {
              return parts;
            }
          } else if (text) {
            // Single breadcrumb item
            breadcrumbs.push(text);
          }
        }
      } catch (e) {
        continue;
      }
    }

    // Try to extract from individual breadcrumb links
    try {
      $('.breadcrumbs a, .breadcrumb a').each((i, el) => {
        const text = $(el).text().trim();
        if (text) {
          breadcrumbs.push(text);
        }
      });
    } catch (e) {
      // Ignore
    }

    return breadcrumbs;
  }
}

export const takealotScrapingService = new TakealotScrapingService();
export default TakealotScrapingService;
