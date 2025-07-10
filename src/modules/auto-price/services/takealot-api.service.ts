// Enhanced Takealot API Scraping Service - Phase 1 Implementation
// Based on the external Scrapy script analysis
import axios from 'axios';
import { webshareService } from '@/modules/webshare/services';
import { WebshareProxy } from '@/modules/webshare/types';

export interface TakealotApiProduct {
  // Core product info
  id: string;
  title: string;
  brand: string;
  seller: string;
  price: string;
  stock: string;
  reviews: string;
  star_rating: string;
  barcode: string;
  product_url: string;
  image_url: string;
  
  // Competitor data
  other_offers_count: string;
  competitors: Array<{
    seller: string;
    price: string;
    status: string;
  }>;
  
  // Quality validation
  titleMismatchWarning?: {
    expected: string;
    scraped: string;
    similarity: number;
  };
  
  // Raw API response for analysis
  raw_product_details?: any;
  raw_search_data?: any;
}

export interface TakealotApiResponse {
  success: boolean;
  data?: TakealotApiProduct;
  error?: string;
  duration: number;
  apiCallsMade: number;
  rawResponses: {
    searchResponse?: any;
    productDetailsResponse?: any;
  };
  proxyInfo?: {
    address: string;
    country: string;
    city: string;
    usedProxy: boolean;
  };
}

class TakealotApiService {
  private readonly API_BASE = 'https://api.takealot.com/rest/v-1-11-0';
  private readonly DEFAULT_HEADERS = {
    'authority': 'api.takealot.com',
    'accept': '*/*',
    'accept-language': 'en-US,en;q=0.9,ms;q=0.8,ur;q=0.7',
    'cache-control': 'max-age=0',
    'origin': 'https://www.takealot.com',
    'referer': 'https://www.takealot.com/',
    'sec-ch-ua': '"Google Chrome";v="119", "Chromium";v="119", "Not?A_Brand";v="24"',
    'sec-ch-ua-mobile': '?0',
    'sec-ch-ua-platform': '"Windows"',
    'sec-fetch-dest': 'empty',
    'sec-fetch-mode': 'cors',
    'sec-fetch-site': 'same-site',
    'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36',
  };

  /**
   * Scrape product using Takealot API endpoints (like the external script)
   */
  async scrapeProductByTsin(tsin: string): Promise<TakealotApiResponse> {
    const startTime = Date.now();
    let apiCallsMade = 0;
    const rawResponses: any = {};

    try {
      console.log(`[TakealotAPI] Starting API-based scraping for TSIN: ${tsin}`);

      // Step 1: Get product details directly using TSIN with proxy support
      const productDetailsUrl = `${this.API_BASE}/product-details/PLID${tsin}?platform=desktop&display_credit=true`;
      
      console.log(`[TakealotAPI] Fetching product details: ${productDetailsUrl}`);
      
      const { response: productResponse, proxyInfo } = await this.makeProxyRequest(productDetailsUrl, {
        timeout: 8000, // Reduced from 15000ms for faster scraping
        validateStatus: (status) => status < 500
      });
      
      apiCallsMade++;
      rawResponses.productDetailsResponse = productResponse.data;

      if (productResponse.status !== 200) {
        return {
          success: false,
          error: `API returned status ${productResponse.status}`,
          duration: Date.now() - startTime,
          apiCallsMade,
          rawResponses
        };
      }

      // Parse the API response (similar to external script)
      const productData = this.parseProductDetailsResponse(productResponse.data);
      
      const duration = Date.now() - startTime;
      
      console.log(`[TakealotAPI] ✅ Successfully scraped product via API in ${duration}ms`);
      
      return {
        success: true,
        data: productData,
        duration,
        apiCallsMade,
        rawResponses,
        proxyInfo
      };

    } catch (error: any) {
      console.error(`[TakealotAPI] Error scraping TSIN ${tsin}:`, error.message);
      
      return {
        success: false,
        error: `API scraping failed: ${error.message}`,
        duration: Date.now() - startTime,
        apiCallsMade,
        rawResponses
      };
    }
  }

