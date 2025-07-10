'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { FiSearch, FiRefreshCw, FiPackage, FiFilter, FiX, FiChevronLeft, FiChevronRight, FiEdit } from 'react-icons/fi';
import { useAuth } from '@/context/AuthContext';
import { usePageTitle } from '@/context/PageTitleContext';

interface Product {
  id?: number;
  tsin_id?: string;
  sku: string;
  product_title: string;
  current_price: number;
  original_price?: number;
  stock_quantity: number;
  offer_status: string;
  offer_details?: any;
  // Analytics
  sales_count?: number;
  total_sold?: number;
  sold_30_days?: number;
  total_revenue?: number;
  avg_selling_price?: number;
  last_sale_date?: string;
  days_since_last_order?: number;
  is_bestseller?: boolean;
  is_slow_moving?: boolean;
  needs_restock?: boolean;
  qty_require?: number;
  [key: string]: any;
}

interface Pagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPrevPage: boolean;
}

export default function OptimizedTakealotProductsPage({ params }: { params: Promise<{ integrationId: string }> }) {
  const { currentUser } = useAuth();
  const { setPageTitle } = usePageTitle();
  
  // Fix for Next.js 15 - params are now async
  const resolvedParams = React.use(params);
  const { integrationId } = resolvedParams;
  
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [pagination, setPagination] = useState<Pagination>({
    page: 1,
    limit: 20,
    total: 0,
    totalPages: 0,
    hasNextPage: false,
    hasPrevPage: false
  });
  
  const [showFilters, setShowFilters] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [showProductModal, setShowProductModal] = useState(false);
  
  const [filters, setFilters] = useState({
    status: ['Buyable', 'Not Buyable'],
    minPrice: '',
    maxPrice: '',
    hasStock: undefined as boolean | undefined,
  });
  
  const [sortBy, setSortBy] = useState('sold_30_days');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

  useEffect(() => {
    setPageTitle('Takealot Products (Optimized)');
    return () => setPageTitle('');
  }, [setPageTitle]);

  const loadProducts = useCallback(async (page = 1, resetProducts = false) => {
    if (!currentUser || !integrationId) return;
    
    try {
      setLoading(true);
      
      console.log('Loading products with pagination:', { page, filters, sortBy, sortOrder, searchTerm });

      // Build filters object for API
      const apiFilters: any = {
        sortBy,
        sortOrder,
      };

      // Add search term
      if (searchTerm.trim()) {
        apiFilters.search = searchTerm.trim();
      }

      // Add status filter
      if (filters.status.length > 0) {
        apiFilters.status = filters.status;
      }

      // Add price filters
      if (filters.minPrice) {
        apiFilters.minPrice = parseFloat(filters.minPrice);
      }
      if (filters.maxPrice) {
        apiFilters.maxPrice = parseFloat(filters.maxPrice);
      }

      // Add stock filter
      if (filters.hasStock !== undefined) {
        apiFilters.hasStock = filters.hasStock;
      }

      const response = await fetch('/api/admin/takealot/get-products-paginated', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          integrationId,
          adminId: currentUser?.uid,
          page,
          limit: pagination.limit,
          filters: apiFilters
        })
      });

      const data = await response.json();
      
      if (!response.ok || !data.success) {
        throw new Error(data.error || 'Failed to fetch products');
      }

      console.log('Paginated products loaded:', data.pagination);

      // Transform data to match frontend interface
      const productData = data.data.map((product: any) => ({
        id: product.id,
        sku: product.sku || 'N/A',
        product_title: product.product_title || 'Unnamed Product',
        current_price: product.current_price || 0,
        original_price: product.original_price || 0,
        stock_quantity: product.stock_quantity || 0,
        offer_status: product.offer_status || 'Unknown',
        offer_details: product.offer_details ? JSON.parse(product.offer_details) : {},
        tsin_id: product.offer_details ? JSON.parse(product.offer_details || '{}').tsin_id : null,
        // Analytics
        sales_count: product.sales_count || 0,
        total_sold: product.total_sold || 0,
        sold_30_days: product.sold_30_days || 0,
        total_revenue: product.total_revenue || 0,
        avg_selling_price: product.avg_selling_price || product.current_price || 0,
        last_sale_date: product.last_sale_date,
        days_since_last_order: product.days_since_last_order || 999,
        is_bestseller: product.is_bestseller || false,
        is_slow_moving: product.is_slow_moving || false,
        needs_restock: product.needs_restock || false,
        qty_require: product.qty_require || 0,
      }));

      if (resetProducts || page === 1) {
        setProducts(productData);
      } else {
        setProducts(prev => [...prev, ...productData]);
      }
      
      setPagination(data.pagination);

    } catch (error) {
      console.error('Error loading paginated products:', error);
      setProducts([]);
    } finally {
      setLoading(false);
    }
  }, [currentUser, integrationId, searchTerm, filters, sortBy, sortOrder, pagination.limit]);

  // Load initial data
  useEffect(() => {
    loadProducts(1, true);
  }, [searchTerm, filters, sortBy, sortOrder]);

  // Handle page change
  const handlePageChange = (newPage: number) => {
    if (newPage < 1 || newPage > pagination.totalPages) return;
    loadProducts(newPage, true);
  };

  // Handle search with debouncing
  useEffect(() => {
    const timer = setTimeout(() => {
      loadProducts(1, true);
    }, 500);

    return () => clearTimeout(timer);
  }, [searchTerm]);

  // Filter handlers
  const handleFilterChange = (key: string, value: any) => {
    setFilters(prev => ({ ...prev, [key]: value }));
  };

  const clearFilters = () => {
    setFilters({
      status: ['Buyable', 'Not Buyable'],
      minPrice: '',
      maxPrice: '',
      hasStock: undefined,
    });
  };

  // Status badge styling
  const getStatusBadge = (status: string) => {
    const lowerStatus = status.toLowerCase();
    if (lowerStatus.includes('buyable') && !lowerStatus.includes('not')) {
      return 'bg-green-100 text-green-800';
    }
    if (lowerStatus.includes('out of stock')) {
      return 'bg-yellow-100 text-yellow-800';
    }
    if (lowerStatus.includes('disabled')) {
      return 'bg-red-100 text-red-800';
    }
    if (lowerStatus.includes('not buyable')) {
      return 'bg-gray-100 text-gray-800';
    }
    return 'bg-gray-200 text-gray-900';
  };

  // Currency formatter
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-ZA', {
      style: 'currency',
      currency: 'ZAR',
    }).format(amount);
  };

  if (!currentUser) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-500">Please log in to access Takealot products.</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 flex items-center">
              <FiPackage className="w-7 h-7 mr-3 text-blue-600" />
              Takealot Products
            </h1>
            <p className="text-gray-600 mt-1">
              Showing {products.length} of {pagination.total} products with enhanced performance
            </p>
          </div>
          
          <div className="flex items-center space-x-3">
            <button
              onClick={() => loadProducts(pagination.page, true)}
              disabled={loading}
              className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
            >
              <FiRefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </button>
          </div>
        </div>

        {/* Search and Filters */}
        <div className="flex flex-col sm:flex-row gap-4 mb-6">
          <div className="flex-1">
            <div className="relative">
              <FiSearch className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
              <input
                type="text"
                placeholder="Search products by title or SKU..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
          </div>
          <button
            onClick={() => setShowFilters(!showFilters)}
            className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
          >
            <FiFilter className="w-4 h-4 mr-2" />
            Filters
          </button>
        </div>

        {/* Filters Panel */}
        {showFilters && (
          <div className="bg-gray-50 rounded-lg p-4 mb-6">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              {/* Status Filter */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Status</label>
                <select
                  multiple
                  value={filters.status}
                  onChange={(e) => handleFilterChange('status', Array.from(e.target.selectedOptions, option => option.value))}
                  className="w-full border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  size={3}
                >
                  <option value="Buyable">Buyable</option>
                  <option value="Not Buyable">Not Buyable</option>
                  <option value="Out of Stock">Out of Stock</option>
                  <option value="Disabled">Disabled</option>
                </select>
              </div>

              {/* Price Range */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Min Price</label>
                <input
                  type="number"
                  placeholder="0"
                  value={filters.minPrice}
                  onChange={(e) => handleFilterChange('minPrice', e.target.value)}
                  className="w-full border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Max Price</label>
                <input
                  type="number"
                  placeholder="1000"
                  value={filters.maxPrice}
                  onChange={(e) => handleFilterChange('maxPrice', e.target.value)}
                  className="w-full border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>

              {/* Stock Filter */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Stock</label>
                <select
                  value={filters.hasStock === undefined ? '' : filters.hasStock.toString()}
                  onChange={(e) => handleFilterChange('hasStock', e.target.value === '' ? undefined : e.target.value === 'true')}
                  className="w-full border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">All</option>
                  <option value="true">In Stock</option>
                  <option value="false">Out of Stock</option>
                </select>
              </div>
            </div>

            <div className="flex justify-end mt-4">
              <button
                onClick={clearFilters}
                className="inline-flex items-center px-4 py-2 text-gray-600 hover:text-gray-800"
              >
                <FiX className="w-4 h-4 mr-2" />
                Clear Filters
              </button>
            </div>
          </div>
        )}

        {/* Sort Options */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center space-x-4">
            <label className="text-sm font-medium text-gray-700">Sort by:</label>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className="border border-gray-300 rounded-lg px-3 py-1 text-sm focus:ring-2 focus:ring-blue-500"
            >
              <option value="sold_30_days">Sales (30 days)</option>
              <option value="product_title">Product Title</option>
              <option value="current_price">Price</option>
              <option value="stock_quantity">Stock</option>
              <option value="updated_at">Last Updated</option>
            </select>
            <select
              value={sortOrder}
              onChange={(e) => setSortOrder(e.target.value as 'asc' | 'desc')}
              className="border border-gray-300 rounded-lg px-3 py-1 text-sm focus:ring-2 focus:ring-blue-500"
            >
              <option value="desc">High to Low</option>
              <option value="asc">Low to High</option>
            </select>
          </div>
          
          <div className="flex items-center space-x-2">
            <label className="text-sm font-medium text-gray-700">Per page:</label>
            <select
              value={pagination.limit}
              onChange={(e) => setPagination(prev => ({ ...prev, limit: parseInt(e.target.value) }))}
              className="border border-gray-300 rounded-lg px-3 py-1 text-sm focus:ring-2 focus:ring-blue-500"
            >
              <option value={10}>10</option>
              <option value={20}>20</option>
              <option value={50}>50</option>
              <option value={100}>100</option>
            </select>
          </div>
        </div>
      </div>

      {/* Products Table */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        {loading ? (
          <div className="p-8">
            <div className="flex items-center justify-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
              <span className="ml-3 text-gray-600">Loading products...</span>
            </div>
          </div>
        ) : products.length === 0 ? (
          <div className="p-8 text-center">
            <div className="text-gray-500 mb-4">No products found</div>
            <div className="text-sm text-gray-400">
              Try adjusting your filters or check your Takealot integration.
            </div>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Product</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Price</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Stock</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Sales (30d)</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {products.map((product, index) => (
                    <tr key={product.id || index} className="hover:bg-gray-50">
                      <td className="px-6 py-4">
                        <div className="flex items-center">
                          {product.offer_details?.image_url && (
                            <img
                              src={product.offer_details.image_url}
                              alt={product.product_title}
                              className="w-12 h-12 rounded-lg object-cover mr-4"
                              onError={(e) => { e.currentTarget.style.display = 'none'; }}
                            />
                          )}
                          <div>
                            <div className="text-sm font-medium text-gray-900 truncate max-w-xs">
                              {product.product_title}
                            </div>
                            <div className="text-sm text-gray-500">SKU: {product.sku}</div>
                            {product.is_bestseller && (
                              <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800 mt-1">
                                Bestseller
                              </span>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="text-sm font-medium text-gray-900">
                          {formatCurrency(product.current_price)}
                        </div>
                        {product.original_price && product.original_price !== product.current_price && (
                          <div className="text-sm text-gray-500 line-through">
                            {formatCurrency(product.original_price)}
                          </div>
                        )}
                      </td>
                      <td className="px-6 py-4">
                        <div className="text-sm text-gray-900">{product.stock_quantity || 0}</div>
                        {product.needs_restock && (
                          <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-red-100 text-red-800 mt-1">
                            Low Stock
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-4">
                        <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${getStatusBadge(product.offer_status)}`}>
                          {product.offer_status}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <div className="text-sm font-medium text-gray-900">{product.sold_30_days || 0}</div>
                        <div className="text-sm text-gray-500">
                          {formatCurrency(product.total_revenue || 0)}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <button
                          onClick={() => {
                            setSelectedProduct(product);
                            setShowProductModal(true);
                          }}
                          className="text-blue-600 hover:text-blue-800"
                        >
                          <FiEdit className="w-4 h-4" />
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
                Showing {((pagination.page - 1) * pagination.limit) + 1} to {Math.min(pagination.page * pagination.limit, pagination.total)} of {pagination.total} results
              </div>
              <div className="flex items-center space-x-2">
                <button
                  onClick={() => handlePageChange(pagination.page - 1)}
                  disabled={!pagination.hasPrevPage}
                  className="inline-flex items-center px-3 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <FiChevronLeft className="w-4 h-4 mr-1" />
                  Previous
                </button>
                
                <span className="text-sm text-gray-700">
                  Page {pagination.page} of {pagination.totalPages}
                </span>
                
                <button
                  onClick={() => handlePageChange(pagination.page + 1)}
                  disabled={!pagination.hasNextPage}
                  className="inline-flex items-center px-3 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Next
                  <FiChevronRight className="w-4 h-4 ml-1" />
                </button>
              </div>
            </div>
          </>
        )}
      </div>

      {/* Product Modal - Basic implementation */}
      {showProductModal && selectedProduct && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 max-w-2xl w-full mx-4">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold">Product Details</h3>
              <button
                onClick={() => setShowProductModal(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <FiX className="w-6 h-6" />
              </button>
            </div>
            <div className="space-y-4">
              <div>
                <strong>Title:</strong> {selectedProduct.product_title}
              </div>
              <div>
                <strong>SKU:</strong> {selectedProduct.sku}
              </div>
              <div>
                <strong>Price:</strong> {formatCurrency(selectedProduct.current_price)}
              </div>
              <div>
                <strong>Stock:</strong> {selectedProduct.stock_quantity}
              </div>
              <div>
                <strong>Status:</strong> {selectedProduct.offer_status}
              </div>
              <div>
                <strong>Sales (30 days):</strong> {selectedProduct.sold_30_days || 0}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
