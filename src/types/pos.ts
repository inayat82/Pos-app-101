export interface Brand {
  id: string;
  name: string;
  adminId: string;
  imageUrl?: string;
  imagePath?: string;
  description?: string;
}

export interface Category {
  id: string;
  name: string;
  adminId: string;
  imageUrl?: string;
  imagePath?: string;
  description?: string;
  parent?: string | null;
}

export interface Supplier {
  id: string;
  name: string;
  contactPerson?: string;
  email?: string;
  phone?: string;
  address?: string;
  companyName?: string; // Added
  vatNumber?: string; // Added
  notes?: string; // Added
  adminId: string;
}

export interface Product {
  id: string;
  name: string;
  sku: string;
  barcode?: string;
  advancedDescription?: string;
  brandId?: string; // Made optional
  categoryId?: string; // Made optional
  supplierId?: string; // Made optional
  purchasePrice: number;
  sellPrice: number; // Renamed from sellingPrice for consistency
  stockQty: number; // Renamed from quantity for clarity
  reorderLevel?: number;
  imageUrl?: string;
  imagePath?: string; // Added
  weight?: number;
  dimensions?: string;
  tags?: string;
  location?: string;
  rackNo?: string;
  stockHandler?: string;
  modelNo?: string;
  notes?: string;
  adminId: string;
  createdAt?: any; // Using 'any' for Timestamp to avoid direct Firebase import in types
  updatedAt?: any; // Using 'any' for Timestamp
}

export interface Sale {
  id: string;
  // Define sale properties here
  adminId: string;
}

export interface ProductFormData {
  name: string;
  sku: string;
  barcode?: string;
  advancedDescription?: string;
  brandId?: string;
  categoryId?: string;
  supplierId?: string;
  purchasePrice: number;
  sellPrice: number; // Renamed from sellingPrice for consistency
  stockQty: number; // Renamed from quantity for clarity
  reorderLevel?: number;
  imageUrl?: string;
  weight?: number;
  dimensions?: string;
  tags?: string;
  location?: string;
  rackNo?: string;
  stockHandler?: string;
  modelNo?: string;
  notes?: string;
}

export interface PurchaseOrderItem {
  id: string;
  productId: string;
  productName: string;
  productSku: string;
  productBarcode?: string;
  brandId?: string;
  brandName?: string;
  categoryId?: string;
  categoryName?: string;
  supplierId?: string;
  supplierName?: string;
  purchasePrice: number;
  quantity: number;
  totalAmount: number;
  adminId: string;
  dateAdded: any; // Timestamp
  status: 'pending' | 'out-of-stock' | 'ordered' | 'received';
  receivedAt?: any; // Timestamp
  updatedAt?: any; // Timestamp
  purchaseOrderId?: string; // Reference to PurchaseOrder when moved to ordered status
}

export interface PurchaseOrder {
  id: string;
  adminId: string;
  supplierId: string;
  supplierName: string;
  status: 'open' | 'closed' | 'cancelled';
  totalAmount: number;
  itemCount: number;
  createdAt: any; // Timestamp
  updatedAt: any; // Timestamp
  closedAt?: any; // Timestamp
  notes?: string;
}

export interface Purchase {
  id: string;
  purchaseOrderItemId: string;
  productId: string;
  productName: string;
  productSku: string;
  productBarcode?: string;
  brandId?: string;
  brandName?: string;
  categoryId?: string;
  categoryName?: string;
  supplierId?: string;
  supplierName?: string;
  purchasePrice: number;
  quantity: number;
  totalAmount: number;
  adminId: string;
  purchaseDate: any; // Timestamp
  receivedDate: any; // Timestamp
  createdAt: any; // Timestamp
}

// You can add other POS related types here, for example:
// export interface Customer { ... }
