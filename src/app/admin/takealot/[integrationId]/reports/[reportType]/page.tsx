'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { 
  FiArrowLeft, 
  FiDownload, 
  FiRefreshCw,
  FiPackage,
  FiBarChart,
  FiTrendingUp,
  FiDollarSign,
  FiTarget,
  FiActivity,
  FiEye,
  FiFilter,
  FiCalendar,
  FiChevronLeft,
  FiChevronRight,
  FiChevronsLeft,
  FiChevronsRight,
  FiSettings,
  FiSearch
} from 'react-icons/fi';
import { useAuth } from '@/context/AuthContext';
import { usePageTitle } from '@/context/PageTitleContext';
import { getSavedReport, saveReportToDatabase } from '@/lib/reportDatabaseService';
import { getOptimizedProductData, getFastProductData } from '@/lib/reportCacheService';
import { runQuickCalculation } from '@/lib/quickCalculationService';

interface ReportViewProps {
  params: Promise<{ 
    integrationId: string;
    reportType: string;
  }>;
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
  availableQtyAtTakealot: number;
  totalProductSoldAmount: number;
  productStatus: 'Buyable' | 'Not Buyable' | 'Disable';
}

interface SavedReportMetadata {
  totalProducts: number;
  totalSales: number;
  totalReturns: number;
  last30DaysSales: number;
  avgReturnRate: number;
  lastGenerated: Date;
  generatedBy: string;
  version: string;
}

