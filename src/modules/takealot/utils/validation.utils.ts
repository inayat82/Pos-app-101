// src/modules/takealot/utils/validation.utils.ts
// Takealot validation utilities

/**
 * Validate Takealot API key format
 */
export function validateApiKey(apiKey: string): { isValid: boolean; error?: string } {
  if (!apiKey) {
    return { isValid: false, error: 'API key is required' };
  }
  
  if (typeof apiKey !== 'string') {
    return { isValid: false, error: 'API key must be a string' };
  }
  
  if (apiKey.length < 20) {
    return { isValid: false, error: 'API key appears to be too short' };
  }
  
  // Basic format check - Takealot API keys are typically alphanumeric
  if (!/^[a-zA-Z0-9]+$/.test(apiKey)) {
    return { isValid: false, error: 'API key contains invalid characters' };
  }
  
  return { isValid: true };
}

/**
 * Validate Takealot TSIN ID
 */
export function validateTsin(tsin: string): { isValid: boolean; error?: string } {
  if (!tsin) {
    return { isValid: false, error: 'TSIN is required' };
  }
  
  if (typeof tsin !== 'string') {
    return { isValid: false, error: 'TSIN must be a string' };
  }
  
  // TSIN is typically numeric
  if (!/^\d+$/.test(tsin)) {
    return { isValid: false, error: 'TSIN must be numeric' };
  }
  
  return { isValid: true };
}

/**
 * Validate product data structure
 */
export function validateProductData(product: any): { isValid: boolean; errors: string[] } {
  const errors: string[] = [];
  
  if (!product) {
    errors.push('Product data is required');
    return { isValid: false, errors };
  }
  
  if (!product.tsin_id) {
    errors.push('Product TSIN ID is required');
  }
  
  if (!product.product_title) {
    errors.push('Product title is required');
  }
  
  if (typeof product.selling_price !== 'number' || product.selling_price < 0) {
    errors.push('Valid selling price is required');
  }
  
  return { isValid: errors.length === 0, errors };
}

/**
 * Validate sales data structure
 */
export function validateSalesData(sale: any): { isValid: boolean; errors: string[] } {
  const errors: string[] = [];
  
  if (!sale) {
    errors.push('Sales data is required');
    return { isValid: false, errors };
  }
  
  if (!sale.order_id && !sale.sale_id) {
    errors.push('Order ID or Sale ID is required');
  }
  
  if (!sale.tsin_id) {
    errors.push('TSIN ID is required');
  }
  
  if (typeof sale.quantity !== 'number' || sale.quantity < 0) {
    errors.push('Valid quantity is required');
  }
  
  if (typeof sale.selling_price !== 'number' || sale.selling_price < 0) {
    errors.push('Valid selling price is required');
  }
  
  return { isValid: errors.length === 0, errors };
}

/**
 * Validate sync strategy
 */
export function validateSyncStrategy(strategy: string): { isValid: boolean; error?: string } {
  const validStrategies = [
    'prod_all', 'prod_100',
    'sls_100', 'sls_30d', 'sls_6m', 'sls_all'
  ];
  
  if (!strategy) {
    return { isValid: false, error: 'Sync strategy is required' };
  }
  
  if (!validStrategies.includes(strategy)) {
    return { isValid: false, error: `Invalid sync strategy. Must be one of: ${validStrategies.join(', ')}` };
  }
  
  return { isValid: true };
}

/**
 * Validate pagination parameters
 */
export function validatePaginationParams(page: number, pageSize: number): { isValid: boolean; errors: string[] } {
  const errors: string[] = [];
  
  if (typeof page !== 'number' || page < 1) {
    errors.push('Page must be a positive number starting from 1');
  }
  
  if (typeof pageSize !== 'number' || pageSize < 1 || pageSize > 1000) {
    errors.push('Page size must be between 1 and 1000');
  }
  
  return { isValid: errors.length === 0, errors };
}

/**
 * Validate date range
 */
export function validateDateRange(startDate?: string, endDate?: string): { isValid: boolean; errors: string[] } {
  const errors: string[] = [];
  
  if (startDate) {
    const start = new Date(startDate);
    if (isNaN(start.getTime())) {
      errors.push('Invalid start date format');
    }
  }
  
  if (endDate) {
    const end = new Date(endDate);
    if (isNaN(end.getTime())) {
      errors.push('Invalid end date format');
    }
  }
  
  if (startDate && endDate) {
    const start = new Date(startDate);
    const end = new Date(endDate);
    
    if (start > end) {
      errors.push('Start date must be before end date');
    }
    
    // Check if date range is too large (more than 1 year)
    const oneYear = 365 * 24 * 60 * 60 * 1000; // milliseconds
    if (end.getTime() - start.getTime() > oneYear) {
      errors.push('Date range cannot exceed 1 year');
    }
  }
  
  return { isValid: errors.length === 0, errors };
}
