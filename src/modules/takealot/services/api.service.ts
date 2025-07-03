// src/modules/takealot/services/api.service.ts
// Takealot API Service - Consolidated core API interaction logic

import { takealotProxyService } from './proxy.service';

const TAKEALOT_API_BASE_URL = 'https://seller-api.takealot.com';

interface TakealotApiErrorResponse {
  error_code?: string;
  message?: string;
  errors?: Array<{ field: string; message: string }>;
}

export class TakealotApiError extends Error {
  public statusCode: number;
  public errorCode?: string;
  public details?: any;

  constructor(message: string, statusCode: number, errorCode?: string, details?: any) {
    super(message);
    this.name = 'TakealotApiError';
    this.statusCode = statusCode;
    this.errorCode = errorCode;
    this.details = details;
  }
}

async function makeTakealotApiRequest<T>(
  apiKey: string,
  endpoint: string,
  method: 'GET' | 'POST' | 'PATCH' = 'GET',
  params?: Record<string, string | number>,
  body?: Record<string, any>
): Promise<T> {
  console.log(`Making Takealot API request through proxy: ${method} ${endpoint}`);
  
  try {
    let response;
    
    if (method === 'GET') {
      response = await takealotProxyService.get(endpoint, apiKey, params, {
        adminId: 'settings-api-check', // Identifier for settings page calls
        integrationId: 'settings-api-check',
        requestType: 'manual',
        dataType: endpoint.includes('sales') ? 'sales' : 'products',
        timeout: 30000
      });
    } else {
      response = await takealotProxyService.post(endpoint, apiKey, body, {
        adminId: 'settings-api-check',
        integrationId: 'settings-api-check', 
        requestType: 'manual',
        dataType: endpoint.includes('sales') ? 'sales' : 'products',
        timeout: 30000
      });
    }
    
    if (!response.success) {
      const errorMessage = response.error || `API request failed with status ${response.statusCode}`;
      console.error(`Takealot API Error (${response.statusCode}) for ${method} ${endpoint}:`, response.error);
      throw new TakealotApiError(errorMessage, response.statusCode || 0, 'API_ERROR');
    }

    console.log(`Takealot API response data for ${endpoint} (via proxy ${response.proxyUsed}):`, JSON.stringify(response.data, null, 2));
    return response.data as T;
    
  } catch (error) {
    if (error instanceof TakealotApiError) {
      throw error; // Re-throw TakealotApiError
    }
    // Handle network errors or other unexpected issues
    console.error(`Network or unexpected error during Takealot API request to ${endpoint}:`, error);
    throw new TakealotApiError(
      error instanceof Error ? error.message : 'An unexpected network error occurred',
      0, // Or a custom status code for network errors
      'NETWORK_ERROR'
    );
  }
}

// --- Specific API Functions ---

/**
 * Checks the API connection by making a simple request
 */
export async function checkTakealotConnection(apiKey: string): Promise<{ success: boolean; message: string; details?: any }> {
  try {
    await makeTakealotApiRequest<any>(apiKey, '/v2/offers/count', 'GET');
    return { success: true, message: 'API connection successful.' };
  } catch (error) {
    if (error instanceof TakealotApiError) {
      return { 
        success: false, 
        message: `API connection failed: ${error.message}`,
        details: { statusCode: error.statusCode, errorCode: error.errorCode, apiDetails: error.details }
      };
    }
    return { success: false, message: `API connection failed: ${error instanceof Error ? error.message : 'Unknown error'}` };
  }
}

interface TakealotOffersResponse {
  page_size: number;
  page_number: number;
  total_results: number;
  offers: any[];
}

/**
 * Fetches total product count and calculates total pages
 */
