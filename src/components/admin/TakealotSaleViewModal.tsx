// src/components/admin/TakealotSaleViewModal.tsx
'use client';

import React from 'react';
import { FiX, FiExternalLink, FiPackage } from 'react-icons/fi';

interface TakealotSale {
  order_id: string;
  item_id?: string;
  product_title?: string;
  sku?: string;
  tsin?: string;
  order_date: string;
  customer_name?: string;
  quantity?: number;
  price?: number;
  selling_price?: number;
  subtotal?: number;
  gross_sell?: number;
  status?: string;
  dc?: string;
  image_url?: string;
  barcode?: string;
  pos_barcode?: string;
  profit_loss?: number;
  total_qty_available?: number;
  [key: string]: any;
}

interface TakealotSaleViewModalProps {
  sale: TakealotSale;
  onClose: () => void;
}

const TakealotSaleViewModal: React.FC<TakealotSaleViewModalProps> = ({ sale, onClose }) => {
  const formatPrice = (price: number | string | undefined): string => {
    if (price === undefined || price === null) return 'N/A';
    const numPrice = typeof price === 'string' ? parseFloat(price) : price;
    return isNaN(numPrice) ? 'N/A' : `R${numPrice.toFixed(2)}`;
  };

  const formatDate = (dateString: string | undefined): string => {
    if (!dateString) return 'N/A';
    try {
      const date = new Date(dateString);
      return date.toLocaleDateString('en-ZA', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch {
      return dateString;
    }
  };

  const openTakealotProduct = () => {
    if (sale.tsin) {
      window.open(`https://www.takealot.com/p/${sale.tsin}`, '_blank');
    }
  };

  const calculateGrossSell = (): number => {
    if (sale.gross_sell) return typeof sale.gross_sell === 'string' ? parseFloat(sale.gross_sell) : sale.gross_sell;
    if (sale.subtotal) return typeof sale.subtotal === 'string' ? parseFloat(sale.subtotal) : sale.subtotal;
    if (sale.selling_price && sale.quantity) {
      const price = typeof sale.selling_price === 'string' ? parseFloat(sale.selling_price) : sale.selling_price;
      return price * sale.quantity;
    }
    return 0;
  };

  const calculateProfitLoss = (): number => {
    if (sale.profit_loss !== undefined) return sale.profit_loss;
    // Placeholder calculation - would need cost data
    const grossSell = calculateGrossSell();
    const estimatedCost = grossSell * 0.7; // Assume 30% margin as placeholder
    return grossSell - estimatedCost;
  };

  return (
    <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
      <div className="relative top-20 mx-auto p-5 border w-11/12 max-w-4xl shadow-lg rounded-md bg-white">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-gray-200">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-blue-100 rounded-lg">
              <FiPackage className="w-6 h-6 text-blue-600" />
            </div>
            <div>
              <h3 className="text-lg font-medium text-gray-900">Sale Details</h3>
              <p className="text-sm text-gray-500">Order ID: {sale.order_id}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <FiX className="w-6 h-6" />
          </button>
        </div>

        {/* Content */}
        <div className="py-6">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Product Image and Basic Info */}
            <div className="lg:col-span-1">
              <div className="bg-gray-50 rounded-lg p-4">
                <div className="text-center mb-4">
                  {sale.image_url ? (
                    <img
                      src={sale.image_url}
                      alt={sale.product_title || 'Product'}
                      className="w-full h-48 object-cover rounded-lg cursor-pointer hover:opacity-80 transition-opacity"
                      onClick={openTakealotProduct}
                      title="Click to view on Takealot"
                    />
                  ) : (
                    <div 
                      className="w-full h-48 bg-gray-200 rounded-lg flex items-center justify-center cursor-pointer hover:bg-gray-300 transition-colors"
                      onClick={openTakealotProduct}
                      title="Click to view on Takealot"
                    >
                      <FiPackage className="w-16 h-16 text-gray-400" />
                    </div>
                  )}
                </div>
                
                <h4 
                  className="font-medium text-gray-900 text-center mb-2 cursor-pointer hover:text-blue-600 transition-colors"
                  onClick={openTakealotProduct}
                  title="Click to view on Takealot"
                >
                  {sale.product_title || 'Unknown Product'}
                </h4>
                
                {sale.tsin && (
                  <button
                    onClick={openTakealotProduct}
                    className="w-full flex items-center justify-center px-3 py-2 text-sm text-blue-600 border border-blue-600 rounded-md hover:bg-blue-50 transition-colors"
                  >
                    <FiExternalLink className="w-4 h-4 mr-2" />
                    View on Takealot
                  </button>
                )}
              </div>
            </div>

            {/* Sale Details */}
            <div className="lg:col-span-2">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Order Information */}
                <div>
                  <h5 className="text-lg font-medium text-gray-900 mb-4">Order Information</h5>
                  <div className="space-y-3">
                    <div>
                      <label className="block text-sm font-medium text-gray-500">Order ID</label>
                      <p className="text-sm text-gray-900">{sale.order_id}</p>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-500">Item ID</label>
                      <p className="text-sm text-gray-900">{sale.item_id || 'N/A'}</p>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-500">Order Date</label>
                      <p className="text-sm text-gray-900">{formatDate(sale.order_date)}</p>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-500">Customer Name</label>
                      <p className="text-sm text-gray-900">{sale.customer_name || 'N/A'}</p>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-500">Distribution Center</label>
                      <p className="text-sm text-gray-900">{sale.dc || 'N/A'}</p>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-500">Sale Status</label>
                      <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                        sale.status === 'Completed' || sale.status === 'completed'
                          ? 'bg-green-100 text-green-800'
                          : sale.status === 'Pending' || sale.status === 'pending'
                          ? 'bg-yellow-100 text-yellow-800'
                          : sale.status === 'Cancelled' || sale.status === 'cancelled'
                          ? 'bg-red-100 text-red-800'
                          : 'bg-gray-100 text-gray-800'
                      }`}>
                        {sale.status || 'Unknown'}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Product & Financial Information */}
                <div>
                  <h5 className="text-lg font-medium text-gray-900 mb-4">Product & Financial Details</h5>
                  <div className="space-y-3">
                    <div>
                      <label className="block text-sm font-medium text-gray-500">SKU</label>
                      <p className="text-sm text-gray-900">{sale.sku || 'N/A'}</p>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-500">TSIN</label>
                      <p className="text-sm text-gray-900">{sale.tsin || 'N/A'}</p>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-500">Quantity</label>
                      <p className="text-sm text-gray-900">{sale.quantity || 1}</p>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-500">Selling Price</label>
                      <p className="text-sm text-gray-900">{formatPrice(sale.selling_price || sale.price)}</p>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-500">Gross Sell</label>
                      <p className="text-sm font-semibold text-gray-900">{formatPrice(calculateGrossSell())}</p>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-500">Profit/Loss (Est.)</label>
                      <p className={`text-sm font-semibold ${
                        calculateProfitLoss() >= 0 ? 'text-green-600' : 'text-red-600'
                      }`}>
                        {formatPrice(calculateProfitLoss())}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Inventory & Barcode Information */}
                <div className="md:col-span-2">
                  <h5 className="text-lg font-medium text-gray-900 mb-4">Inventory & Barcode Information</h5>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-500">POS Barcode</label>
                      <p className="text-sm text-gray-900">{sale.pos_barcode || sale.barcode || 'N/A'}</p>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-500">Product Barcode</label>
                      <p className="text-sm text-gray-900">{sale.barcode || 'N/A'}</p>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-500">Total Qty Available</label>
                      <p className="text-sm text-gray-900">{sale.total_qty_available !== undefined ? sale.total_qty_available : 'TBC'}</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end pt-4 border-t border-gray-200 space-x-2">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

export default TakealotSaleViewModal;
