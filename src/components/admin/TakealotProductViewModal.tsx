// src/components/admin/TakealotProductViewModal.tsx
"use client";
import React from 'react';
import { FiEdit, FiExternalLink } from 'react-icons/fi';

// Define a type for the product for better type safety
interface TakealotProduct {
  sku: string;
  title?: string;
  name?: string;
  tsin_id?: string;
  sell_price?: number | string;
  rrp?: number | string;
  stock?: number;
  quantity?: number;
  status?: string;
  barcode?: string;
  image_url_1?: string;
  offer_url?: string;
  // Calculated fields (to be implemented later)
  profit_loss?: number;
  qty_required_estimate?: number;
  total_sold_30?: number;
  days_sold_30?: number;
  days_return_30?: number;
  // Allow any other properties that might come from the API
  [key: string]: any;
}

interface Props {
  product: TakealotProduct | null;
  onClose: () => void;
  onEdit?: (product: TakealotProduct) => void;
}

const TakealotProductViewModal: React.FC<Props> = ({ product, onClose, onEdit }) => {
  if (!product) {
    return null;
  }

  const formatPrice = (price: number | string | undefined): string => {
    if (price === undefined || price === null) return 'N/A';
    const numPrice = typeof price === 'string' ? parseFloat(price) : price;
    return isNaN(numPrice) ? 'N/A' : `R${numPrice.toFixed(2)}`;
  };

  const formatNumber = (num: number | undefined): string => {
    return num !== undefined ? num.toString() : 'N/A';
  };

  // Calculate profit/loss (placeholder - to be implemented)
  const calculateProfitLoss = (): string => {
    // This will be implemented later with actual cost data
    return product.profit_loss !== undefined ? formatPrice(product.profit_loss) : 'To be calculated';
  };
  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl max-w-4xl w-full max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <div className="flex items-center space-x-4">
            <h2 className="text-xl font-semibold text-gray-900">Product Details</h2>
            {product.offer_url && (
              <a
                href={product.offer_url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-600 hover:text-blue-800"
                title="View on Takealot"
              >
                <FiExternalLink className="w-4 h-4" />
              </a>
            )}
          </div>
          <div className="flex items-center space-x-2">
            {onEdit && (
              <button
                onClick={() => onEdit(product)}
                className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <FiEdit className="w-4 h-4 mr-2 inline" />
                Edit
              </button>
            )}
            <button
              onClick={onClose}
              className="p-2 text-gray-400 hover:text-gray-600 focus:outline-none focus:ring-2 focus:ring-gray-500 rounded-lg"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto max-h-[calc(90vh-80px)]">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Product Image */}
            <div className="lg:col-span-1">
              <div className="bg-gray-50 rounded-lg p-4">
                <h3 className="text-sm font-medium text-gray-900 mb-3">Image</h3>
                {product.image_url_1 ? (
                  <img
                    src={product.image_url_1}
                    alt={product.title || product.name || 'Product'}
                    className="w-full h-48 object-contain rounded-lg bg-white border"
                    onError={(e) => {
                      e.currentTarget.src = '/placeholder-product.png';
                    }}
                  />
                ) : (
                  <div className="w-full h-48 bg-gray-200 rounded-lg flex items-center justify-center">
                    <span className="text-gray-500">No Image Available</span>
                  </div>
                )}
              </div>
            </div>

            {/* Product Details */}
            <div className="lg:col-span-2 space-y-6">
              {/* Basic Information */}
              <div className="bg-gray-50 rounded-lg p-4">
                <h3 className="text-sm font-medium text-gray-900 mb-3">Basic Information</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-gray-500 uppercase">Title</label>
                    <p className="mt-1 text-sm text-gray-900">{product.title || product.name || 'N/A'}</p>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-500 uppercase">SKU / TSIN</label>
                    <p className="mt-1 text-sm text-gray-900">
                      {product.sku || 'N/A'} {product.tsin_id && `/ ${product.tsin_id}`}
                    </p>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-500 uppercase">POS Barcode</label>
                    <p className="mt-1 text-sm text-gray-900">{product.barcode || 'N/A'}</p>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-500 uppercase">Status</label>
                    <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                      product.status === 'Active' || product.status === 'active'
                        ? 'bg-green-100 text-green-800'
                        : 'bg-red-100 text-red-800'
                    }`}>
                      {product.status || 'Unknown'}
                    </span>
                  </div>
                </div>
              </div>

              {/* Pricing & Inventory */}
              <div className="bg-gray-50 rounded-lg p-4">
                <h3 className="text-sm font-medium text-gray-900 mb-3">Pricing & Inventory</h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-gray-500 uppercase">Selling Price / RRP</label>
                    <p className="mt-1 text-sm font-semibold text-gray-900">{formatPrice(product.sell_price)}</p>
                    {product.rrp && product.rrp !== product.sell_price && (
                      <p className="text-xs text-gray-500 line-through">RRP: {formatPrice(product.rrp)}</p>
                    )}
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-500 uppercase">Quantity</label>
                    <p className="mt-1 text-sm text-gray-900">{product.stock ?? product.quantity ?? 'N/A'}</p>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-500 uppercase">Profit / Loss</label>
                    <p className="mt-1 text-sm text-gray-900">{calculateProfitLoss()}</p>
                  </div>
                </div>
              </div>              {/* Analytics & Performance (Calculated Fields) */}
              <div className="bg-gray-50 rounded-lg p-4">
                <h3 className="text-sm font-medium text-gray-900 mb-3">Analytics & Performance (30 Days)</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-gray-500 uppercase">Qty Require (Estimate)</label>
                    <p className="mt-1 text-sm text-gray-900">
                      {product.qty_required_estimate !== undefined ? formatNumber(product.qty_required_estimate) : 'To be calculated'}
                    </p>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-500 uppercase">Total Sold 30</label>
                    <p className="mt-1 text-sm text-gray-900">
                      {product.total_sold_30 !== undefined ? formatNumber(product.total_sold_30) : 'To be calculated'}
                    </p>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-500 uppercase">Days Sold 30</label>
                    <p className="mt-1 text-sm text-gray-900">
                      {product.days_sold_30 !== undefined ? formatNumber(product.days_sold_30) : 'To be calculated'}
                    </p>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-500 uppercase">Days Return 30</label>
                    <p className="mt-1 text-sm text-gray-900">
                      {product.days_return_30 !== undefined ? formatNumber(product.days_return_30) : 'To be calculated'}
                    </p>
                  </div>
                </div>
              </div>

              {/* Sales-Related Fields (for mapping comparison) */}
              <div className="bg-blue-50 rounded-lg p-4">
                <h3 className="text-sm font-medium text-gray-900 mb-3">Sales View Fields Mapping</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-gray-500 uppercase">Sales Product Name</label>
                    <p className="mt-1 text-sm text-gray-900">{product.title || product.name || 'N/A'}</p>
                    <p className="text-xs text-gray-500">Used in Sales view as product_title</p>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-500 uppercase">Sales SKU/TSIN</label>
                    <p className="mt-1 text-sm text-gray-900">{product.sku}</p>
                    {product.tsin_id && (
                      <p className="text-xs text-gray-600">TSIN: {product.tsin_id}</p>
                    )}
                    <p className="text-xs text-gray-500">Used in Sales view for product lookup</p>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-500 uppercase">Sales Customer Info</label>
                    <p className="mt-1 text-sm text-gray-900">Available in individual sale records</p>
                    <p className="text-xs text-gray-500">Customer Name, DC, Order Date</p>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-500 uppercase">Sales Gross Sell</label>
                    <p className="mt-1 text-sm text-gray-900">Calculated per sale</p>
                    <p className="text-xs text-gray-500">Selling Price × Quantity</p>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-500 uppercase">Sales Status</label>
                    <p className="mt-1 text-sm text-gray-900">Per order status</p>
                    <p className="text-xs text-gray-500">Completed, Pending, Cancelled</p>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-500 uppercase">Total Qty Available</label>
                    <p className="mt-1 text-sm text-gray-900">{product.stock ?? product.quantity ?? 'TBC'}</p>
                    <p className="text-xs text-gray-500">Current stock level for sales</p>
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="bg-gray-50 rounded-lg p-4">
                <h3 className="text-sm font-medium text-gray-900 mb-3">Actions</h3>
                <div className="flex flex-wrap gap-3">
                  {product.offer_url && (
                    <a
                      href={product.offer_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="px-4 py-2 text-sm font-medium text-blue-600 bg-blue-50 border border-blue-200 rounded-lg hover:bg-blue-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <FiExternalLink className="w-4 h-4 mr-2 inline" />
                      View on Takealot
                    </a>
                  )}
                  {onEdit && (
                    <button
                      onClick={() => onEdit(product)}
                      className="px-4 py-2 text-sm font-medium text-green-600 bg-green-50 border border-green-200 rounded-lg hover:bg-green-100 focus:outline-none focus:ring-2 focus:ring-green-500"
                    >
                      <FiEdit className="w-4 h-4 mr-2 inline" />
                      Edit Product
                    </button>
                  )}
                </div>
              </div>

              {/* Additional Data */}
              <div className="bg-gray-50 rounded-lg p-4">
                <h3 className="text-sm font-medium text-gray-900 mb-3">System Information</h3>
                <div className="text-xs text-gray-600 space-y-1">
                  <p><strong>Last Updated:</strong> {product.fetchedAt ? new Date(product.fetchedAt.seconds * 1000).toLocaleString() : 'N/A'}</p>
                  <p><strong>Integration ID:</strong> {product.integrationId || 'N/A'}</p>
                  <p><strong>Original ID:</strong> {product.original_id || product.id || 'N/A'}</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default TakealotProductViewModal;
