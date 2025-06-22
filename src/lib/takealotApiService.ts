// src/lib/takealotApiService.ts

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
  let url = `${TAKEALOT_API_BASE_URL}${endpoint}`;

  if (params && method === 'GET') {
    const queryParams = new URLSearchParams();
    for (const [key, value] of Object.entries(params)) {
      queryParams.append(key, String(value));
    }
    if (queryParams.toString()) {
      url += `?${queryParams.toString()}`;
    }
  }

  const headers: HeadersInit = {
    'Authorization': `Key ${apiKey}`,
    'Content-Type': 'application/json',
  };

  const config: RequestInit = {
    method,
    headers,
  };

  if (body && (method === 'POST' || method === 'PATCH')) {
    config.body = JSON.stringify(body);
  }
  try {
    console.log(`Making Takealot API request: ${method} ${url}`);
    const response = await fetch(url, config);
    console.log(`Takealot API response status: ${response.status} ${response.statusText}`);

    if (!response.ok) {
      let errorData: TakealotApiErrorResponse | string;
      try {
        errorData = await response.json();
      } catch (e) {
        errorData = await response.text(); // Fallback if JSON parsing fails
      }
      
      const errorMessage = typeof errorData === 'string' ? errorData : errorData.message || `API request failed with status ${response.status}`;
      const errorCode = typeof errorData === 'object' ? errorData.error_code : undefined;
      const errorDetails = typeof errorData === 'object' ? errorData.errors || errorData : undefined;

      console.error(`Takealot API Error (${response.status}) for ${method} ${url}:`, errorData);
      throw new TakealotApiError(errorMessage, response.status, errorCode, errorDetails);
    }

    // Handle cases where response might be empty but successful (e.g., 204 No Content)
    if (response.status === 204) {
      return {} as T; // Or handle as appropriate for your use case
    }

    const jsonResponse = await response.json() as T;
    console.log(`Takealot API response data for ${endpoint}:`, JSON.stringify(jsonResponse, null, 2));
    return jsonResponse;

  } catch (error) {
    if (error instanceof TakealotApiError) {
      throw error; // Re-throw TakealotApiError
    }
    // Handle network errors or other unexpected issues
    console.error(`Network or unexpected error during Takealot API request to ${url}:`, error);
    throw new TakealotApiError(
      error instanceof Error ? error.message : 'An unexpected network error occurred',
      0, // Or a custom status code for network errors
      'NETWORK_ERROR'
    );
  }
}

// --- Specific API Functions ---

/**
 * Checks the API connection by making a simple request (e.g., fetching offer count or first page of offers).
 */
export async function checkTakealotConnection(apiKey: string): Promise<{ success: boolean; message: string; details?: any }> {
  try {
    // Using /v2/offers/count as a lightweight check as per docs
    // Or /v2/offers?page_number=1&page_size=1 if /count is not available/suitable
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
  offers: any[]; // Define more specific offer type if needed
}

/**
 * Fetches total product count and calculates total pages.
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
    
    const totalPages = Math.ceil(totalProducts / 100); // Assuming 100 items per page for full listings
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
  sales: any[]; // Define more specific sale type if needed
}

/**
 * Fetches total sales count for a given period (e.g., last 30 days) and calculates total pages.
 * Note: Date filtering parameters for the sales endpoint need to be confirmed from Takealot docs.
 * For now, this will fetch the summary of all sales if no date filters are applied by the endpoint by default.
 */
export async function getTakealotSalesTotals(
  apiKey: string, 
  // startDate?: string, // YYYY-MM-DD
  // endDate?: string   // YYYY-MM-DD
): Promise<{ success: boolean; totalSales?: number; totalPages?: number; message: string; details?: any }> {
  try {
    console.log('getTakealotSalesTotals: Making API request...');
    // const params: Record<string, string | number> = { page_number: 1, page_size: 1 };
    // if (startDate) params.start_date = startDate;
    // if (endDate) params.end_date = endDate;
    // The /V2/sales endpoint might require specific date filter params not listed in the general overview.
    // For now, we hit it with minimal params to get the overall total if available.
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
    
    const totalPages = Math.ceil(totalSales / 100); // Assuming 100 items per page for full listings
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
