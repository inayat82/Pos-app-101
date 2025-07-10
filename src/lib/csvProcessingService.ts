import { ReconInvoiceItem } from '@/types/recon-invoice';

export interface CSVParseResult {
  isValid: boolean;
  items: ReconInvoiceItem[];
  errors: string[];
  warnings: string[];
  totalAmount: number;
  itemCount: number;
}

export type CSVFormat = 'takealot_recon' | 'simple_invoice' | 'unknown';

export class CSVProcessingService {
  /**
   * Parse CSV file and extract invoice items
   */
  static async parseCSVFile(file: File): Promise<CSVParseResult> {
    try {
      const text = await this.readFileAsText(file);
      return this.parseCSVText(text, file.name);
    } catch (error) {
      return {
        isValid: false,
        items: [],
        errors: [`Failed to read file: ${error instanceof Error ? error.message : 'Unknown error'}`],
        warnings: [],
        totalAmount: 0,
        itemCount: 0
      };
    }
  }

  /**
   * Parse CSV text content
   */
  static parseCSVText(csvText: string, fileName: string = 'upload.csv'): CSVParseResult {
    const errors: string[] = [];
    const warnings: string[] = [];
    const items: ReconInvoiceItem[] = [];

    try {
      // Split into lines and filter out empty lines
      const lines = csvText.split('\n').map(line => line.trim()).filter(line => line.length > 0);
      
      if (lines.length === 0) {
        return {
          isValid: false,
          items: [],
          errors: ['File is empty'],
          warnings: [],
          totalAmount: 0,
          itemCount: 0
        };
      }

      // Parse header row
      const headerLine = lines[0];
      const headers = this.parseCSVLine(headerLine);
      
      // Detect CSV format type
      const formatType = this.detectCSVFormat(headers);
      
      if (formatType === 'unknown') {
        return {
          isValid: false,
          items: [],
          errors: [
            'Unrecognized CSV format. Please ensure your file contains either:',
            '• Takealot Stock Recon format (period, tsin_id, sku, product_title, total_claim_value, etc.)',
            '• Simple invoice format (title, tsin, quantity, total amount)'
          ],
          warnings: [],
          totalAmount: 0,
          itemCount: 0
        };
      }

      // Validate headers based on format
      const headerValidation = this.validateHeadersForFormat(headers, formatType);
      
      if (!headerValidation.isValid) {
        return {
          isValid: false,
          items: [],
          errors: headerValidation.errors,
          warnings: [],
          totalAmount: 0,
          itemCount: 0
        };
      }

      // Skip description row if it's a Takealot Stock Recon file
      const dataStartIndex = formatType === 'takealot_recon' ? 2 : 1;

      // Parse data rows
      for (let i = dataStartIndex; i < lines.length; i++) {
        const line = lines[i];
        if (!line.trim()) continue; // Skip empty lines

        try {
          const values = this.parseCSVLine(line);
          const item = this.parseDataRowForFormat(values, headerValidation.columnMap, formatType, i + 1);
          
          if (item.errors.length > 0) {
            errors.push(...item.errors);
          }
          if (item.warnings.length > 0) {
            warnings.push(...item.warnings);
          }
          if (item.item) {
            items.push(item.item);
          }
        } catch (error) {
          errors.push(`Row ${i + 1}: Failed to parse line - ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
      }

      // Calculate totals
      const totalAmount = items.reduce((sum, item) => sum + item.totalAmount, 0);
      const itemCount = items.length;

      // Add summary warnings
      if (itemCount === 0) {
        errors.push('No valid data rows found');
      }

      // Add format-specific warnings
      if (formatType === 'takealot_recon' && itemCount > 0) {
        warnings.unshift(`✅ Processed ${itemCount} items with claim values from Takealot Stock Reconciliation report`);
        
        // Count items with and without losses
        const linesProcessed = lines.length - dataStartIndex;
        const skippedItems = linesProcessed - itemCount;
        if (skippedItems > 0) {
          warnings.push(`ℹ️ Skipped ${skippedItems} items with no losses or claim values`);
        }
        
        warnings.push(`💰 Total claim amount: R${totalAmount.toFixed(2)}`);
      }

      return {
        isValid: errors.length === 0,
        items,
        errors,
        warnings,
        totalAmount,
        itemCount
      };

    } catch (error) {
      return {
        isValid: false,
        items: [],
        errors: [`Failed to parse CSV: ${error instanceof Error ? error.message : 'Unknown error'}`],
        warnings: [],
        totalAmount: 0,
        itemCount: 0
      };
    }
  }

  /**
   * Validate file before processing
   */
  static validateFile(file: File): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];

    // Check file type
    if (!file.name.toLowerCase().endsWith('.csv')) {
      errors.push('File must be a CSV file (.csv extension)');
    }

    // Check file size (10MB limit)
    const maxSize = 10 * 1024 * 1024; // 10MB
    if (file.size > maxSize) {
      errors.push('File size must be less than 10MB');
    }

    // Check if file is empty
    if (file.size === 0) {
      errors.push('File is empty');
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  /**
   * Detect CSV format based on headers
   */
  private static detectCSVFormat(headers: string[]): CSVFormat {
    const normalizedHeaders = headers.map(h => h.toLowerCase().trim());

    // Check for Takealot Stock Recon format
    const takealotReconKeys = ['period', 'tsin_id', 'sku', 'product_title', 'average_selling_price', 'success_fee', 'fulfilment_fee', 'total_claim_value', 'other_outflow'];
    const hasTakealotKeys = takealotReconKeys.slice(0, 5).every(key => 
      normalizedHeaders.some(header => header === key)
    );

    if (hasTakealotKeys) {
      return 'takealot_recon';
    }

    // Check for simple invoice format
    const simpleInvoiceKeys = ['title', 'tsin', 'quantity', 'total amount'];
    const hasSimpleKeys = simpleInvoiceKeys.every(key => 
      normalizedHeaders.some(header => 
        header === key || 
        header === key.replace(' ', '') || 
        header === key.replace(' ', '_')
      )
    );

    if (hasSimpleKeys) {
      return 'simple_invoice';
    }

    return 'unknown';
  }

  /**
   * Validate headers for specific format
   */
  private static validateHeadersForFormat(headers: string[], format: CSVFormat): {
    isValid: boolean;
    errors: string[];
    columnMap: { [key: string]: number };
  } {
    const errors: string[] = [];
    const columnMap: { [key: string]: number } = {};
    const normalizedHeaders = headers.map(h => h.toLowerCase().trim());

    if (format === 'takealot_recon') {
      const requiredColumns = {
        'period': 'period',
        'tsin_id': 'tsin_id',
        'sku': 'sku', 
        'product_title': 'product_title',
        'average_selling_price': 'average_selling_price',
        'success_fee': 'success_fee',
        'fulfilment_fee': 'fulfilment_fee',
        'total_claim_value': 'total_claim_value',
        'other_outflow': 'other_outflow'
      };

      for (const [key, column] of Object.entries(requiredColumns)) {
        const index = normalizedHeaders.findIndex(h => h === column);
        if (index === -1) {
          errors.push(`Missing required column for Takealot Recon: "${column}"`);
        } else {
          columnMap[key] = index;
        }
      }
    } else if (format === 'simple_invoice') {
      const requiredColumns = {
        'title': ['title', 'product_title', 'product title'],
        'tsin': ['tsin', 'tsin_id', 'sku'],
        'quantity': ['quantity', 'qty'],
        'totalamount': ['total amount', 'totalamount', 'total_amount', 'amount']
      };

      for (const [key, variations] of Object.entries(requiredColumns)) {
        const index = normalizedHeaders.findIndex(h => 
          variations.some(variation => h === variation)
        );
        if (index === -1) {
          errors.push(`Missing required column: one of ${variations.join(', ')}`);
        } else {
          columnMap[key] = index;
        }
      }
    }

    return {
      isValid: errors.length === 0,
      errors,
      columnMap
    };
  }

  /**
   * Parse a data row based on format
   */
  private static parseDataRowForFormat(
    values: string[], 
    columnMap: { [key: string]: number }, 
    format: CSVFormat, 
    rowNumber: number
  ): {
    item: ReconInvoiceItem | null;
    errors: string[];
    warnings: string[];
  } {
    const errors: string[] = [];
    const warnings: string[] = [];

    try {
      if (format === 'takealot_recon') {
        return this.parseTakealotReconRow(values, columnMap, rowNumber);
      } else if (format === 'simple_invoice') {
        return this.parseSimpleInvoiceRow(values, columnMap, rowNumber);
      }

      return {
        item: null,
        errors: [`Row ${rowNumber}: Unknown format`],
        warnings: []
      };

    } catch (error) {
      return {
        item: null,
        errors: [`Row ${rowNumber}: ${error instanceof Error ? error.message : 'Unknown error'}`],
        warnings: []
      };
    }
  }

  /**
   * Parse Takealot Stock Recon row
   */
  private static parseTakealotReconRow(
    values: string[], 
    columnMap: { [key: string]: number }, 
    rowNumber: number
  ): {
    item: ReconInvoiceItem | null;
    errors: string[];
    warnings: string[];
  } {
    const errors: string[] = [];
    const warnings: string[] = [];

    try {
      // Extract values
      const tsin = values[columnMap.tsin_id]?.trim() || '';
      const sku = values[columnMap.sku]?.trim() || '';
      const title = values[columnMap.product_title]?.trim() || '';
      const totalClaimValueStr = values[columnMap.total_claim_value]?.trim() || '';
      const averageSellingPriceStr = values[columnMap.average_selling_price]?.trim() || '';
      const successFeeStr = values[columnMap.success_fee]?.trim() || '';
      const fulfilmentFeeStr = values[columnMap.fulfilment_fee]?.trim() || '';
      const otherOutflowStr = values[columnMap.other_outflow]?.trim() || '';

      // Validate required fields
      if (!tsin) {
        errors.push(`Row ${rowNumber}: TSIN ID is required`);
      }
      if (!title) {
        errors.push(`Row ${rowNumber}: Product title is required`);
      }

      // Parse numeric values
      const totalClaimValue = parseFloat(totalClaimValueStr) || 0;
      const averageSellingPrice = parseFloat(averageSellingPriceStr) || 0;
      const successFee = parseFloat(successFeeStr) || 0;
      const fulfilmentFee = parseFloat(fulfilmentFeeStr) || 0;
      const otherOutflow = parseFloat(otherOutflowStr) || 0;

      // Calculate claim value if not provided or is 0
      let calculatedClaimValue = totalClaimValue;
      
      // If total_claim_value is 0 but there are losses (other_outflow > 0), calculate manually
      if (totalClaimValue === 0 && otherOutflow > 0 && averageSellingPrice > 0) {
        // Formula from Takealot: (average_selling_price - success_fee - fulfilment_fee) * other_outflow
        const netSellingPrice = averageSellingPrice - successFee - fulfilmentFee;
        if (netSellingPrice > 0) {
          calculatedClaimValue = netSellingPrice * otherOutflow;
          warnings.push(`Row ${rowNumber}: Calculated claim value (${calculatedClaimValue.toFixed(2)}) for ${otherOutflow} lost items`);
        }
      }
      
      // Skip items with no claim value and no losses
      if (calculatedClaimValue <= 0 && otherOutflow <= 0) {
        return {
          item: null,
          errors: [],
          warnings: [`Row ${rowNumber}: Skipped item with no losses or claim value`]
        };
      }

      // For items with losses but no claim value calculated, use a warning but still include
      if (calculatedClaimValue <= 0 && otherOutflow > 0) {
        warnings.push(`Row ${rowNumber}: Item has ${otherOutflow} losses but no calculable claim value`);
        // Skip items we can't calculate a value for
        return {
          item: null,
          errors: [],
          warnings
        };
      }

      // Use the quantity as the other_outflow (actual lost items) for better tracking
      const quantity = Math.max(1, otherOutflow); // At least 1 for claim items
      const unitPrice = quantity > 0 ? calculatedClaimValue / quantity : calculatedClaimValue;
      const totalAmount = calculatedClaimValue;

      // Add SKU and loss info to title for clarity
      let fullTitle = sku ? `${title} (SKU: ${sku})` : title;
      if (otherOutflow > 0) {
        fullTitle += ` - ${otherOutflow} lost items`;
      }

      // Return item if no errors
      if (errors.length === 0) {
        return {
          item: {
            title: fullTitle,
            tsin,
            quantity,
            unitPrice,
            totalAmount
          },
          errors: [],
          warnings
        };
      } else {
        return {
          item: null,
          errors,
          warnings
        };
      }

    } catch (error) {
      return {
        item: null,
        errors: [`Row ${rowNumber}: ${error instanceof Error ? error.message : 'Unknown error'}`],
        warnings: []
      };
    }
  }

  /**
   * Parse simple invoice row
   */
  private static parseSimpleInvoiceRow(
    values: string[], 
    columnMap: { [key: string]: number }, 
    rowNumber: number
  ): {
    item: ReconInvoiceItem | null;
    errors: string[];
    warnings: string[];
  } {
    const errors: string[] = [];
    const warnings: string[] = [];

    try {
      // Extract values
      const title = values[columnMap.title]?.trim() || '';
      const tsin = values[columnMap.tsin]?.trim() || '';
      const quantityStr = values[columnMap.quantity]?.trim() || '';
      const totalAmountStr = values[columnMap.totalamount]?.trim() || '';

      // Validate required fields
      if (!title) {
        errors.push(`Row ${rowNumber}: Title is required`);
      }
      if (!tsin) {
        errors.push(`Row ${rowNumber}: TSIN is required`);
      }
      if (!quantityStr) {
        errors.push(`Row ${rowNumber}: Quantity is required`);
      }
      if (!totalAmountStr) {
        errors.push(`Row ${rowNumber}: Total Amount is required`);
      }

      // Parse numeric values
      const quantity = parseInt(quantityStr);
      if (isNaN(quantity) || quantity <= 0) {
        errors.push(`Row ${rowNumber}: Quantity must be a positive number`);
      }

      // Parse total amount (handle currency symbols)
      const cleanAmountStr = totalAmountStr.replace(/[R\s,]/g, '');
      const totalAmount = parseFloat(cleanAmountStr);
      if (isNaN(totalAmount) || totalAmount < 0) {
        errors.push(`Row ${rowNumber}: Total Amount must be a valid number`);
      }

      // Calculate unit price
      let unitPrice = 0;
      if (!isNaN(quantity) && !isNaN(totalAmount) && quantity > 0) {
        unitPrice = totalAmount / quantity;
      }

      // Add warnings for potential issues
      if (title.length > 200) {
        warnings.push(`Row ${rowNumber}: Title is very long (${title.length} characters)`);
      }
      if (tsin && !/^\d+$/.test(tsin)) {
        warnings.push(`Row ${rowNumber}: TSIN should contain only numbers`);
      }

      // Return item if no errors
      if (errors.length === 0) {
        return {
          item: {
            title,
            tsin,
            quantity,
            unitPrice,
            totalAmount
          },
          errors: [],
          warnings
        };
      } else {
        return {
          item: null,
          errors,
          warnings
        };
      }

    } catch (error) {
      return {
        item: null,
        errors: [`Row ${rowNumber}: ${error instanceof Error ? error.message : 'Unknown error'}`],
        warnings: []
      };
    }
  }

  /**
   * Read file as text
   */
  private static readFileAsText(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        if (e.target?.result) {
          resolve(e.target.result as string);
        } else {
          reject(new Error('Failed to read file'));
        }
      };
      reader.onerror = () => reject(new Error('File reading failed'));
      reader.readAsText(file);
    });
  }

  /**
   * Parse a single CSV line handling quotes and commas
   */
  private static parseCSVLine(line: string): string[] {
    const result: string[] = [];
    let current = '';
    let inQuotes = false;
    
    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      
      if (char === '"') {
        if (inQuotes && line[i + 1] === '"') {
          // Escaped quote
          current += '"';
          i++; // Skip next quote
        } else {
          // Toggle quote state
          inQuotes = !inQuotes;
        }
      } else if (char === ',' && !inQuotes) {
        // End of field
        result.push(current.trim());
        current = '';
      } else {
        current += char;
      }
    }
    
    // Add last field
    result.push(current.trim());
    
    return result;
  }
}