  /**
   * Scrape product using TSIN and actual offer URL to prevent mismatched data
   */
  async scrapeProductByTsinAndUrl(tsin: string, offerUrl: string): Promise<TakealotApiResponse> {
    const startTime = Date.now();
    let apiCallsMade = 0;
    const rawResponses: any = {};

    try {
      console.log(`[TakealotAPI] Starting URL-based scraping for TSIN: ${tsin}`);
      console.log(`[TakealotAPI] Using URL: ${offerUrl}`);

      // Extract PLID from offer_url instead of using TSIN
      const plid = this.extractPlidFromUrl(offerUrl);
      if (!plid) {
        return {
          success: false,
          error: `Could not extract PLID from URL: ${offerUrl}`,
          duration: Date.now() - startTime,
          apiCallsMade,
          rawResponses
        };
      }

      // Step 1: Get product details using the correct PLID from URL with proxy support
      const productDetailsUrl = `${this.API_BASE}/product-details/${plid}?platform=desktop&display_credit=true`;
      
      console.log(`[TakealotAPI] Fetching product details: ${productDetailsUrl}`);
      
      const { response: productResponse, proxyInfo } = await this.makeProxyRequest(productDetailsUrl, {
        timeout: 8000, // Reduced from 15000ms for faster scraping
        validateStatus: (status) => status < 500
      });
      
      apiCallsMade++;
      rawResponses.productDetailsResponse = productResponse.data;

      if (productResponse.status !== 200) {
        return {
          success: false,
          error: `API returned status ${productResponse.status}`,
          duration: Date.now() - startTime,
          apiCallsMade,
          rawResponses
        };
      }

      // Parse the API response
      const productData = this.parseProductDetailsResponse(productResponse.data);
      
      // Validate that we got the right product by checking TSIN if available
      if (productData.id && productData.id !== tsin) {
        console.warn(`[TakealotAPI] Warning: TSIN mismatch. Expected: ${tsin}, Got: ${productData.id}`);
      }
      
      const duration = Date.now() - startTime;
      
      console.log(`[TakealotAPI] ✅ Successfully scraped product via URL in ${duration}ms`);
      
      return {
        success: true,
        data: productData,
        duration,
        apiCallsMade,
        rawResponses,
        proxyInfo
      };

    } catch (error: any) {
      console.error(`[TakealotAPI] Error scraping TSIN ${tsin} with URL ${offerUrl}:`, error.message);
      
      return {
        success: false,
        error: `URL-based scraping failed: ${error.message}`,
        duration: Date.now() - startTime,
        apiCallsMade,
        rawResponses
      };
    }
  }

  /**
   * Extract PLID from Takealot URL
   */
  private extractPlidFromUrl(url: string): string | null {
    try {
      // Handle different URL formats:
      // https://www.takealot.com/p/PLID12345678
      // https://www.takealot.com/product-name/PLID12345678
      const plidMatch = url.match(/\/PLID(\d+)/);
      if (plidMatch) {
        return `PLID${plidMatch[1]}`;
      }

      // Handle direct PLID format
      const directPlidMatch = url.match(/PLID\d+/);
      if (directPlidMatch) {
        return directPlidMatch[0];
      }

      return null;
    } catch (error) {
      console.error('Error extracting PLID from URL:', error);
      return null;
    }
  }

  /**
   * Parse product details API response (correct structure based on analysis)
   */
  private parseProductDetailsResponse(jsonData: any): TakealotApiProduct {
    const data: any = {};

    // Extract basic product info
    try { data.star_rating = jsonData["core"]["star_rating"]?.toString() || '0'; } catch { data.star_rating = '0'; }
    try { data.reviews = jsonData["core"]["reviews"]?.toString() || '0'; } catch { data.reviews = '0'; }
    try { data.title = jsonData["core"]["title"] || ''; } catch { data.title = ''; }
    try { data.brand = jsonData["core"]["brand"] || ''; } catch { data.brand = ''; }
    
    // Price and seller info from buybox.items[0]
    const firstItem = jsonData?.buybox?.items?.[0];
    if (firstItem) {
      try { data.price = firstItem["pretty_price"] || `R ${firstItem["price"]}` || '0'; } catch { data.price = '0'; }
      try { data.stock = firstItem["stock_availability"]["status"] || 'Unknown'; } catch { data.stock = 'Unknown'; }
    } else {
      data.price = '0';
      data.stock = 'Unknown';
    }
    
    // For seller info, we need to look elsewhere or check offer_detail
    try { 
      data.seller = firstItem?.["offer_detail"]?.["seller_name"] || 
                   jsonData["seller_detail"]?.["display_name"] || 
                   'Takealot'; 
    } catch { 
      data.seller = 'Takealot'; 
    }
    
    // Barcode extraction (following external script logic)
    let barcode = '';
    try {
      const productInfo = jsonData["product_information"]?.["items"] || [];
      for (const item of productInfo) {
        if (item["item_type"] && item["item_type"].includes("barcode")) {
          barcode = item['displayable_text'] || '';
          break;
        }
      }
    } catch { /* ignore */ }
    data.barcode = barcode.replace('\\', '');
    
    // URLs and images
    try { data.product_url = jsonData['seo']['canonical'] || `https://www.takealot.com/product/PLID${jsonData?.core?.id}`; } catch { data.product_url = ''; }
    try { 
      const images = jsonData['gallery']?.['images'] || [];
      if (images.length > 0) {
        data.image_url = images[0]
          .replace('{size}', 'zoom')
          .replace('{size', 'zoom')
          .replace('}', ''); 
      } else {
        data.image_url = '';
      }
    } catch { data.image_url = ''; }

    // Competitor offers (other sellers) - this would be in a separate API call typically
    const competitors: Array<{seller: string, price: string, status: string}> = [];
    try {
      // Note: The current API call doesn't return other sellers
      // This would require a separate API call to get competing offers
      data.other_offers_count = '0';
    } catch { 
      data.other_offers_count = '0';
    }

    return {
      id: jsonData?.core?.id?.toString() || '',
      title: data.title,
      brand: data.brand,
      seller: data.seller,
      price: data.price,
      stock: data.stock,
      reviews: data.reviews,
      star_rating: data.star_rating,
      barcode: data.barcode,
      product_url: data.product_url,
      image_url: data.image_url,
      other_offers_count: data.other_offers_count,
      competitors,
      raw_product_details: jsonData // Store raw response for analysis
    };
  }

