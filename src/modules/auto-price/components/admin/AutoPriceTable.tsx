// Auto Price Table Component - Main data table
import React from 'react';
import { 
  AutoPriceProduct, 
  AutoPriceSortOptions 
} from '../../types/auto-price.types';
import { 
  FiChevronLeft, 
  FiChevronRight,
  FiMoreHorizontal
} from 'react-icons/fi';

interface AutoPriceTableProps {
  products: AutoPriceProduct[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
  isLoading: boolean;
  sort?: AutoPriceSortOptions;
  selectedProducts: Set<string>;
  onSortChange: (sort: AutoPriceSortOptions) => void;
  onPageChange: (page: number) => void;
  onSelectAll: () => void;
  onSelectProduct: (productId: string) => void;
  onProductUpdate: (productId: string, updates: Partial<AutoPriceProduct>) => void;
  onSetProductLoading: (productId: string, loading: boolean) => void;
  isProductLoading: (productId: string) => boolean;
  integrationId: string;
  hasNextPage: boolean;
  hasPrevPage: boolean;
  isEmpty: boolean;
}

export const AutoPriceTable: React.FC<AutoPriceTableProps> = ({
  products,
  pagination,
  isLoading,
  sort,
  selectedProducts,
  onSortChange,
  onPageChange,
  onSelectAll,
  onSelectProduct,
  onProductUpdate,
  onSetProductLoading,
  isProductLoading,
  integrationId,
  hasNextPage,
  hasPrevPage,
  isEmpty
}) => {
  
  const formatPrice = (price?: number) => {
    if (price === undefined || price === null) return 'N/A';
    return `R${price.toFixed(2)}`;
  };

  const formatDifference = (difference?: number) => {
    if (difference === undefined || difference === null) return 'N/A';
    const sign = difference > 0 ? '+' : '';
    const color = difference <= 0 ? 'text-green-600' : 'text-red-600';
    return (
      <span className={color}>
        {sign}R{difference.toFixed(2)}
      </span>
    );
  };

  const getScrapingStatusBadge = (status: string) => {
    const statusStyles = {
      idle: 'bg-gray-100 text-gray-800',
      queued: 'bg-blue-100 text-blue-800',
      scraping: 'bg-yellow-100 text-yellow-800',
      success: 'bg-green-100 text-green-800',
      error: 'bg-red-100 text-red-800',
      retry: 'bg-orange-100 text-orange-800',
      skip: 'bg-gray-100 text-gray-800'
    };

    return (
      <span className={`px-2 py-1 text-xs font-medium rounded-full ${statusStyles[status as keyof typeof statusStyles] || statusStyles.idle}`}>
        {status}
      </span>
    );
  };

  if (isLoading) {
    return (
      <div className="p-8">
        <div className="flex items-center justify-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          <span className="ml-3 text-gray-600">Loading products...</span>
        </div>
      </div>
    );
  }

  if (isEmpty) {
    return (
      <div className="p-8 text-center">
        <div className="text-gray-500 mb-4">No products found</div>
        <div className="text-sm text-gray-400">
          Try adjusting your filters or check your Takealot integration.
        </div>
      </div>
    );
  }

  return (
    <div className="overflow-hidden">
      {/* Table */}
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left">
                <input
                  type="checkbox"
                  checked={selectedProducts.size === products.length && products.length > 0}
                  onChange={onSelectAll}
                  className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Product
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Status
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Our Price
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                RRP
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Winner Price
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Win Difference
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Rating
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Scraping
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {products.map((product) => (
              <tr key={product.id} className="hover:bg-gray-50">
                <td className="px-6 py-4">
                  <input
                    type="checkbox"
                    checked={selectedProducts.has(product.id)}
                    onChange={() => onSelectProduct(product.id)}
                    className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                </td>
                <td className="px-6 py-4">
                  <div className="flex items-center">
                    {product.imageUrl && (
                      <img
                        src={product.imageUrl}
                        alt={product.title}
                        className="w-12 h-12 rounded-lg object-cover mr-4"
                      />
                    )}
                    <div>
                      <div className="text-sm font-medium text-gray-900 line-clamp-2">
                        {product.title}
                      </div>
                      <div className="text-sm text-gray-500">
                        SKU: {product.sku} | TSIN: {product.tsin}
                      </div>
                    </div>
                  </div>
                </td>
                <td className="px-6 py-4">
                  <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                    product.status === 'buyable' ? 'bg-green-100 text-green-800' :
                    product.status === 'loading' ? 'bg-yellow-100 text-yellow-800' :
                    product.status === 'out_of_stock' ? 'bg-red-100 text-red-800' :
                    'bg-gray-100 text-gray-800'
                  }`}>
                    {product.status}
                  </span>
                </td>
                <td className="px-6 py-4 text-sm text-gray-900">
                  {formatPrice(product.ourPrice)}
                </td>
                <td className="px-6 py-4 text-sm text-gray-900">
                  {formatPrice(product.rrp)}
                </td>
                <td className="px-6 py-4 text-sm text-gray-900">
                  {formatPrice(product.scrapedWinnerSellerPrice)}
                </td>
                <td className="px-6 py-4 text-sm">
                  {formatDifference(product.winDifference)}
                </td>
                <td className="px-6 py-4 text-sm text-gray-900">
                  {product.scrapedRating ? (
                    <div>
                      <span className="font-medium">{product.scrapedRating.toFixed(1)}</span>
                      {product.scrapedReviewCount && (
                        <span className="text-gray-500 ml-1">
                          ({product.scrapedReviewCount})
                        </span>
                      )}
                    </div>
                  ) : (
                    <span className="text-gray-500">N/A</span>
                  )}
                </td>
                <td className="px-6 py-4">
                  {getScrapingStatusBadge(product.scrapingStatus)}
                </td>
                <td className="px-6 py-4">
                  <button className="text-gray-400 hover:text-gray-600">
                    <FiMoreHorizontal className="w-5 h-5" />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      <div className="bg-white px-6 py-3 border-t border-gray-200 flex items-center justify-between">
        <div className="text-sm text-gray-700">
          Showing {((pagination.page - 1) * pagination.limit) + 1} to{' '}
          {Math.min(pagination.page * pagination.limit, pagination.total)} of{' '}
          {pagination.total} results
        </div>
        
        <div className="flex items-center space-x-2">
          <button
            onClick={() => onPageChange(pagination.page - 1)}
            disabled={!hasPrevPage}
            className="px-3 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <FiChevronLeft className="w-4 h-4" />
          </button>
          
          <span className="text-sm text-gray-700">
            Page {pagination.page} of {pagination.totalPages}
          </span>
          
          <button
            onClick={() => onPageChange(pagination.page + 1)}
            disabled={!hasNextPage}
            className="px-3 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <FiChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
};
