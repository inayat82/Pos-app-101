'use client';

import React, { useState, useEffect } from 'react';
import { FiSearch, FiRefreshCw, FiTrendingUp, FiDollarSign, FiPackage, FiEye, FiFilter, FiDownload, FiPlay, FiPause } from 'react-icons/fi';
import { useAuth } from '@/context/AuthContext';
import { usePageTitle } from '@/context/PageTitleContext';
import { db } from '@/lib/firebase/firebase';
import { collection, query, where, getDocs, Timestamp } from 'firebase/firestore';

interface AutoPriceProduct {
  id: string;
  integrationId: string;
  adminId: string;
  tsin: string;
  sku: string;
  title: string;
  imageUrl?: string;
  status: 'buyable' | 'loading' | 'out_of_stock' | 'unavailable';
  ourPrice: number;
  rrp: number;
  createdAt: Date | Timestamp;
  updatedAt: Date | Timestamp;
  
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
  winDifference?: number; // ourPrice - scrapedWinnerSellerPrice
  winPrice?: number; // scrapedWinnerSellerPrice
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
  switch (status) {
    case 'buyable':
      return 'bg-green-100 text-green-800';
    case 'loading':
      return 'bg-yellow-100 text-yellow-800';
    case 'out_of_stock':
      return 'bg-red-100 text-red-800';
    case 'unavailable':
      return 'bg-gray-100 text-gray-800';
    default:
      return 'bg-gray-100 text-gray-800';
  }
};

const formatCurrency = (amount: number) => {
  return new Intl.NumberFormat('en-ZA', {
    style: 'currency',
    currency: 'ZAR',
  }).format(amount);
};

