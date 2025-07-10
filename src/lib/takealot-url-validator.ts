/**
 * Takealot URL Validation and Formatting Utilities
 * Ensures all URLs follow the correct PLID format
 */

export interface TakealotUrlValidation {
  isValid: boolean;
  hasPlid: boolean;
  extractedPlid?: string;
  errorMessage?: string;
}

export class TakealotUrlValidator {
  
  /**
   * Validate if a URL is a proper Takealot URL with PLID format
   */
  static validateUrl(url: string): TakealotUrlValidation {
    if (!url) {
      return {
        isValid: false,
        hasPlid: false,
        errorMessage: 'URL is empty or undefined'
      };
    }

    // Check if it's a valid Takealot domain
    if (!url.includes('takealot.com')) {
      return {
        isValid: false,
        hasPlid: false,
        errorMessage: 'URL is not from takealot.com domain'
      };
    }

    // Check for PLID format (should contain /x/PLID followed by numbers)
    const plidMatch = url.match(/\/x\/(PLID\d+)/);
    if (plidMatch) {
      return {
        isValid: true,
        hasPlid: true,
        extractedPlid: plidMatch[1]
      };
    }

    // Check if it's using the old /p/ format (this is problematic)
    if (url.includes('/p/')) {
      return {
        isValid: false,
        hasPlid: false,
        errorMessage: 'URL uses deprecated /p/ format instead of /x/PLID format'
      };
    }

    return {
      isValid: false,
      hasPlid: false,
      errorMessage: 'URL does not contain valid PLID format (/x/PLID...)'
    };
  }

  /**
   * Extract PLID from a valid Takealot URL
   */
  static extractPlid(url: string): string | null {
    const validation = this.validateUrl(url);
    return validation.extractedPlid || null;
  }

  /**
   * Check if URL is using the deprecated /p/ format
   */
  static isDeprecatedFormat(url: string): boolean {
    return url.includes('/p/') && url.includes('takealot.com');
  }

  /**
   * Generate a warning message for deprecated URLs
   */
  static getDeprecationWarning(url: string): string {
    return `⚠️ DEPRECATED URL FORMAT: ${url} uses /p/ format. Should use /x/PLID format from offer_url in database.`;
  }

  /**
   * Log validation errors for debugging
   */
  static logValidationError(url: string, context: string = 'Unknown'): void {
    const validation = this.validateUrl(url);
    if (!validation.isValid) {
      console.error(`[URL Validation Error] Context: ${context}`);
      console.error(`URL: ${url}`);
      console.error(`Error: ${validation.errorMessage}`);
      
      if (this.isDeprecatedFormat(url)) {
        console.error(this.getDeprecationWarning(url));
      }
    }
  }

  /**
   * Suggest using offer_url instead of generating URLs
   */
  static suggestOfferUrl(tsin: string): string {
    return `⚠️ Instead of generating URL for TSIN ${tsin}, use the 'offer_url' field from the database which contains the correct PLID format.`;
  }
}

/**
 * Helper function to validate and warn about URLs
 */
export function validateTakealotUrl(url: string, context: string = 'Unknown'): boolean {
  const validation = TakealotUrlValidator.validateUrl(url);
  
  if (!validation.isValid) {
    TakealotUrlValidator.logValidationError(url, context);
    return false;
  }
  
  return true;
}

/**
 * Helper function to safely get URL from product data
 */
export function getSafeProductUrl(productData: { offer_url?: string; url?: string; tsin?: string }): string {
  // Priority 1: Use offer_url from database (this should contain PLID)
  if (productData.offer_url) {
    const validation = TakealotUrlValidator.validateUrl(productData.offer_url);
    if (validation.isValid) {
      return productData.offer_url;
    } else {
      console.warn(`⚠️ offer_url is not valid PLID format: ${productData.offer_url}`);
    }
  }

  // Priority 2: Use url field if available
  if (productData.url) {
    const validation = TakealotUrlValidator.validateUrl(productData.url);
    if (validation.isValid) {
      return productData.url;
    } else {
      console.warn(`⚠️ url field is not valid PLID format: ${productData.url}`);
    }
  }

  // Priority 3: Generate fallback URL (but warn about it)
  const fallbackUrl = `https://www.takealot.com/p/${productData.tsin}`;
  console.error(`🚨 CRITICAL: No valid offer_url found for TSIN ${productData.tsin}. Using fallback URL: ${fallbackUrl}`);
  console.error(`🚨 This indicates a database issue - all products should have valid offer_url with PLID format.`);
  
  return fallbackUrl;
}
