'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { FiSearch, FiTrendingUp, FiDollarSign, FiPackage, FiFilter } from 'react-icons/fi';
import { useAuth } from '@/context/AuthContext';
import { usePageTitle } from '@/context/PageTitleContext';

interface AutoPriceProduct {
  id: string;
  integrationId: string;
  adminId: string;
  tsin: string;
  sku: string;
  title: string;
  imageUrl?: string;
  status: string;
  ourPrice: number;
  rrp: number;
  createdAt: Date;
  updatedAt: Date;
  offerUrl?: string;
  plid?: string;
  
  // Stock information
  stock?: number;
  stock_dbn?: number;
  stock_cpt?: number;
  stock_jhb?: number;
  
  // Sales metrics
  sold_30_days?: number;
  total_sold?: number;
  
  // Scraped data fields
  scrapedRating?: number;
  scrapedReviewCount?: number;
  scrapedWinnerSeller?: string;
  scrapedWinnerSellerPrice?: number;
  scrapedTotalSellers?: number;
  lastScrapedAt?: Date;
  scrapingStatus: 'idle' | 'queued' | 'scraping' | 'success' | 'error' | 'retry' | 'skip';
  scrapingErrorMessage?: string;
  proxyUsed?: string;
  scrapingDuration?: number;
  
  // Calculated fields
  winDifference?: number;
  winPrice?: number;
  posBarcode?: string;
  posPrice?: number;
  profitLoss?: number;
  minPrice?: number;
  maxPrice?: number;
  competitivenessScore?: number;
  pricePosition?: 'lowest' | 'competitive' | 'premium' | 'overpriced';
  recommendedAction?: 'maintain' | 'reduce' | 'increase' | 'investigate';
}

interface AutoPriceStats {
  totalProducts: number;
  scrapedToday: number;
  pendingScraping: number;
  averageWinDifference: number;
  successRate24h: number;
  competitiveProducts: number;
  overPricedProducts: number;
  potentialSavings: number;
}