export default function TakealotAutoPricePage({ params }: { params: Promise<{ integrationId: string }> }) {
  const { currentUser } = useAuth();
  const { setPageTitle } = usePageTitle();
  
  // Fix for Next.js 15 - params are now async
  const resolvedParams = React.use(params);
  const { integrationId } = resolvedParams;

  const [products, setProducts] = useState<AutoPriceProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(50);
  const [stats, setStats] = useState<AutoPriceStats | null>(null);
  const [selectedProduct, setSelectedProduct] = useState<AutoPriceProduct | null>(null);
  const [showProductModal, setShowProductModal] = useState(false);
  const [statusFilter, setStatusFilter] = useState<string[]>([]);
  const [priceFilter, setPriceFilter] = useState({
    min: '',
    max: ''
  });

  useEffect(() => {
    setPageTitle('Takealot Auto Price');
    return () => setPageTitle('');
  }, [setPageTitle]);

  useEffect(() => {
    if (currentUser && integrationId) {
      loadAutoPriceProducts();
    }
  }, [currentUser, integrationId]);

  const loadAutoPriceProducts = async () => {
    try {
      setLoading(true);
      
      console.log('Loading auto price products for integration:', integrationId);

      // Try takealot_offers first (same as products page)
      const offersQuery = query(
        collection(db, 'takealot_offers'),
        where('integrationId', '==', integrationId)
      );
      
      const offersSnapshot = await getDocs(offersQuery);
      console.log('Found in takealot_offers:', offersSnapshot.size);

      if (offersSnapshot.size > 0) {
        const autoProducts: AutoPriceProduct[] = offersSnapshot.docs.map(doc => {
          const data = doc.data();
          
          // Extract stock data from arrays if available
          const stockAtTakealot = data.stock_at_takealot || [];
          
          return {
            id: doc.id,
            integrationId,
            adminId: currentUser?.uid || '',
            tsin: data.tsin_id || data.offer_id || '',
            sku: data.sku || data.offer_id || '',
            title: data.title || data.product_title || '',
            imageUrl: data.image_url_1 || data.image_url || '',
            status: data.status === 'Buyable' ? 'buyable' : 
                   data.status === 'Loading' ? 'loading' :
                   data.status === 'Out of Stock' ? 'out_of_stock' : 'unavailable',
            ourPrice: data.selling_price || data.sell_price || data.price || 0,
            rrp: data.rrp || data.recommended_retail_price || 0,
            createdAt: data.created_at || new Date(),
            updatedAt: data.updated_at || new Date(),
            
            // Stock information
            stock: data.stock_at_takealot_total || 0,
            stock_dbn: stockAtTakealot.find((s: any) => s.warehouse?.name === 'DBN')?.quantity_available || 0,
            stock_cpt: stockAtTakealot.find((s: any) => s.warehouse?.name === 'CPT')?.quantity_available || 0,
            stock_jhb: stockAtTakealot.find((s: any) => s.warehouse?.name === 'JHB')?.quantity_available || 0,
            
            // Sales metrics
            sold_30_days: data.last_30_days_sold || data.tsinCalculatedMetrics?.last30DaysSold || 0,
            total_sold: data.total_sold || data.tsinCalculatedMetrics?.totalSold || 0,
            
            // Auto Price specific fields (initially empty - to be populated by scraping)
            scrapedRating: undefined,
            scrapedReviewCount: undefined,
            scrapedWinnerSeller: undefined,
            scrapedWinnerSellerPrice: undefined,
            scrapedTotalSellers: undefined,
            lastScrapedAt: undefined,
            scrapingStatus: 'idle',
            scrapingErrorMessage: undefined,
            proxyUsed: undefined,
            scrapingDuration: undefined,
            
            // Calculated fields (to be computed)
            winDifference: undefined,
            winPrice: undefined,
            posBarcode: data.barcode || '',
            posPrice: data.selling_price || data.sell_price || data.price || 0,
            profitLoss: undefined,
            minPrice: undefined,
            maxPrice: undefined,
          };
        });
        
        setProducts(autoProducts);
      } else {
        // Try takealotProducts as fallback
        const productsQuery = query(
          collection(db, 'takealotProducts'),
          where('integrationId', '==', integrationId)
        );
        
        const productsSnapshot = await getDocs(productsQuery);
        console.log('Found in takealotProducts:', productsSnapshot.size);
        
        if (productsSnapshot.size > 0) {
          const autoProducts: AutoPriceProduct[] = productsSnapshot.docs.map(doc => {
            const data = doc.data();
            
            return {
              id: doc.id,
              integrationId,
              adminId: currentUser?.uid || '',
              tsin: data.tsin_id || data.tsin || '',
              sku: data.sku || '',
              title: data.title || '',
              imageUrl: data.image_url || '',
              status: data.status === 'Buyable' ? 'buyable' : 
                     data.status === 'Loading' ? 'loading' :
                     data.status === 'Out of Stock' ? 'out_of_stock' : 'unavailable',
              ourPrice: data.price || data.sell_price || 0,
              rrp: data.rrp || 0,
              createdAt: data.created_at || new Date(),
              updatedAt: data.updated_at || new Date(),
              
              // Stock information
              stock: data.stock || 0,
              
              // Auto Price specific fields (initially empty)
              scrapedRating: undefined,
              scrapedReviewCount: undefined,
              scrapedWinnerSeller: undefined,
              scrapedWinnerSellerPrice: undefined,
              scrapedTotalSellers: undefined,
              lastScrapedAt: undefined,
              scrapingStatus: 'idle',
              scrapingErrorMessage: undefined,
              proxyUsed: undefined,
              scrapingDuration: undefined,
              
              // Calculated fields
              winDifference: undefined,
              winPrice: undefined,
              posBarcode: data.barcode || '',
              posPrice: data.price || data.sell_price || 0,
              profitLoss: undefined,
              minPrice: undefined,
              maxPrice: undefined,
            };
          });
          
          setProducts(autoProducts);
        } else {
          console.log('No products found in either collection');
          setProducts([]);
        }
      }
      
      // Calculate basic stats from loaded products
      const totalProducts = products.length;
      const scrapedToday = 0; // Will be calculated when scraping is implemented
      const pendingScraping = 0; // Will be calculated when scraping is implemented  
      const averageWinDifference = 0; // Will be calculated when scraping data is available
      
      setStats({
        totalProducts,
        scrapedToday,
        pendingScraping,
        averageWinDifference,
        successRate24h: 0,
        competitiveProducts: 0,
        overPricedProducts: 0,
        potentialSavings: 0
      });
      
    } catch (error) {
      console.error('Error loading auto price products:', error);
      setProducts([]);
    } finally {
      setLoading(false);
    }
  };

  const filteredProducts = () => {
    let filtered = products.filter(product => {
      // Search filter
      if (searchTerm.trim()) {
        const searchLower = searchTerm.toLowerCase();
        const matches = (
          product.title.toLowerCase().includes(searchLower) ||
          product.sku.toLowerCase().includes(searchLower) ||
          product.tsin.toLowerCase().includes(searchLower) ||
          (product.scrapedWinnerSeller && product.scrapedWinnerSeller.toLowerCase().includes(searchLower))
        );
        if (!matches) return false;
      }

      // Status filter
      if (statusFilter.length > 0 && !statusFilter.includes(product.scrapingStatus)) {
        return false;
      }

      // Price filter
      if (priceFilter.min && product.ourPrice < parseFloat(priceFilter.min)) return false;
      if (priceFilter.max && product.ourPrice > parseFloat(priceFilter.max)) return false;

      return true;
    });

    return filtered;
  };

  const triggerScraping = async (productId?: string) => {
    try {
      console.log('Triggering scraping for:', productId || 'all products');
      // In real implementation, this would call the scraping API
      
      if (productId) {
        setProducts(prev => prev.map(p => 
          p.id === productId 
            ? { ...p, scrapingStatus: 'queued' as const }
            : p
        ));
      } else {
        setProducts(prev => prev.map(p => ({ ...p, scrapingStatus: 'queued' as const })));
      }
      
      // Simulate scraping completion after delay
      setTimeout(() => {
        if (productId) {
          setProducts(prev => prev.map(p => 
            p.id === productId 
              ? { ...p, scrapingStatus: 'success' as const, lastScrapedAt: new Date() }
              : p
          ));
        }
      }, 3000);
      
    } catch (error) {
      console.error('Error triggering scraping:', error);
    }
  };

  const getStatusBadge = (status: string) => {
    const variants = {
      idle: 'bg-gray-100 text-gray-800',
      queued: 'bg-yellow-100 text-yellow-800',
      scraping: 'bg-blue-100 text-blue-800',
      success: 'bg-green-100 text-green-800',
      error: 'bg-red-100 text-red-800',
      retry: 'bg-orange-100 text-orange-800',
      skip: 'bg-gray-100 text-gray-600'
    };
    return variants[status as keyof typeof variants] || variants.idle;
  };

  const getPositionBadge = (position: string) => {
    const variants = {
      lowest: 'bg-green-100 text-green-800',
      competitive: 'bg-blue-100 text-blue-800',
      premium: 'bg-yellow-100 text-yellow-800',
      overpriced: 'bg-red-100 text-red-800'
    };
    return variants[position as keyof typeof variants] || variants.competitive;
  };

  const getActionBadge = (action: string) => {
    const variants = {
      maintain: 'bg-green-100 text-green-800',
      reduce: 'bg-red-100 text-red-800',
      increase: 'bg-blue-100 text-blue-800',
      investigate: 'bg-yellow-100 text-yellow-800'
    };
    return variants[action as keyof typeof variants] || variants.maintain;
  };

  const formatCurrency = (amount: number) => {
    return `R${amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}`;
  };

  const formatDateTime = (date: Date | undefined) => {
    if (!date) return 'Never';
    return new Date(date).toLocaleString();
  };

  // Pagination
  const filteredData = filteredProducts();
  const totalPages = Math.ceil(filteredData.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const currentProducts = filteredData.slice(startIndex, startIndex + itemsPerPage);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header with Enhanced Actions */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Auto Price Management</h1>
          <p className="text-gray-600 mt-1">Competitive pricing analysis and market intelligence</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => triggerScraping()}
            className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            <FiRefreshCw className="h-4 w-4 mr-2" />
            Scrape All Prices
          </button>
          <button
            onClick={() => {
              // Export functionality
              console.log('Export auto price data');
            }}
            className="flex items-center px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
          >
            <FiDownload className="h-4 w-4 mr-2" />
            Export Data
          </button>
          <button
            onClick={() => {
              // Automation settings
              console.log('Configure automation');
            }}
            className="flex items-center px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
          >
            <FiPlay className="h-4 w-4 mr-2" />
            Automation
          </button>
        </div>
      </div>

      {/* Enhanced Statistics Cards */}
      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-white p-6 rounded-lg shadow">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Total Products</p>
                <p className="text-2xl font-bold text-gray-900">{stats.totalProducts}</p>
                <p className="text-xs text-gray-500 mt-1">
                  {stats.scrapedToday} scraped today
                </p>
              </div>
              <FiPackage className="h-8 w-8 text-blue-600" />
            </div>
          </div>

          <div className="bg-white p-6 rounded-lg shadow">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Competitive Position</p>
                <p className="text-2xl font-bold text-green-600">{stats.competitiveProducts}</p>
                <p className="text-xs text-gray-500 mt-1">
                  {stats.overPricedProducts} overpriced
                </p>
              </div>
              <FiTrendingUp className="h-8 w-8 text-green-600" />
            </div>
          </div>

          <div className="bg-white p-6 rounded-lg shadow">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Avg Win Difference</p>
                <p className="text-2xl font-bold text-purple-600">{formatCurrency(stats.averageWinDifference)}</p>
                <p className="text-xs text-gray-500 mt-1">
                  {formatCurrency(stats.potentialSavings)} potential savings
                </p>
              </div>
              <FiDollarSign className="h-8 w-8 text-purple-600" />
            </div>
          </div>

          <div className="bg-white p-6 rounded-lg shadow">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Scraping Health</p>
                <p className="text-2xl font-bold text-orange-600">{stats.successRate24h}%</p>
                <p className="text-xs text-gray-500 mt-1">
                  {stats.pendingScraping} pending
                </p>
              </div>
              <FiTrendingUp className="h-8 w-8 text-orange-600" />
            </div>
          </div>
        </div>
      )}

      {/* Advanced Search and Filters */}
      <div className="bg-white p-4 rounded-lg shadow space-y-4">
        <div className="flex flex-col lg:flex-row gap-4">
          {/* Search */}
          <div className="flex-1">
            <div className="relative">
              <FiSearch className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
              <input
                type="text"
                placeholder="Search by product title, SKU, TSIN, or seller..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 pr-4 py-2 w-full border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
          </div>
          
          {/* Items Per Page */}
          <div className="flex space-x-2">
            <select
              value={itemsPerPage}
              onChange={(e) => setItemsPerPage(Number(e.target.value))}
              className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value={25}>25 per page</option>
              <option value={50}>50 per page</option>
              <option value={100}>100 per page</option>
            </select>
          </div>
        </div>

        {/* Advanced Filters */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {/* Status Filter */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
            <select
              value={statusFilter.length === 1 ? statusFilter[0] : ''}
              onChange={(e) => setStatusFilter(e.target.value ? [e.target.value] : [])}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="">All Status</option>
              <option value="buyable">Buyable</option>
              <option value="loading">Loading</option>
              <option value="out_of_stock">Out of Stock</option>
              <option value="unavailable">Unavailable</option>
            </select>
          </div>

          {/* Price Range Filter */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Min Price</label>
            <input
              type="number"
              placeholder="0"
              value={priceFilter.min}
              onChange={(e) => setPriceFilter(prev => ({ ...prev, min: e.target.value }))}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Max Price</label>
            <input
              type="number"
              placeholder="10000"
              value={priceFilter.max}
              onChange={(e) => setPriceFilter(prev => ({ ...prev, max: e.target.value }))}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>

          {/* Scraping Status Filter */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Scraping Status</label>
            <select
              value=""
              onChange={(e) => {
                // Add scraping status filter logic
                console.log('Scraping filter:', e.target.value);
              }}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="">All Scraping Status</option>
              <option value="idle">Idle</option>
              <option value="queued">Queued</option>
              <option value="scraping">Scraping</option>
              <option value="success">Success</option>
              <option value="error">Error</option>
            </select>
          </div>
        </div>

        {/* Quick Filter Buttons */}
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => {
              setSearchTerm('');
              setStatusFilter([]);
              setPriceFilter({ min: '', max: '' });
            }}
            className="px-3 py-1 text-sm bg-gray-100 text-gray-700 rounded-full hover:bg-gray-200"
          >
            Clear All
          </button>
          <button
            onClick={() => setStatusFilter(['buyable'])}
            className="px-3 py-1 text-sm bg-green-100 text-green-700 rounded-full hover:bg-green-200"
          >
            Buyable Only
          </button>
          <button
            onClick={() => setStatusFilter(['out_of_stock'])}
            className="px-3 py-1 text-sm bg-red-100 text-red-700 rounded-full hover:bg-red-200"
          >
            Out of Stock
          </button>
          <button
            onClick={() => {
              // Filter products that need price updates (have winner data but high difference)
              // This would need to be implemented in the filter logic
            }}
            className="px-3 py-1 text-sm bg-yellow-100 text-yellow-700 rounded-full hover:bg-yellow-200"
          >
            Needs Price Update
          </button>
          <button
            onClick={() => {
              // Filter products with scraping errors
              // This would need to be implemented in the filter logic
            }}
            className="px-3 py-1 text-sm bg-orange-100 text-orange-700 rounded-full hover:bg-orange-200"
          >
            Scraping Errors
          </button>
        </div>
      </div>

      {/* Products Table */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Product</th>
                <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Our Price</th>
                <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">RRP</th>
                <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Stock</th>
                <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Sales</th>
                <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Winner</th>
                <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Difference</th>
                <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Rating</th>
                <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Competition</th>
                <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Scraping</th>
                <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {currentProducts.map((product) => (
                <tr key={product.id} className="hover:bg-gray-50">
                  {/* Product Column */}
                  <td className="px-3 py-4">
                    <div className="flex items-center">
                      {product.imageUrl && (
                        <img
                          src={product.imageUrl}
                          alt={product.title}
                          className="h-10 w-10 rounded object-cover mr-3 flex-shrink-0"
                        />
                      )}
                      <div className="min-w-0">
                        <div className="text-sm font-medium text-gray-900 max-w-xs truncate" title={product.title}>
                          {product.title}
                        </div>
                        <div className="text-xs text-gray-500">
                          SKU: {product.sku}
                        </div>
                        <div className="text-xs text-gray-500">
                          TSIN: {product.tsin}
                        </div>
                      </div>
                    </div>
                  </td>
                  
                  {/* Our Price Column */}
                  <td className="px-3 py-4 text-sm text-gray-900 font-medium">
                    {formatCurrency(product.ourPrice)}
                    {product.posPrice && product.posPrice !== product.ourPrice && (
                      <div className="text-xs text-gray-500">
                        POS: {formatCurrency(product.posPrice)}
                      </div>
                    )}
                  </td>
                  
                  {/* RRP Column */}
                  <td className="px-3 py-4 text-sm text-gray-900">
                    {formatCurrency(product.rrp)}
                    {product.rrp > 0 && product.ourPrice > 0 && (
                      <div className="text-xs text-gray-500">
                        {Math.round(((product.rrp - product.ourPrice) / product.rrp) * 100)}% off
                      </div>
                    )}
                  </td>
                  
                  {/* Stock Column */}
                  <td className="px-3 py-4 text-sm">
                    <div className={`font-medium ${(product.stock || 0) > 0 ? 'text-green-600' : 'text-red-600'}`}>
                      {product.stock || 0}
                    </div>
                    {/* Stock breakdown by warehouse */}
                    {(product.stock_dbn || product.stock_cpt || product.stock_jhb) && (
                      <div className="text-xs text-gray-500 space-y-1">
                        {product.stock_dbn ? <div>DBN: {product.stock_dbn}</div> : null}
                        {product.stock_cpt ? <div>CPT: {product.stock_cpt}</div> : null}
                        {product.stock_jhb ? <div>JHB: {product.stock_jhb}</div> : null}
                      </div>
                    )}
                  </td>
                  
                  {/* Sales Column */}
                  <td className="px-3 py-4 text-sm text-gray-900">
                    {product.sold_30_days ? (
                      <div>
                        <div className="font-medium text-green-600">{product.sold_30_days}</div>
                        <div className="text-xs text-gray-500">30 days</div>
                      </div>
                    ) : (
                      <span className="text-gray-400">-</span>
                    )}
                    {product.total_sold && (
                      <div className="text-xs text-gray-500">
                        Total: {product.total_sold}
                      </div>
                    )}
                  </td>
                  
                  {/* Winner Column */}
                  <td className="px-3 py-4 text-sm">
                    {product.scrapedWinnerSellerPrice ? (
                      <div>
                        <div className="font-medium text-gray-900">
                          {formatCurrency(product.scrapedWinnerSellerPrice)}
                        </div>
                        {product.scrapedWinnerSeller && (
                          <div className="text-xs text-gray-500 max-w-24 truncate" title={product.scrapedWinnerSeller}>
                            {product.scrapedWinnerSeller}
                          </div>
                        )}
                      </div>
                    ) : (
                      <span className="text-gray-400">-</span>
                    )}
                  </td>
                  
                  {/* Difference Column */}
                  <td className="px-3 py-4 text-sm">
                    {product.winDifference !== undefined ? (
                      <div>
                        <span className={`font-medium ${product.winDifference > 0 ? 'text-red-600' : 'text-green-600'}`}>
                          {product.winDifference > 0 ? '+' : ''}{formatCurrency(product.winDifference)}
                        </span>
                        {product.pricePosition && (
                          <div className="text-xs">
                            <span className={`inline-flex px-1 py-0.5 rounded text-xs font-medium ${
                              product.pricePosition === 'lowest' ? 'bg-green-100 text-green-800' :
                              product.pricePosition === 'competitive' ? 'bg-yellow-100 text-yellow-800' :
                              product.pricePosition === 'premium' ? 'bg-orange-100 text-orange-800' :
                              'bg-red-100 text-red-800'
                            }`}>
                              {product.pricePosition}
                            </span>
                          </div>
                        )}
                      </div>
                    ) : (
                      <span className="text-gray-400">-</span>
                    )}
                  </td>
                  
                  {/* Rating Column */}
                  <td className="px-3 py-4 text-sm">
                    {product.scrapedRating ? (
                      <div>
                        <div className="flex items-center">
                          <span className="text-yellow-500">★</span>
                          <span className="ml-1 font-medium">{product.scrapedRating.toFixed(1)}</span>
                        </div>
                        {product.scrapedReviewCount && (
                          <div className="text-xs text-gray-500">
                            {product.scrapedReviewCount} reviews
                          </div>
                        )}
                      </div>
                    ) : (
                      <span className="text-gray-400">-</span>
                    )}
                  </td>
                  
                  {/* Competition Column */}
                  <td className="px-3 py-4 text-sm">
                    {product.scrapedTotalSellers ? (
                      <div>
                        <div className="font-medium text-gray-900">
                          {product.scrapedTotalSellers} sellers
                        </div>
                        {product.competitivenessScore && (
                          <div className="text-xs text-gray-500">
                            Score: {Math.round(product.competitivenessScore * 100)}%
                          </div>
                        )}
                      </div>
                    ) : (
                      <span className="text-gray-400">-</span>
                    )}
                  </td>
                  
                  {/* Status Column */}
                  <td className="px-3 py-4">
                    <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${getStatusBadge(product.status)}`}>
                      {product.status}
                    </span>
                    {product.recommendedAction && (
                      <div className="text-xs text-gray-500 mt-1">
                        {product.recommendedAction}
                      </div>
                    )}
                  </td>
                  
                  {/* Scraping Status Column */}
                  <td className="px-3 py-4 text-sm">
                    <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${
                      product.scrapingStatus === 'success' ? 'bg-green-100 text-green-800' :
                      product.scrapingStatus === 'scraping' ? 'bg-blue-100 text-blue-800' :
                      product.scrapingStatus === 'queued' ? 'bg-yellow-100 text-yellow-800' :
                      product.scrapingStatus === 'error' ? 'bg-red-100 text-red-800' :
                      'bg-gray-100 text-gray-800'
                    }`}>
                      {product.scrapingStatus}
                    </span>
                    {product.lastScrapedAt && (
                      <div className="text-xs text-gray-500 mt-1">
                        {new Date(product.lastScrapedAt).toLocaleDateString()}
                      </div>
                    )}
                    {product.scrapingErrorMessage && (
                      <div className="text-xs text-red-500 mt-1 max-w-32 truncate" title={product.scrapingErrorMessage}>
                        {product.scrapingErrorMessage}
                      </div>
                    )}
                  </td>
                  
                  {/* Actions Column */}
                  <td className="px-3 py-4">
                    <div className="flex space-x-2">
                      <button
                        onClick={() => triggerScraping(product.id)}
                        disabled={product.scrapingStatus === 'scraping' || product.scrapingStatus === 'queued'}
                        className="text-blue-600 hover:text-blue-800 disabled:text-gray-400"
                        title="Scrape Price"
                      >
                        <FiRefreshCw className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => {
                          setSelectedProduct(product);
                          setShowProductModal(true);
                        }}
                        className="text-gray-600 hover:text-gray-800"
                        title="View Details"
                      >
                        <FiEye className="h-4 w-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="bg-white px-4 py-3 flex items-center justify-between border-t border-gray-200">
            <div className="flex-1 flex justify-between sm:hidden">
              <button
                onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                disabled={currentPage === 1}
                className="relative inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50"
              >
                Previous
              </button>
              <button
                onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
                disabled={currentPage === totalPages}
                className="ml-3 relative inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50"
              >
                Next
              </button>
            </div>
            <div className="hidden sm:flex-1 sm:flex sm:items-center sm:justify-between">
              <div>
                <p className="text-sm text-gray-700">
                  Showing <span className="font-medium">{startIndex + 1}</span> to{' '}
                  <span className="font-medium">{Math.min(startIndex + itemsPerPage, filteredData.length)}</span> of{' '}
                  <span className="font-medium">{filteredData.length}</span> results
                </p>
              </div>
              <div>
                <nav className="relative z-0 inline-flex rounded-md shadow-sm -space-x-px">
                  <button
                    onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                    disabled={currentPage === 1}
                    className="relative inline-flex items-center px-2 py-2 rounded-l-md border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50 disabled:opacity-50"
                  >
                    Previous
                  </button>
                  <button
                    onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
                    disabled={currentPage === totalPages}
                    className="relative inline-flex items-center px-2 py-2 rounded-r-md border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50 disabled:opacity-50"
                  >
                    Next
                  </button>
                </nav>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Product Detail Modal */}
      {showProductModal && selectedProduct && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-gray-200">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-semibold text-gray-900">Product Details</h2>
                <button
                  onClick={() => setShowProductModal(false)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>
            
            <div className="p-6 space-y-6">
              {/* Product Header */}
              <div className="flex items-start space-x-4">
                {selectedProduct.imageUrl && (
                  <img
                    src={selectedProduct.imageUrl}
                    alt={selectedProduct.title}
                    className="h-20 w-20 rounded object-cover flex-shrink-0"
                  />
                )}
                <div className="flex-1">
                  <h3 className="text-lg font-medium text-gray-900">{selectedProduct.title}</h3>
                  <div className="text-sm text-gray-500 space-y-1">
                    <p>SKU: {selectedProduct.sku}</p>
                    <p>TSIN: {selectedProduct.tsin}</p>
                    {selectedProduct.posBarcode && <p>Barcode: {selectedProduct.posBarcode}</p>}
                  </div>
                </div>
              </div>

              {/* Pricing Information */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-gray-50 p-4 rounded-lg">
                  <h4 className="font-medium text-gray-900 mb-2">Our Pricing</h4>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span>Current Price:</span>
                      <span className="font-medium">{formatCurrency(selectedProduct.ourPrice)}</span>
                    </div>
                    {selectedProduct.posPrice && selectedProduct.posPrice !== selectedProduct.ourPrice && (
                      <div className="flex justify-between">
                        <span>POS Price:</span>
                        <span className="font-medium">{formatCurrency(selectedProduct.posPrice)}</span>
                      </div>
                    )}
                    <div className="flex justify-between">
                      <span>RRP:</span>
                      <span className="font-medium">{formatCurrency(selectedProduct.rrp)}</span>
                    </div>
                    {selectedProduct.minPrice && (
                      <div className="flex justify-between">
                        <span>Min Price:</span>
                        <span className="font-medium">{formatCurrency(selectedProduct.minPrice)}</span>
                      </div>
                    )}
                    {selectedProduct.maxPrice && (
                      <div className="flex justify-between">
                        <span>Max Price:</span>
                        <span className="font-medium">{formatCurrency(selectedProduct.maxPrice)}</span>
                      </div>
                    )}
                  </div>
                </div>

                <div className="bg-gray-50 p-4 rounded-lg">
                  <h4 className="font-medium text-gray-900 mb-2">Market Information</h4>
                  <div className="space-y-2 text-sm">
                    {selectedProduct.scrapedWinnerSellerPrice && (
                      <div className="flex justify-between">
                        <span>Winner Price:</span>
                        <span className="font-medium">{formatCurrency(selectedProduct.scrapedWinnerSellerPrice)}</span>
                      </div>
                    )}
                    {selectedProduct.scrapedWinnerSeller && (
                      <div className="flex justify-between">
                        <span>Winner Seller:</span>
                        <span className="font-medium text-xs">{selectedProduct.scrapedWinnerSeller}</span>
                      </div>
                    )}
                    {selectedProduct.winDifference !== undefined && (
                      <div className="flex justify-between">
                        <span>Price Difference:</span>
                        <span className={`font-medium ${selectedProduct.winDifference > 0 ? 'text-red-600' : 'text-green-600'}`}>
                          {selectedProduct.winDifference > 0 ? '+' : ''}{formatCurrency(selectedProduct.winDifference)}
                        </span>
                      </div>
                    )}
                    {selectedProduct.scrapedTotalSellers && (
                      <div className="flex justify-between">
                        <span>Total Sellers:</span>
                        <span className="font-medium">{selectedProduct.scrapedTotalSellers}</span>
                      </div>
                    )}
                    {selectedProduct.pricePosition && (
                      <div className="flex justify-between">
                        <span>Position:</span>
                        <span className={`font-medium capitalize ${
                          selectedProduct.pricePosition === 'lowest' ? 'text-green-600' :
                          selectedProduct.pricePosition === 'competitive' ? 'text-yellow-600' :
                          selectedProduct.pricePosition === 'premium' ? 'text-orange-600' :
                          'text-red-600'
                        }`}>
                          {selectedProduct.pricePosition}
                        </span>
                      </div>
                    )}
                  </div>
                </div>

                <div className="bg-gray-50 p-4 rounded-lg">
                  <h4 className="font-medium text-gray-900 mb-2">Business Metrics</h4>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span>Stock Level:</span>
                      <span className={`font-medium ${(selectedProduct.stock || 0) > 0 ? 'text-green-600' : 'text-red-600'}`}>
                        {selectedProduct.stock || 0}
                      </span>
                    </div>
                    {selectedProduct.sold_30_days && (
                      <div className="flex justify-between">
                        <span>Sold (30 days):</span>
                        <span className="font-medium text-green-600">{selectedProduct.sold_30_days}</span>
                      </div>
                    )}
                    {selectedProduct.total_sold && (
                      <div className="flex justify-between">
                        <span>Total Sold:</span>
                        <span className="font-medium">{selectedProduct.total_sold}</span>
                      </div>
                    )}
                    {selectedProduct.profitLoss !== undefined && (
                      <div className="flex justify-between">
                        <span>Profit/Loss:</span>
                        <span className={`font-medium ${selectedProduct.profitLoss >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                          {formatCurrency(selectedProduct.profitLoss)}
                        </span>
                      </div>
                    )}
                    {selectedProduct.competitivenessScore && (
                      <div className="flex justify-between">
                        <span>Competitiveness:</span>
                        <span className="font-medium">{Math.round(selectedProduct.competitivenessScore * 100)}%</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Stock Breakdown */}
              {(selectedProduct.stock_dbn || selectedProduct.stock_cpt || selectedProduct.stock_jhb) && (
                <div className="bg-gray-50 p-4 rounded-lg">
                  <h4 className="font-medium text-gray-900 mb-2">Stock by Warehouse</h4>
                  <div className="grid grid-cols-3 gap-4 text-sm">
                    <div className="text-center">
                      <div className="font-medium text-lg">{selectedProduct.stock_dbn || 0}</div>
                      <div className="text-gray-500">Durban</div>
                    </div>
                    <div className="text-center">
                      <div className="font-medium text-lg">{selectedProduct.stock_cpt || 0}</div>
                      <div className="text-gray-500">Cape Town</div>
                    </div>
                    <div className="text-center">
                      <div className="font-medium text-lg">{selectedProduct.stock_jhb || 0}</div>
                      <div className="text-gray-500">Johannesburg</div>
                    </div>
                  </div>
                </div>
              )}

              {/* Rating and Reviews */}
              {(selectedProduct.scrapedRating || selectedProduct.scrapedReviewCount) && (
                <div className="bg-gray-50 p-4 rounded-lg">
                  <h4 className="font-medium text-gray-900 mb-2">Customer Feedback</h4>
                  <div className="flex items-center space-x-4">
                    {selectedProduct.scrapedRating && (
                      <div className="flex items-center">
                        <span className="text-yellow-500 text-lg">★</span>
                        <span className="ml-1 font-medium text-lg">{selectedProduct.scrapedRating.toFixed(1)}</span>
                        <span className="text-gray-500 ml-1">/ 5</span>
                      </div>
                    )}
                    {selectedProduct.scrapedReviewCount && (
                      <div className="text-sm text-gray-600">
                        {selectedProduct.scrapedReviewCount} reviews
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Scraping Information */}
              <div className="bg-gray-50 p-4 rounded-lg">
                <h4 className="font-medium text-gray-900 mb-2">Scraping Status</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <span>Status:</span>
                      <span className={`font-medium ${
                        selectedProduct.scrapingStatus === 'success' ? 'text-green-600' :
                        selectedProduct.scrapingStatus === 'error' ? 'text-red-600' :
                        selectedProduct.scrapingStatus === 'scraping' ? 'text-blue-600' :
                        'text-gray-600'
                      }`}>
                        {selectedProduct.scrapingStatus}
                      </span>
                    </div>
                    {selectedProduct.lastScrapedAt && (
                      <div className="flex justify-between">
                        <span>Last Scraped:</span>
                        <span className="font-medium">
                          {new Date(selectedProduct.lastScrapedAt).toLocaleString()}
                        </span>
                      </div>
                    )}
                    {selectedProduct.scrapingDuration && (
                      <div className="flex justify-between">
                        <span>Duration:</span>
                        <span className="font-medium">{selectedProduct.scrapingDuration}ms</span>
                      </div>
                    )}
                  </div>
                  <div className="space-y-2">
                    {selectedProduct.proxyUsed && (
                      <div className="flex justify-between">
                        <span>Proxy Used:</span>
                        <span className="font-medium text-xs">{selectedProduct.proxyUsed}</span>
                      </div>
                    )}
                    {selectedProduct.scrapingErrorMessage && (
                      <div>
                        <div className="text-red-600 font-medium mb-1">Error Message:</div>
                        <div className="text-xs text-red-600 bg-red-50 p-2 rounded">
                          {selectedProduct.scrapingErrorMessage}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Recommended Actions */}
              {selectedProduct.recommendedAction && (
                <div className="bg-blue-50 p-4 rounded-lg">
                  <h4 className="font-medium text-blue-900 mb-2">Recommended Action</h4>
                  <p className="text-sm text-blue-800 capitalize">
                    {selectedProduct.recommendedAction.replace('_', ' ')}
                  </p>
                </div>
              )}

              {/* Action Buttons */}
              <div className="flex justify-end space-x-3 pt-4 border-t border-gray-200">
                <button
                  onClick={() => triggerScraping(selectedProduct.id)}
                  disabled={selectedProduct.scrapingStatus === 'scraping' || selectedProduct.scrapingStatus === 'queued'}
                  className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
                >
                  <FiRefreshCw className="h-4 w-4 mr-2" />
                  Refresh Data
                </button>
                <button
                  onClick={() => setShowProductModal(false)}
                  className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
