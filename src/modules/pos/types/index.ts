// POS Types
// TODO: Move from src/types/pos.ts

export interface POSItem {
  id: string;
  name: string;
  price: number;
  quantity: number;
  category?: string;
}

export interface POSTransaction {
  id: string;
  items: POSItem[];
  total: number;
  timestamp: string;
  customerId?: string;
}

export interface Invoice {
  id: string;
  transaction: POSTransaction;
  customer?: {
    name: string;
    email?: string;
    phone?: string;
  };
  createdAt: string;
  status: 'draft' | 'sent' | 'paid' | 'cancelled';
}
