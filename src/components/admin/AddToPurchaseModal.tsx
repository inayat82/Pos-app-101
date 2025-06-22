import React, { useState, useEffect } from 'react';
import { FiX, FiShoppingCart, FiPackage, FiDollarSign, FiTruck, FiClock, FiUser } from 'react-icons/fi';
import { Product, Supplier, PurchaseOrderItem } from '@/types/pos';
import { Timestamp } from 'firebase/firestore';

// Extended product interface for the product page
interface PageProduct extends Product {
  brandName?: string;
  categoryName?: string;
  supplierName?: string;
}

interface PurchaseHistory {
  supplierId: string;
  supplierName: string;
  purchasePrice: number;
  purchaseDate: Date;
  quantity: number;
}

interface AddToPurchaseModalProps {
  isOpen: boolean;
  onClose: () => void;
  product: PageProduct | null;
  suppliers: Supplier[];
  purchaseHistory: PurchaseHistory[];
  onAddToPending: (quantity: number) => Promise<void>;
  isLoading?: boolean;
}

const AddToPurchaseModal: React.FC<AddToPurchaseModalProps> = ({
  isOpen,
  onClose,
  product,
  suppliers,
  purchaseHistory,
  onAddToPending,
  isLoading = false
}) => {
  const [quantity, setQuantity] = useState(1);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      setQuantity(1);
      setError(null);
    }
  }, [isOpen]);

  if (!isOpen || !product) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (quantity <= 0) {
      setError('Quantity must be greater than 0');
      return;
    }

    try {
      setError(null);
      await onAddToPending(quantity);
      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to add to purchase list');
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b">
          <div className="flex items-center gap-3">
            <FiShoppingCart className="text-blue-600" size={24} />
            <h2 className="text-xl font-semibold text-gray-900">Add to Purchase List</h2>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
            disabled={isLoading}
          >
            <FiX size={24} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6">          {/* Product Info */}
          <div className="bg-gradient-to-r from-gray-50 to-blue-50 rounded-lg p-6 mb-6 border border-gray-200">
            <div className="flex items-start gap-4">
              <div className="w-20 h-20 bg-gray-200 rounded-lg flex items-center justify-center overflow-hidden border-2 border-white shadow-sm">
                {product.imageUrl ? (
                  <img 
                    src={product.imageUrl} 
                    alt={product.name}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <FiPackage className="text-gray-400" size={32} />
                )}
              </div>
              <div className="flex-1">
                <h3 className="text-xl font-bold text-gray-900 mb-2">{product.name}</h3>
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-gray-600">SKU:</span>
                    <span className="text-gray-800 font-mono bg-gray-100 px-2 py-1 rounded">{product.sku || 'N/A'}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-gray-600">Barcode:</span>
                    <span className="text-gray-800 font-mono bg-gray-100 px-2 py-1 rounded">{product.barcode || 'N/A'}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-gray-600">Stock:</span>
                    <span className={`font-semibold px-2 py-1 rounded ${
                      (product.stockQty || 0) > 10 ? 'text-green-700 bg-green-100' :
                      (product.stockQty || 0) > 0 ? 'text-yellow-700 bg-yellow-100' :
                      'text-red-700 bg-red-100'
                    }`}>
                      {product.stockQty || 0} units
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-gray-600">Last Price:</span>
                    <span className="text-green-700 font-bold bg-green-100 px-2 py-1 rounded">
                      R {product.purchasePrice?.toFixed(2) || 'N/A'}
                    </span>
                  </div>
                </div>
                {product.brandName && (
                  <div className="mt-2 flex items-center gap-2">
                    <span className="text-xs font-medium text-gray-500">Brand:</span>
                    <span className="text-sm text-blue-600 font-medium">{product.brandName}</span>
                  </div>
                )}
              </div>
            </div>
          </div>{/* Purchase History */}
          {purchaseHistory.length > 0 && (
            <div className="mb-6">
              <h4 className="font-medium text-gray-900 mb-3 flex items-center gap-2">
                <FiClock className="text-blue-600" size={16} />
                Recent Purchase History (Last 5 Suppliers)
              </h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-h-64 overflow-y-auto">
                {purchaseHistory.slice(0, 5).map((history, index) => (
                  <div key={index} className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg p-4 border border-blue-200 hover:shadow-md transition-all duration-200">
                    <div className="flex justify-between items-start mb-2">
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
                          <FiUser className="text-blue-600" size={14} />
                        </div>
                        <div>
                          <span className="text-sm font-semibold text-blue-900 block">
                            {history.supplierName}
                          </span>
                          <span className="text-xs text-blue-700">
                            {history.purchaseDate.toLocaleDateString()}
                          </span>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-lg font-bold text-green-600">
                          R {history.purchasePrice.toFixed(2)}
                        </div>
                        <div className="text-xs text-gray-600">per unit</div>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-2 pt-2 border-t border-blue-100">
                      <div className="text-center">
                        <span className="text-xs text-blue-700 block">Quantity</span>
                        <span className="text-sm font-medium text-blue-900">{history.quantity}</span>
                      </div>
                      <div className="text-center">
                        <span className="text-xs text-blue-700 block">Total</span>
                        <span className="text-sm font-medium text-green-600">R {(history.purchasePrice * history.quantity).toFixed(2)}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {purchaseHistory.length === 0 && (
            <div className="mb-6 text-center py-8 bg-gray-50 rounded-lg border-2 border-dashed border-gray-200">
              <FiClock size={32} className="mx-auto mb-2 text-gray-300" />
              <p className="text-gray-500 font-medium">No purchase history available</p>
              <p className="text-sm text-gray-400">This will be your first purchase for this product</p>
            </div>
          )}          {/* Quantity Input */}
          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 mb-2 flex items-center gap-2">
              <FiShoppingCart className="text-blue-600" size={16} />
              Order Quantity
            </label>
            <div className="relative">
              <input
                type="number"
                min="1"
                value={quantity}
                onChange={(e) => setQuantity(parseInt(e.target.value) || 1)}
                className="w-full px-4 py-3 text-lg font-medium border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                required
                disabled={isLoading}
                placeholder="Enter quantity"
              />
              <div className="absolute inset-y-0 right-0 flex items-center pr-3">
                <span className="text-gray-400 text-sm">units</span>
              </div>
            </div>
            <p className="text-xs text-gray-500 mt-1">Specify how many units you want to order</p>
          </div>

          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg">
              <p className="text-red-600 text-sm">{error}</p>
            </div>
          )}

          {/* Footer */}
          <div className="flex gap-3 pt-4 border-t">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
              disabled={isLoading}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="flex-1 px-4 py-2 bg-blue-600 text-white hover:bg-blue-700 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              disabled={isLoading}
            >
              {isLoading ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent"></div>
                  Adding...
                </>
              ) : (
                <>
                  <FiShoppingCart size={16} />
                  Add to Purchase List
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default AddToPurchaseModal;
