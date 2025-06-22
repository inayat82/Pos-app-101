import React, { useState, useEffect } from 'react';
import { FiX, FiShoppingCart, FiPackage, FiDollarSign, FiTruck, FiAlertTriangle, FiUser, FiClock, FiCheck } from 'react-icons/fi';
import { PurchaseOrderItem, Supplier } from '@/types/pos';

interface PurchaseHistory {
  supplierId: string;
  supplierName: string;
  purchasePrice: number;
  purchaseDate: Date;
  quantity: number;
}

interface PurchaseActionModalProps {
  isOpen: boolean;
  onClose: () => void;
  item: PurchaseOrderItem | null;
  suppliers: Supplier[];
  purchaseHistory: PurchaseHistory[];
  onPurchase: (data: {
    supplierId: string;
    purchasePrice: number;
    quantity: number;
  }) => Promise<void>;
  onMarkOutOfStock: () => Promise<void>;
  isLoading?: boolean;
}

const PurchaseActionModal: React.FC<PurchaseActionModalProps> = ({
  isOpen,
  onClose,
  item,
  suppliers,
  purchaseHistory,
  onPurchase,
  onMarkOutOfStock,
  isLoading = false
}) => {
  const [action, setAction] = useState<'purchase' | 'out-of-stock' | null>(null);
  const [selectedSupplierId, setSelectedSupplierId] = useState('');
  const [purchasePrice, setPurchasePrice] = useState(0);
  const [quantity, setQuantity] = useState(1);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen && item) {
      setAction(null);
      setSelectedSupplierId(item.supplierId || '');
      setPurchasePrice(item.purchasePrice || 0);
      setQuantity(item.quantity || 1);
      setError(null);
    }
  }, [isOpen, item]);

  if (!isOpen || !item) return null;

  const handlePurchase = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!selectedSupplierId) {
      setError('Please select a supplier');
      return;
    }
    
    if (purchasePrice <= 0) {
      setError('Purchase price must be greater than 0');
      return;
    }
    
    if (quantity <= 0) {
      setError('Quantity must be greater than 0');
      return;
    }

    try {
      setError(null);
      await onPurchase({
        supplierId: selectedSupplierId,
        purchasePrice,
        quantity
      });
      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to process purchase');
    }
  };

  const handleOutOfStock = async () => {
    try {
      setError(null);
      await onMarkOutOfStock();
      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to mark as out of stock');
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-4xl max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b bg-gradient-to-r from-blue-50 to-indigo-50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
              <FiShoppingCart className="text-blue-600" size={24} />
            </div>
            <div>
              <h2 className="text-xl font-semibold text-gray-900">Purchase Actions</h2>
              <p className="text-sm text-gray-600">Manage purchase orders and stock levels</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors p-2 hover:bg-gray-100 rounded-full"
            disabled={isLoading}
          >
            <FiX size={24} />
          </button>
        </div>

        <div className="p-6">
          {/* Product Info */}
          <div className="bg-gradient-to-r from-gray-50 to-blue-50 rounded-lg p-6 mb-6 border border-gray-200">
            <div className="flex items-start gap-4">
              <div className="w-20 h-20 bg-gray-200 rounded-lg flex items-center justify-center border-2 border-white shadow-sm">
                <FiPackage className="text-gray-400" size={32} />
              </div>
              <div className="flex-1">
                <h3 className="text-xl font-bold text-gray-900 mb-2">{item.productName}</h3>
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-gray-600">SKU:</span>
                    <span className="text-gray-800 font-mono bg-gray-100 px-2 py-1 rounded">{item.productSku || 'N/A'}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-gray-600">Barcode:</span>
                    <span className="text-gray-800 font-mono bg-gray-100 px-2 py-1 rounded">{item.productBarcode || 'N/A'}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-gray-600">Brand:</span>
                    <span className="text-blue-600 font-medium">{item.brandName || 'N/A'}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-gray-600">Category:</span>
                    <span className="text-gray-800">{item.categoryName || 'N/A'}</span>
                  </div>
                </div>
                <div className="mt-3 p-3 bg-blue-100 rounded-lg border border-blue-200">
                  <span className="text-sm font-medium text-blue-800">
                    Requested Quantity: {item.quantity} units
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Purchase History */}
          {purchaseHistory.length > 0 && (
            <div className="mb-6">
              <h4 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
                <FiClock className="text-blue-600" size={18} />
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
          )}

          {/* Action Selection */}
          {!action && (
            <div className="space-y-4">
              <h4 className="font-semibold text-gray-900 text-lg">Choose Action:</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <button
                  onClick={() => setAction('purchase')}
                  className="p-6 border-2 border-green-200 hover:border-green-300 rounded-lg text-left transition-all duration-200 group hover:shadow-md"
                  disabled={isLoading}
                >
                  <div className="flex items-center gap-3 mb-3">
                    <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center group-hover:bg-green-200 transition-colors">
                      <FiShoppingCart className="text-green-600 group-hover:text-green-700" size={24} />
                    </div>
                    <div>
                      <span className="font-semibold text-green-900 text-lg block">Purchase</span>
                      <span className="text-sm text-green-700">Create purchase order</span>
                    </div>
                  </div>
                  <p className="text-sm text-gray-600">
                    Process purchase order with supplier details, pricing, and quantities
                  </p>
                </button>

                <button
                  onClick={() => setAction('out-of-stock')}
                  className="p-6 border-2 border-orange-200 hover:border-orange-300 rounded-lg text-left transition-all duration-200 group hover:shadow-md"
                  disabled={isLoading}
                >
                  <div className="flex items-center gap-3 mb-3">
                    <div className="w-12 h-12 bg-orange-100 rounded-full flex items-center justify-center group-hover:bg-orange-200 transition-colors">
                      <FiAlertTriangle className="text-orange-600 group-hover:text-orange-700" size={24} />
                    </div>
                    <div>
                      <span className="font-semibold text-orange-900 text-lg block">Mark Out of Stock</span>
                      <span className="text-sm text-orange-700">Move to out of stock list</span>
                    </div>
                  </div>
                  <p className="text-sm text-gray-600">
                    Move to out of stock list for later review and potential reordering
                  </p>
                </button>
              </div>
            </div>
          )}

          {/* Purchase Form */}
          {action === 'purchase' && (
            <form onSubmit={handlePurchase} className="space-y-6">
              <div className="flex items-center gap-2 mb-4">
                <button
                  type="button"
                  onClick={() => setAction(null)}
                  className="text-blue-600 hover:text-blue-700 text-sm flex items-center gap-1 hover:underline"
                >
                  ← Back to actions
                </button>
              </div>

              <div className="bg-gradient-to-r from-green-50 to-emerald-50 rounded-lg p-4 border border-green-200">
                <h4 className="font-semibold text-green-900 mb-2 flex items-center gap-2">
                  <FiShoppingCart className="text-green-600" />
                  Purchase Order Details
                </h4>
                <p className="text-sm text-green-700">
                  Complete the purchase details below to create a purchase order
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2 flex items-center gap-2">
                  <FiTruck className="text-blue-600" size={16} />
                  Supplier *
                </label>
                <select
                  value={selectedSupplierId}
                  onChange={(e) => setSelectedSupplierId(e.target.value)}
                  className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                  required
                  disabled={isLoading}
                >
                  <option value="">Choose a supplier...</option>
                  {suppliers.map((supplier) => (
                    <option key={supplier.id} value={supplier.id}>
                      {supplier.name} {supplier.email && `(${supplier.email})`}
                    </option>
                  ))}
                </select>
                {suppliers.length === 0 && (
                  <p className="text-xs text-red-500 mt-1">No suppliers available. Please add suppliers first.</p>
                )}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2 flex items-center gap-2">
                    <FiDollarSign className="text-green-600" size={16} />
                    Purchase Price (per unit) *
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                      <span className="text-gray-500 text-lg">R</span>
                    </div>
                    <input
                      type="number"
                      step="0.01"
                      min="0.01"
                      value={purchasePrice}
                      onChange={(e) => setPurchasePrice(parseFloat(e.target.value) || 0)}
                      className="w-full pl-8 pr-4 py-3 text-lg font-medium border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                      required
                      disabled={isLoading}
                      placeholder="0.00"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2 flex items-center gap-2">
                    <FiPackage className="text-blue-600" size={16} />
                    Quantity *
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
                      placeholder="1"
                    />
                    <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
                      <span className="text-gray-500 text-sm">units</span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg p-4 border-2 border-blue-200">
                <div className="flex justify-between items-center">
                  <span className="text-blue-900 font-medium">Total Purchase Amount:</span>
                  <span className="text-2xl font-bold text-green-600">
                    R {(purchasePrice * quantity).toFixed(2)}
                  </span>
                </div>
                <div className="mt-2 text-sm text-blue-700">
                  {quantity} units × R {purchasePrice.toFixed(2)} per unit
                </div>
              </div>

              {error && (
                <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
                  <p className="text-red-600 text-sm font-medium">{error}</p>
                </div>
              )}

              <div className="flex gap-3 pt-4 border-t">
                <button
                  type="button"
                  onClick={() => setAction(null)}
                  className="flex-1 px-4 py-3 text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors font-medium"
                  disabled={isLoading}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 px-4 py-3 bg-green-600 text-white hover:bg-green-700 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 font-medium"
                  disabled={isLoading || !selectedSupplierId || purchasePrice <= 0}
                >
                  {isLoading ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent"></div>
                      Processing...
                    </>
                  ) : (
                    <>
                      <FiCheck size={16} />
                      Create Purchase Order
                    </>
                  )}
                </button>
              </div>
            </form>
          )}

          {/* Out of Stock Confirmation */}
          {action === 'out-of-stock' && (
            <div className="space-y-4">
              <div className="flex items-center gap-2 mb-4">
                <button
                  type="button"
                  onClick={() => setAction(null)}
                  className="text-blue-600 hover:text-blue-700 text-sm hover:underline"
                >
                  ← Back to actions
                </button>
              </div>

              <div className="bg-gradient-to-r from-orange-50 to-red-50 border border-orange-200 rounded-lg p-6">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-10 h-10 bg-orange-100 rounded-full flex items-center justify-center">
                    <FiAlertTriangle className="text-orange-600" size={20} />
                  </div>
                  <div>
                    <h4 className="font-semibold text-orange-900">Mark as Out of Stock</h4>
                    <p className="text-sm text-orange-700">This action will move the item to your out of stock list</p>
                  </div>
                </div>
                <div className="bg-white rounded-lg p-4 border border-orange-200 mb-4">
                  <p className="text-sm text-gray-700 mb-2">
                    <strong>What happens next:</strong>
                  </p>
                  <ul className="text-sm text-gray-600 space-y-1 list-disc list-inside">
                    <li>Item will be removed from the pending purchase list</li>
                    <li>Item will be moved to the "Out of Stock" page for review</li>
                    <li>You can reorder the item later from the out of stock list</li>
                    <li>No purchase order will be created at this time</li>
                  </ul>
                </div>
                
                {error && (
                  <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg">
                    <p className="text-red-600 text-sm font-medium">{error}</p>
                  </div>
                )}

                <div className="flex gap-3">
                  <button
                    type="button"
                    onClick={() => setAction(null)}
                    className="flex-1 px-4 py-3 text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors font-medium"
                    disabled={isLoading}
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleOutOfStock}
                    className="flex-1 px-4 py-3 bg-orange-600 text-white hover:bg-orange-700 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 font-medium"
                    disabled={isLoading}
                  >
                    {isLoading ? (
                      <>
                        <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent"></div>
                        Processing...
                      </>
                    ) : (
                      <>
                        <FiAlertTriangle size={16} />
                        Mark Out of Stock
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default PurchaseActionModal;
