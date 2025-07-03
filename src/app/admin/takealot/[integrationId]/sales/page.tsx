'use client';

import React, { useState, useEffect } from 'react';
import { FiSearch, FiRefreshCw, FiDollarSign, FiCalendar, FiPackage, FiEye, FiX, FiTrendingUp, FiShoppingCart, FiUsers, FiFilter, FiDownload } from 'react-icons/fi';
import { useAuth } from '@/context/AuthContext';
import { usePageTitle } from '@/context/PageTitleContext';
import { db } from '@/lib/firebase/firebase';
import { collection, query, where, getDocs } from 'firebase/firestore';

interface Sale {
  order_id: string;
  order_item_id?: string;
  product_title: string;
  customer_name: string;
  order_date: string;
  selling_price: number;
  quantity: number;
  status: string;
  tsin_id?: string;
  sku?: string;
  customer_dc?: string;
  dc?: string;
  takealot_url_mol?: string;
  success_fee?: number;
  total_fee?: number;
  stock_transfer_fee?: number;
  courier_collection_fee?: number;
  [key: string]: any;
}

interface Product {
  sku: string;
  tsin_id?: string;
  image_url?: string;
  [key: string]: any;
}

interface SalesAnalytics {
  totalSales: number;
  totalRevenue: number;
  averageOrderValue: number;
  totalQuantity: number;
  topProducts: Array<{
    product_title: string;
    sales_count: number;
    total_revenue: number;
  }>;
  salesByStatus: Record<string, number>;
  salesTrend: Array<{
    date: string;
    sales: number;
    revenue: number;
  }>;
}