// Helper functions for badge styling
const getStatusBadge = (status: string) => {
  const lowerStatus = status.toLowerCase();
  if (lowerStatus.includes('buyable')) {
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
  switch (lowerStatus) {
    case 'loading':
      return 'bg-blue-100 text-blue-800';
    case 'unavailable':
      return 'bg-gray-100 text-gray-800';
    default:
      return 'bg-gray-200 text-gray-900';
  }
};

const formatCurrency = (amount: number) => {
  return new Intl.NumberFormat('en-ZA', {
    style: 'currency',
    currency: 'ZAR',
  }).format(amount);
};

export default function AutoPricePage({ params }: { params: { integrationId: string } }) {
  const { integrationId } = params;
  const { currentUser } = useAuth();
  const { setPageTitle } = usePageTitle();

  // State management
  const [products, setProducts] = useState<AutoPriceProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [tempSearchTerm, setTempSearchTerm] = useState('');
  const [statusFilters, setStatusFilters] = useState<string[]>(['buyable']); // Default to buyable
  const [tempStatusFilters, setTempStatusFilters] = useState<string[]>(['buyable']);
  const [isFilterDrawerOpen, setIsFilterDrawerOpen] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(25); // Show more products per page
  const [scrapingProduct, setScrapingProduct] = useState<string | null>(null); // Track which product is being scraped

  useEffect(() => {
    setPageTitle('Auto Price Management');
  }, [setPageTitle]);

  // Function to scrape single product
  const scrapeSingleProduct = async (product: AutoPriceProduct) => {
    setScrapingProduct(product.id);
    try {
      const response = await fetch(`/api/admin/auto-price/scrape-single`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          integrationId,
          productId: product.id,
          tsin: product.tsin,
          sku: product.sku,
        }),
      });

      if (response.ok) {
        // Reload products to get updated data
        await loadProducts();
        alert('Product scraped successfully!');
      } else {
        alert('Failed to scrape product. Please try again.');
      }
    } catch (error) {
      console.error('Error scraping product:', error);
      alert('Error occurred while scraping product.');
    } finally {
      setScrapingProduct(null);
    }
  };

  // Filter products based on search term and status filters
  const filteredProducts = useMemo(() => {
    return products.filter(product => {
      const matchesSearch = !searchTerm || 
        product.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
        product.sku.toLowerCase().includes(searchTerm.toLowerCase()) ||
        product.tsin.toLowerCase().includes(searchTerm.toLowerCase());
      
      const matchesStatus = statusFilters.length === 0 || 
        statusFilters.includes(product.status);
      
      return matchesSearch && matchesStatus;
    });
  }, [products, searchTerm, statusFilters]);

  // Get unique statuses for filtering
  const uniqueStatuses = useMemo(() => {
    const statuses = [...new Set(products.map(p => p.status))];
    return statuses.sort();
  }, [products]);

  useEffect(() => {
    loadProducts();
  }, [integrationId, currentUser]);

  const loadProducts = async () => {
    if (!currentUser) return;
    
    setLoading(true);
    setError(null);
    try {
      console.log('Loading enhanced products from new Neon tables for auto-price, integration:', integrationId);
      
      // Call the paginated API route to get products with sales analytics
      const response = await fetch('/api/admin/takealot/get-products-paginated', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          integrationId,
          adminId: currentUser?.uid,
          filters: {
            // Add any specific filters for auto-pricing if needed
          }
        })
      });

      const data = await response.json();
      
      if (!response.ok || !data.success) {
        throw new Error(data.error || 'Failed to fetch enhanced products');
      }

      console.log('Found enhanced products in new Neon tables:', data.data.length);
      
      if (data.data.length === 0) {
        console.log('No enhanced products found for integration:', integrationId);
        setProducts([]);
        return;
      }
      
      const autoProducts: AutoPriceProduct[] = data.data.map((product: any) => {
        console.log('Processing product:', product.id, 'with keys:', Object.keys(product));
        
        // Helper function to safely extract string values
        const safeString = (value: any): string => {
          if (typeof value === 'string') return value;
          if (typeof value === 'number') return value.toString();
          if (value === null || value === undefined) return '';
          if (typeof value === 'object') {
            console.log('Converting object to string:', value);
            return JSON.stringify(value);
          }
          return String(value);
        };

        // Helper function to safely extract number values
        const safeNumber = (value: any): number => {
          if (typeof value === 'number') return value;
          if (typeof value === 'string') {
            const parsed = parseFloat(value.replace(/[^\d.-]/g, '')); // Remove non-numeric characters
            return isNaN(parsed) ? 0 : parsed;
          }
          return 0;
        };
        
        return {
          id: product.id?.toString() || '',
          integrationId,
          adminId: currentUser?.uid || '',
          tsin: safeString(product.tsin_id || product.offer_details?.tsin_id),
          sku: safeString(product.sku),
          title: safeString(product.product_title || product.title),
          imageUrl: safeString(product.offer_details?.image_url),
          status: safeString(product.offer_status || product.status || 'unavailable').toLowerCase(),
          ourPrice: safeNumber(product.current_price || product.selling_price),
          rrp: safeNumber(product.original_price || product.rrp),
          createdAt: product.created_at ? new Date(product.created_at) : new Date(),
          updatedAt: product.updated_at ? new Date(product.updated_at) : new Date(),
          offerUrl: safeString(product.offer_details?.offer_url || product.offer_url),
          plid: safeString(product.offer_id),
          
          // Stock information from enhanced data
          stock: safeNumber(product.stock_quantity || product.stock),
          stock_dbn: safeNumber(product.offer_details?.stock_dbn || product.stock_dbn),
          stock_cpt: safeNumber(product.offer_details?.stock_cpt || product.stock_cpt),
          stock_jhb: safeNumber(product.offer_details?.stock_jhb || product.stock_jhb),
          
          // Enhanced sales metrics from new tables
          sold_30_days: safeNumber(product.sold_30_days || product.quantity_30_days),
          total_sold: safeNumber(product.total_sold || product.total_quantity_sold),
          sales_count: safeNumber(product.sales_count),
          total_revenue: safeNumber(product.total_revenue),
          avg_selling_price: safeNumber(product.avg_selling_price),
          days_since_last_order: safeNumber(product.days_since_last_order),
          
          // Performance indicators
          is_bestseller: product.is_bestseller || false,
          is_slow_moving: product.is_slow_moving || false,
          needs_restock: product.needs_restock || false,
          
          // Auto Price specific fields (initially empty)
          scrapedRating: undefined,
          scrapedReviewCount: undefined,
          scrapedWinnerSeller: undefined,
          scrapedWinnerSellerPrice: undefined,
          scrapedTotalSellers: undefined,
          lastScrapedAt: undefined,
          scrapingStatus: 'idle' as const,
          scrapingErrorMessage: undefined,
          proxyUsed: undefined,
          scrapingDuration: undefined,
          
          // Calculated fields (to be computed)
          winDifference: undefined,
          winPrice: undefined,
          posBarcode: safeString(product.sku),
          posPrice: undefined,
          profitLoss: undefined,
          minPrice: undefined,
          maxPrice: undefined,
          competitivenessScore: undefined,
          pricePosition: undefined,
          recommendedAction: undefined,
        };
      });

      setProducts(autoProducts);
      console.log('Loaded enhanced auto-price products from new Neon tables:', autoProducts.length);
      
      // Log analytics if available
      if (data.analytics) {
        console.log('Auto-price analytics:', data.analytics);
      }
      if (data.salesAnalytics) {
        console.log('Sales analytics for auto-pricing:', data.salesAnalytics.length, 'products with sales');
      }
      
    } catch (error) {
      console.error('Error loading enhanced products from new Neon tables:', error);
      setError(error instanceof Error ? error.message : 'Failed to load enhanced products');
      setProducts([]);
    } finally {
      setLoading(false);
    }
  };

  // Pagination
  const filteredData = filteredProducts;
  const totalPages = Math.ceil(filteredData.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const currentProducts = filteredData.slice(startIndex, startIndex + itemsPerPage);

  const handleStatusFilterChange = (status: string) => {
    setTempStatusFilters(prev => 
      prev.includes(status) 
        ? prev.filter(s => s !== status)
        : [...prev, status]
    );
  };

  const applyFilters = () => {
    setStatusFilters(tempStatusFilters);
    setSearchTerm(tempSearchTerm);
    setIsFilterDrawerOpen(false);
  };

  const openFilterDrawer = () => {
    setTempStatusFilters([...statusFilters]); // Use spread to avoid reference issues
    setTempSearchTerm(searchTerm);
    setIsFilterDrawerOpen(true);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6">
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <div className="flex items-center">
            <div className="text-red-400 mr-3">⚠️</div>
            <div>
              <h3 className="text-sm font-medium text-red-800">Error Loading Products</h3>
              <p className="text-sm text-red-700 mt-1">{error}</p>
              <button 
                onClick={loadProducts}
                className="mt-2 text-sm bg-red-100 hover:bg-red-200 text-red-800 px-3 py-1 rounded"
              >
                Try Again
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Full Width Header */}
      <div className="bg-white shadow-sm border-b">
        <div className="max-w-full px-6 py-4">
          <div className="flex flex-col xl:flex-row xl:items-center xl:justify-between gap-4">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Auto Price Management</h1>
              <p className="text-gray-600 mt-1">
                Showing {filteredProducts.length} products • {products.length} total products loaded
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => window.open(`/admin/takealot/${integrationId}/auto-price/scrape-data`, '_blank')}
                className="flex items-center px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 transition-colors shadow-sm"
              >
                <FiSearch className="h-4 w-4 mr-2" />
                Live Scrape Data
              </button>
              <button
                onClick={() => window.open(`/admin/takealot/${integrationId}/auto-price/scrape-user-products`, '_blank')}
                className="flex items-center px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors shadow-sm"
              >
                <FiPackage className="h-4 w-4 mr-2" />
                Your Products Scraper
              </button>
              <button
                onClick={openFilterDrawer}
                className="flex items-center px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors shadow-sm"
              >
                <FiFilter className="h-4 w-4 mr-2" />
                Filters {statusFilters.length > 0 && `(${statusFilters.length})`}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Search and Controls Bar */}
      <div className="bg-white border-b shadow-sm">
        <div className="max-w-full px-6 py-4">
          <div className="flex flex-col lg:flex-row lg:items-center gap-4">
            {/* Search Bar */}
            <div className="flex-1">
              <div className="relative">
                <FiSearch className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-5 w-5" />
                <input
                  type="text"
                  placeholder="Search products by name, SKU, or TSIN..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                />
                {searchTerm && (
                  <button
                    onClick={() => setSearchTerm('')}
                    className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  >
                    ×
                  </button>
                )}
              </div>
            </div>

            {/* Quick Actions */}
            <div className="flex items-center space-x-3">
              {statusFilters.length > 0 && (
                <div className="flex items-center space-x-1">
                  {statusFilters.map(filter => (
                    <span key={filter} className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                      {filter}
                      <button
                        onClick={() => setStatusFilters(prev => prev.filter(f => f !== filter))}
                        className="ml-2 text-blue-600 hover:text-blue-800"
                      >
                        ×
                      </button>
                    </span>
                  ))}
                </div>
              )}
              
              <select
                value={itemsPerPage}
                onChange={(e) => setItemsPerPage(Number(e.target.value))}
                className="text-sm border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value={10}>10 per page</option>
                <option value={25}>25 per page</option>
                <option value={50}>50 per page</option>
                <option value={100}>100 per page</option>
              </select>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="max-w-full px-6 py-6 space-y-6">
        {/* Products Table */}
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-200 bg-gray-50">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-medium text-gray-900">
                Products ({filteredProducts.length})
              </h3>
              <div className="text-sm text-gray-500">
                {filteredProducts.length === 0 && searchTerm && 'No products match your search'}
              </div>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Product</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Our Price</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">RRP</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Stock</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {currentProducts.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-12 text-center text-gray-500">
                      <FiPackage className="h-12 w-12 mx-auto text-gray-300 mb-4" />
                      <p className="text-lg font-medium text-gray-900 mb-2">No products found</p>
                      <p className="text-sm">
                        {searchTerm ? 'Try adjusting your search terms or filters.' : 'No buyable products available for this integration.'}
                      </p>
                    </td>
                  </tr>
                ) : (
                  currentProducts.map((product) => (
                    <tr key={product.id} className="hover:bg-gray-50 transition-colors">
                      {/* Product Column */}
                      <td className="px-4 py-4">
                        <div className="flex items-center">
                          {product.imageUrl && (
                            <img
                              src={product.imageUrl}
                              alt={product.title}
                              className="h-14 w-14 rounded-lg object-cover mr-4 flex-shrink-0 border shadow-sm"
                              onError={(e) => {
                                (e.target as HTMLImageElement).style.display = 'none';
                              }}
                            />
                          )}
                          <div className="min-w-0 flex-1">
                            <div className="text-sm font-medium text-gray-900 max-w-xs truncate" title={product.title}>
                              {product.title || 'No Title'}
                            </div>
                            <div className="text-xs text-gray-500 space-y-1 mt-1">
                              <div className="flex items-center space-x-3">
                                <span>SKU: {product.sku || 'N/A'}</span>
                                <span>TSIN: {product.tsin || 'N/A'}</span>
                              </div>
                            </div>
                          </div>
                        </div>
                      </td>
                      
                      {/* Our Price Column */}
                      <td className="px-4 py-4 text-sm">
                        <div className="font-medium text-gray-900">
                          {product.ourPrice > 0 ? formatCurrency(product.ourPrice) : (
                            <span className="text-gray-400">No Price</span>
                          )}
                        </div>
                        {product.posPrice && product.posPrice !== product.ourPrice && (
                          <div className="text-xs text-gray-500">
                            POS: {formatCurrency(product.posPrice)}
                          </div>
                        )}
                      </td>
                      
                      {/* RRP Column */}
                      <td className="px-4 py-4 text-sm text-gray-900">
                        {product.rrp > 0 ? formatCurrency(product.rrp) : (
                          <span className="text-gray-400">-</span>
                        )}
                      </td>
                      
                      {/* Stock Column */}
                      <td className="px-4 py-4 text-sm">
                        <div className={`text-gray-900 font-medium ${product.stock === 0 ? 'text-red-600' : ''}`}>
                          {product.stock || 0}
                        </div>
                        {(product.stock_dbn || product.stock_cpt || product.stock_jhb) && (
                          <div className="text-xs text-gray-500 space-y-1 mt-1">
                            {product.stock_dbn && <div>DBN: {product.stock_dbn}</div>}
                            {product.stock_cpt && <div>CPT: {product.stock_cpt}</div>}
                            {product.stock_jhb && <div>JHB: {product.stock_jhb}</div>}
                          </div>
                        )}
                      </td>
                      
                      {/* Status Column */}
                      <td className="px-4 py-4">
                        <span className={`inline-flex px-3 py-1 text-xs font-medium rounded-full ${getStatusBadge(product.status)}`}>
                          {product.status}
                        </span>
                      </td>
                      
                      {/* Actions Column */}
                      <td className="px-4 py-4 text-sm">
                        <div className="flex items-center space-x-3">
                          {/* Scrape Single Product Button */}
                          <button
                            onClick={() => scrapeSingleProduct(product)}
                            disabled={scrapingProduct === product.id}
                            className={`inline-flex items-center px-3 py-1 rounded text-xs font-medium transition-colors ${
                              scrapingProduct === product.id
                                ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                                : 'bg-blue-100 text-blue-800 hover:bg-blue-200'
                            }`}
                          >
                            {scrapingProduct === product.id ? (
                              <>
                                <div className="animate-spin rounded-full h-3 w-3 border-b border-blue-600 mr-1"></div>
                                Scraping...
                              </>
                            ) : (
                              <>
                                <FiSearch className="h-3 w-3 mr-1" />
                                Scrape
                              </>
                            )}
                          </button>
                          
                          {/* View on Takealot Button */}
                          {product.offerUrl && (
                            <a
                              href={product.offerUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center px-3 py-1 rounded text-xs font-medium bg-green-100 text-green-800 hover:bg-green-200 transition-colors"
                            >
                              <FiPackage className="h-3 w-3 mr-1" />
                              View
                            </a>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between bg-white px-6 py-4 rounded-lg shadow">
            <div className="flex items-center space-x-2">
              <span className="text-sm text-gray-700">
                Showing {startIndex + 1} to {Math.min(startIndex + itemsPerPage, filteredData.length)} of {filteredData.length} results
              </span>
            </div>
            <div className="flex items-center space-x-2">
              <button
                onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                disabled={currentPage === 1}
                className="px-4 py-2 text-sm font-medium text-gray-500 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                Previous
              </button>
              
              <div className="flex items-center space-x-1">
                {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                  const pageNum = i + 1;
                  return (
                    <button
                      key={pageNum}
                      onClick={() => setCurrentPage(pageNum)}
                      className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
                        currentPage === pageNum
                          ? 'text-blue-600 bg-blue-50 border border-blue-300'
                          : 'text-gray-500 bg-white border border-gray-300 hover:bg-gray-50'
                      }`}
                    >
                      {pageNum}
                    </button>
                  );
                })}
              </div>

              <button
                onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
                disabled={currentPage === totalPages}
                className="px-4 py-2 text-sm font-medium text-gray-500 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Filter Drawer */}
      {isFilterDrawerOpen && (
        <div className="fixed inset-0 z-50 overflow-hidden">
          <div className="absolute inset-0 overflow-hidden">
            <div className="absolute inset-0 bg-gray-500 bg-opacity-75 transition-opacity" onClick={() => setIsFilterDrawerOpen(false)}></div>
            <section className="absolute right-0 top-0 h-full w-full max-w-md flex flex-col bg-white shadow-xl">
              <div className="flex items-center justify-between p-4 border-b">
                <h2 className="text-lg font-medium text-gray-900">Filters</h2>
                <button
                  onClick={() => setIsFilterDrawerOpen(false)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <span className="sr-only">Close</span>
                  ×
                </button>
              </div>
              
              <div className="flex-1 overflow-y-auto p-4 space-y-6">
                {/* Search Filter */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Search Products
                  </label>
                  <input
                    type="text"
                    value={tempSearchTerm}
                    onChange={(e) => setTempSearchTerm(e.target.value)}
                    placeholder="Search by title, SKU, or TSIN..."
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>

                {/* Status Filter */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Status
                  </label>
                  <div className="space-y-2 max-h-40 overflow-y-auto">
                    {uniqueStatuses.map((status) => (
                      <label key={status} className="flex items-center">
                        <input
                          type="checkbox"
                          checked={tempStatusFilters.includes(status)}
                          onChange={() => handleStatusFilterChange(status)}
                          className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                        />
                        <span className="ml-2 text-sm text-gray-700">{status}</span>
                      </label>
                    ))}
                  </div>
                </div>
              </div>
              
              <div className="border-t p-4 space-y-3">
                <button
                  onClick={applyFilters}
                  className="w-full bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 transition-colors"
                >
                  Apply Filters
                </button>
                <button
                  onClick={() => {
                    setTempStatusFilters([]);
                    setTempSearchTerm('');
                    setStatusFilters(['buyable']); // Reset to default buyable filter
                    setSearchTerm('');
                    setIsFilterDrawerOpen(false);
                  }}
                  className="w-full bg-gray-300 text-gray-700 py-2 px-4 rounded-md hover:bg-gray-400 transition-colors"
                >
                  Reset to Buyable
                </button>
              </div>
            </section>
          </div>
        </div>
      )}
    </div>
  );
}