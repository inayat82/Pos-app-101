// Price Calculation Utilities
import { AutoPriceProduct } from '../types/auto-price.types';

export class PriceCalculationUtils {
  
  /**
   * Calculate win difference (Our Price - Winner Seller Price)
   */
  static calculateWinDifference(ourPrice: number, winnerSellerPrice?: number): number | undefined {
    if (!winnerSellerPrice || winnerSellerPrice <= 0) return undefined;
    return Math.round((ourPrice - winnerSellerPrice) * 100) / 100;
  }

  /**
   * Calculate profit/loss percentage
   */
  static calculateProfitLossPercentage(ourPrice: number, costPrice: number): number | undefined {
    if (!costPrice || costPrice <= 0) return undefined;
    return Math.round(((ourPrice - costPrice) / costPrice) * 100 * 100) / 100;
  }

  /**
   * Calculate profit/loss amount
   */
  static calculateProfitLossAmount(ourPrice: number, costPrice: number): number | undefined {
    if (!costPrice || costPrice <= 0) return undefined;
    return Math.round((ourPrice - costPrice) * 100) / 100;
  }

  /**
   * Determine minimum price based on cost and minimum margin
   */
  static calculateMinPrice(costPrice: number, minimumMarginPercent: number = 10): number {
    if (!costPrice || costPrice <= 0) return 0;
    const minimumPrice = costPrice * (1 + minimumMarginPercent / 100);
    return Math.round(minimumPrice * 100) / 100;
  }

  /**
   * Determine maximum price based on RRP or market conditions
   */
  static calculateMaxPrice(rrp: number, maxMarkupPercent: number = 20): number {
    if (!rrp || rrp <= 0) return 0;
    const maximumPrice = rrp * (1 + maxMarkupPercent / 100);
    return Math.round(maximumPrice * 100) / 100;
  }

  /**
   * Suggest competitive price based on winner seller price
   */
  static suggestCompetitivePrice(
    winnerSellerPrice: number,
    ourCurrentPrice: number,
    minPrice: number,
    maxPrice: number,
    competitiveMargin: number = 1 // Default 1 rand below winner
  ): number | undefined {
    if (!winnerSellerPrice || winnerSellerPrice <= 0) return undefined;
    
    // Calculate suggested price (winner price minus competitive margin)
    let suggestedPrice = winnerSellerPrice - competitiveMargin;
    
    // Ensure it's within our min/max bounds
    if (minPrice > 0 && suggestedPrice < minPrice) {
      suggestedPrice = minPrice;
    }
    if (maxPrice > 0 && suggestedPrice > maxPrice) {
      suggestedPrice = maxPrice;
    }
    
    // Only suggest if different from current price
    if (Math.abs(suggestedPrice - ourCurrentPrice) < 0.01) {
      return undefined;
    }
    
    return Math.round(suggestedPrice * 100) / 100;
  }

  /**
   * Calculate all derived fields for a product
   */
  static calculateDerivedFields(
    product: AutoPriceProduct,
    posPrice?: number,
    costPrice?: number,
    minimumMarginPercent: number = 10,
    maxMarkupPercent: number = 20
  ): Partial<AutoPriceProduct> {
    const derived: Partial<AutoPriceProduct> = {};

    // Win difference calculation
    if (product.scrapedWinnerSellerPrice) {
      derived.winDifference = this.calculateWinDifference(
        product.ourPrice, 
        product.scrapedWinnerSellerPrice
      );
      derived.winPrice = product.scrapedWinnerSellerPrice;
    }

    // POS price if available
    if (posPrice) {
      derived.posPrice = posPrice;
    }

    // Profit/loss calculations
    if (costPrice) {
      derived.profitLoss = this.calculateProfitLossAmount(product.ourPrice, costPrice);
    }

    // Min/max price calculations
    if (costPrice) {
      derived.minPrice = this.calculateMinPrice(costPrice, minimumMarginPercent);
    }
    if (product.rrp) {
      derived.maxPrice = this.calculateMaxPrice(product.rrp, maxMarkupPercent);
    }

    return derived;
  }

  /**
   * Determine price competitiveness status
   */
  static getPriceCompetitivenessStatus(
    ourPrice: number,
    winnerSellerPrice?: number,
    totalSellers?: number
  ): {
    status: 'winning' | 'competitive' | 'expensive' | 'unknown';
    message: string;
    color: 'green' | 'yellow' | 'red' | 'gray';
  } {
    if (!winnerSellerPrice) {
      return {
        status: 'unknown',
        message: 'No competitor data available',
        color: 'gray'
      };
    }

    const difference = ourPrice - winnerSellerPrice;
    const percentageDifference = (difference / winnerSellerPrice) * 100;

    if (difference <= 0) {
      return {
        status: 'winning',
        message: `Winning by R${Math.abs(difference).toFixed(2)}`,
        color: 'green'
      };
    } else if (percentageDifference <= 5) {
      return {
        status: 'competitive',
        message: `R${difference.toFixed(2)} above winner (${percentageDifference.toFixed(1)}%)`,
        color: 'yellow'
      };
    } else {
      return {
        status: 'expensive',
        message: `R${difference.toFixed(2)} above winner (${percentageDifference.toFixed(1)}%)`,
        color: 'red'
      };
    }
  }

  /**
   * Calculate potential revenue impact of price changes
   */
  static calculateRevenueImpact(
    currentPrice: number,
    suggestedPrice: number,
    estimatedMonthlySales: number = 0
  ): {
    priceChange: number;
    percentageChange: number;
    monthlyImpact: number;
    annualImpact: number;
  } {
    const priceChange = suggestedPrice - currentPrice;
    const percentageChange = (priceChange / currentPrice) * 100;
    const monthlyImpact = priceChange * estimatedMonthlySales;
    const annualImpact = monthlyImpact * 12;

    return {
      priceChange: Math.round(priceChange * 100) / 100,
      percentageChange: Math.round(percentageChange * 100) / 100,
      monthlyImpact: Math.round(monthlyImpact * 100) / 100,
      annualImpact: Math.round(annualImpact * 100) / 100
    };
  }

  /**
   * Format price for display
   */
  static formatPrice(price: number | undefined): string {
    if (price === undefined || price === null) return 'N/A';
    return `R${price.toFixed(2)}`;
  }

  /**
   * Format percentage for display
   */
  static formatPercentage(percentage: number | undefined): string {
    if (percentage === undefined || percentage === null) return 'N/A';
    const sign = percentage >= 0 ? '+' : '';
    return `${sign}${percentage.toFixed(1)}%`;
  }

  /**
   * Format difference for display with color coding
   */
  static formatDifference(difference: number | undefined): {
    text: string;
    color: 'green' | 'red' | 'gray';
  } {
    if (difference === undefined || difference === null) {
      return { text: 'N/A', color: 'gray' };
    }

    const color = difference <= 0 ? 'green' : 'red';
    const sign = difference > 0 ? '+' : '';
    return {
      text: `${sign}R${difference.toFixed(2)}`,
      color
    };
  }

  /**
   * Validate price inputs
   */
  static validatePrice(price: number): {
    isValid: boolean;
    errors: string[];
  } {
    const errors: string[] = [];

    if (isNaN(price)) {
      errors.push('Price must be a valid number');
    }

    if (price < 0) {
      errors.push('Price cannot be negative');
    }

    if (price > 1000000) {
      errors.push('Price seems unreasonably high');
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }
}
