// Auto Price Main Page - Admin Section
'use client';

import React, { useState, useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import { usePageTitle } from '@/context/PageTitleContext';
import { AutoPriceTable } from '@/modules/auto-price/components/admin/AutoPriceTable';
import { AutoPriceStats } from '@/modules/auto-price/components/admin/AutoPriceStats';
import { FilterAndSearch } from '@/modules/auto-price/components/admin/FilterAndSearch';
import { BulkActions } from '@/modules/auto-price/components/admin/BulkActions';
import { useAutoPriceData } from '@/modules/auto-price/hooks/useAutoPriceData';
import { 
  FiTrendingUp, 
  FiRefreshCw, 
  FiSettings, 
  FiDownload,
  FiPlay,
  FiPause
} from 'react-icons/fi';

interface AutoPricePageProps {
  params: Promise<{ integrationId?: string }>;
}

export default function AutoPricePage({ params }: AutoPricePageProps) {
  const { currentUser } = useAuth();
  const { setPageTitle } = usePageTitle();
  
  // Get integration ID from params or user's first integration
  const [integrationId, setIntegrationId] = useState<string>('');
  const [autoRefreshEnabled, setAutoRefreshEnabled] = useState(false);

  // Initialize integration ID
  useEffect(() => {
    const resolveParams = async () => {
      const resolvedParams = await params;
      if (resolvedParams.integrationId) {
        setIntegrationId(resolvedParams.integrationId);
      } else {
        // TODO: Get user's first integration ID from their integrations
        // For now, we'll need to fetch this from the user's data
      }
    };
    resolveParams();
  }, [params]);

  // Auto Price data hook
  const {
    products,
    stats,
    pagination,
    isLoading,
    isRefreshing,
    error,
    filters,
    sort,
    refresh,
    changePage,
    updateFilters,
    updateSort,
    clearFilters,
    updateProduct,
    setProductLoading,
    isProductLoading,
    hasData,
    isEmpty,
    hasError,
    hasNextPage,
    hasPrevPage,
    scrapedPercentage,
    pendingPercentage
  } = useAutoPriceData({
    integrationId,
    initialLimit: 25,
    autoRefresh: autoRefreshEnabled,
    refreshInterval: 30
  });

  // Set page title
  useEffect(() => {
    setPageTitle('Auto Price Management');
    return () => setPageTitle('');
  }, [setPageTitle]);

  // Selected products for bulk actions
  const [selectedProducts, setSelectedProducts] = useState<Set<string>>(new Set());

  // Bulk selection handlers
  const handleSelectAll = () => {
    if (selectedProducts.size === products.length) {
      setSelectedProducts(new Set());
    } else {
      setSelectedProducts(new Set(products.map(p => p.id)));
    }
  };

  const handleSelectProduct = (productId: string) => {
    const newSelected = new Set(selectedProducts);
    if (newSelected.has(productId)) {
      newSelected.delete(productId);
    } else {
      newSelected.add(productId);
    }
    setSelectedProducts(newSelected);
  };

  // Clear selection when page changes
  useEffect(() => {
    setSelectedProducts(new Set());
  }, [pagination.page]);

  if (!currentUser) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-500">Please log in to access Auto Price features.</div>
      </div>
    );
  }

  if (!integrationId) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="text-gray-500 mb-4">No Takealot integration found.</div>
          <div className="text-sm text-gray-400">
            Please set up a Takealot integration first to use Auto Price features.
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header Section */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 flex items-center">
              <FiTrendingUp className="w-7 h-7 mr-3 text-blue-600" />
              Auto Price Management
            </h1>
            <p className="text-gray-600 mt-1">
              Monitor competitor pricing and optimize your product prices automatically
            </p>
          </div>
          
          <div className="flex items-center space-x-3">
            {/* Auto Refresh Toggle */}
            <button
              onClick={() => setAutoRefreshEnabled(!autoRefreshEnabled)}
              className={`px-4 py-2 rounded-lg border font-medium transition-all duration-200 flex items-center ${
                autoRefreshEnabled
                  ? 'bg-green-50 border-green-200 text-green-700 hover:bg-green-100'
                  : 'bg-gray-50 border-gray-200 text-gray-600 hover:bg-gray-100'
              }`}
            >
              {autoRefreshEnabled ? (
                <>
                  <FiPause className="w-4 h-4 mr-2" />
                  Auto Refresh On
                </>
              ) : (
                <>
                  <FiPlay className="w-4 h-4 mr-2" />
                  Auto Refresh Off
                </>
              )}
            </button>

            {/* Manual Refresh Button */}
            <button
              onClick={refresh}
              disabled={isRefreshing}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 flex items-center"
            >
              <FiRefreshCw className={`w-4 h-4 mr-2 ${isRefreshing ? 'animate-spin' : ''}`} />
              {isRefreshing ? 'Refreshing...' : 'Refresh'}
            </button>

            {/* Settings Button */}
            <button className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-all duration-200 flex items-center">
              <FiSettings className="w-4 h-4 mr-2" />
              Settings
            </button>
          </div>
        </div>

        {/* Stats Section */}
        {stats && (
          <AutoPriceStats 
            stats={stats}
            scrapedPercentage={scrapedPercentage}
            pendingPercentage={pendingPercentage}
          />
        )}
      </div>

      {/* Filters and Search */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
        <FilterAndSearch
          filters={filters}
          onFiltersChange={updateFilters}
          onClearFilters={clearFilters}
          totalProducts={pagination.total}
        />
      </div>

      {/* Bulk Actions */}
      {selectedProducts.size > 0 && (
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
          <BulkActions
            selectedCount={selectedProducts.size}
            selectedProductIds={Array.from(selectedProducts)}
            integrationId={integrationId}
            onClearSelection={() => setSelectedProducts(new Set())}
            onRefreshData={refresh}
          />
        </div>
      )}

      {/* Error Display */}
      {hasError && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4">
          <div className="flex items-center">
            <div className="w-2 h-2 bg-red-500 rounded-full mr-3"></div>
            <span className="text-red-800 font-medium">Error: {error}</span>
          </div>
        </div>
      )}

      {/* Main Table */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm">
        <AutoPriceTable
          products={products}
          pagination={pagination}
          isLoading={isLoading}
          sort={sort}
          selectedProducts={selectedProducts}
          onSortChange={updateSort}
          onPageChange={changePage}
          onSelectAll={handleSelectAll}
          onSelectProduct={handleSelectProduct}
          onProductUpdate={updateProduct}
          onSetProductLoading={setProductLoading}
          isProductLoading={isProductLoading}
          integrationId={integrationId}
          hasNextPage={hasNextPage}
          hasPrevPage={hasPrevPage}
          isEmpty={isEmpty}
        />
      </div>

      {/* Export Actions */}
      <div className="flex justify-end">
        <button className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-all duration-200 flex items-center">
          <FiDownload className="w-4 h-4 mr-2" />
          Export Data
        </button>
      </div>
    </div>
  );
}