export default function ReportViewPage({ params }: ReportViewProps) {
  const { currentUser } = useAuth();
  const { setPageTitle } = usePageTitle();
  
  // Fix for Next.js 15 - params are now async
  const resolvedParams = React.use(params);
  const { integrationId, reportType } = resolvedParams;
    const [loading, setLoading] = useState(true);
  const [productData, setProductData] = useState<ProductPerformanceData[]>([]);
  const [allProductData, setAllProductData] = useState<ProductPerformanceData[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [reportMetadata, setReportMetadata] = useState<SavedReportMetadata | null>(null);
  const [usesSavedReport, setUsesSavedReport] = useState(false);
  
  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(50);
  const [totalPages, setTotalPages] = useState(1);  // Sorting state
  const [sortField, setSortField] = useState<keyof ProductPerformanceData>('last30DaysSold');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');
  // Search state
  const [searchTerm, setSearchTerm] = useState('');
  const [filteredData, setFilteredData] = useState<ProductPerformanceData[]>([]);  // Calculation state
  const [isRecalculating, setIsRecalculating] = useState(false);
  const [recalculationProgress, setRecalculationProgress] = useState<string>('');

  // Report type configurations
  const reportConfigs = {
    'product-performance': {
      title: 'Product Performance Report',
      description: 'Comprehensive product analytics and performance metrics',
      icon: FiPackage,
      color: 'text-green-600'
    },
    'sales-overview': {
      title: 'Sales Overview Report',
      description: 'General sales performance metrics',
      icon: FiBarChart,
      color: 'text-blue-600'
    },
    'sales-trends': {
      title: 'Sales Trends Report',
      description: 'Historical sales trends and patterns',
      icon: FiTrendingUp,
      color: 'text-purple-600'
    },
    'profitability': {
      title: 'Profitability Analysis Report',
      description: 'Profit margins and financial performance',
      icon: FiDollarSign,
      color: 'text-yellow-600'
    },
    'inventory': {
      title: 'Inventory Report',
      description: 'Stock levels and reorder recommendations',
      icon: FiTarget,
      color: 'text-red-600'
    },
    'returns': {
      title: 'Returns Analysis Report',
      description: 'Product returns and refund patterns',
      icon: FiActivity,
      color: 'text-orange-600'
    }
  };

  const currentReport = reportConfigs[reportType as keyof typeof reportConfigs];

  useEffect(() => {
    if (currentReport) {
      setPageTitle(currentReport.title);
    }
    return () => setPageTitle('');
  }, [setPageTitle, currentReport]);  useEffect(() => {
    if (currentUser && integrationId && reportType) {
      loadReportData(false, false); // Load fast data by default
    }
  }, [currentUser, integrationId, reportType]);  // Update pagination when data changes
  useEffect(() => {
    if (!allProductData.length) {
      setProductData([]);
      setFilteredData([]);
      setTotalPages(1);
      return;
    }

    // Filter the data first by search term
    let filteredData = allProductData;
    if (searchTerm.trim()) {
      const searchLower = searchTerm.toLowerCase();
      filteredData = allProductData.filter(product => 
        (product.title && typeof product.title === 'string' && product.title.toLowerCase().includes(searchLower)) ||
        (product.sku && typeof product.sku === 'string' && product.sku.toLowerCase().includes(searchLower)) ||
        (product.tsin_id && String(product.tsin_id).toLowerCase().includes(searchLower))
      );
    }

    // Sort the filtered data
    const sortedData = [...filteredData].sort((a, b) => {
      const aValue = a[sortField];
      const bValue = b[sortField];
      
      // Handle undefined/null values
      if (aValue == null && bValue == null) return 0;
      if (aValue == null) return sortDirection === 'asc' ? -1 : 1;
      if (bValue == null) return sortDirection === 'asc' ? 1 : -1;
      
      if (typeof aValue === 'string' && typeof bValue === 'string') {
        return sortDirection === 'asc' ? aValue.localeCompare(bValue) : bValue.localeCompare(aValue);
      }
      
      if (typeof aValue === 'number' && typeof bValue === 'number') {
        return sortDirection === 'asc' ? aValue - bValue : bValue - aValue;
      }
      
      // Convert to string for comparison if types don't match
      const aStr = String(aValue);
      const bStr = String(bValue);
      return sortDirection === 'asc' ? aStr.localeCompare(bStr) : bStr.localeCompare(aStr);
    });

    // Calculate pagination
    const total = Math.ceil(sortedData.length / itemsPerPage);
    setTotalPages(total);
    
    // Update current page data
    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    const paginatedData = sortedData.slice(startIndex, endIndex);
    
    console.log(`Pagination Debug: Total products: ${allProductData.length}, Filtered: ${sortedData.length}, Page ${currentPage}/${total}, Showing: ${paginatedData.length} items`);
    
    setProductData(paginatedData);
    setFilteredData(sortedData);
    
    // Reset to page 1 when search changes and current page is invalid
    if (searchTerm && currentPage > total && total > 0) {
      setCurrentPage(1);
    }
  }, [allProductData, currentPage, itemsPerPage, sortField, sortDirection, searchTerm]);
  // Determine product status
  const getProductStatus = (product: any): 'Buyable' | 'Not Buyable' | 'Disable' => {
    if (product.stock === 0) return 'Disable';
    if (product.stock < 5) return 'Not Buyable';
    return 'Buyable';
  };  const loadReportData = async (forceGenerate: boolean = false, useAccurateCalculations: boolean = false) => {    setLoading(true);
    setError(null);
    setUsesSavedReport(false);

    try {      
      if (reportType === 'product-performance') {
        if (!forceGenerate && !useAccurateCalculations) {
          // Try to load saved report first
          const savedReport = await getSavedReport(integrationId, reportType);
          if (savedReport) {
            console.log('Using saved report data');
            setAllProductData(savedReport.data);
            setReportMetadata(savedReport.metadata);
            setUsesSavedReport(true);
            setLoading(false);
            return;
          }
        }

        // Check if we should use fast loading or accurate calculations
        if (!useAccurateCalculations && !forceGenerate) {
          // Use fast loading for initial page load
          console.log('Loading fast product data (no calculations)...');
          const fastData = await getFastProductData(integrationId);
          
          if (!fastData || fastData.length === 0) {
            throw new Error(`No product data found for integration "${integrationId}". Please ensure products are synced.`);
          }          setAllProductData(fastData);
          setUsesSavedReport(false);

          // Create basic metadata for fast data
          const metadata = {
            totalProducts: fastData.length,
            totalSales: fastData.reduce((sum: number, p: ProductPerformanceData) => sum + p.totalSold, 0),
            totalReturns: fastData.reduce((sum: number, p: ProductPerformanceData) => sum + p.totalReturn, 0),
            last30DaysSales: fastData.reduce((sum: number, p: ProductPerformanceData) => sum + p.last30DaysSold, 0),
            avgReturnRate: fastData.length > 0 ? fastData.reduce((sum: number, p: ProductPerformanceData) => sum + p.returnRate, 0) / fastData.length : 0,
            lastGenerated: new Date(),
            generatedBy: currentUser?.uid || 'system',
            version: 'fast_load'
          };
          
          setReportMetadata(metadata);
          setLoading(false);
          return;
        }

        // Generate new report with accurate calculations
        console.log('Generating new report data with accurate calculations for integration:', integrationId);
        const productData = await getOptimizedProductData(integrationId);
        console.log('Retrieved product data:', productData?.length || 0, 'items');
        
        if (!productData || productData.length === 0) {
          console.error('No product data found for integration:', integrationId);
          throw new Error(`No product data found for integration "${integrationId}". Please ensure products are synced and the integration ID is correct.`);
        }

        // Add product status based on stock and activity
        const enhancedData = productData.map((product: any) => ({
          ...product,
          productStatus: getProductStatus(product)
        }));        
        setAllProductData(enhancedData);
        setUsesSavedReport(false);// Save the new report to database
        if (currentUser && enhancedData.length > 0) {
          try {
            await saveReportToDatabase(integrationId, reportType, enhancedData, currentUser.uid);
            
            // Update metadata for display
            const metadata = {
              totalProducts: enhancedData.length,
              totalSales: enhancedData.reduce((sum: number, p: ProductPerformanceData) => sum + p.totalSold, 0),
              totalReturns: enhancedData.reduce((sum: number, p: ProductPerformanceData) => sum + p.totalReturn, 0),
              last30DaysSales: enhancedData.reduce((sum: number, p: ProductPerformanceData) => sum + p.last30DaysSold, 0),
              avgReturnRate: enhancedData.length > 0 ? enhancedData.reduce((sum: number, p: ProductPerformanceData) => sum + p.returnRate, 0) / enhancedData.length : 0,
              lastGenerated: new Date(),
              generatedBy: currentUser.uid,
              version: '1.0'
            };
            
            setReportMetadata(metadata);
            console.log('Report generated and saved successfully');
          } catch (saveError) {
            console.warn('Report generated but failed to save to database:', saveError);
            // Still show the report even if saving fails
            
            // Create metadata even if save fails
            const metadata = {
              totalProducts: enhancedData.length,
              totalSales: enhancedData.reduce((sum: number, p: ProductPerformanceData) => sum + p.totalSold, 0),
              totalReturns: enhancedData.reduce((sum: number, p: ProductPerformanceData) => sum + p.totalReturn, 0),
              last30DaysSales: enhancedData.reduce((sum: number, p: ProductPerformanceData) => sum + p.last30DaysSold, 0),
              avgReturnRate: enhancedData.length > 0 ? enhancedData.reduce((sum: number, p: ProductPerformanceData) => sum + p.returnRate, 0) / enhancedData.length : 0,
              lastGenerated: new Date(),
              generatedBy: currentUser.uid,
              version: '1.0'
            };
            
            setReportMetadata(metadata);
          }
        }
      } else {
        // For other report types, show placeholder
        setError(`${currentReport?.title || 'This report'} is coming soon!`);
      }
    } catch (error) {
      console.error('Error loading report data:', error);
      setError(`Failed to load report data: ${error instanceof Error ? error.message : 'Please try again.'}`);
    } finally {
      setLoading(false);
    }
  };
  const exportReport = () => {
    // TODO: Implement export functionality
    alert('Export functionality coming soon!');
  };  const handleGenerateReport = () => {
    loadReportData(true, true); // Force generate new report with accurate calculations
  };const handleRecalculateMetrics = async () => {
    if (!currentUser || isRecalculating) return;

    setIsRecalculating(true);
    setRecalculationProgress('Preparing TSIN-based metric recalculation...');
    setError(null); // Clear any previous errors

    try {
      // Clear the current data to show fresh calculations
      setProductData([]);
      setAllProductData([]);
      
      setRecalculationProgress('Starting optimized TSIN-based calculations (much faster & more accurate!)...');
      
      const response = await fetch('/api/admin/takealot/recalculate-metrics', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          integrationId,
          useTsinCalculation: true // Use new TSIN-based calculation
        }),
      });

      const data = await response.json();

      if (data.success) {
        setRecalculationProgress(`🎉 Successfully updated ${data.productsUpdated} products with TSIN-based calculations!`);
          // Show success message for a moment before refreshing
        setTimeout(() => {
          setRecalculationProgress('Loading updated data with enhanced calculations...');
          loadReportData(true, true); // Force generate new report with accurate calculations
          
          setTimeout(() => {
            setIsRecalculating(false);
            setRecalculationProgress('');
          }, 1000);
        }, 2000);
      } else {
        throw new Error(data.details || 'TSIN-based recalculation failed');
      }
    } catch (error) {
      console.error('Error recalculating metrics:', error);
      setError(`Recalculation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
      setIsRecalculating(false);
      setRecalculationProgress('');
    }
  };

  const handleQuickCalculation = async () => {
    if (!currentUser || isRecalculating) return;

    setIsRecalculating(true);
    setRecalculationProgress('Starting quick calculation to populate missing fields...');
    setError(null);

    try {
      // Clear the current data to show fresh calculations
      setProductData([]);
      setAllProductData([]);
      
      const result = await runQuickCalculation(integrationId, (progress) => {
        setRecalculationProgress(`Processing ${progress.processed}/${progress.total}: ${progress.currentProduct}`);
      });

      if (result.success > 0) {
        setRecalculationProgress(`🎉 Successfully calculated ${result.success} products! Loading updated data...`);
        
        // Reload data after calculation
        setTimeout(() => {
          loadReportData(false, false); // Load fast data to see the updated calculations
          
          setTimeout(() => {
            setIsRecalculating(false);
            setRecalculationProgress('');
          }, 1000);
        }, 1000);
      } else {
        throw new Error('No products were updated');
      }
    } catch (error) {
      console.error('Error in quick calculation:', error);
      setError(`Quick calculation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
      setIsRecalculating(false);
      setRecalculationProgress('');
    }
  };

  const handlePageChange = (page: number) => {
    setCurrentPage(page);
  };  const handleItemsPerPageChange = (items: number) => {
    setItemsPerPage(items);
    setCurrentPage(1); // Reset to first page
  };

  const handleSort = (field: keyof ProductPerformanceData) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('desc');
    }
    setCurrentPage(1); // Reset to first page when sorting
  };
  const getSortIcon = (field: keyof ProductPerformanceData) => {
    if (sortField !== field) return '↕';
    return sortDirection === 'asc' ? '↑' : '↓';
  };

  if (!currentReport) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900 mb-4">Report Not Found</h1>
          <Link 
            href={`/admin/takealot/${integrationId}/reports`}
            className="text-blue-600 hover:text-blue-800"
          >
            ← Back to Reports
          </Link>
        </div>
      </div>
    );
  }
  const IconComponent = currentReport.icon;
  return (
    <div className="min-h-screen bg-gray-50">
      {/* Main Content Area */}
      <div className="flex flex-col">
        {/* Header */}
        <div className="bg-white shadow-sm border-b">
          <div className="px-4 lg:px-6">
            <div className="flex items-center justify-between h-14">
              <div className="flex items-center space-x-4">
                <Link
                  href={`/admin/takealot/${integrationId}/reports`}
                  className="flex items-center text-gray-600 hover:text-gray-900 transition-colors"
                >
                  <FiArrowLeft className="h-5 w-5 mr-2" />
                  Back to Reports
                </Link>
                
                <div className="h-6 w-px bg-gray-300"></div>
                  <div className="flex items-center">
                  <IconComponent className={`h-6 w-6 ${currentReport.color} mr-3`} />
                  <div>
                    <h1 className="text-lg font-semibold text-gray-900">
                      {currentReport.title}
                    </h1>
                  </div>
                </div>
              </div>              <div className="flex items-center space-x-2">
                  <div className="flex items-center space-x-2 bg-gray-50 rounded-lg px-3 py-2">
                  <select
                    value={itemsPerPage}
                    onChange={(e) => handleItemsPerPageChange(Number(e.target.value))}
                    className="border-0 bg-transparent text-sm focus:outline-none focus:ring-0 pr-8"
                  >
                    <option value={50}>50</option>
                    <option value={100}>100</option>
                    <option value={200}>200</option>
                  </select>
                  <span className="text-sm text-gray-600">per page</span>                </div>                  <div className="flex items-center space-x-2">
                  <button
                    onClick={handleQuickCalculation}
                    disabled={loading || isRecalculating}
                    className="flex items-center px-3 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-sm font-medium"
                    title="Quick calculation using sales_units data (faster)"
                  >
                    <FiRefreshCw className={`mr-2 h-4 w-4 ${isRecalculating ? 'animate-spin' : ''}`} />
                    Quick Calc
                  </button>
                  
                  <button
                    onClick={handleRecalculateMetrics}
                    disabled={loading || isRecalculating}
                    className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-sm font-medium"
                    title="Recalculate all product metrics with TSIN-based calculations"
                  >
                    <FiSettings className={`mr-2 h-4 w-4 ${isRecalculating ? 'animate-spin' : ''}`} />
                    {isRecalculating ? 'Calculating...' : 'Recalc Metrics'}
                  </button>
                  
                  <button
                    onClick={handleGenerateReport}
                    disabled={loading || isRecalculating}
                    className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    <FiRefreshCw className={`mr-2 ${loading ? 'animate-spin' : ''}`} />
                    Generate Report
                  </button>
                  
                  <button
                    onClick={exportReport}
                    disabled={loading || productData.length === 0}
                    className="flex items-center px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    <FiDownload className="mr-2" />
                    Export
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>        {/* Content */}
        <div className="bg-gray-50">
          <div className="px-4 lg:px-6 py-4">        {/* Recalculation Progress Bar - Only show during recalculation */}
        {isRecalculating && (
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center">
                <FiSettings className="h-5 w-5 text-blue-600 mr-2 animate-spin" />
                <h3 className="text-sm font-medium text-blue-900">Recalculating Product Metrics</h3>
              </div>
              <div className="bg-blue-100 text-blue-800 px-2 py-1 rounded text-xs font-medium">
                Processing...
              </div>
            </div>
            
            {recalculationProgress && (
              <div className="space-y-2">
                <p className="text-sm text-blue-800">{recalculationProgress}</p>
                <div className="w-full bg-blue-200 rounded-full h-2">
                  <div className="bg-blue-600 h-2 rounded-full animate-pulse" style={{width: '70%'}}></div>
                </div>
              </div>
            )}
          </div>
        )}{loading ? (
          <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
            <div className="p-6">
              <div className="flex items-center justify-center mb-6">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mr-3"></div>
                <span className="text-gray-600">Loading product performance data...</span>
              </div>
              
              {/* Skeleton Table */}
              <div className="space-y-3">
                <div className="grid grid-cols-12 gap-2">
                  <div className="h-4 bg-gray-200 rounded animate-pulse"></div>
                  <div className="col-span-3 h-4 bg-gray-200 rounded animate-pulse"></div>
                  <div className="h-4 bg-gray-200 rounded animate-pulse"></div>
                  <div className="h-4 bg-gray-200 rounded animate-pulse"></div>
                  <div className="h-4 bg-gray-200 rounded animate-pulse"></div>
                  <div className="h-4 bg-gray-200 rounded animate-pulse"></div>
                  <div className="h-4 bg-gray-200 rounded animate-pulse"></div>
                  <div className="h-4 bg-gray-200 rounded animate-pulse"></div>
                  <div className="h-4 bg-gray-200 rounded animate-pulse"></div>
                  <div className="h-4 bg-gray-200 rounded animate-pulse"></div>
                  <div className="h-4 bg-gray-200 rounded animate-pulse"></div>
                  <div className="h-4 bg-gray-200 rounded animate-pulse"></div>
                </div>
                {[...Array(8)].map((_, i) => (
                  <div key={i} className="grid grid-cols-12 gap-2">
                    <div className="h-8 bg-gray-100 rounded animate-pulse"></div>
                    <div className="col-span-3 h-8 bg-gray-100 rounded animate-pulse"></div>
                    <div className="h-8 bg-gray-100 rounded animate-pulse"></div>
                    <div className="h-8 bg-gray-100 rounded animate-pulse"></div>
                    <div className="h-8 bg-gray-100 rounded animate-pulse"></div>
                    <div className="h-8 bg-gray-100 rounded animate-pulse"></div>
                    <div className="h-8 bg-gray-100 rounded animate-pulse"></div>
                    <div className="h-8 bg-gray-100 rounded animate-pulse"></div>
                    <div className="h-8 bg-gray-100 rounded animate-pulse"></div>
                    <div className="h-8 bg-gray-100 rounded animate-pulse"></div>
                    <div className="h-8 bg-gray-100 rounded animate-pulse"></div>
                    <div className="h-8 bg-gray-100 rounded animate-pulse"></div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        ) : error ? (
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6">
            <div className="flex items-center">
              <FiActivity className="h-6 w-6 text-yellow-600 mr-3" />
              <div>
                <h2 className="text-lg font-semibold text-yellow-800">Report Status</h2>
                <p className="text-yellow-700 mt-1">{error}</p>
              </div>
            </div>
          </div>        ) : reportType === 'product-performance' ? (
          <div className="bg-white border border-gray-200">
            <div className="px-4 py-3 border-b border-gray-200">
              {/* Summary Stats - Compact */}
              <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded p-3 mb-4">
                <div className="grid grid-cols-3 md:grid-cols-6 gap-3 text-xs">
                  <div className="text-center">
                    <div className="font-semibold text-gray-900 text-sm">
                      {allProductData.length}
                    </div>
                    <div className="text-gray-600">Products</div>
                  </div>
                  <div className="text-center">
                    <div className="font-semibold text-green-600 text-sm">
                      {allProductData.reduce((sum, p) => sum + p.totalSold, 0)}
                    </div>
                    <div className="text-gray-600">Units Sold</div>
                  </div>
                  <div className="text-center">
                    <div className="font-semibold text-red-600 text-sm">
                      {allProductData.reduce((sum, p) => sum + p.totalReturn, 0)}
                    </div>
                    <div className="text-gray-600">Returns</div>
                  </div>
                  <div className="text-center">
                    <div className="font-semibold text-blue-600 text-sm">
                      {allProductData.reduce((sum, p) => sum + p.last30DaysSold, 0)}
                    </div>
                    <div className="text-gray-600">30D Sales</div>
                  </div>
                  <div className="text-center">
                    <div className="font-semibold text-orange-600 text-sm">                      {allProductData.reduce((sum, p) => sum + p.qtyRequire, 0)}
                    </div>
                    <div className="text-gray-600">Qty Required</div>
                  </div>
                  <div className="text-center">
                    <div className="font-semibold text-yellow-600 text-sm">
                      {allProductData.length > 0 ? (allProductData.reduce((sum, p) => sum + p.returnRate, 0) / allProductData.length).toFixed(1) : 0}%
                    </div>
                    <div className="text-gray-600">Avg Return %</div>
                  </div>
                </div>
              </div>              {/* Improved Top Controls - Search after pagination info */}
              <div className="space-y-4 mb-4">
                {/* Pagination Info and Controls */}
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-gray-50 border border-gray-200 rounded-lg p-4">
                  <div className="flex items-center space-x-6">
                    <div className="text-sm text-gray-600">
                      Showing <span className="font-semibold text-gray-900">{((currentPage - 1) * itemsPerPage) + 1}-{Math.min(currentPage * itemsPerPage, filteredData.length)}</span> of <span className="font-semibold text-gray-900">{filteredData.length}</span> products
                      {searchTerm && (
                        <span className="text-blue-600 ml-1">
                          (filtered from {allProductData.length} total)
                        </span>
                      )}
                    </div>
                    
                    {/* Search Box - Now after pagination info */}
                    <div className="relative max-w-md">
                      <FiSearch className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                      <input
                        type="text"
                        placeholder="Search products, SKU, or TSIN..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full pl-10 pr-10 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
                      />
                      {searchTerm && (
                        <button
                          onClick={() => setSearchTerm('')}
                          className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-full w-5 h-5 flex items-center justify-center"
                          title="Clear search"
                        >
                          ×
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Items per page selector */}
                  <div className="flex items-center space-x-3 bg-white border border-gray-300 rounded-lg px-3 py-2">
                    <span className="text-sm text-gray-600">Show:</span>
                    <select
                      value={itemsPerPage}
                      onChange={(e) => handleItemsPerPageChange(Number(e.target.value))}
                      className="border-0 bg-transparent text-sm focus:outline-none focus:ring-0 pr-8"
                    >
                      <option value={25}>25</option>
                      <option value={50}>50</option>
                      <option value={100}>100</option>
                      <option value={200}>200</option>
                    </select>
                    <span className="text-sm text-gray-600">per page</span>
                  </div>
                </div>

                {/* Pagination Controls */}
                {totalPages > 1 && (
                  <div className="flex items-center justify-center space-x-1 bg-white border border-gray-200 rounded-lg p-3">
                    <button
                      onClick={() => handlePageChange(1)}
                      disabled={currentPage === 1}
                      className="px-3 py-1 text-sm rounded border border-gray-300 bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      First
                    </button>
                    <button
                      onClick={() => handlePageChange(currentPage - 1)}
                      disabled={currentPage === 1}
                      className="px-3 py-1 text-sm rounded border border-gray-300 bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      Prev
                    </button>
                    <span className="px-4 py-1 text-sm font-medium text-gray-700 bg-blue-50 border border-blue-200 rounded">
                      {currentPage} of {totalPages}
                    </span>
                    <button
                      onClick={() => handlePageChange(currentPage + 1)}
                      disabled={currentPage === totalPages}
                      className="px-3 py-1 text-sm rounded border border-gray-300 bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      Next
                    </button>
                    <button
                      onClick={() => handlePageChange(totalPages)}
                      disabled={currentPage === totalPages}
                      className="px-3 py-1 text-sm rounded border border-gray-300 bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      Last
                    </button>
                  </div>
                )}
              </div>
            </div>

            {productData.length === 0 ? (
              <div className="text-center py-12">
                <FiPackage className="mx-auto h-12 w-12 text-gray-400 mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">No Product Data Found</h3>
                <p className="text-gray-500">
                  No products found for this integration.
                </p>
              </div>            ) : (
              <div className="bg-white border border-gray-200 overflow-hidden">
                <div className="overflow-x-auto">                  <table className="w-full divide-y divide-gray-200 text-sm">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-2 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wide w-12">
                          Img
                        </th>
                        <th 
                          className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wide cursor-pointer hover:bg-gray-100"
                          onClick={() => handleSort('title')}
                        >
                          Product Title {getSortIcon('title')}
                        </th>
                        <th 
                          className="px-2 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wide cursor-pointer hover:bg-gray-100 w-20"
                          onClick={() => handleSort('tsin_id')}
                        >
                          TSIN {getSortIcon('tsin_id')}
                        </th>
                        <th 
                          className="px-2 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wide cursor-pointer hover:bg-gray-100 w-24"
                          onClick={() => handleSort('sku')}
                        >
                          SKU {getSortIcon('sku')}
                        </th>
                        <th 
                          className="px-2 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wide cursor-pointer hover:bg-gray-100 w-18"
                          onClick={() => handleSort('productStatus')}
                        >
                          Status {getSortIcon('productStatus')}
                        </th>
                        <th 
                          className="px-2 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wide cursor-pointer hover:bg-gray-100 w-16"
                          onClick={() => handleSort('avgSellingPrice')}
                        >
                          Price {getSortIcon('avgSellingPrice')}
                        </th>
                        <th 
                          className="px-2 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wide cursor-pointer hover:bg-gray-100 w-16"
                          onClick={() => handleSort('totalSold')}
                          title="Total units sold (all time) - calculated using TSIN matching for accuracy"
                        >
                          Total Sold {getSortIcon('totalSold')}
                        </th>
                        <th 
                          className="px-2 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wide cursor-pointer hover:bg-gray-100 w-16"
                          onClick={() => handleSort('totalReturn')}
                          title="Total returns (all time) - enhanced detection logic including 'Returned' status"
                        >
                          Total Return {getSortIcon('totalReturn')}
                        </th>
                        <th 
                          className="px-2 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wide cursor-pointer hover:bg-gray-100 w-16"
                          onClick={() => handleSort('last30DaysSold')}
                          title="Units sold in last 30 days - calculated using TSIN matching"
                        >
                          30D Sold {getSortIcon('last30DaysSold')}
                        </th>
                        <th 
                          className="px-2 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wide cursor-pointer hover:bg-gray-100 w-16"
                          onClick={() => handleSort('last30DaysReturn')}
                          title="Units returned in last 30 days - enhanced return detection"
                        >
                          30D Return {getSortIcon('last30DaysReturn')}
                        </th>
                        <th 
                          className="px-2 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wide cursor-pointer hover:bg-gray-100 w-12"
                          onClick={() => handleSort('daysSinceLastOrder')}
                          title="Days Since Last Order"
                        >
                          DSO {getSortIcon('daysSinceLastOrder')}
                        </th>
                        <th 
                          className="px-2 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wide cursor-pointer hover:bg-gray-100 w-16"
                          onClick={() => handleSort('returnRate')}
                          title="Return Rate Percentage - (Total Returns ÷ Total Sold) × 100"
                        >
                          Return % {getSortIcon('returnRate')}
                        </th>
                        <th 
                          className="px-2 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wide cursor-pointer hover:bg-gray-100 w-16"
                          onClick={() => handleSort('qtyRequire')}
                          title="Qty Required = 30 Days Sold - Stock on Way - Available Stock (Updated Formula)"
                        >
                          Qty Req {getSortIcon('qtyRequire')}
                        </th>
                      </tr>
                    </thead>                    <tbody className="bg-white divide-y divide-gray-200 text-sm">
                      {productData.map((product, index) => (
                        <tr key={product.sku || index} className="hover:bg-gray-50">
                          <td className="px-2 py-3">
                            {product.image_url ? (
                              <img
                                src={product.image_url}
                                alt={product.title}
                                className="h-10 w-10 rounded object-cover"
                                onError={(e) => {
                                  (e.target as HTMLImageElement).style.display = 'none';
                                }}
                              />
                            ) : (
                              <div className="h-10 w-10 bg-gray-100 rounded flex items-center justify-center">
                                <FiPackage className="text-gray-400 h-4 w-4" />
                              </div>
                            )}
                          </td>
                          
                          <td className="px-3 py-3">
                            <div className="text-sm font-medium text-gray-900 max-w-xs truncate" title={product.title}>
                              {product.title}
                            </div>
                          </td>

                          <td className="px-2 py-3 text-xs font-mono">
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
                          
                          <td className="px-2 py-3 text-xs font-mono">
                            {product.sku}
                          </td>
                          
                          <td className="px-2 py-3">
                            <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                              product.productStatus === 'Buyable' 
                                ? 'bg-green-100 text-green-800'
                                : product.productStatus === 'Not Buyable'
                                ? 'bg-yellow-100 text-yellow-800'
                                : product.productStatus === 'Disable'
                                ? 'bg-red-100 text-red-800'
                                : 'bg-gray-100 text-gray-800'
                            }`}>
                              {product.productStatus === 'Not Buyable' ? 'Not Buy' : product.productStatus}
                            </span>
                          </td>
                          
                          <td className="px-2 py-3 text-sm font-medium">
                            R{product.avgSellingPrice.toFixed(0)}
                          </td>
                          
                          <td className="px-2 py-3 text-sm font-medium text-green-600">
                            {product.totalSold}
                          </td>

                          <td className="px-2 py-3 text-sm font-medium text-red-600">
                            {product.totalReturn}
                          </td>

                          <td className="px-2 py-3 text-sm font-medium text-blue-600">
                            {product.last30DaysSold}
                          </td>

                          <td className="px-2 py-3 text-sm font-medium text-red-600">
                            {product.last30DaysReturn}
                          </td>
                          
                          <td className="px-2 py-3 text-sm">
                            <span className={`font-medium ${
                              product.daysSinceLastOrder > 30 
                                ? 'text-red-600' 
                                : product.daysSinceLastOrder > 14 
                                ? 'text-yellow-600' 
                                : 'text-green-600'
                            }`}>
                              {product.daysSinceLastOrder === 999 ? 'Never' : product.daysSinceLastOrder}
                            </span>
                          </td>

                          <td className="px-2 py-3 text-sm font-medium">
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
                          
                          <td className="px-2 py-3 text-sm font-medium">
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
                </div>
                
                {/* Bottom Pagination */}
                {totalPages > 1 && (
                  <div className="bg-gray-50 px-4 py-3 border-t border-gray-200">
                    <div className="flex items-center justify-between">
                      <div className="text-sm text-gray-600">
                        Showing <span className="font-semibold text-gray-900">{((currentPage - 1) * itemsPerPage) + 1}-{Math.min(currentPage * itemsPerPage, allProductData.length)}</span> of <span className="font-semibold text-gray-900">{allProductData.length}</span> products
                      </div>
                      <div className="flex items-center space-x-2">
                        <button
                          onClick={() => handlePageChange(1)}
                          disabled={currentPage === 1}
                          className="px-3 py-1 text-sm font-medium rounded border border-gray-300 bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          First
                        </button>
                        <button
                          onClick={() => handlePageChange(currentPage - 1)}
                          disabled={currentPage === 1}
                          className="px-3 py-1 text-sm font-medium rounded border border-gray-300 bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          Previous
                        </button>
                        <span className="px-3 py-1 text-sm font-medium text-gray-700 bg-blue-50 border border-blue-200 rounded">
                          Page {currentPage} of {totalPages}
                        </span>
                        <button
                          onClick={() => handlePageChange(currentPage + 1)}
                          disabled={currentPage === totalPages}
                          className="px-3 py-1 text-sm font-medium rounded border border-gray-300 bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          Next
                        </button>
                        <button
                          onClick={() => handlePageChange(totalPages)}
                          disabled={currentPage === totalPages}
                          className="px-3 py-1 text-sm font-medium rounded border border-gray-300 bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          Last
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}
