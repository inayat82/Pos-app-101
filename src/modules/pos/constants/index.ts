// POS Constants

export const POS_CONFIG = {
  CURRENCY: 'ZAR',
  TAX_RATE: 0.15, // 15% VAT
  MAX_ITEMS_PER_TRANSACTION: 100,
  TRANSACTION_TIMEOUT: 300000, // 5 minutes
} as const;

export const INVOICE_STATUSES = {
  DRAFT: 'draft',
  SENT: 'sent', 
  PAID: 'paid',
  CANCELLED: 'cancelled',
} as const;

export const PAYMENT_METHODS = {
  CASH: 'cash',
  CARD: 'card',
  TRANSFER: 'transfer',
  SPLIT: 'split',
} as const;