  /**
   * Search products by seller ID (following external script approach)
   */
  async searchProductsBySeller(sellerId: string): Promise<{
    success: boolean;
    products?: Array<{id: string, title: string}>;
    error?: string;
    rawResponse?: any;
  }> {
    try {
      const searchUrl = `${this.API_BASE}/searches/products,filters,facets,sort_options,breadcrumbs,slots_audience,context,seo?sellers=${sellerId}&filter=Sellers:${sellerId}`;
      
      console.log(`[TakealotAPI] Searching products for seller: ${sellerId}`);
      
      const { response, proxyInfo } = await this.makeProxyRequest(searchUrl, {
        timeout: 8000 // Reduced from 15000ms for faster scraping
      });

      if (response.status !== 200) {
        return {
          success: false,
          error: `Search API returned status ${response.status}`
        };
      }

      const products = response.data?.sections?.products?.results || [];
      const productList = products.map((record: any) => ({
        id: record?.product_views?.core?.id || '',
        title: record?.product_views?.core?.title || ''
      }));

      return {
        success: true,
        products: productList,
        rawResponse: response.data
      };

    } catch (error: any) {
      return {
        success: false,
        error: `Search failed: ${error.message}`
      };
    }
  }

  /**
   * Make HTTP request with proxy support
   * Uses webshare proxy rotation for better scraping success rates
   */
  private async makeProxyRequest(url: string, options: {
    method?: 'GET' | 'POST';
    timeout?: number;
    validateStatus?: (status: number) => boolean;
  } = {}): Promise<{
    response: any;
    proxyInfo: {
      address: string;
      country: string;
      city: string;
      usedProxy: boolean;
    };
  }> {
    try {
      // Try to get a proxy for the request
      const proxy = await webshareService.getRandomProxy();
      
      if (proxy) {
        console.log(`[TakealotAPI] Using proxy: ${proxy.proxy_address}:${proxy.port} (${proxy.country_code})`);
        
        // Import proxy agent dynamically
        const { HttpsProxyAgent } = await import('https-proxy-agent');
        
        // Create proxy agent
        const proxyUrl = `http://${proxy.username}:${proxy.password}@${proxy.proxy_address}:${proxy.port}`;
        const httpsAgent = new HttpsProxyAgent(proxyUrl);
        
        // Make request with proxy
        const response = await axios({
          method: options.method || 'GET',
          url,
          headers: this.DEFAULT_HEADERS,
          timeout: options.timeout || 8000, // Reduced default timeout
          httpsAgent,
          validateStatus: options.validateStatus || ((status) => status < 500)
        });
        
        return {
          response,
          proxyInfo: {
            address: `${proxy.proxy_address}:${proxy.port}`,
            country: proxy.country_code,
            city: proxy.city_name || 'Unknown',
            usedProxy: true
          }
        };
      } else {
        console.log(`[TakealotAPI] No proxy available, using direct connection`);
        
        // Fallback to direct connection
        const response = await axios({
          method: options.method || 'GET',
          url,
          headers: this.DEFAULT_HEADERS,
          timeout: options.timeout || 8000, // Reduced default timeout
          validateStatus: options.validateStatus || ((status) => status < 500)
        });
        
        return {
          response,
          proxyInfo: {
            address: 'Direct Connection',
            country: 'N/A',
            city: 'N/A',
            usedProxy: false
          }
        };
      }
    } catch (error: any) {
      console.error(`[TakealotAPI] Proxy request failed:`, error.message);
      
      // Fallback to direct connection on proxy failure
      console.log(`[TakealotAPI] Falling back to direct connection`);
      const response = await axios({
        method: options.method || 'GET',
        url,
        headers: this.DEFAULT_HEADERS,
        timeout: options.timeout || 8000, // Reduced default timeout
        validateStatus: options.validateStatus || ((status) => status < 500)
      });
      
      return {
        response,
        proxyInfo: {
          address: 'Direct Connection (Fallback)',
          country: 'N/A',
          city: 'N/A',
          usedProxy: false
        }
      };
    }
  }
}

// Export singleton instance
export const takealotApiService = new TakealotApiService();
