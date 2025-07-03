// Filter and Search Component for Auto Price
import React, { useState, useEffect } from 'react';
import { AutoPriceFilters, ProductStatus, ScrapingStatus } from '../../types/auto-price.types';
import { 
  FiSearch, 
  FiFilter, 
  FiX, 
  FiChevronDown 
} from 'react-icons/fi';

interface FilterAndSearchProps {
  filters?: AutoPriceFilters;
  onFiltersChange: (filters: AutoPriceFilters) => void;
  onClearFilters: () => void;
  totalProducts: number;
}

export const FilterAndSearch: React.FC<FilterAndSearchProps> = ({
  filters,
  onFiltersChange,
  onClearFilters,
  totalProducts
}) => {
  // Local state for form inputs
  const [searchTerm, setSearchTerm] = useState(filters?.search || '');
  const [selectedStatuses, setSelectedStatuses] = useState<ProductStatus[]>(filters?.status || []);
  const [selectedScrapingStatuses, setSelectedScrapingStatuses] = useState<ScrapingStatus[]>(
    filters?.scrapingStatus || []
  );
  const [hasScrapedData, setHasScrapedData] = useState<boolean | undefined>(filters?.hasScrapedData);
  const [priceRange, setPriceRange] = useState({
    min: filters?.priceRange?.min || '',
    max: filters?.priceRange?.max || ''
  });

  // Status options
  const statusOptions: { value: ProductStatus; label: string; color: string }[] = [
    { value: 'buyable', label: 'Buyable', color: 'green' },
    { value: 'loading', label: 'Loading', color: 'yellow' },
    { value: 'out_of_stock', label: 'Out of Stock', color: 'red' },
    { value: 'unavailable', label: 'Unavailable', color: 'gray' }
  ];

  const scrapingStatusOptions: { value: ScrapingStatus; label: string; color: string }[] = [
    { value: 'idle', label: 'Not Scraped', color: 'gray' },
    { value: 'queued', label: 'Queued', color: 'blue' },
    { value: 'scraping', label: 'Scraping', color: 'yellow' },
    { value: 'success', label: 'Success', color: 'green' },
    { value: 'error', label: 'Error', color: 'red' },
    { value: 'retry', label: 'Retry', color: 'orange' },
    { value: 'skip', label: 'Skipped', color: 'gray' }
  ];

  // Debounced search
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      applyFilters();
    }, 500);

    return () => clearTimeout(timeoutId);
  }, [searchTerm]);

  // Apply filters when other inputs change
  useEffect(() => {
    applyFilters();
  }, [selectedStatuses, selectedScrapingStatuses, hasScrapedData, priceRange]);

  const applyFilters = () => {
    const newFilters: AutoPriceFilters = {};

    if (searchTerm.trim()) {
      newFilters.search = searchTerm.trim();
    }

    if (selectedStatuses.length > 0) {
      newFilters.status = selectedStatuses;
    }

    if (selectedScrapingStatuses.length > 0) {
      newFilters.scrapingStatus = selectedScrapingStatuses;
    }

    if (hasScrapedData !== undefined) {
      newFilters.hasScrapedData = hasScrapedData;
    }

    if (priceRange.min || priceRange.max) {
      newFilters.priceRange = {
        min: parseFloat(priceRange.min.toString()) || 0,
        max: parseFloat(priceRange.max.toString()) || 999999
      };
    }

    onFiltersChange(newFilters);
  };

  const handleStatusToggle = (status: ProductStatus) => {
    setSelectedStatuses(prev => 
      prev.includes(status) 
        ? prev.filter(s => s !== status)
        : [...prev, status]
    );
  };

  const handleScrapingStatusToggle = (status: ScrapingStatus) => {
    setSelectedScrapingStatuses(prev => 
      prev.includes(status) 
        ? prev.filter(s => s !== status)
        : [...prev, status]
    );
  };

  const clearAllFilters = () => {
    setSearchTerm('');
    setSelectedStatuses([]);
    setSelectedScrapingStatuses([]);
    setHasScrapedData(undefined);
    setPriceRange({ min: '', max: '' });
    onClearFilters();
  };

  const activeFiltersCount = [
    searchTerm.trim(),
    selectedStatuses.length > 0,
    selectedScrapingStatuses.length > 0,
    hasScrapedData !== undefined,
    priceRange.min || priceRange.max
  ].filter(Boolean).length;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <FiFilter className="w-5 h-5 text-gray-600" />
          <h3 className="text-lg font-semibold text-gray-900">Filters</h3>
          {activeFiltersCount > 0 && (
            <span className="px-2 py-1 bg-blue-100 text-blue-800 text-xs font-medium rounded-full">
              {activeFiltersCount} active
            </span>
          )}
        </div>
        
        {activeFiltersCount > 0 && (
          <button
            onClick={clearAllFilters}
            className="flex items-center text-sm text-gray-600 hover:text-red-600 transition-colors"
          >
            <FiX className="w-4 h-4 mr-1" />
            Clear All
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
        {/* Search */}
        <div className="lg:col-span-1">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Search Products
          </label>
          <div className="relative">
            <FiSearch className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search by title, SKU, or TSIN..."
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
        </div>

        {/* Product Status */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Product Status
          </label>
          <div className="space-y-2 max-h-32 overflow-y-auto">
            {statusOptions.map(option => (
              <label key={option.value} className="flex items-center">
                <input
                  type="checkbox"
                  checked={selectedStatuses.includes(option.value)}
                  onChange={() => handleStatusToggle(option.value)}
                  className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
                <span className="ml-2 text-sm text-gray-700">{option.label}</span>
                <span className={`ml-auto w-2 h-2 rounded-full bg-${option.color}-500`}></span>
              </label>
            ))}
          </div>
        </div>

        {/* Scraping Status */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Scraping Status
          </label>
          <div className="space-y-2 max-h-32 overflow-y-auto">
            {scrapingStatusOptions.map(option => (
              <label key={option.value} className="flex items-center">
                <input
                  type="checkbox"
                  checked={selectedScrapingStatuses.includes(option.value)}
                  onChange={() => handleScrapingStatusToggle(option.value)}
                  className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
                <span className="ml-2 text-sm text-gray-700">{option.label}</span>
                <span className={`ml-auto w-2 h-2 rounded-full bg-${option.color}-500`}></span>
              </label>
            ))}
          </div>
        </div>

        {/* Additional Filters */}
        <div className="space-y-4">
          {/* Price Range */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Price Range
            </label>
            <div className="grid grid-cols-2 gap-2">
              <input
                type="number"
                value={priceRange.min}
                onChange={(e) => setPriceRange(prev => ({ ...prev, min: e.target.value }))}
                placeholder="Min"
                className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
              />
              <input
                type="number"
                value={priceRange.max}
                onChange={(e) => setPriceRange(prev => ({ ...prev, max: e.target.value }))}
                placeholder="Max"
                className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
              />
            </div>
          </div>

          {/* Has Scraped Data */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Scraped Data
            </label>
            <select
              value={hasScrapedData === undefined ? '' : hasScrapedData.toString()}
              onChange={(e) => setHasScrapedData(
                e.target.value === '' ? undefined : e.target.value === 'true'
              )}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
            >
              <option value="">All Products</option>
              <option value="true">Has Scraped Data</option>
              <option value="false">No Scraped Data</option>
            </select>
          </div>
        </div>
      </div>

      {/* Results Summary */}
      <div className="text-sm text-gray-600">
        {totalProducts > 0 ? (
          <>Showing {totalProducts.toLocaleString()} products</>
        ) : (
          <>No products found with current filters</>
        )}
      </div>
    </div>
  );
};
