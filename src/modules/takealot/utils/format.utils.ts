// src/modules/takealot/utils/format.utils.ts
// Takealot formatting utilities

/**
 * Format Takealot price with currency
 */
export function formatTakealotPrice(price: number, currency: string = 'ZAR'): string {
  return new Intl.NumberFormat('en-ZA', {
    style: 'currency',
    currency: currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(price);
}

/**
 * Format Takealot product title
 */
export function formatProductTitle(title: string): string {
  if (!title) return '';
  
  // Trim whitespace and limit length
  const trimmed = title.trim();
  if (trimmed.length <= 100) return trimmed;
  
  return trimmed.substring(0, 97) + '...';
}

/**
 * Format Takealot order ID
 */
export function formatOrderId(orderId: string): string {
  if (!orderId) return '';
  
  // Add prefix if not present
  if (!orderId.startsWith('TK')) {
    return `TK${orderId}`;
  }
  
  return orderId;
}

/**
 * Format Takealot date
 */
export function formatTakealotDate(date: string | Date): string {
  if (!date) return '';
  
  const dateObj = typeof date === 'string' ? new Date(date) : date;
  
  if (isNaN(dateObj.getTime())) return '';
  
  return dateObj.toLocaleDateString('en-ZA', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  });
}

/**
 * Format Takealot percentage
 */
export function formatPercentage(value: number): string {
  if (typeof value !== 'number' || isNaN(value)) return '0%';
  
  return `${(value * 100).toFixed(1)}%`;
}

/**
 * Format stock quantity
 */
export function formatStockQuantity(quantity: number): string {
  if (typeof quantity !== 'number' || isNaN(quantity)) return '0';
  
  return quantity.toLocaleString();
}

/**
 * Format file size
 */
export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 Bytes';
  
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}
