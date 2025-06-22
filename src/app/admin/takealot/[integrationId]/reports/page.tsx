'use client';

import React, { useState, useEffect } from 'react';
import { 
  FiBarChart, 
  FiTrendingUp, 
  FiDollarSign, 
  FiPackage, 
  FiCalendar, 
  FiDownload, 
  FiRefreshCw,
  FiPieChart,
  FiActivity,
  FiTarget
} from 'react-icons/fi';
import { useAuth } from '@/context/AuthContext';
import { usePageTitle } from '@/context/PageTitleContext';
import { db } from '@/lib/firebase/firebase';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { calculateBatchSalesMetrics } from '@/lib/salesCalculationService';

interface ReportData {
  message: string;
  timestamp: string;
}

interface ProductPerformanceData {
  image_url?: string;
  title: string;
  tsin_id?: string;
  sku: string;
  avgSellingPrice: number;
  totalSold: number;
  totalReturn: number;
  last30DaysSold: number;
  last30DaysReturn: number;
  daysSinceLastOrder: number;
  returnRate: number;
  qtyRequire: number;
  stock: number;
}

export default function TakealotReportsPage({ params }: { params: { integrationId: string } }) {
  const { currentUser } = useAuth();
  const { setPageTitle } = usePageTitle();
  const { integrationId } = params;
  const [loading, setLoading] = useState(false);
  const [reportData, setReportData] = useState<ReportData | null>(null);
  const [selectedDateRange, setSelectedDateRange] = useState('30days');  const [selectedReportType, setSelectedReportType] = useState('overview');
  const [productPerformanceData, setProductPerformanceData] = useState<ProductPerformanceData[]>([]);
  const [loadingProducts, setLoadingProducts] = useState(false);
  const [showReport, setShowReport] = useState(false);
  const [cardLoading, setCardLoading] = useState<string | null>(null);
  useEffect(() => {
    setPageTitle('Takealot Reports');
    return () => setPageTitle('');
  }, [setPageTitle]);

  // Load product performance data when report type is products
  useEffect(() => {
    if (selectedReportType === 'products' && currentUser && integrationId) {
      loadProductPerformanceData();
    }
  }, [selectedReportType, currentUser, integrationId, selectedDateRange]);

  // Function to calculate days since last order
  const calculateDaysSinceLastOrder = async (sku: string, tsinId?: string): Promise<number> => {
    try {
      const salesCollections = ['takealotSales', 'takealot_sales', 'sales'];
      let latestOrderDate: Date | null = null;

      for (const collectionName of salesCollections) {
        try {
          const queries = [];
          
          if (sku && sku !== 'N/A') {
            queries.push(
              query(
                collection(db, collectionName),
                where('integrationId', '==', integrationId),
                where('sku', '==', sku)
              ),
              query(
                collection(db, collectionName),
                where('integrationId', '==', integrationId),
                where('product_sku', '==', sku)
              )
            );
          }

          if (tsinId) {
            queries.push(
              query(
                collection(db, collectionName),
                where('integrationId', '==', integrationId),
                where('tsin_id', '==', tsinId)
              )
            );
          }          for (const salesQuery of queries) {
            const snapshot = await getDocs(salesQuery);
            snapshot.forEach(doc => {
              const sale = doc.data();
              const orderDate = sale.order_date || sale.sale_date;              if (orderDate) {
                const date = new Date(orderDate);
                if (!isNaN(date.getTime())) {
                  if (latestOrderDate === null || date.getTime() > latestOrderDate.getTime()) {
                    latestOrderDate = date;
                  }
                }
              }
            });
          }
        } catch (error) {
          console.warn(`Could not query collection ${collectionName}:`, error);
        }      }      if (latestOrderDate) {
        const now = new Date();
        const diffTime = Math.abs(now.getTime() - (latestOrderDate as Date).getTime());
        return Math.ceil(diffTime / (1000 * 60 * 60 * 24)); // Convert to days
      }

      return 999; // Return high number if no orders found
    } catch (error) {
      console.error('Error calculating days since last order:', error);
      return 999;
    }
  };

  // Function to load product performance data
  const loadProductPerformanceData = async () => {
    setLoadingProducts(true);
    try {
      console.log('Loading product performance data for integration:', integrationId);

      // Load products from takealot_offers first, then fallback to takealotProducts
      let products: any[] = [];
      
      const offersQuery = query(
        collection(db, 'takealot_offers'),
        where('integrationId', '==', integrationId)
      );
      
      const offersSnapshot = await getDocs(offersQuery);
      
      if (offersSnapshot.size > 0) {
        products = offersSnapshot.docs.map(doc => {
          const data = doc.data();
          const stockAtTakealot = data.stock_at_takealot || [];
          
          return {
            sku: data.sku || data.product_label_number || 'N/A',
            title: data.title || 'Unnamed Product',
            price: data.selling_price || 0,
            stock: data.stock_at_takealot_total || 0,
            image_url: data.image_url,
            tsin_id: data.tsin_id,
          };
        });
      } else {
        // Fallback to takealotProducts
        const productsQuery = query(
          collection(db, 'takealotProducts'),
          where('integrationId', '==', integrationId)
        );
        
        const productsSnapshot = await getDocs(productsQuery);
        products = productsSnapshot.docs.map(doc => {
          const data = doc.data();
          
          return {
            sku: data.sku || data.product_label_number || 'N/A',
            title: data.title || 'Unnamed Product',
            price: data.selling_price || 0,
            stock: data.stock_at_takealot_total || 0,
            image_url: data.image_url,
            tsin_id: data.tsin_id,
          };
        });
      }

      if (products.length === 0) {
        console.log('No products found for integration');
        setProductPerformanceData([]);
        return;
      }

      console.log(`Found ${products.length} products, calculating sales metrics...`);

      // Prepare data for batch sales metrics calculation
      const productMetrics = products.map(product => ({
        sku: product.sku,
        tsin_id: product.tsin_id,
        stock: product.stock
      }));

      // Calculate sales metrics in batches
      const salesMetricsMap = await calculateBatchSalesMetrics(integrationId, productMetrics);

      // Calculate performance data for each product
      const performanceData: ProductPerformanceData[] = [];
      
      for (const product of products) {
        const metrics = salesMetricsMap.get(product.sku);
        const daysSinceLastOrder = await calculateDaysSinceLastOrder(product.sku, product.tsin_id);
        
        const totalSold = metrics?.totalSold || 0;
        const totalReturn = metrics?.returned30Days || 0; // Using 30 days return as proxy for total returns
        const returnRate = totalSold > 0 ? (totalReturn / totalSold) * 100 : 0;

        performanceData.push({
          image_url: product.image_url,
          title: product.title,
          tsin_id: product.tsin_id,
          sku: product.sku,
          avgSellingPrice: product.price || product.selling_price || 0,
          totalSold: totalSold,
          totalReturn: totalReturn,
          last30DaysSold: metrics?.sold30Days || 0,
          last30DaysReturn: metrics?.returned30Days || 0,
          daysSinceLastOrder: daysSinceLastOrder,
          returnRate: Math.round(returnRate * 100) / 100, // Round to 2 decimal places
          qtyRequire: metrics?.qtyRequire || 0,
          stock: product.stock
        });
      }

      // Sort by total sold (descending) to show best performers first
      performanceData.sort((a, b) => b.totalSold - a.totalSold);

      setProductPerformanceData(performanceData);
      console.log(`Product performance data loaded for ${performanceData.length} products`);

    } catch (error) {
      console.error('Error loading product performance data:', error);
      setProductPerformanceData([]);
    } finally {
      setLoadingProducts(false);
    }
  };
  // Enhanced report generation function
  const generateReport = async () => {
    setLoading(true);
    try {
      console.log('Generating report for integration:', integrationId);
      console.log('Date range:', selectedDateRange);
      console.log('Report type:', selectedReportType);
      
      if (selectedReportType === 'products') {
        // For product reports, trigger the loadProductPerformanceData function
        await loadProductPerformanceData();
        setReportData({
          message: `Product Performance Report generated with ${productPerformanceData.length} products`,
          timestamp: new Date().toISOString()
        });
      } else {
        // Simulate loading for other report types
        await new Promise(resolve => setTimeout(resolve, 1500));
        
        setReportData({
          message: 'Report generation will be implemented in the future for this report type',
          timestamp: new Date().toISOString()
        });
      }
    } catch (error) {
      console.error('Error generating report:', error);
      setReportData({
        message: 'Error generating report. Please try again.',
        timestamp: new Date().toISOString()
      });    } finally {
      setLoading(false);
    }
  };
  // Function to handle report card clicks
  const handleReportCardClick = async (reportTypeId: string) => {
    // Navigate to dedicated report view page
    const reportTypeMap: { [key: string]: string } = {
      'overview': 'sales-overview',
      'products': 'product-performance',
      'trends': 'sales-trends',
      'profitability': 'profitability',
      'inventory': 'inventory',
      'returns': 'returns'
    };
    
    const reportType = reportTypeMap[reportTypeId] || reportTypeId;
    window.location.href = `/admin/takealot/${integrationId}/reports/${reportType}`;
  };

  // Function to view the selected report
  const viewSelectedReport = () => {
    // Navigate to dedicated report view page
    const reportTypeMap: { [key: string]: string } = {
      'overview': 'sales-overview',
      'products': 'product-performance',
      'trends': 'sales-trends',
      'profitability': 'profitability',
      'inventory': 'inventory',
      'returns': 'returns'
    };
    
    const reportType = reportTypeMap[selectedReportType] || selectedReportType;
    window.location.href = `/admin/takealot/${integrationId}/reports/${reportType}`;
  };
  // Function to clear/reset the current report
  const clearReport = () => {
    setShowReport(false);
    setReportData(null);
    setProductPerformanceData([]);
    setCardLoading(null);
  };

  const reportTypes = [
    {
      id: 'overview',
      name: 'Sales Overview',
      description: 'General sales performance metrics',
      icon: FiBarChart,
      color: 'bg-blue-500'
    },
    {
      id: 'products',
      name: 'Product Performance',
      description: 'Top selling products and inventory analysis',
      icon: FiPackage,
      color: 'bg-green-500'
    },    {
      id: 'trends',
      name: 'Sales Trends',
      description: 'Historical sales trends and patterns',
      icon: FiTrendingUp,
      color: 'bg-purple-500'
    },
    {
      id: 'profitability',
      name: 'Profitability Analysis',
      description: 'Profit margins and financial performance',
      icon: FiDollarSign,
      color: 'bg-yellow-500'
    },
    {
      id: 'inventory',
      name: 'Inventory Report',
      description: 'Stock levels and reorder recommendations',
      icon: FiTarget,
      color: 'bg-red-500'
    },
    {
      id: 'returns',
      name: 'Returns Analysis',
      description: 'Product returns and refund patterns',
      icon: FiActivity,
      color: 'bg-orange-500'
    }
  ];

  const dateRanges = [
    { id: '7days', name: 'Last 7 Days' },
    { id: '30days', name: 'Last 30 Days' },
    { id: '90days', name: 'Last 90 Days' },
    { id: '6months', name: 'Last 6 Months' },
    { id: '1year', name: 'Last Year' },
    { id: 'custom', name: 'Custom Range' }
  ];

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p>Generating report...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white p-6 rounded-lg shadow-sm">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Takealot Reports</h1>
            <p className="text-gray-600">Comprehensive analytics and insights for your Takealot integration</p>
          </div>
          <div className="flex items-center space-x-3">
            <button
              onClick={generateReport}
              disabled={loading}
              className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              <FiRefreshCw className={`mr-2 ${loading ? 'animate-spin' : ''}`} />
              Generate Report
            </button>
            <button
              disabled={!reportData}
              className="flex items-center px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              <FiDownload className="mr-2" />
              Export
            </button>
          </div>
        </div>
      </div>

      {/* Report Configuration */}
      <div className="bg-white p-6 rounded-lg shadow-sm">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Report Configuration</h2>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Date Range Selection */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Date Range</label>
            <select
              value={selectedDateRange}
              onChange={(e) => setSelectedDateRange(e.target.value)}
              className="w-full border border-gray-300 rounded-md px-3 py-2 focus:ring-2 focus:ring-blue-500"
            >
              {dateRanges.map(range => (
                <option key={range.id} value={range.id}>{range.name}</option>
              ))}
            </select>
          </div>

          {/* Report Type Selection */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Report Type</label>
            <select
              value={selectedReportType}
              onChange={(e) => setSelectedReportType(e.target.value)}
              className="w-full border border-gray-300 rounded-md px-3 py-2 focus:ring-2 focus:ring-blue-500"
            >
              {reportTypes.map(type => (
                <option key={type.id} value={type.id}>{type.name}</option>
              ))}
            </select>          </div>
        </div>        {/* View Report Button */}
        <div className="mt-6 flex justify-center space-x-4">
          <button
            onClick={() => viewSelectedReport()}
            disabled={loading || loadingProducts}
            className="flex items-center px-6 py-3 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-medium shadow-sm"
          >
            <FiBarChart className={`mr-2 ${(loading || loadingProducts) ? 'animate-pulse' : ''}`} />
            View Report
          </button>
          
          {showReport && (
            <button
              onClick={clearReport}
              className="flex items-center px-6 py-3 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors font-medium shadow-sm"
            >
              <FiRefreshCw className="mr-2" />
              Clear Report
            </button>
          )}
        </div>
      </div>

      {/* Report Types Grid */}
      <div className="bg-white p-6 rounded-lg shadow-sm">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Available Reports</h2>
        <p className="text-sm text-gray-600 mb-6">Click on any report card to select and view it immediately</p>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {reportTypes.map((type) => {
            const IconComponent = type.icon;            const isSelected = selectedReportType === type.id;
            const isAvailable = type.id === 'products';
            const isLoadingCard = cardLoading === type.id;
            
            return (              <div
                key={type.id}
                className={`p-4 rounded-lg border-2 cursor-pointer transition-all duration-200 transform hover:scale-105 ${
                  isSelected
                    ? 'border-blue-500 bg-blue-50 shadow-lg'
                    : 'border-gray-200 hover:border-blue-300 hover:shadow-md'
                } ${isLoadingCard ? 'opacity-75' : ''}`}
                onClick={() => !isLoadingCard && handleReportCardClick(type.id)}
              >                <div className="flex items-center mb-2">
                  <div className={`p-2 rounded-lg ${type.color} mr-3 ${
                    isSelected ? 'scale-110' : ''
                  } transition-transform duration-200 ${isLoadingCard ? 'animate-pulse' : ''}`}>
                    <IconComponent className="h-5 w-5 text-white" />
                  </div>
                  <h3 className="font-semibold text-gray-900">{type.name}</h3>
                  {isLoadingCard && (
                    <div className="ml-2 animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
                  )}
                </div>
                <p className="text-sm text-gray-600 mb-3">{type.description}</p>
                <div className="flex items-center justify-between">                  <span className={`text-xs font-medium px-2 py-1 rounded-full ${
                    isSelected
                      ? 'bg-blue-100 text-blue-700'
                      : 'bg-gray-100 text-gray-600'
                  }`}>
                    {isLoadingCard ? 'Loading...' : isSelected ? 'Selected' : 'Click to View'}
                  </span>
                  <div className="flex space-x-1">
                    {isAvailable && (
                      <span className="text-xs bg-green-100 text-green-700 px-2 py-1 rounded-full font-medium">
                        Available
                      </span>
                    )}
                    {!isAvailable && (
                      <span className="text-xs bg-orange-100 text-orange-700 px-2 py-1 rounded-full font-medium">
                        Coming Soon
                      </span>
                    )}
                  </div>
                </div>
              </div>
            );
          })}        </div>
      </div>      {/* Product Performance Table */}
      {selectedReportType === 'products' && showReport && (
        <div className="bg-white rounded-lg shadow-sm overflow-hidden">
          <div className="p-6 border-b border-gray-200">
            <div className="flex justify-between items-center">
              <div>
                <h2 className="text-lg font-semibold text-gray-900">Product Performance Report</h2>
                <p className="text-gray-600">Comprehensive product analytics and performance metrics</p>
              </div>
              {loadingProducts && (
                <div className="flex items-center text-blue-600">
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600 mr-2"></div>
                  <span className="text-sm">Loading products...</span>
                </div>
              )}
            </div>
          </div>

          {loadingProducts ? (
            <div className="flex justify-center items-center h-64">
              <div className="text-center">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
                <p>Loading product performance data...</p>
              </div>
            </div>
          ) : productPerformanceData.length === 0 ? (
            <div className="text-center py-12">
              <FiPackage className="mx-auto h-12 w-12 text-gray-400 mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">No Product Data Found</h3>
              <p className="text-gray-500">
                No products found for this integration. Make sure products have been fetched from Takealot API.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Image</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Product</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">TSIN</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">SKU</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Avg Selling Price</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Total Sold</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Total Return</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">30 Days Sold</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">30 Days Return</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">DSO (Days)</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Return Rate %</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Qty Require</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {productPerformanceData.map((product, index) => (
                    <tr key={product.sku || index} className="hover:bg-gray-50">
                      <td className="px-4 py-4">
                        {product.image_url ? (
                          <img
                            src={product.image_url}
                            alt={product.title}
                            className="h-12 w-12 rounded object-cover"
                            onError={(e) => {
                              (e.target as HTMLImageElement).style.display = 'none';
                            }}
                          />
                        ) : (
                          <div className="h-12 w-12 bg-gray-200 rounded flex items-center justify-center">
                            <FiPackage className="text-gray-400" />
                          </div>
                        )}
                      </td>
                      
                      <td className="px-4 py-4">
                        <div className="font-medium text-gray-900 max-w-xs truncate" title={product.title}>
                          {product.title}
                        </div>
                      </td>

                      <td className="px-4 py-4 text-sm font-mono text-gray-900">
                        {product.tsin_id ? (
                          <span 
                            className="text-blue-600 cursor-pointer hover:underline"
                            onClick={() => window.open(`https://www.takealot.com/p/${product.tsin_id}`, '_blank')}
                            title="Click to view on Takealot"
                          >
                            {product.tsin_id}
                          </span>
                        ) : (
                          '-'
                        )}
                      </td>
                      
                      <td className="px-4 py-4 text-sm font-mono text-gray-900">
                        {product.sku}
                      </td>
                      
                      <td className="px-4 py-4 text-sm font-medium text-gray-900">
                        R{product.avgSellingPrice.toFixed(2)}
                      </td>
                      
                      <td className="px-4 py-4 text-sm font-medium text-gray-900">
                        <span className="text-green-600">
                          {product.totalSold}
                        </span>
                      </td>

                      <td className="px-4 py-4 text-sm font-medium text-gray-900">
                        <span className="text-red-600">
                          {product.totalReturn}
                        </span>
                      </td>

                      <td className="px-4 py-4 text-sm font-medium text-blue-600">
                        {product.last30DaysSold}
                      </td>

                      <td className="px-4 py-4 text-sm font-medium text-red-600">
                        {product.last30DaysReturn}
                      </td>
                      
                      <td className="px-4 py-4 text-sm text-gray-900">
                        <span className={`font-medium ${
                          product.daysSinceLastOrder > 30 
                            ? 'text-red-600' 
                            : product.daysSinceLastOrder > 14 
                            ? 'text-yellow-600' 
                            : 'text-green-600'
                        }`}>
                          {product.daysSinceLastOrder === 999 ? 'No orders' : product.daysSinceLastOrder}
                        </span>
                      </td>

                      <td className="px-4 py-4 text-sm font-medium">
                        <span className={`${
                          product.returnRate > 10 
                            ? 'text-red-600' 
                            : product.returnRate > 5 
                            ? 'text-yellow-600' 
                            : 'text-green-600'
                        }`}>
                          {product.returnRate.toFixed(1)}%
                        </span>
                      </td>

                      <td className="px-4 py-4 text-sm font-medium">
                        <span className={`${
                          product.qtyRequire > 0 
                            ? 'text-orange-600' 
                            : 'text-gray-600'
                        }`}>
                          {product.qtyRequire}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {/* Summary Stats */}
              {productPerformanceData.length > 0 && (
                <div className="bg-gray-50 px-6 py-4 border-t border-gray-200">
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                    <div className="text-center">
                      <div className="font-semibold text-gray-900">
                        {productPerformanceData.length}
                      </div>
                      <div className="text-gray-600">Total Products</div>
                    </div>
                    <div className="text-center">
                      <div className="font-semibold text-green-600">
                        {productPerformanceData.reduce((sum, p) => sum + p.totalSold, 0)}
                      </div>
                      <div className="text-gray-600">Total Units Sold</div>
                    </div>
                    <div className="text-center">
                      <div className="font-semibold text-blue-600">
                        {productPerformanceData.reduce((sum, p) => sum + p.last30DaysSold, 0)}
                      </div>
                      <div className="text-gray-600">30 Days Sales</div>
                    </div>
                    <div className="text-center">
                      <div className="font-semibold text-orange-600">
                        {productPerformanceData.reduce((sum, p) => sum + p.qtyRequire, 0)}
                      </div>
                      <div className="text-gray-600">Total Qty Required</div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}      {/* Coming Soon Notice - Only show for non-product report types */}
      {selectedReportType !== 'products' && showReport && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6">
          <div className="flex items-center mb-4">
            <FiActivity className="h-6 w-6 text-yellow-600 mr-3" />
            <h2 className="text-lg font-semibold text-yellow-800">Coming Soon</h2>
          </div>
          <div className="space-y-3 text-yellow-700">
          <p>
            The Takealot Reports feature is currently under development. This comprehensive reporting system will provide:
          </p>
          <ul className="list-disc pl-6 space-y-1">
            <li><strong>Sales Analytics:</strong> Detailed revenue and sales performance metrics</li>
            <li><strong>Product Insights:</strong> Top-performing products and inventory analysis</li>
            <li><strong>Trend Analysis:</strong> Historical data and forecasting</li>
            <li><strong>Profitability Reports:</strong> Margin analysis and financial insights</li>
            <li><strong>Inventory Management:</strong> Stock level monitoring and reorder alerts</li>
            <li><strong>Returns Analysis:</strong> Product return patterns and insights</li>
            <li><strong>Custom Reports:</strong> Flexible reporting with date ranges and filters</li>
            <li><strong>Export Functionality:</strong> PDF and Excel export capabilities</li>
          </ul>
          <p className="mt-3">
            <strong>Expected Features:</strong>
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-2">
            <div className="bg-white p-3 rounded border">
              <h4 className="font-semibold text-gray-900 mb-1">Dashboard Integration</h4>
              <p className="text-sm text-gray-600">Real-time widgets and summary cards</p>
            </div>
            <div className="bg-white p-3 rounded border">
              <h4 className="font-semibold text-gray-900 mb-1">Automated Reporting</h4>
              <p className="text-sm text-gray-600">Scheduled reports via email</p>
            </div>
            <div className="bg-white p-3 rounded border">
              <h4 className="font-semibold text-gray-900 mb-1">Comparative Analysis</h4>
              <p className="text-sm text-gray-600">Period-over-period comparisons</p>
            </div>            <div className="bg-white p-3 rounded border">
              <h4 className="font-semibold text-gray-900 mb-1">Visual Charts</h4>
              <p className="text-sm text-gray-600">Interactive graphs and charts</p>
            </div>
          </div>
          </div>
        </div>
      )}      {/* Quick Actions */}
      <div className="bg-white p-6 rounded-lg shadow-sm">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Quick Actions</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <button
            onClick={() => handleReportCardClick('products')}
            className="flex items-center p-4 bg-green-50 rounded-lg hover:bg-green-100 transition-colors"
          >
            <FiPackage className="h-8 w-8 text-green-600 mr-3" />
            <div className="text-left">
              <div className="font-medium text-gray-900">Product Performance</div>
              <div className="text-sm text-gray-600">View detailed product analytics</div>
            </div>
          </button>
          
          <button
            onClick={() => handleReportCardClick('overview')}
            className="flex items-center p-4 bg-blue-50 rounded-lg hover:bg-blue-100 transition-colors"
          >
            <FiBarChart className="h-8 w-8 text-blue-600 mr-3" />
            <div className="text-left">
              <div className="font-medium text-gray-900">Sales Overview</div>
              <div className="text-sm text-gray-600">View sales performance metrics</div>
            </div>
          </button>
          
          <button
            onClick={() => handleReportCardClick('trends')}
            className="flex items-center p-4 bg-purple-50 rounded-lg hover:bg-purple-100 transition-colors"
          >
            <FiTrendingUp className="h-8 w-8 text-purple-600 mr-3" />
            <div className="text-left">
              <div className="font-medium text-gray-900">Sales Trends</div>
              <div className="text-sm text-gray-600">Analyze historical patterns</div>
            </div>
          </button>
        </div>
      </div>
    </div>
  );
}
