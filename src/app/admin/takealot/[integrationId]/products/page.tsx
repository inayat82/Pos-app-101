'use client';

import React, { useState, useEffect } from 'react';
import { FiSearch, FiRefreshCw, FiPackage, FiExternalLink, FiEye, FiFilter, FiX, FiEdit, FiTarget } from 'react-icons/fi';
import { useAuth } from '@/context/AuthContext';
import { usePageTitle } from '@/context/PageTitleContext';
import { db } from '@/lib/firebase/firebase';
import { collection, query, where, getDocs } from 'firebase/firestore';

interface Product {
  sku: string;
  title: string;
  price: number;
  sell_price?: number;
  rrp?: number;
  stock: number;
  status: string;
  image_url?: string;
  tsin_id?: string;
  // Additional fields for detailed view
  stock_dbn?: number;
  stock_cpt?: number;
  stock_jhb?: number;
  stock_on_way?: number;
  // New fields for enhanced functionality
  pos_barcode?: string;
  qty_require?: number; // estimated
  total_sold?: number;
  sold_30_days?: number;
  returned_30_days?: number;
  [key: string]: any;
}

export default function TakealotProductsPage({ params }: { params: Promise<{ integrationId: string }> }) {
  const { currentUser } = useAuth();
  const { setPageTitle } = usePageTitle();
  
  // Fix for Next.js 15 - params are now async
  const resolvedParams = React.use(params);
  const { integrationId } = resolvedParams;const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(100);const [showFilters, setShowFilters] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [showProductModal, setShowProductModal] = useState(false);  const [filters, setFilters] = useState({
    status: ['Buyable', 'Not Buyable'], // Default to show only Buyable and Not Buyable
  });
  const [tempFilters, setTempFilters] = useState({
    status: ['Buyable', 'Not Buyable'], // Temporary filters for the filter panel
  });  const [sortBy, setSortBy] = useState('sold_30_days');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

  useEffect(() => {
    setPageTitle('Takealot Products');
    return () => setPageTitle('');
  }, [setPageTitle]);

  useEffect(() => {
    if (currentUser && integrationId) {
      loadProducts();
    }
  }, [currentUser, integrationId]);

  const loadProducts = async () => {
    try {
      setLoading(true);
      console.log('Loading products for integration:', integrationId);

      // Try takealot_offers first
      const offersQuery = query(
        collection(db, 'takealot_offers'),
        where('integrationId', '==', integrationId)
      );
      
      const offersSnapshot = await getDocs(offersQuery);
      console.log('Found in takealot_offers:', offersSnapshot.size);      if (offersSnapshot.size > 0) {        const productData = offersSnapshot.docs.map(doc => {
          const data = doc.data();
          
          // Safely extract warehouse stock data from arrays
          const stockAtTakealot = data.stock_at_takealot || [];
          const stockOnWay = data.stock_on_way || [];
          const salesUnits = data.sales_units || [];
            return {
            sku: data.sku || data.product_label_number || 'N/A',
            title: data.title || 'Unnamed Product',
            price: data.selling_price || 0,
            sell_price: data.selling_price || 0,
            rrp: data.rrp || 0,
            stock: data.stock_at_takealot_total || 0,
            status: data.status || 'Unknown',
            image_url: data.image_url,
            tsin_id: data.tsin_id,
            // Additional fields for detailed view - extracted from arrays
            stock_dbn: stockAtTakealot.find((s: any) => s.warehouse?.name === 'DBN')?.quantity_available || 0,
            stock_cpt: stockAtTakealot.find((s: any) => s.warehouse?.name === 'CPT')?.quantity_available || 0,
            stock_jhb: stockAtTakealot.find((s: any) => s.warehouse?.name === 'JHB')?.quantity_available || 0,            stock_on_way: data.total_stock_on_way || 0,
            // POS integration fields
            pos_barcode: data.barcode || '', // Use API barcode as placeholder            // CALCULATED METRICS (prioritize TSIN-based calculations with debugging)
            qty_require: data.tsinCalculatedMetrics?.qtyRequire || data.calculatedMetrics?.qtyRequire || data.qtyRequire || 0,
            total_sold: data.tsinCalculatedMetrics?.totalSold || data.calculatedMetrics?.totalSold || data.totalSold || 0,
            sold_30_days: data.tsinCalculatedMetrics?.last30DaysSold || data.calculatedMetrics?.last30DaysSold || data.last30DaysSold || 0,
            returned_30_days: data.tsinCalculatedMetrics?.last30DaysReturn || data.calculatedMetrics?.last30DaysReturn || data.last30DaysReturn || 0,
            avg_selling_price: data.tsinCalculatedMetrics?.avgSellingPrice || data.calculatedMetrics?.avgSellingPrice || data.avgSellingPrice || data.selling_price || 0,
            return_rate: data.tsinCalculatedMetrics?.returnRate || data.calculatedMetrics?.returnRate || data.returnRate || 0,
            days_since_last_order: data.tsinCalculatedMetrics?.daysSinceLastOrder || data.calculatedMetrics?.daysSinceLastOrder || data.daysSinceLastOrder || 999,
            // Metadata for tracking calculations (IMPORTANT FOR DEBUGGING)
            calculation_method: data.calculationMethod || (data.tsinCalculatedMetrics ? 'TSIN-based' : 'Legacy'),
            metrics_last_calculated: data.tsinCalculatedMetrics?.lastCalculated || data.calculatedMetrics?.lastCalculated || null,
            has_tsin_metrics: !!data.tsinCalculatedMetrics,
            has_legacy_metrics: !!data.calculatedMetrics,
          };
        });
        setProducts(productData);
      } else {
        // Try takealotProducts as fallback
        const productsQuery = query(
          collection(db, 'takealotProducts'),
          where('integrationId', '==', integrationId)
        );
        
        const productsSnapshot = await getDocs(productsQuery);
        console.log('Found in takealotProducts:', productsSnapshot.size);        const productData = productsSnapshot.docs.map(doc => {
          const data = doc.data();
          
          // Safely extract warehouse stock data from arrays
          const stockAtTakealot = data.stock_at_takealot || [];
          const stockOnWay = data.stock_on_way || [];
          const salesUnits = data.sales_units || [];
            return {
            sku: data.sku || data.product_label_number || 'N/A',
            title: data.title || 'Unnamed Product',
            price: data.selling_price || 0,
            sell_price: data.selling_price || 0,
            rrp: data.rrp || 0,
            stock: data.stock_at_takealot_total || 0,
            status: data.status || 'Unknown',
            image_url: data.image_url,
            tsin_id: data.tsin_id,
            // Additional fields for detailed view - extracted from arrays
            stock_dbn: stockAtTakealot.find((s: any) => s.warehouse?.name === 'DBN')?.quantity_available || 0,
            stock_cpt: stockAtTakealot.find((s: any) => s.warehouse?.name === 'CPT')?.quantity_available || 0,
            stock_jhb: stockAtTakealot.find((s: any) => s.warehouse?.name === 'JHB')?.quantity_available || 0,
            stock_on_way: data.total_stock_on_way || 0,
            // POS integration fields
            pos_barcode: data.barcode || '', // Use API barcode as placeholder
            // CALCULATED METRICS (from database calculations)
            qty_require: data.qtyRequire || data.calculatedMetrics?.qtyRequire || 0,
            total_sold: data.totalSold || data.calculatedMetrics?.totalSold || 0,
            sold_30_days: data.last30DaysSold || data.calculatedMetrics?.last30DaysSold || 0,
            returned_30_days: data.last30DaysReturn || data.calculatedMetrics?.last30DaysReturn || 0,
            avg_selling_price: data.avgSellingPrice || data.calculatedMetrics?.avgSellingPrice || data.selling_price || 0,
            return_rate: data.returnRate || data.calculatedMetrics?.returnRate || 0,
            days_since_last_order: data.daysSinceLastOrder || data.calculatedMetrics?.daysSinceLastOrder || 999,
            // Metadata for tracking calculations
            metrics_last_calculated: data.metricsLastCalculated || data.calculatedMetrics?.lastCalculated || null,
          };});        
        // Set products with calculated data
        setProducts(productData);
      }

    } catch (error) {
      console.error('Error loading products:', error);
    } finally {
      setLoading(false);
    }  };

  // Enhanced filtering and sorting function
  const filteredAndSortedProducts = () => {
    let filtered = products.filter(product => {
      if (!searchTerm.trim()) {
        // When no search term, apply status filter
        const matchesStatus = filters.status.length === 0 || 
                             filters.status.some(status => 
                               product.status && typeof product.status === 'string' && 
                               product.status.toLowerCase().includes(status.toLowerCase())
                             );
        return matchesStatus;
      }
      
      const searchLower = searchTerm.toLowerCase();
      const matchesSearch = 
        (product.title && typeof product.title === 'string' && product.title.toLowerCase().includes(searchLower)) ||
        (product.sku && typeof product.sku === 'string' && product.sku.toLowerCase().includes(searchLower)) ||
        (product.tsin_id && String(product.tsin_id).toLowerCase().includes(searchLower)) ||
        (product.pos_barcode && typeof product.pos_barcode === 'string' && product.pos_barcode.toLowerCase().includes(searchLower));
      
      // Apply status filter along with search
      const matchesStatus = filters.status.length === 0 || 
                           filters.status.some(status => 
                             product.status && typeof product.status === 'string' && product.status.toLowerCase().includes(status.toLowerCase())
                           );

      return matchesSearch && matchesStatus;
    });

    // Apply sorting (default: sold_30_days desc to show most sold first)
    filtered.sort((a, b) => {
      let aValue: any, bValue: any;
      
      switch (sortBy) {
        case 'title':
          aValue = a.title.toLowerCase();
          bValue = b.title.toLowerCase();
          break;        case 'price':
          aValue = a.selling_price || a.sell_price || a.price || 0;
          bValue = b.selling_price || b.sell_price || b.price || 0;
          break;
        case 'rrp':
          aValue = a.rrp || 0;
          bValue = b.rrp || 0;
          break;
        case 'stock':
          aValue = a.stock || 0;
          bValue = b.stock || 0;
          break;
        case 'total_sold':
          aValue = a.total_sold || 0;
          bValue = b.total_sold || 0;
          break;
        case 'sold_30_days':
          aValue = a.sold_30_days || 0;
          bValue = b.sold_30_days || 0;
          break;
        case 'returned_30_days':
          aValue = a.returned_30_days || 0;
          bValue = b.returned_30_days || 0;
          break;
        case 'status':
          aValue = a.status.toLowerCase();
          bValue = b.status.toLowerCase();
          break;
        default:
          aValue = a.title.toLowerCase();
          bValue = b.title.toLowerCase();
      }

      if (typeof aValue === 'string') {
        return sortOrder === 'asc' ? aValue.localeCompare(bValue) : bValue.localeCompare(aValue);
      } else {
        return sortOrder === 'asc' ? aValue - bValue : bValue - aValue;
      }
    });

    return filtered;
  };

  // Handle column header click for sorting
  const handleSort = (column: string) => {
    if (sortBy === column) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(column);
      setSortOrder('desc');
    }
  };

  const filteredProducts = filteredAndSortedProducts();

  // Get status badge with proper colors
  const getStatusBadge = (status: string) => {
    const normalizedStatus = status.toLowerCase();
    let badgeClass = '';
    
    if (normalizedStatus.includes('buyable') && !normalizedStatus.includes('not')) {
      badgeClass = 'bg-blue-100 text-blue-800'; // buyable - blue
    } else if (normalizedStatus.includes('not') && normalizedStatus.includes('buyable')) {
      badgeClass = 'bg-orange-100 text-orange-800'; // not buyable - orange
    } else if (normalizedStatus.includes('disable') || normalizedStatus.includes('inactive')) {
      badgeClass = 'bg-red-100 text-red-800'; // disable - red
    } else if (normalizedStatus.includes('active')) {
      badgeClass = 'bg-green-100 text-green-800'; // active - green
    } else {
      badgeClass = 'bg-gray-100 text-gray-800'; // default
    }

    return (
      <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${badgeClass}`}>
        {status}
      </span>
    );
  };  // Clear all filters
  const clearFilters = () => {
    setFilters({
      status: ['Buyable', 'Not Buyable'], // Reset to default
    });
    setTempFilters({
      status: ['Buyable', 'Not Buyable'],
    });
  };

  // Apply filters function
  const applyFilters = () => {
    setFilters({...tempFilters});
    setShowFilters(false);
  };

  // Pagination calculations
  const totalPages = Math.ceil(filteredProducts.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const currentProducts = filteredProducts.slice(startIndex, endIndex);
  // Reset to page 1 when search changes
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, itemsPerPage, filters]);const openProduct = (product: Product) => {
    if (product.tsin_id) {
      window.open(`https://www.takealot.com/p/${product.tsin_id}`, '_blank');
    } else {
      // Fallback: try to construct URL from SKU or show alert
      console.log('No TSIN available for product:', product.sku);
    }
  };  const viewProductDetails = (product: Product) => {
    setSelectedProduct(product);
    setShowProductModal(true);
  };

  const editProduct = (product: Product) => {
    // TODO: Implement edit functionality later
    console.log('Edit product:', product.sku);
    alert(`Edit functionality for ${product.sku} will be implemented later`);
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p>Loading products...</p>
        </div>
      </div>
    );
  }
  return (
    <div className="flex h-full">
      {/* Main Content */}
      <div className={`flex-1 space-y-6 transition-all duration-300 ${showFilters ? 'mr-80' : ''}`}>
        {/* Header */}
        <div className="bg-white p-6 rounded-lg shadow-sm">
          <div className="flex justify-between items-center">            <div>
              <h1 className="text-2xl font-bold text-gray-900">Takealot Products</h1>
              <div className="flex items-center space-x-4">
                <p className="text-gray-600">
                  {filteredProducts.length} products found
                  {filteredProducts.length !== products.length && (
                    <span className="text-sm text-blue-600 ml-1">
                      (filtered from {products.length} total)
                    </span>
                  )}
                </p>
                {/* Active Filter Summary */}
                {filters.status.length > 0 && filters.status.length < 4 && (
                  <div className="flex items-center gap-1">
                    <span className="text-sm text-gray-500">Showing:</span>
                    {filters.status.map((status, index) => (
                      <span key={status} className="inline-flex items-center px-2 py-1 text-xs font-medium bg-blue-100 text-blue-800 rounded-full">
                        {status}
                      </span>
                    ))}
                  </div>                )}
              </div>
            </div><div className="flex items-center space-x-3">
              <button
                onClick={() => setShowFilters(!showFilters)}
                className={`flex items-center px-4 py-2 text-sm font-medium rounded-lg border transition-colors ${
                  showFilters ? 'bg-blue-50 text-blue-700 border-blue-200' : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
                }`}
              >
                <FiFilter className="mr-2" />
                Filters
                {filters.status.length > 0 && filters.status.length < 5 && (
                  <span className="ml-2 bg-blue-500 text-white text-xs rounded-full px-2 py-0.5">
                    {filters.status.length}
                  </span>
                )}
              </button>
              <button
                onClick={loadProducts}
                className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                <FiRefreshCw className="mr-2" />
                Refresh
              </button>
            </div>
          </div>
        </div>

        {/* Search Bar */}
        <div className="bg-white p-4 rounded-lg shadow-sm">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div className="relative flex-1 max-w-md">
              <FiSearch className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                placeholder="Search products, SKU, TSIN, or POS barcode..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              />
            </div>
            
            <div className="flex items-center gap-3">
              <span className="text-sm text-gray-700">Show:</span>
              <select
                value={itemsPerPage}
                onChange={(e) => setItemsPerPage(Number(e.target.value))}
                className="border border-gray-300 rounded-md px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500"
              >
                <option value={50}>50</option>
                <option value={100}>100</option>
                <option value={200}>200</option>
              </select>
              <span className="text-sm text-gray-700">per page</span>
            </div>
          </div>
        </div>

        {/* Products */}
        {filteredProducts.length === 0 ? (
          <div className="bg-white rounded-lg shadow-sm p-12 text-center">
            <FiPackage className="mx-auto h-12 w-12 text-gray-400 mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">No Products Found</h3>
            <p className="text-gray-500">
              {products.length === 0 
                ? 'Go to Settings to fetch product data from Takealot API.'
                : 'Try adjusting your search terms or filters.'}
            </p>
          </div>        ) : (
          <div className="bg-white rounded-lg shadow-sm overflow-hidden">
            {/* Sorting Info */}
            <div className="px-4 py-2 bg-gray-50 border-b border-gray-200">
              <p className="text-xs text-gray-600">
                <strong>Default sorting:</strong> Products ordered by most sold in last 30 days (highest first). 
                Click column headers to change sorting.
              </p>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">IMAGE</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      <button
                        onClick={() => handleSort('title')}
                        className="flex items-center hover:text-gray-700"
                      >
                        PRODUCT
                        {sortBy === 'title' && (
                          <span className="ml-1">{sortOrder === 'asc' ? '↑' : '↓'}</span>
                        )}
                      </button>
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">POS BARCODE</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      <button
                        onClick={() => handleSort('price')}
                        className="flex items-center hover:text-gray-700"
                      >
                        SELLING PRICE
                        {sortBy === 'price' && (
                          <span className="ml-1">{sortOrder === 'asc' ? '↑' : '↓'}</span>
                        )}
                      </button>
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      <button
                        onClick={() => handleSort('rrp')}
                        className="flex items-center hover:text-gray-700"
                      >
                        RRP
                        {sortBy === 'rrp' && (
                          <span className="ml-1">{sortOrder === 'asc' ? '↑' : '↓'}</span>
                        )}
                      </button>
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      <button
                        onClick={() => handleSort('stock')}
                        className="flex items-center hover:text-gray-700"
                      >
                        <span title="Stock at Takealot Total" className="cursor-help border-b border-dotted border-gray-400">
                          STK
                        </span>
                        {sortBy === 'stock' && (
                          <span className="ml-1">{sortOrder === 'asc' ? '↑' : '↓'}</span>
                        )}
                      </button>
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">QTY REQUIRE</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      <button
                        onClick={() => handleSort('total_sold')}
                        className="flex items-center hover:text-gray-700"
                      >
                        TOTAL SOLD
                        {sortBy === 'total_sold' && (
                          <span className="ml-1">{sortOrder === 'asc' ? '↑' : '↓'}</span>
                        )}
                      </button>
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      <button
                        onClick={() => handleSort('sold_30_days')}
                        className="flex items-center hover:text-gray-700"
                      >
                        30 DAYS SOLD
                        {sortBy === 'sold_30_days' && (
                          <span className="ml-1">{sortOrder === 'asc' ? '↑' : '↓'}</span>
                        )}
                      </button>
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      <button
                        onClick={() => handleSort('returned_30_days')}
                        className="flex items-center hover:text-gray-700"
                      >
                        30 DAYS RETURN
                        {sortBy === 'returned_30_days' && (
                          <span className="ml-1">{sortOrder === 'asc' ? '↑' : '↓'}</span>
                        )}
                      </button>
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      <button
                        onClick={() => handleSort('status')}
                        className="flex items-center hover:text-gray-700"
                      >
                        STATUS
                        {sortBy === 'status' && (
                          <span className="ml-1">{sortOrder === 'asc' ? '↑' : '↓'}</span>
                        )}
                      </button>
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">ACTIONS</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {currentProducts.map((product, index) => (
                    <tr key={product.sku || index} className="hover:bg-gray-50">
                      <td className="px-4 py-4">
                        {product.image_url ? (
                          <img
                            src={product.image_url}
                            alt={product.title}
                            className="h-12 w-12 rounded object-cover cursor-pointer hover:opacity-75 transition-opacity"
                            onClick={() => openProduct(product)}
                            title="Click to view on Takealot"
                            onError={(e) => {
                              (e.target as HTMLImageElement).style.display = 'none';
                            }}
                          />
                        ) : (
                          <div 
                            className="h-12 w-12 bg-gray-200 rounded flex items-center justify-center cursor-pointer hover:bg-gray-300 transition-colors"
                            onClick={() => openProduct(product)}
                            title="Click to view on Takealot"
                          >
                            <FiPackage className="text-gray-400" />
                          </div>
                        )}
                      </td>
                      
                      <td className="px-4 py-4">
                        <div>
                          <div 
                            className="font-medium text-gray-900 cursor-pointer hover:text-blue-600 hover:underline transition-colors"
                            onClick={() => openProduct(product)}
                            title="Click to view on Takealot"
                          >
                            {product.title}
                          </div>
                          <div className="text-sm text-gray-500">
                            SKU: {product.sku}
                            {product.tsin_id && (
                              <span className="ml-2">
                                | TSIN: <span 
                                  className="text-blue-600 cursor-pointer hover:underline"
                                  onClick={() => openProduct(product)}
                                  title="Click to view on Takealot"
                                >
                                  {product.tsin_id}
                                </span>
                              </span>
                            )}
                          </div>                        </div>
                      </td>

                      <td className="px-4 py-4 text-sm text-gray-900 font-mono">
                        {product.pos_barcode || '-'}
                      </td>
                      
                      <td className="px-4 py-4 text-sm font-medium text-gray-900">
                        R{(product.selling_price || product.sell_price || product.price || 0).toFixed(2)}
                      </td>
                      
                      <td className="px-4 py-4 text-sm text-gray-900">
                        R{(product.rrp || 0).toFixed(2)}
                      </td>
                      
                      <td className="px-4 py-4 text-sm text-gray-900">
                        <span className={`font-medium ${product.stock > 0 ? 'text-green-600' : 'text-red-600'}`}>
                          {product.stock}
                        </span>
                      </td>

                      <td className="px-4 py-4 text-sm text-gray-900">
                        <span className="text-orange-600 font-medium">
                          {product.qty_require || 0}
                        </span>
                      </td>                      <td className="px-4 py-4 text-sm text-gray-900 font-medium">
                        <div className="flex items-center space-x-2">
                          <span>{product.total_sold || 0}</span>
                          {product.has_tsin_metrics ? (
                            <span className="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium bg-green-100 text-green-800" title="TSIN-based calculation">
                              T
                            </span>
                          ) : product.has_legacy_metrics ? (
                            <span className="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium bg-orange-100 text-orange-800" title="Legacy calculation">
                              L
                            </span>
                          ) : (
                            <span className="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-800" title="No calculation">
                              -
                            </span>
                          )}
                        </div>
                      </td>

                      <td className="px-4 py-4 text-sm text-blue-600 font-medium">
                        <div className="flex items-center space-x-2">
                          <span>{product.sold_30_days || 0}</span>
                          {product.has_tsin_metrics ? (
                            <span className="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium bg-green-100 text-green-800" title="TSIN-based calculation">
                              T
                            </span>
                          ) : product.has_legacy_metrics ? (
                            <span className="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium bg-orange-100 text-orange-800" title="Legacy calculation">
                              L
                            </span>
                          ) : (
                            <span className="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-800" title="No calculation">
                              -
                            </span>
                          )}
                        </div>
                      </td>

                      <td className="px-4 py-4 text-sm text-red-600 font-medium">
                        <div className="flex items-center space-x-2">
                          <span>{product.returned_30_days || 0}</span>
                          {product.has_tsin_metrics ? (
                            <span className="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium bg-green-100 text-green-800" title="TSIN-based calculation">
                              T
                            </span>
                          ) : product.has_legacy_metrics ? (
                            <span className="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium bg-orange-100 text-orange-800" title="Legacy calculation">
                              L
                            </span>
                          ) : (
                            <span className="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-800" title="No calculation">
                              -
                            </span>
                          )}
                        </div>
                      </td>
                      
                      <td className="px-4 py-4">
                        {getStatusBadge(product.status)}
                      </td>

                      <td className="px-4 py-4">
                        <div className="flex items-center justify-center space-x-2">
                          <button
                            onClick={() => viewProductDetails(product)}
                            className="text-blue-600 hover:text-blue-900 p-2 hover:bg-blue-50 rounded-md transition-colors"
                            title="View detailed product information"
                          >
                            <FiEye className="h-4 w-4" />
                          </button>
                          <button
                            onClick={() => editProduct(product)}
                            className="text-gray-600 hover:text-gray-900 p-2 hover:bg-gray-50 rounded-md transition-colors"
                            title="Edit product (Coming Soon)"
                          >
                            <FiEdit className="h-4 w-4" />
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
              <div className="px-6 py-4 border-t border-gray-200 bg-gray-50 flex items-center justify-between">
                <div className="flex items-center text-sm text-gray-700">
                  <span>
                    Showing {startIndex + 1} to {Math.min(endIndex, filteredProducts.length)} of {filteredProducts.length} products
                  </span>
                </div>
                <div className="flex items-center space-x-2">
                  <button
                    onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                    disabled={currentPage === 1}
                    className="px-3 py-1 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Previous
                  </button>
                  <span className="px-3 py-1 text-sm font-medium text-gray-700">
                    Page {currentPage} of {totalPages}
                  </span>
                  <button
                    onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
                    disabled={currentPage === totalPages}
                    className="px-3 py-1 text-sm font-medium text-white bg-blue-600 border border-blue-600 rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Next
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Calculation Status Indicator */}
        {products.length > 0 && (
          <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-lg p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center">
                <FiTarget className="h-5 w-5 text-blue-600 mr-3" />
                <div>
                  <h4 className="text-sm font-semibold text-blue-900">Calculation Status Overview</h4>
                  <p className="text-xs text-blue-700 mt-1">
                    Showing calculation method distribution across your products
                  </p>
                </div>
              </div>
              <div className="text-xs text-blue-600 font-medium">
                {products.length} products loaded
              </div>
            </div>
            
            <div className="mt-3 grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="bg-white rounded-lg p-3 border border-blue-100">
                <div className="text-lg font-bold text-green-700">
                  {products.filter(p => p.has_tsin_metrics).length}
                </div>
                <div className="text-xs text-green-600">TSIN-based calculations</div>
                <div className="text-xs text-green-500 mt-1">⚡ Enhanced & faster</div>
              </div>
              <div className="bg-white rounded-lg p-3 border border-orange-100">
                <div className="text-lg font-bold text-orange-700">
                  {products.filter(p => p.has_legacy_metrics && !p.has_tsin_metrics).length}
                </div>
                <div className="text-xs text-orange-600">Legacy calculations only</div>
                <div className="text-xs text-orange-500 mt-1">📊 Needs upgrade</div>
              </div>
              <div className="bg-white rounded-lg p-3 border border-gray-100">
                <div className="text-lg font-bold text-gray-700">
                  {products.filter(p => !p.has_tsin_metrics && !p.has_legacy_metrics).length}
                </div>
                <div className="text-xs text-gray-600">No calculations</div>
                <div className="text-xs text-gray-500 mt-1">⚠️ Run recalculation</div>
              </div>
            </div>
            
            {products.filter(p => !p.has_tsin_metrics && !p.has_legacy_metrics).length > 0 && (
              <div className="mt-3 p-2 bg-yellow-50 border border-yellow-200 rounded text-xs text-yellow-800">
                <strong>Tip:</strong> Go to Reports → Product Performance and click "Recalc Metrics (TSIN)" to calculate missing metrics.
              </div>
            )}
          </div>
        )}
      </div>

      {/* Right Sidebar - Filters */}
      {showFilters && (
        <div className="fixed right-0 top-0 h-full w-80 bg-white shadow-2xl border-l border-gray-200 z-40 overflow-y-auto">
          <div className="p-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-semibold text-gray-900">Filters</h2>
              <button
                onClick={() => setShowFilters(false)}
                className="text-gray-400 hover:text-gray-600 p-1"
              >
                <FiX className="h-5 w-5" />
              </button>
            </div>            <div className="space-y-6">
              {/* Filter Info */}
              <div className="bg-blue-50 p-3 rounded-lg border border-blue-200">
                <p className="text-sm text-blue-800">
                  <strong>Default:</strong> Showing only "Buyable" and "Not Buyable" products to reduce load time.
                  Other statuses are hidden by default.
                </p>
              </div>

              {/* Status Filter */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-3">Product Status</label>
                <div className="space-y-2">
                  {['Buyable', 'Not Buyable', 'Disabled by Seller', 'Disabled by Takealot'].map((status) => (
                    <label key={status} className="flex items-center">
                      <input
                        type="checkbox"
                        checked={tempFilters.status.includes(status)}
                        onChange={(e) => {
                          const newStatus = e.target.checked
                            ? [...tempFilters.status, status]
                            : tempFilters.status.filter(s => s !== status);
                          setTempFilters({...tempFilters, status: newStatus});
                        }}
                        className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                      />
                      <span className="ml-2 text-sm text-gray-700">{status}</span>
                      {['Buyable', 'Not Buyable'].includes(status) && (
                        <span className="ml-2 text-xs text-blue-600">(default)</span>
                      )}
                    </label>
                  ))}
                </div>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="mt-6 pt-6 border-t border-gray-200 space-y-3">
              <button
                onClick={applyFilters}
                className="w-full flex items-center justify-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                Apply Filters
              </button>
              
              {(tempFilters.status.length !== 2 || !tempFilters.status.includes('Buyable') || !tempFilters.status.includes('Not Buyable')) && (
                <button
                  onClick={clearFilters}
                  className="w-full flex items-center justify-center px-4 py-2 text-sm text-gray-600 hover:text-gray-800 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
                >
                  <FiX className="mr-2 h-4 w-4" />
                  Reset to Default
                </button>
              )}
            </div>
          </div>
        </div>      )}

      {/* Product Details Modal */}
      {showProductModal && selectedProduct && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            {/* Modal Header */}
            <div className="flex items-center justify-between p-6 border-b border-gray-200">
              <h2 className="text-xl font-semibold text-gray-900">Product Details</h2>
              <button
                onClick={() => setShowProductModal(false)}
                className="text-gray-400 hover:text-gray-600 p-1"
              >
                <FiX className="h-6 w-6" />
              </button>
            </div>

            {/* Modal Content */}
            <div className="p-6">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Left Column - Basic Info */}
                <div className="space-y-6">
                  {/* Product Image */}
                  <div className="text-center">
                    {selectedProduct.image_url ? (
                      <img
                        src={selectedProduct.image_url}
                        alt={selectedProduct.title}
                        className="h-64 w-64 object-cover rounded-lg mx-auto shadow-md"
                        onError={(e) => {
                          (e.target as HTMLImageElement).src = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjU2IiBoZWlnaHQ9IjI1NiIgdmlld0JveD0iMCAwIDI1NiAyNTYiIGZpbGw9Im5vbmUiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+CjxyZWN0IHdpZHRoPSIyNTYiIGhlaWdodD0iMjU2IiBmaWxsPSIjRjNGNEY2Ii8+CjxwYXRoIGQ9Ik0xMjggODBDMTA0IDgwIDg0IDEwMCA4NCAxMjRWMTMyQzg0IDE1NiAxMDQgMTc2IDEyOCAxNzZDMTUyIDE3NiAxNzIgMTU2IDE3MiAxMzJWMTI0QzE3MiAxMDAgMTUyIDgwIDEyOCA4MFoiIGZpbGw9IiM5Q0E5QjQiLz4KPHA=';
                        }}
                      />
                    ) : (
                      <div className="h-64 w-64 bg-gray-200 rounded-lg mx-auto flex items-center justify-center">
                        <FiPackage className="h-16 w-16 text-gray-400" />
                      </div>
                    )}
                  </div>

                  {/* Basic Product Info */}
                  <div className="space-y-4">
                    <div>
                      <h3 className="text-lg font-semibold text-gray-900 mb-2">{selectedProduct.title}</h3>
                      <div className="space-y-2 text-sm">
                        <div className="flex justify-between">
                          <span className="text-gray-600">SKU:</span>
                          <span className="font-mono text-gray-900">{selectedProduct.sku}</span>
                        </div>
                        {selectedProduct.tsin_id && (
                          <div className="flex justify-between">
                            <span className="text-gray-600">TSIN:</span>
                            <span className="font-mono text-blue-600 cursor-pointer hover:underline"
                                  onClick={() => openProduct(selectedProduct)}>
                              {selectedProduct.tsin_id}
                            </span>
                          </div>
                        )}                        {selectedProduct.pos_barcode && (
                          <div className="flex justify-between">
                            <span className="text-gray-600">POS Barcode:</span>
                            <span className="font-mono text-gray-900">{selectedProduct.pos_barcode}</span>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Pricing Information */}
                    <div className="bg-gray-50 p-4 rounded-lg">
                      <h4 className="font-semibold text-gray-900 mb-3">Pricing</h4>
                      <div className="space-y-2">
                        <div className="flex justify-between">
                          <span className="text-gray-600">Selling Price:</span>
                          <span className="font-semibold text-green-600">
                            R{(selectedProduct.selling_price || selectedProduct.sell_price || selectedProduct.price || 0).toFixed(2)}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-600">RRP:</span>
                          <span className="font-semibold text-gray-900">
                            R{(selectedProduct.rrp || 0).toFixed(2)}
                          </span>
                        </div>                        {selectedProduct.rrp && selectedProduct.selling_price && selectedProduct.rrp > 0 && selectedProduct.selling_price > 0 && (
                          <div className="flex justify-between">
                            <span className="text-gray-600">Profit Margin:</span>
                            <span className="font-semibold text-blue-600">
                              {(((selectedProduct.rrp - (selectedProduct.selling_price || selectedProduct.sell_price || 0)) / selectedProduct.rrp) * 100).toFixed(1)}%
                            </span>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Right Column - Stock & Additional Info */}
                <div className="space-y-6">
                  {/* Stock Information */}
                  <div className="bg-blue-50 p-4 rounded-lg">
                    <h4 className="font-semibold text-gray-900 mb-3">Stock Information</h4>
                    <div className="space-y-3">
                      <div className="flex justify-between items-center">
                        <span className="text-gray-600">Total Stock:</span>
                        <span className={`font-bold text-lg ${selectedProduct.stock > 0 ? 'text-green-600' : 'text-red-600'}`}>
                          {selectedProduct.stock}
                        </span>
                      </div>
                      
                      <div className="border-t pt-3 space-y-2">
                        <div className="flex justify-between">
                          <span className="text-gray-600">Durban (DBN):</span>
                          <span className="font-semibold">
                            {selectedProduct.stock_dbn || 0}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-600">Cape Town (CPT):</span>
                          <span className="font-semibold">
                            {selectedProduct.stock_cpt || 0}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-600">Johannesburg (JHB):</span>
                          <span className="font-semibold">
                            {selectedProduct.stock_jhb || 0}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-600">Stock On The Way:</span>
                          <span className="font-semibold text-orange-600">
                            {selectedProduct.stock_on_way || 0}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Sales & Performance Data */}
                  <div className="bg-green-50 p-4 rounded-lg">
                    <h4 className="font-semibold text-gray-900 mb-3">Sales & Performance</h4>
                    <div className="space-y-2">
                      <div className="flex justify-between">
                        <span className="text-gray-600">Qty Required (Est.):</span>
                        <span className="font-semibold text-orange-600">
                          {selectedProduct.qty_require || 0}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-600">Total Sold:</span>
                        <span className="font-semibold text-gray-900">
                          {selectedProduct.total_sold || 0}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-600">30 Days Sold:</span>
                        <span className="font-semibold text-blue-600">
                          {selectedProduct.sold_30_days || 0}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-600">30 Days Returned:</span>
                        <span className="font-semibold text-red-600">
                          {selectedProduct.returned_30_days || 0}
                        </span>
                      </div>
                    </div>
                  </div>                  {/* POS Integration Data */}
                  {selectedProduct.pos_barcode && (
                    <div className="bg-purple-50 p-4 rounded-lg">
                      <h4 className="font-semibold text-gray-900 mb-3">POS Integration</h4>
                      <div className="space-y-2">
                        <div className="flex justify-between">
                          <span className="text-gray-600">POS Barcode:</span>
                          <span className="font-mono text-gray-900">{selectedProduct.pos_barcode}</span>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Modal Footer */}
              <div className="mt-6 pt-6 border-t border-gray-200 flex justify-between">
                <button
                  onClick={() => setShowProductModal(false)}
                  className="px-4 py-2 text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
                >
                  Close
                </button>
                {selectedProduct.tsin_id && (
                  <button
                    onClick={() => openProduct(selectedProduct)}
                    className="flex items-center px-4 py-2 bg-blue-600 text-white hover:bg-blue-700 rounded-lg transition-colors"
                  >
                    <FiExternalLink className="mr-2 h-4 w-4" />
                    View on Takealot
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
