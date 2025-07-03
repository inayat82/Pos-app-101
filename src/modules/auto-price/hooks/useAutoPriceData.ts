// Custom hook for Auto Price data management
import { useState, useEffect, useCallback } from 'react';
import { AutoPriceService } from '../services/auto-price.service';
import { 
  AutoPriceProduct, 
  AutoPriceFilters, 
  AutoPriceSortOptions,
  AutoPriceStats,
  PaginatedAutoPriceResponse
} from '../types/auto-price.types';

interface UseAutoPriceDataProps {
  integrationId: string;
  initialPage?: number;
  initialLimit?: number;
  initialFilters?: AutoPriceFilters;
  initialSort?: AutoPriceSortOptions;
  autoRefresh?: boolean;
  refreshInterval?: number; // seconds
}

export const useAutoPriceData = ({
  integrationId,
  initialPage = 1,
  initialLimit = 50,
  initialFilters,
  initialSort,
  autoRefresh = false,
  refreshInterval = 30
}: UseAutoPriceDataProps) => {
  
  // State management
  const [products, setProducts] = useState<AutoPriceProduct[]>([]);
  const [stats, setStats] = useState<AutoPriceStats | null>(null);
  const [pagination, setPagination] = useState({
    page: initialPage,
    limit: initialLimit,
    total: 0,
    totalPages: 0
  });
  
  // UI state
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Filter and sort state
  const [filters, setFilters] = useState<AutoPriceFilters | undefined>(initialFilters);
  const [sort, setSort] = useState<AutoPriceSortOptions | undefined>(initialSort);
  
  // Individual product loading states
  const [loadingProducts, setLoadingProducts] = useState<Set<string>>(new Set());

  /**
   * Fetch products data
   */
  const fetchProducts = useCallback(async (
    page?: number,
    currentFilters?: AutoPriceFilters,
    currentSort?: AutoPriceSortOptions,
    isRefresh = false
  ) => {
    try {
      if (isRefresh) {
        setIsRefreshing(true);
      } else {
        setIsLoading(true);
      }
      setError(null);

      const response: PaginatedAutoPriceResponse = await AutoPriceService.getProducts(
        integrationId,
        page || pagination.page,
        pagination.limit,
        currentFilters || filters,
        currentSort || sort
      );

      setProducts(response.products);
      setStats(response.stats);
      setPagination(response.pagination);

    } catch (err: any) {
      console.error('Error fetching auto price data:', err);
      setError(err.message || 'Failed to fetch auto price data');
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [integrationId, pagination.page, pagination.limit, filters, sort]);

  /**
   * Refresh data manually
   */
  const refresh = useCallback(() => {
    fetchProducts(undefined, undefined, undefined, true);
  }, [fetchProducts]);

  /**
   * Change page
   */
  const changePage = useCallback((newPage: number) => {
    setPagination(prev => ({ ...prev, page: newPage }));
    fetchProducts(newPage);
  }, [fetchProducts]);

  /**
   * Update filters
   */
  const updateFilters = useCallback((newFilters: AutoPriceFilters) => {
    setFilters(newFilters);
    setPagination(prev => ({ ...prev, page: 1 })); // Reset to first page
    fetchProducts(1, newFilters);
  }, [fetchProducts]);

  /**
   * Update sorting
   */
  const updateSort = useCallback((newSort: AutoPriceSortOptions) => {
    setSort(newSort);
    fetchProducts(undefined, undefined, newSort);
  }, [fetchProducts]);

  /**
   * Clear filters
   */
  const clearFilters = useCallback(() => {
    setFilters(undefined);
    setPagination(prev => ({ ...prev, page: 1 }));
    fetchProducts(1, undefined);
  }, [fetchProducts]);

  /**
   * Update a single product in the list
   */
  const updateProduct = useCallback((productId: string, updates: Partial<AutoPriceProduct>) => {
    setProducts(prev => prev.map(product => 
      product.id === productId 
        ? { ...product, ...updates }
        : product
    ));
  }, []);

  /**
   * Set loading state for a specific product
   */
  const setProductLoading = useCallback((productId: string, loading: boolean) => {
    setLoadingProducts(prev => {
      const newSet = new Set(prev);
      if (loading) {
        newSet.add(productId);
      } else {
        newSet.delete(productId);
      }
      return newSet;
    });
  }, []);

  /**
   * Check if a specific product is loading
   */
  const isProductLoading = useCallback((productId: string) => {
    return loadingProducts.has(productId);
  }, [loadingProducts]);

  /**
   * Remove a product from the list
   */
  const removeProduct = useCallback((productId: string) => {
    setProducts(prev => prev.filter(product => product.id !== productId));
    setPagination(prev => ({ ...prev, total: prev.total - 1 }));
  }, []);

  /**
   * Add a new product to the list
   */
  const addProduct = useCallback((product: AutoPriceProduct) => {
    setProducts(prev => [product, ...prev]);
    setPagination(prev => ({ ...prev, total: prev.total + 1 }));
  }, []);

  // Initial data load
  useEffect(() => {
    if (integrationId) {
      fetchProducts();
    }
  }, [integrationId]); // Only depend on integrationId for initial load

  // Auto-refresh functionality
  useEffect(() => {
    if (!autoRefresh || !integrationId) return;

    const interval = setInterval(() => {
      fetchProducts(undefined, undefined, undefined, true);
    }, refreshInterval * 1000);

    return () => clearInterval(interval);
  }, [autoRefresh, refreshInterval, integrationId, fetchProducts]);

  // Return all state and methods
  return {
    // Data
    products,
    stats,
    pagination,
    
    // UI state
    isLoading,
    isRefreshing,
    error,
    
    // Filter and sort state
    filters,
    sort,
    
    // Methods
    refresh,
    changePage,
    updateFilters,
    updateSort,
    clearFilters,
    updateProduct,
    removeProduct,
    addProduct,
    
    // Product-specific loading
    setProductLoading,
    isProductLoading,
    
    // Computed values
    hasData: products.length > 0,
    isEmpty: !isLoading && products.length === 0,
    hasError: !!error,
    hasNextPage: pagination.page < pagination.totalPages,
    hasPrevPage: pagination.page > 1,
    
    // Stats computed values
    scrapedPercentage: stats ? (stats.scrapedToday / stats.totalProducts) * 100 : 0,
    pendingPercentage: stats ? (stats.pendingScraping / stats.totalProducts) * 100 : 0
  };
};