export default function TakealotSalesPage({ params }: { params: Promise<{ integrationId: string }> }) {
  const { currentUser } = useAuth();
  const { setPageTitle } = usePageTitle();
  const [integrationId, setIntegrationId] = useState<string>('');

  useEffect(() => {
    const resolveParams = async () => {
      const resolvedParams = await params;
      setIntegrationId(resolvedParams.integrationId);
    };
    resolveParams();
  }, [params]);
  
  const [sales, setSales] = useState<Sale[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(100);
  const [products, setProducts] = useState<Product[]>([]);
  const [sortBy, setSortBy] = useState('order_date');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [selectedSale, setSelectedSale] = useState<Sale | null>(null);
  const [showSaleModal, setShowSaleModal] = useState(false);
  const [analytics, setAnalytics] = useState<SalesAnalytics | null>(null);
  const [dateFilter, setDateFilter] = useState({
    from: '',
    to: ''
  });
  const [statusFilter, setStatusFilter] = useState<string[]>([]);
  const [showFilters, setShowFilters] = useState(false);

  useEffect(() => {
    setPageTitle('Takealot Sales');
    return () => setPageTitle('');
  }, [setPageTitle]);
  useEffect(() => {
    if (currentUser && integrationId) {
      loadSales();
      loadProducts(); // Load products for image mapping
    }
  }, [currentUser, integrationId]);

  const loadProducts = async () => {
    try {
      console.log('Loading products for image mapping...');

      // Try takealot_offers first
      const offersQuery = query(
        collection(db, 'takealot_offers'),
        where('integrationId', '==', integrationId)
      );
      
      const offersSnapshot = await getDocs(offersQuery);
      
      if (offersSnapshot.size > 0) {
        const productData = offersSnapshot.docs.map(doc => {
          const data = doc.data();
          return {
            sku: data.sku || data.offer_id,
            tsin_id: data.tsin_id,
            image_url: data.image_url_1 || data.image_url,
            ...data
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
        
        const productData = productsSnapshot.docs.map(doc => {
          const data = doc.data();
          return {
            sku: data.sku,
            tsin_id: data.tsin_id,
            image_url: data.image_url_1 || data.image_url,
            ...data
          };
        });
        setProducts(productData);
      }

    } catch (error) {
      console.error('Error loading products:', error);
    }
  };

  // Calculate analytics from sales data
  const calculateAnalytics = (salesData: Sale[]): SalesAnalytics => {
    const totalSales = salesData.length;
    const totalRevenue = salesData.reduce((sum, sale) => sum + ((sale.selling_price || 0) * (sale.quantity || 0)), 0);
    const totalQuantity = salesData.reduce((sum, sale) => sum + (sale.quantity || 0), 0);
    const averageOrderValue = totalSales > 0 ? totalRevenue / totalSales : 0;

    // Top products by sales count
    const productSales: Record<string, { count: number; revenue: number }> = {};
    salesData.forEach(sale => {
      const key = sale.product_title || 'Unknown Product';
      if (!productSales[key]) {
        productSales[key] = { count: 0, revenue: 0 };
      }
      productSales[key].count += 1;
      productSales[key].revenue += (sale.selling_price || 0) * (sale.quantity || 0);
    });

    const topProducts = Object.entries(productSales)
      .map(([title, data]) => ({
        product_title: title,
        sales_count: data.count,
        total_revenue: data.revenue
      }))
      .sort((a, b) => b.sales_count - a.sales_count)
      .slice(0, 5);

    // Sales by status
    const salesByStatus: Record<string, number> = {};
    salesData.forEach(sale => {
      const status = sale.status || 'Unknown';
      salesByStatus[status] = (salesByStatus[status] || 0) + 1;
    });

    // Sales trend (last 30 days)
    const salesTrend: Array<{ date: string; sales: number; revenue: number }> = [];
    const last30Days = new Date();
    last30Days.setDate(last30Days.getDate() - 30);

    for (let i = 0; i < 30; i++) {
      const date = new Date(last30Days);
      date.setDate(date.getDate() + i);
      const dateStr = date.toISOString().split('T')[0];
      
      const daySales = salesData.filter(sale => {
        const saleDate = new Date(sale.order_date).toISOString().split('T')[0];
        return saleDate === dateStr;
      });

      salesTrend.push({
        date: dateStr,
        sales: daySales.length,
        revenue: daySales.reduce((sum, sale) => sum + ((sale.selling_price || 0) * (sale.quantity || 0)), 0)
      });
    }

    return {
      totalSales,
      totalRevenue,
      averageOrderValue,
      totalQuantity,
      topProducts,
      salesByStatus,
      salesTrend
    };
  };

  const loadSales = async () => {
    try {
      setLoading(true);
      
      console.log('Loading sales for integration:', integrationId);

      const salesQuery = query(
        collection(db, 'takealot_sales'),
        where('integrationId', '==', integrationId)
      );
      
      const salesSnapshot = await getDocs(salesQuery);
      
      if (salesSnapshot.size > 0) {
        const salesData = salesSnapshot.docs.map(doc => {
          const data = doc.data();
          return {
            order_id: data.order_id || '',
            order_item_id: data.order_item_id || '',
            product_title: data.product_title || '',
            customer_name: data.customer_name || '',
            order_date: data.order_date || '',
            selling_price: Number(data.selling_price) || 0,
            quantity: Number(data.quantity) || 0,
            status: data.status || '',
            tsin_id: data.tsin_id || '',
            sku: data.sku || '',
            customer_dc: data.customer_dc || data.dc || '',
            dc: data.customer_dc || data.dc || '',
            takealot_url_mol: data.takealot_url_mol || '',
            success_fee: data.success_fee || 0,
            total_fee: data.total_fee || 0,
            stock_transfer_fee: data.stock_transfer_fee || 0,
            courier_collection_fee: data.courier_collection_fee || 0,
            ...data
          };
        });
        
        const uniqueSales = salesData.filter((sale, index, self) => 
          index === self.findIndex(s => s.order_id === sale.order_id)
        );
        
        setSales(uniqueSales);
        setAnalytics(calculateAnalytics(uniqueSales));
      } else {
        console.log('No sales data found in takealot_sales collection');
        setSales([]);
        setAnalytics(null);
      }

    } catch (error) {
      console.error('Error loading sales:', error);
    } finally {
      setLoading(false);
    }
  };

  // Enhanced filtering function
  const filteredAndSortedSales = () => {
    let filtered = sales.filter(sale => {
      // Search filter
      if (searchTerm.trim()) {
        const searchLower = searchTerm.toLowerCase();
        const matches = (
          (sale.product_title && typeof sale.product_title === 'string' && sale.product_title.toLowerCase().includes(searchLower)) ||
          (sale.order_id && String(sale.order_id).toLowerCase().includes(searchLower)) ||
          (sale.customer_name && typeof sale.customer_name === 'string' && sale.customer_name.toLowerCase().includes(searchLower)) ||
          (sale.sku && typeof sale.sku === 'string' && sale.sku.toLowerCase().includes(searchLower)) ||
          (sale.tsin_id && String(sale.tsin_id).toLowerCase().includes(searchLower))
        );
        if (!matches) return false;
      }

      // Date filter
      if (dateFilter.from || dateFilter.to) {
        const saleDate = new Date(sale.order_date);
        if (dateFilter.from && saleDate < new Date(dateFilter.from)) return false;
        if (dateFilter.to && saleDate > new Date(dateFilter.to)) return false;
      }

      // Status filter
      if (statusFilter.length > 0 && !statusFilter.includes(sale.status)) {
        return false;
      }

      return true;
    });

    // Apply sorting
    filtered.sort((a, b) => {
      let aValue: any, bValue: any;
      
      switch (sortBy) {
        case 'order_date':
          aValue = new Date(a.order_date || 0).getTime();
          bValue = new Date(b.order_date || 0).getTime();
          break;
        case 'product_title':
          aValue = (a.product_title || '').toLowerCase();
          bValue = (b.product_title || '').toLowerCase();
          break;        case 'order_id':
          aValue = a.order_id || '';
          bValue = b.order_id || '';
          break;
        case 'customer_name':
          aValue = (a.customer_name || '').toLowerCase();
          bValue = (b.customer_name || '').toLowerCase();
          break;
        case 'selling_price':
          aValue = a.selling_price || 0;
          bValue = b.selling_price || 0;
          break;
        case 'quantity':
          aValue = a.quantity || 0;
          bValue = b.quantity || 0;
          break;
        case 'gross_sale':
          aValue = (a.selling_price || 0) * (a.quantity || 0);
          bValue = (b.selling_price || 0) * (b.quantity || 0);
          break;
        case 'status':
          aValue = (a.status || '').toLowerCase();
          bValue = (b.status || '').toLowerCase();
          break;
        default:
          aValue = new Date(a.order_date || 0).getTime();
          bValue = new Date(b.order_date || 0).getTime();
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

  const filteredSales = filteredAndSortedSales();

  // Pagination calculations
  const totalPages = Math.ceil(filteredSales.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const currentSales = filteredSales.slice(startIndex, endIndex);
  // Reset to page 1 when search changes
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, itemsPerPage]);

  // Helper function to find product image by TSIN or SKU
  const getProductImage = (sale: Sale): string | undefined => {
    if (sale.tsin_id) {
      const product = products.find(p => p.tsin_id === sale.tsin_id);
      if (product?.image_url) return product.image_url;
    }
    
    if (sale.sku) {
      const product = products.find(p => p.sku === sale.sku);
      if (product?.image_url) return product.image_url;
    }
    
    return undefined;
  };
  // Helper function to open product on Takealot
  const openProductOnTakealot = (sale: Sale) => {
    if (sale.tsin_id) {
      window.open(`https://www.takealot.com/p/${sale.tsin_id}`, '_blank');
    } else {
      console.log('No TSIN available for sale:', sale.order_id);
    }
  };

  // Helper function to view sale details
  const viewSaleDetails = (sale: Sale) => {
    setSelectedSale(sale);
    setShowSaleModal(true);
  };

  const formatDate = (dateString: string) => {
    try {
      const date = new Date(dateString);
      return date.toLocaleDateString();
    } catch {
      return dateString;
    }
  };

  const formatPrice = (price: number) => {
    return `R${price.toFixed(2)}`;
  };
  const totalSalesValue = currentSales.reduce((total, sale) => 
    total + (sale.selling_price * sale.quantity), 0
  );

  // Export sales data
  const exportSalesData = () => {
    const filteredSales = filteredAndSortedSales();
    const csvContent = [
      'Order ID,Product Title,Customer Name,Order Date,Selling Price,Quantity,Status,TSIN,SKU,DC',
      ...filteredSales.map(sale => [
        sale.order_id,
        `"${sale.product_title}"`,
        `"${sale.customer_name}"`,
        sale.order_date,
        sale.selling_price,
        sale.quantity,
        sale.status,
        sale.tsin_id,
        sale.sku,
        sale.dc
      ].join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `takealot-sales-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Takealot Sales</h1>
          <p className="text-gray-600 mt-1">Monitor your sales performance and revenue analytics</p>
        </div>
        <div className="flex space-x-2">
          <button
            onClick={exportSalesData}
            className="flex items-center px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
          >
            <FiDownload className="h-4 w-4 mr-2" />
            Export CSV
          </button>
          <button
            onClick={loadSales}
            className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            <FiRefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </button>
        </div>
      </div>

      {/* Analytics Dashboard */}
      {analytics && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="bg-white p-6 rounded-lg shadow">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Total Sales</p>
                <p className="text-2xl font-bold text-gray-900">{analytics.totalSales.toLocaleString()}</p>
              </div>
              <FiShoppingCart className="h-8 w-8 text-blue-600" />
            </div>
          </div>

          <div className="bg-white p-6 rounded-lg shadow">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Total Revenue</p>
                <p className="text-2xl font-bold text-green-600">R{analytics.totalRevenue.toLocaleString(undefined, { minimumFractionDigits: 2 })}</p>
              </div>
              <FiDollarSign className="h-8 w-8 text-green-600" />
            </div>
          </div>

          <div className="bg-white p-6 rounded-lg shadow">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Avg Order Value</p>
                <p className="text-2xl font-bold text-purple-600">R{analytics.averageOrderValue.toLocaleString(undefined, { minimumFractionDigits: 2 })}</p>
              </div>
              <FiTrendingUp className="h-8 w-8 text-purple-600" />
            </div>
          </div>

          <div className="bg-white p-6 rounded-lg shadow">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Total Quantity</p>
                <p className="text-2xl font-bold text-orange-600">{analytics.totalQuantity.toLocaleString()}</p>
              </div>
              <FiPackage className="h-8 w-8 text-orange-600" />
            </div>
          </div>
        </div>
      )}

      {/* Filters and Search */}
      <div className="bg-white p-4 rounded-lg shadow">
        <div className="flex flex-col md:flex-row gap-4">
          <div className="flex-1">
            <div className="relative">
              <FiSearch className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
              <input
                type="text"
                placeholder="Search by product title, order ID, customer name, SKU, or TSIN..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 pr-4 py-2 w-full border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
          </div>
          
          <button
            onClick={() => setShowFilters(!showFilters)}
            className="flex items-center px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
          >
            <FiFilter className="h-4 w-4 mr-2" />
            Filters
          </button>
        </div>

        {showFilters && (
          <div className="mt-4 p-4 bg-gray-50 rounded-lg">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">From Date</label>
                <input
                  type="date"
                  value={dateFilter.from}
                  onChange={(e) => setDateFilter(prev => ({ ...prev, from: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">To Date</label>
                <input
                  type="date"
                  value={dateFilter.to}
                  onChange={(e) => setDateFilter(prev => ({ ...prev, to: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
                <select
                  multiple
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(Array.from(e.target.selectedOptions, option => option.value))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  {analytics && Object.keys(analytics.salesByStatus).map(status => (
                    <option key={status} value={status}>{status}</option>
                  ))}
                </select>
              </div>
            </div>
            <div className="mt-3 flex justify-end space-x-2">
              <button
                onClick={() => {
                  setDateFilter({ from: '', to: '' });
                  setStatusFilter([]);
                }}
                className="px-4 py-2 text-gray-600 hover:text-gray-800 transition-colors"
              >
                Clear Filters
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Sales */}
      {filteredSales.length === 0 ? (
        <div className="bg-white rounded-lg shadow-sm p-12 text-center">
          <FiDollarSign className="mx-auto h-12 w-12 text-gray-400 mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">No Sales Found</h3>
          <p className="text-gray-500">
            {sales.length === 0 
              ? 'Go to Settings to fetch sales data from Takealot API.'
              : 'Try adjusting your search terms.'}
          </p>
        </div>
      ) : (        <div className="bg-white rounded-lg shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Image</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    <button
                      onClick={() => handleSort('order_date')}
                      className="flex items-center hover:text-gray-700"
                    >
                      Order Date
                      {sortBy === 'order_date' && (
                        <span className="ml-1">{sortOrder === 'asc' ? '↑' : '↓'}</span>
                      )}
                    </button>
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    <button
                      onClick={() => handleSort('product_title')}
                      className="flex items-center hover:text-gray-700"
                    >
                      Title
                      {sortBy === 'product_title' && (
                        <span className="ml-1">{sortOrder === 'asc' ? '↑' : '↓'}</span>
                      )}
                    </button>
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    <button
                      onClick={() => handleSort('order_id')}
                      className="flex items-center hover:text-gray-700"
                    >
                      Order ID
                      {sortBy === 'order_id' && (
                        <span className="ml-1">{sortOrder === 'asc' ? '↑' : '↓'}</span>
                      )}
                    </button>
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    <button
                      onClick={() => handleSort('selling_price')}
                      className="flex items-center hover:text-gray-700"
                    >
                      Selling Price
                      {sortBy === 'selling_price' && (
                        <span className="ml-1">{sortOrder === 'asc' ? '↑' : '↓'}</span>
                      )}
                    </button>
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    <button
                      onClick={() => handleSort('gross_sale')}
                      className="flex items-center hover:text-gray-700"
                    >
                      Gross Sale
                      {sortBy === 'gross_sale' && (
                        <span className="ml-1">{sortOrder === 'asc' ? '↑' : '↓'}</span>
                      )}
                    </button>
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    <button
                      onClick={() => handleSort('quantity')}
                      className="flex items-center hover:text-gray-700"
                    >
                      Quantity
                      {sortBy === 'quantity' && (
                        <span className="ml-1">{sortOrder === 'asc' ? '↑' : '↓'}</span>
                      )}
                    </button>
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    <button
                      onClick={() => handleSort('status')}
                      className="flex items-center hover:text-gray-700"
                    >
                      Sale Status
                      {sortBy === 'status' && (
                        <span className="ml-1">{sortOrder === 'asc' ? '↑' : '↓'}</span>
                      )}
                    </button>
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    <button
                      onClick={() => handleSort('customer_name')}
                      className="flex items-center hover:text-gray-700"
                    >
                      Customer Name
                      {sortBy === 'customer_name' && (
                        <span className="ml-1">{sortOrder === 'asc' ? '↑' : '↓'}</span>
                      )}
                    </button>
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">DC</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
                </tr>
              </thead>              <tbody className="divide-y divide-gray-200">
                {currentSales.map((sale, index) => {
                  const productImage = getProductImage(sale);
                  const grossSale = (sale.selling_price || 0) * (sale.quantity || 0);
                  
                  return (
                    <tr key={`${sale.order_id}-${sale.order_item_id || index}`} className="hover:bg-gray-50">
                      {/* Product Image */}
                      <td className="px-4 py-4">
                        {productImage ? (
                          <img
                            src={productImage}
                            alt={sale.product_title}
                            className="h-10 w-10 rounded object-cover cursor-pointer hover:opacity-75 transition-opacity"
                            onClick={() => openProductOnTakealot(sale)}
                            title="Click to view on Takealot"
                            onError={(e) => {
                              (e.target as HTMLImageElement).style.display = 'none';
                            }}
                          />
                        ) : (
                          <div 
                            className="h-10 w-10 bg-gray-200 rounded flex items-center justify-center cursor-pointer hover:bg-gray-300 transition-colors"
                            onClick={() => openProductOnTakealot(sale)}
                            title={sale.tsin_id ? "Click to view on Takealot" : "No image available"}
                          >
                            <FiPackage className="text-gray-400" />
                          </div>
                        )}
                      </td>
                      
                      {/* Order Date */}
                      <td className="px-4 py-4 text-sm text-gray-900">
                        <div className="flex items-center">
                          <FiCalendar className="mr-1 text-gray-400" />
                          {formatDate(sale.order_date)}
                        </div>
                      </td>
                      
                      {/* Product Title with TSIN and SKU */}
                      <td className="px-4 py-4">
                        <div>
                          <div 
                            className="text-sm font-medium text-gray-900 max-w-xs truncate cursor-pointer hover:text-blue-600 hover:underline transition-colors"
                            onClick={() => openProductOnTakealot(sale)}
                            title={sale.tsin_id ? "Click to view on Takealot" : sale.product_title}
                          >
                            {sale.product_title}
                          </div>                          <div className="text-xs text-gray-500 space-y-1">
                            {sale.sku && (
                              <div className="font-mono">SKU: {sale.sku}</div>
                            )}
                            {sale.tsin_id && (
                              <div className="font-mono">TSIN: {sale.tsin_id}</div>
                            )}
                          </div>
                        </div>
                      </td>
                      
                      {/* Order ID */}
                      <td className="px-4 py-4 text-sm font-medium text-gray-900 font-mono">
                        {sale.order_id}
                      </td>
                      
                      {/* Selling Price */}
                      <td className="px-4 py-4 text-sm text-gray-900 font-medium">
                        {formatPrice(sale.selling_price)}
                      </td>
                      
                      {/* Gross Sale */}
                      <td className="px-4 py-4 text-sm font-bold text-green-600">
                        {formatPrice(grossSale)}
                      </td>
                      
                      {/* Quantity */}
                      <td className="px-4 py-4 text-sm text-gray-900 text-center">
                        <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                          {sale.quantity}
                        </span>
                      </td>
                      
                      {/* Sale Status */}
                      <td className="px-4 py-4">
                        <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                          sale.status === 'Completed' || sale.status === 'completed' || sale.status === 'Complete' || sale.status === 'Shipped to Customer'
                            ? 'bg-green-100 text-green-800'
                            : sale.status === 'Pending' || sale.status === 'pending' || sale.status === 'Preparing for Customer'
                            ? 'bg-yellow-100 text-yellow-800'
                            : sale.status === 'New Lead Time Order' || sale.status === 'Inter DC Transfer'
                            ? 'bg-blue-100 text-blue-800'
                            : 'bg-red-100 text-red-800'
                        }`}>
                          {sale.status}
                        </span>
                      </td>
                      
                      {/* Customer Name */}
                      <td className="px-4 py-4 text-sm text-gray-900">
                        {sale.customer_name}
                      </td>
                      
                      {/* DC - Distribution Center */}
                      <td className="px-4 py-4 text-sm text-gray-900">
                        {sale.dc || sale.customer_dc || '-'}
                      </td>
                      
                      {/* Actions - View Details */}
                      <td className="px-4 py-4">
                        <button
                          onClick={() => viewSaleDetails(sale)}
                          className="inline-flex items-center px-2 py-1 text-xs font-medium text-blue-600 bg-blue-100 rounded hover:bg-blue-200 transition-colors"
                          title="View sale details"
                        >
                          <FiEye className="mr-1" />
                          View
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>          
          {/* Pagination */}
          {totalPages > 1 && (
            <div className="px-6 py-4 border-t border-gray-200 bg-gray-50 flex items-center justify-between">
              <div className="flex items-center text-sm text-gray-700">
                <span>
                  Showing {startIndex + 1} to {Math.min(endIndex, filteredSales.length)} of {filteredSales.length} sales
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
          )}        </div>
      )}

      {/* Sale Details Modal */}
      {showSaleModal && selectedSale && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            {/* Modal Header */}
            <div className="flex items-center justify-between p-6 border-b border-gray-200">
              <h2 className="text-xl font-semibold text-gray-900">Sale Details</h2>
              <button
                onClick={() => setShowSaleModal(false)}
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
                  {/* Product Info */}
                  <div>
                    <h3 className="text-lg font-medium text-gray-900 mb-4">Product Information</h3>
                    <div className="space-y-3">
                      <div>
                        <label className="block text-sm font-medium text-gray-700">Product Title</label>
                        <p className="mt-1 text-sm text-gray-900">{selectedSale.product_title}</p>
                      </div>
                      {selectedSale.tsin_id && (
                        <div>
                          <label className="block text-sm font-medium text-gray-700">TSIN</label>
                          <p className="mt-1 text-sm text-gray-900 font-mono">{selectedSale.tsin_id}</p>
                        </div>
                      )}
                      {selectedSale.sku && (
                        <div>
                          <label className="block text-sm font-medium text-gray-700">SKU</label>
                          <p className="mt-1 text-sm text-gray-900 font-mono">{selectedSale.sku}</p>
                        </div>
                      )}
                      {selectedSale.takealot_url_mol && (
                        <div>
                          <label className="block text-sm font-medium text-gray-700">Takealot URL</label>
                          <a 
                            href={selectedSale.takealot_url_mol} 
                            target="_blank" 
                            rel="noopener noreferrer"
                            className="mt-1 text-sm text-blue-600 hover:text-blue-800 underline"
                          >
                            View on Takealot
                          </a>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Order Info */}
                  <div>
                    <h3 className="text-lg font-medium text-gray-900 mb-4">Order Information</h3>
                    <div className="space-y-3">
                      <div>
                        <label className="block text-sm font-medium text-gray-700">Order ID</label>
                        <p className="mt-1 text-sm text-gray-900 font-mono">{selectedSale.order_id}</p>
                      </div>
                      {selectedSale.order_item_id && (
                        <div>
                          <label className="block text-sm font-medium text-gray-700">Order Item ID</label>
                          <p className="mt-1 text-sm text-gray-900 font-mono">{selectedSale.order_item_id}</p>
                        </div>
                      )}
                      <div>
                        <label className="block text-sm font-medium text-gray-700">Order Date</label>
                        <p className="mt-1 text-sm text-gray-900">{formatDate(selectedSale.order_date)}</p>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700">Status</label>
                        <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                          selectedSale.status === 'Completed' || selectedSale.status === 'completed' || selectedSale.status === 'Complete' || selectedSale.status === 'Shipped to Customer'
                            ? 'bg-green-100 text-green-800'
                            : selectedSale.status === 'Pending' || selectedSale.status === 'pending' || selectedSale.status === 'Preparing for Customer'
                            ? 'bg-yellow-100 text-yellow-800'
                            : selectedSale.status === 'New Lead Time Order' || selectedSale.status === 'Inter DC Transfer'
                            ? 'bg-blue-100 text-blue-800'
                            : 'bg-red-100 text-red-800'
                        }`}>
                          {selectedSale.status}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Right Column - Financial & Customer Info */}
                <div className="space-y-6">
                  {/* Financial Info */}
                  <div>
                    <h3 className="text-lg font-medium text-gray-900 mb-4">Financial Information</h3>
                    <div className="space-y-3">
                      <div>
                        <label className="block text-sm font-medium text-gray-700">Selling Price</label>
                        <p className="mt-1 text-sm text-gray-900 font-bold">{formatPrice(selectedSale.selling_price)}</p>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700">Quantity</label>
                        <p className="mt-1 text-sm text-gray-900">{selectedSale.quantity}</p>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700">Gross Sale</label>
                        <p className="mt-1 text-sm text-green-600 font-bold">
                          {formatPrice((selectedSale.selling_price || 0) * (selectedSale.quantity || 0))}
                        </p>
                      </div>                      {(selectedSale.success_fee || 0) > 0 && (
                        <div>
                          <label className="block text-sm font-medium text-gray-700">Success Fee</label>
                          <p className="mt-1 text-sm text-gray-900">{formatPrice(selectedSale.success_fee || 0)}</p>
                        </div>
                      )}
                      {(selectedSale.total_fee || 0) > 0 && (
                        <div>
                          <label className="block text-sm font-medium text-gray-700">Total Fee</label>
                          <p className="mt-1 text-sm text-gray-900">{formatPrice(selectedSale.total_fee || 0)}</p>
                        </div>
                      )}
                      {(selectedSale.stock_transfer_fee || 0) > 0 && (
                        <div>
                          <label className="block text-sm font-medium text-gray-700">Stock Transfer Fee</label>
                          <p className="mt-1 text-sm text-gray-900">{formatPrice(selectedSale.stock_transfer_fee || 0)}</p>
                        </div>
                      )}
                      {(selectedSale.courier_collection_fee || 0) > 0 && (
                        <div>
                          <label className="block text-sm font-medium text-gray-700">Courier Collection Fee</label>
                          <p className="mt-1 text-sm text-gray-900">{formatPrice(selectedSale.courier_collection_fee || 0)}</p>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Customer & Logistics Info */}
                  <div>
                    <h3 className="text-lg font-medium text-gray-900 mb-4">Customer & Logistics</h3>
                    <div className="space-y-3">
                      <div>
                        <label className="block text-sm font-medium text-gray-700">Customer Name</label>
                        <p className="mt-1 text-sm text-gray-900">{selectedSale.customer_name}</p>
                      </div>
                      {selectedSale.dc && (
                        <div>
                          <label className="block text-sm font-medium text-gray-700">Distribution Center</label>
                          <p className="mt-1 text-sm text-gray-900">{selectedSale.dc}</p>
                        </div>
                      )}
                      {selectedSale.customer_dc && selectedSale.customer_dc !== selectedSale.dc && (
                        <div>
                          <label className="block text-sm font-medium text-gray-700">Customer DC</label>
                          <p className="mt-1 text-sm text-gray-900">{selectedSale.customer_dc}</p>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="mt-6 pt-6 border-t border-gray-200 flex justify-end space-x-3">
                {selectedSale.takealot_url_mol && (
                  <button
                    onClick={() => window.open(selectedSale.takealot_url_mol, '_blank')}
                    className="px-4 py-2 text-sm font-medium text-blue-600 bg-blue-100 border border-blue-300 rounded-md hover:bg-blue-200 transition-colors"
                  >
                    View on Takealot
                  </button>
                )}
                <button
                  onClick={() => setShowSaleModal(false)}
                  className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 transition-colors"
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