export async function getTakealotProductTotals(apiKey: string): Promise<{ success: boolean; totalProducts?: number; totalPages?: number; message: string; details?: any }> {
  try {
    console.log('getTakealotProductTotals: Making API request...');
    const response = await makeTakealotApiRequest<TakealotOffersResponse>(apiKey, '/v2/offers', 'GET', { page_number: 1, page_size: 1 });
    console.log('getTakealotProductTotals: Raw API response:', JSON.stringify(response, null, 2));
    
    const totalProducts = response.total_results;
    console.log('getTakealotProductTotals: Extracted totalProducts:', totalProducts);
    
    if (typeof totalProducts !== 'number' || isNaN(totalProducts)) {
      console.error('getTakealotProductTotals: total_results is not a valid number:', totalProducts);
      return { 
        success: false, 
        message: `Invalid total_results received from API: ${totalProducts}`,
        details: { responseStructure: response }
      };
    }
    
    const totalPages = Math.ceil(totalProducts / 100);
    console.log('getTakealotProductTotals: Calculated totalPages:', totalPages);
    
    return { 
      success: true, 
      totalProducts, 
      totalPages, 
      message: 'Successfully fetched product totals.' 
    };
  } catch (error) {
    console.error('getTakealotProductTotals: Error occurred:', error);
    if (error instanceof TakealotApiError) {
      return { 
        success: false, 
        message: `Failed to fetch product totals: ${error.message}`,
        details: { statusCode: error.statusCode, errorCode: error.errorCode, apiDetails: error.details }
      };
    }
    return { success: false, message: `Failed to fetch product totals: ${error instanceof Error ? error.message : 'Unknown error'}` };
  }
}

interface TakealotSalesPageSummary {
  total: number;
  page_size: number;
  page_number: number;
}

interface TakealotSalesResponse {
  page_summary: TakealotSalesPageSummary;
  sales: any[];
}

/**
 * Fetches total sales count and calculates total pages
 */
export async function getTakealotSalesTotals(apiKey: string): Promise<{ success: boolean; totalSales?: number; totalPages?: number; message: string; details?: any }> {
  try {
    console.log('getTakealotSalesTotals: Making API request...');
    const response = await makeTakealotApiRequest<TakealotSalesResponse>(apiKey, '/V2/sales', 'GET', { page_number: 1, page_size: 1 });
    console.log('getTakealotSalesTotals: Raw API response:', JSON.stringify(response, null, 2));
    
    const totalSales = response.page_summary?.total;
    console.log('getTakealotSalesTotals: Extracted totalSales:', totalSales);
    
    if (typeof totalSales !== 'number' || isNaN(totalSales)) {
      console.error('getTakealotSalesTotals: page_summary.total is not a valid number:', totalSales);
      return { 
        success: false, 
        message: `Invalid page_summary.total received from API: ${totalSales}`,
        details: { responseStructure: response }
      };
    }
    
    const totalPages = Math.ceil(totalSales / 100);
    console.log('getTakealotSalesTotals: Calculated totalPages:', totalPages);
    
    return { 
      success: true, 
      totalSales, 
      totalPages, 
      message: 'Successfully fetched sales totals.' 
    };
  } catch (error) {
    console.error('getTakealotSalesTotals: Error occurred:', error);
    if (error instanceof TakealotApiError) {
      return { 
        success: false, 
        message: `Failed to fetch sales totals: ${error.message}`,
        details: { statusCode: error.statusCode, errorCode: error.errorCode, apiDetails: error.details }
      };
    }
    return { success: false, message: `Failed to fetch sales totals: ${error instanceof Error ? error.message : 'Unknown error'}` };
  }
}

/**
 * Batch fetch offers with pagination support.
 */
export async function fetchTakealotOffers(
  apiKey: string,
  pageNumber: number = 1,
  pageSize: number = 100
): Promise<{ success: boolean; data?: TakealotOffersResponse; error?: string }> {
  try {
    const response = await makeTakealotApiRequest<TakealotOffersResponse>(
      apiKey,
      '/v2/offers',
      'GET',
      { page_number: pageNumber, page_size: pageSize }
    );
    return { success: true, data: response };
  } catch (error) {
    if (error instanceof TakealotApiError) {
      return { success: false, error: error.message };
    }
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
}

/**
 * Batch fetch sales with pagination support.
 */
export async function fetchTakealotSales(
  apiKey: string,
  pageNumber: number = 1,
  pageSize: number = 100
): Promise<{ success: boolean; data?: TakealotSalesResponse; error?: string }> {
  try {
    const response = await makeTakealotApiRequest<TakealotSalesResponse>(
      apiKey,
      '/v2/sales',
      'GET',
      { page_number: pageNumber, page_size: pageSize }
    );
    return { success: true, data: response };
  } catch (error) {
    if (error instanceof TakealotApiError) {
      return { success: false, error: error.message };
    }
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
}

// Export the main API request function for custom usage
export { makeTakealotApiRequest };
