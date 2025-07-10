'use client';

import React, { useState, useEffect } from 'react';
import { 
  FiSearch, 
  FiPlay, 
  FiLoader, 
  FiArrowLeft, 
  FiExternalLink, 
  FiClock, 
  FiShield, 
  FiTrendingUp, 
  FiStar, 
  FiUsers,
  FiDollarSign,
  FiPackage,
  FiCheckCircle,
  FiXCircle,
  FiAlertCircle,
  FiRefreshCw,
  FiDownload,
  FiEye,
  FiDatabase
} from 'react-icons/fi';
import { useAuth } from '@/context/AuthContext';
import { usePageTitle } from '@/context/PageTitleContext';
import { useRouter, useSearchParams } from 'next/navigation';
import { SampleDataDisplay } from '@/components/SampleDataDisplay';
import { TakealotUrlValidator, getSafeProductUrl } from '@/lib/takealot-url-validator';

interface SellerInfo {
  name: string;
  price: number;
  stock: string;
  isWinner: boolean;
  rank: number;
}

interface ScrapedData {
  tsin: string;
  plid: string;
  title: string;
  brand?: string;
  barcode?: string;
  productUrl: string;
  imageUrl: string;
  
  // Winner information
  winnerSeller: string;
  winnerPrice: number;
  winnerStock: string;
  winDifference: number;
  winPrice: number;
  
  // Market data
  totalSellers: number;
  reviewCount: number;
  rating: number;
  
  // Our data
  requestSeller: string;
  ourPrice?: number;
  
  // Competitors (up to 12 sellers from the CSV structure)
  sellers: SellerInfo[];
  
  // Scraping metadata
  scrapedAt: Date;
  proxyUsed?: string;
  scrapingDuration?: number;
  success: boolean;
  errorMessage?: string;
}

interface SearchProduct {
  id: string;
  tsin: string;
  title: string;
  sku: string;
  url?: string;
  offer_url?: string;
  imageUrl?: string;
  currentPrice?: number;
  barcode?: string;
}

export default function ScrapeDataPage({ params }: { params: Promise<{ integrationId: string }> }) {
  const { currentUser } = useAuth();
  const { setPageTitle } = usePageTitle();
  const router = useRouter();
  const searchParams = useSearchParams();
  
  // Fix for Next.js 15 - params are now async
  const resolvedParams = React.use(params);
  const { integrationId } = resolvedParams;

  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<SearchProduct[]>([]);
  const [selectedProduct, setSelectedProduct] = useState<SearchProduct | null>(null);
  const [scrapedData, setScrapedData] = useState<ScrapedData | null>(null);
  
  const [isSearchingProducts, setIsSearchingProducts] = useState(false);
  const [rawJsonResponse, setRawJsonResponse] = useState<any>(null);
  const [showJsonView, setShowJsonView] = useState(false);
  const [isScraping, setIsScraping] = useState(false);
  const [searchHistory, setSearchHistory] = useState<ScrapedData[]>([]);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [showSampleData, setShowSampleData] = useState(false);

  useEffect(() => {
    setPageTitle('Scrape Data - Live Product Analysis');
    
    // Check for pre-loaded data from URL
    const preloadedTsin = searchParams.get('tsin');
    if (preloadedTsin) {
      const preloadedProduct: SearchProduct = {
        id: `preloaded-${preloadedTsin}`,
        tsin: preloadedTsin,
        title: searchParams.get('title') || 'Unknown Title',
        sku: searchParams.get('sku') || '',
        imageUrl: searchParams.get('imageUrl') || '',
        currentPrice: parseFloat(searchParams.get('price') || '0'),
        offer_url: searchParams.get('offerUrl') || '',
      };
      setSelectedProduct(preloadedProduct);
      scrapeProductData(preloadedProduct);
    }

    return () => setPageTitle('');
  }, [setPageTitle, searchParams]);

  const searchProducts = async () => {
    if (!searchQuery.trim()) return;

    setIsSearchingProducts(true);
    setSearchResults([]);
    
    try {
      console.log('🔍 Searching user products for:', searchQuery);
      
      // Use the new search API for user's own products
      const response = await fetch('/api/admin/auto-price/search-user-products', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          integrationId,
          searchQuery: searchQuery.trim(),
          limit: 20
        }),
      });

      const result = await response.json();

      if (response.ok && result.success) {
        console.log('✅ Found user products:', result.products.length);
        setSearchResults(result.products);
      } else {
        console.error('❌ Search failed:', result.error);
        setSearchResults([]);
      }
    } catch (error) {
      console.error('❌ Search error:', error);
      setSearchResults([]);
    } finally {
      setIsSearchingProducts(false);
    }
  };

  const scrapeProductData = async (product: SearchProduct) => {
    if (!product.tsin) return;

    setIsScraping(true);
    setScrapedData(null);
    setSelectedProduct(product);
    setRawJsonResponse(null);

    try {
      console.log(`🚀 Starting enhanced scraping for TSIN: ${product.tsin}`);
      console.log(`� Product: ${product.title}`);
      
      // Use the new single product scraper API with proxy support
      const response = await fetch('/api/admin/auto-price/scrape-single-product', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          integrationId,
          tsin: product.tsin,
          productTitle: product.title,
          productSku: product.sku,
          useProxy: true // Always use proxy for live scraping
        }),
      });

      const result = await response.json();
      
      // Store the raw JSON response for display
      setRawJsonResponse(result);

      if (response.ok && result.success && result.scrapingResult.success) {
        console.log(`✅ Successfully scraped TSIN: ${product.tsin}`);
        
        const scrapingData = result.scrapingResult.scrapedData;
        
        // Convert API data to our display format
        const scrapedResult: ScrapedData = {
          tsin: product.tsin,
          plid: product.tsin,
          title: scrapingData.title || product.title,
          brand: scrapingData.brand,
          barcode: scrapingData.barcode,
          productUrl: scrapingData.product_url || '',
          imageUrl: scrapingData.image_url || product.imageUrl || '',
          
          winnerSeller: scrapingData.seller || '',
          winnerPrice: parseFloat(scrapingData.price?.replace(/[^0-9.]/g, '') || '0'),
          winnerStock: scrapingData.stock || '',
          winDifference: 0, // Will calculate if we have our price
          winPrice: parseFloat(scrapingData.price?.replace(/[^0-9.]/g, '') || '0'),
          
          totalSellers: parseInt(scrapingData.other_offers_count || '1'),
          reviewCount: parseInt(scrapingData.reviews || '0'),
          rating: parseFloat(scrapingData.star_rating || '0'),
          
          requestSeller: 'Your Store',
          ourPrice: product.currentPrice,
          
          sellers: scrapingData.competitors?.map((comp: any, index: number) => ({
            name: comp.seller,
            price: parseFloat(comp.price?.replace(/[^0-9.]/g, '') || '0'),
            stock: comp.status,
            isWinner: index === 0,
            rank: index + 1
          })) || [],
          
          scrapedAt: new Date(),
          proxyUsed: result.scrapingResult.proxyUsed || 'webshare',
          scrapingDuration: result.scrapingResult.scrapingDuration || 0,
          success: true
        };
        
        setScrapedData(scrapedResult);
        setSearchHistory(prev => [scrapedResult, ...prev.slice(0, 9)]);
        
      } else {
        const errorMessage = result.scrapingResult?.scrapingError || result.error || 'Unknown error occurred';
        console.error(`❌ Scraping failed for TSIN: ${product.tsin}`, errorMessage);
        
        // Still show the error data for debugging
        const failedResult: ScrapedData = {
          tsin: product.tsin,
          plid: product.tsin,
          title: product.title,
          productUrl: '',
          imageUrl: product.imageUrl || '',
          
          winnerSeller: '',
          winnerPrice: 0,
          winnerStock: '',
          winDifference: 0,
          winPrice: 0,
          
          totalSellers: 0,
          reviewCount: 0,
          rating: 0,
          
          requestSeller: 'Your Store',
          ourPrice: product.currentPrice,
          sellers: [],
          
          scrapedAt: new Date(),
          proxyUsed: result.scrapingResult?.proxyUsed || 'webshare',
          scrapingDuration: result.scrapingResult?.scrapingDuration || 0,
          success: false,
          errorMessage
        };
        
        setScrapedData(failedResult);
      }
      
    } catch (error) {
      console.error(`❌ Error scraping TSIN: ${product.tsin}`, error);
      
      const errorResult: ScrapedData = {
        tsin: product.tsin,
        plid: product.tsin,
        title: product.title,
        productUrl: '',
        imageUrl: product.imageUrl || '',
        
        winnerSeller: '',
        winnerPrice: 0,
        winnerStock: '',
        winDifference: 0,
        winPrice: 0,
        
        totalSellers: 0,
        reviewCount: 0,
        rating: 0,
        
        requestSeller: 'Your Store',
        ourPrice: product.currentPrice,
        sellers: [],
        
        scrapedAt: new Date(),
        proxyUsed: 'webshare',
        scrapingDuration: 0,
        success: false,
        errorMessage: error instanceof Error ? error.message : 'Network error occurred'
      };
      
      setScrapedData(errorResult);
      setRawJsonResponse({ error: error instanceof Error ? error.message : 'Network error occurred' });
    } finally {
      setIsScraping(false);
    }
  };

  const formatCurrency = (amount: number) => {
    return `R${amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}`;
  };

  const formatDuration = (ms: number) => {
    return `${(ms / 1000).toFixed(2)}s`;
  };

  const getStockStatusColor = (stock: string) => {
    if (stock.toLowerCase().includes('in stock')) return 'text-green-600 bg-green-100';
    if (stock.toLowerCase().includes('ships')) return 'text-yellow-600 bg-yellow-100';
    if (stock.toLowerCase().includes('out of stock')) return 'text-red-600 bg-red-100';
    return 'text-gray-600 bg-gray-100';
  };

  const getRatingStars = (rating: number) => {
    const stars = [];
    for (let i = 1; i <= 5; i++) {
      stars.push(
        <FiStar
          key={i}
          className={`h-4 w-4 ${i <= rating ? 'text-yellow-400 fill-current' : 'text-gray-300'}`}
        />
      );
    }
    return stars;
  };

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <button
              onClick={() => router.back()}
              className="flex items-center px-3 py-2 text-gray-600 hover:text-gray-800 transition-colors"
            >
              <FiArrowLeft className="h-4 w-4 mr-2" />
              Back to Auto Price
            </button>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Live Product Data Scraping</h1>
              <p className="text-gray-600">Search and analyze competitive pricing data in real-time</p>
            </div>
          </div>
          
          {!searchHistory.length && (
            <div className="flex items-center space-x-2">
              <button
                onClick={() => window.open(`/admin/takealot/${integrationId}/auto-price/scrape-user-products`, '_blank')}
                className="flex items-center px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
              >
                <FiPackage className="h-4 w-4 mr-2" />
                Your Products Scraper
              </button>
              <button
                onClick={() => setShowSampleData(true)}
                className="flex items-center px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
              >
                <FiDatabase className="h-4 w-4 mr-2" />
                View Sample Data
              </button>
            </div>
          )}
          
          {searchHistory.length > 0 && (
            <div className="flex items-center space-x-2">
              <button
                onClick={() => window.open(`/admin/takealot/${integrationId}/auto-price/scrape-user-products`, '_blank')}
                className="flex items-center px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
              >
                <FiPackage className="h-4 w-4 mr-2" />
                Your Products Scraper
              </button>
              <button
                onClick={() => setShowSampleData(true)}
                className="flex items-center px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
              >
                <FiDatabase className="h-4 w-4 mr-2" />
                View Sample Data
              </button>
              <button
                onClick={() => {/* Export functionality */}}
                className="flex items-center px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
              >
                <FiDownload className="h-4 w-4 mr-2" />
                Export Data
              </button>
            </div>
          )}
        </div>

        {/* Scraping Method Info */}
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Enhanced Live Scraping</h2>
          
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <div className="flex items-start">
              <FiDatabase className="h-5 w-5 text-blue-600 mr-3 mt-0.5" />
              <div>
                <h3 className="text-sm font-medium text-blue-800">
                  Enhanced Scraping with Proxy Protection
                </h3>
                <p className="text-sm text-blue-700 mt-1">
                  Uses the same strategy as "Your Products Scraper" - leverages Webshare proxy IPs to avoid blocking 
                  and provides detailed JSON field analysis. Perfect for analyzing individual products with full competitive data.
                </p>
                <div className="flex items-center mt-2 text-xs text-blue-600">
                  <FiShield className="h-3 w-3 mr-1" />
                  <span>Webshare Proxy Protection Active</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Search Section */}
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-900">Search Your Products</h2>
            <div className="flex items-center text-sm text-gray-500">
              <FiPackage className="h-4 w-4 mr-1" />
              <span>Only your integration's products</span>
            </div>
          </div>
          
          <div className="flex space-x-4 mb-4">
            <div className="flex-1">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && searchProducts()}
                placeholder="Enter product name, SKU, barcode, or TSIN number..."
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-lg"
              />
            </div>
            <button
              onClick={searchProducts}
              disabled={isSearchingProducts || !searchQuery.trim()}
              className="flex items-center px-8 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {isSearchingProducts ? (
                <FiLoader className="h-5 w-5 mr-2 animate-spin" />
              ) : (
                <FiSearch className="h-5 w-5 mr-2" />
              )}
              {isSearchingProducts ? 'Searching...' : 'Search Your Products'}
            </button>
          </div>

          {/* Manual TSIN Input */}
          {searchResults.length === 0 && !isSearchingProducts && searchQuery.trim() && /^\d+$/.test(searchQuery.trim()) && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
              <div className="flex items-center mb-3">
                <FiSearch className="h-5 w-5 text-blue-600 mr-2" />
                <h3 className="text-lg font-semibold text-blue-800">TSIN ID Detected</h3>
              </div>
              <p className="text-blue-700 mb-4">
                No products found in your database for TSIN: <strong>{searchQuery.trim()}</strong>
              </p>
              <p className="text-blue-600 mb-4">
                You can still test scraping this product directly from Takealot to see what competitive data is available.
              </p>
              
              <div className="flex space-x-3">
                <button
                  onClick={() => {
                    const manualTsin = searchQuery.trim();
                    console.warn(`🚨 MANUAL TSIN TEST: No database record found for TSIN ${manualTsin}`);
                    console.warn(`🚨 Using fallback /p/ URL format - this may not work correctly`);
                    
                    const manualProduct: SearchProduct = {
                      id: `manual-${manualTsin}`,
                      tsin: manualTsin,
                      title: `Manual TSIN Test: ${manualTsin}`,
                      sku: manualTsin,
                      // No offer_url available for manual tests - this is the core problem
                      url: `https://www.takealot.com/p/${manualTsin}`,
                    };
                    scrapeProductData(manualProduct);
                  }}
                  disabled={isScraping}
                  className="flex items-center px-6 py-3 bg-orange-600 text-white rounded-lg hover:bg-orange-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {isScraping ? (
                    <FiLoader className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <FiPlay className="h-4 w-4 mr-2" />
                  )}
                  {isScraping ? 'Scraping...' : 'Test Scraping (May Fail)'}
                </button>
                <button
                  onClick={() => {
                    const testUrl = `https://www.takealot.com/p/${searchQuery.trim()}`;
                    console.warn(`🚨 Opening deprecated URL format: ${testUrl}`);
                    window.open(testUrl, '_blank');
                  }}
                  className="flex items-center px-4 py-3 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors"
                >
                  <FiExternalLink className="h-4 w-4 mr-2" />
                  Test URL (May Not Work)
                </button>
              </div>
              
              <div className="mt-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                <p className="text-sm text-yellow-800">
                  <strong>⚠️ Warning:</strong> Manual TSIN testing uses deprecated /p/ URL format. 
                  For accurate results, search for products that exist in your database with proper offer_url containing PLID format.
                </p>
              </div>
            </div>
          )}

          {/* Search Results */}
          {searchResults.length > 0 && (
            <div>
              <h3 className="text-md font-medium text-gray-900 mb-3">
                Found {searchResults.length} products in your database
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {searchResults.map((product) => (
                  <div key={product.id} className="border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow">
                    <div className="flex items-start space-x-3">
                      {product.imageUrl && (
                        <img
                          src={product.imageUrl}
                          alt={product.title}
                          className="w-16 h-16 object-cover rounded-lg"
                          onError={(e) => {
                            e.currentTarget.style.display = 'none';
                          }}
                        />
                      )}
                      <div className="flex-1 min-w-0">
                        <h4 className="text-sm font-medium text-gray-900 line-clamp-2">{product.title}</h4>
                        <p className="text-xs text-gray-500 mt-1">TSIN: {product.tsin}</p>
                        <p className="text-xs text-gray-500">SKU: {product.sku}</p>
                        {product.currentPrice && (
                          <p className="text-sm font-medium text-green-600 mt-1">
                            {formatCurrency(product.currentPrice)}
                          </p>
                        )}
                      </div>
                    </div>
                    <button
                      onClick={() => scrapeProductData(product)}
                      disabled={isScraping}
                      className="w-full mt-3 flex items-center justify-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    >
                      {isScraping && selectedProduct?.id === product.id ? (
                        <FiLoader className="h-4 w-4 mr-2 animate-spin" />
                      ) : (
                        <FiPlay className="h-4 w-4 mr-2" />
                      )}
                      {isScraping && selectedProduct?.id === product.id ? 'Scraping...' : 'Scrape Data'}
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Scraped Data Display */}
        {scrapedData && (
          <div className="bg-white rounded-lg shadow">
            {/* Header */}
            <div className="p-6 border-b border-gray-200">
              <div className="flex items-start justify-between">
                <div className="flex items-start space-x-4">
                  {scrapedData.imageUrl && (
                    <img
                      src={scrapedData.imageUrl}
                      alt={scrapedData.title}
                      className="w-20 h-20 object-cover rounded-lg"
                      onError={(e) => {
                        e.currentTarget.style.display = 'none';
                      }}
                    />
                  )}
                  <div>
                    <h2 className="text-xl font-bold text-gray-900">{scrapedData.title}</h2>
                    <p className="text-gray-600">TSIN: {scrapedData.tsin}</p>
                    {scrapedData.brand && (
                      <p className="text-gray-600">Brand: {scrapedData.brand}</p>
                    )}
                    <div className="flex items-center mt-2">
                      {scrapedData.success ? (
                        <FiCheckCircle className="h-5 w-5 text-green-600 mr-2" />
                      ) : (
                        <FiXCircle className="h-5 w-5 text-red-600 mr-2" />
                      )}
                      <span className={`text-sm font-medium ${scrapedData.success ? 'text-green-600' : 'text-red-600'}`}>
                        {scrapedData.success ? 'Scraping Successful' : 'Scraping Failed'}
                      </span>
                    </div>
                  </div>
                </div>
                
                <div className="flex items-center space-x-2">
                  <button
                    onClick={() => setShowDetailModal(true)}
                    className="flex items-center px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors"
                  >
                    <FiEye className="h-4 w-4 mr-2" />
                    View Details
                  </button>
                  <button
                    onClick={() => setShowJsonView(!showJsonView)}
                    className={`flex items-center px-4 py-2 rounded-lg transition-colors ${
                      showJsonView 
                        ? 'bg-indigo-600 text-white hover:bg-indigo-700' 
                        : 'bg-indigo-100 text-indigo-700 hover:bg-indigo-200'
                    }`}
                  >
                    <FiDatabase className="h-4 w-4 mr-2" />
                    {showJsonView ? 'Hide JSON' : 'Show JSON Response'}
                  </button>
                  <button
                    onClick={() => window.open(scrapedData.productUrl, '_blank')}
                    className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                  >
                    <FiExternalLink className="h-4 w-4 mr-2" />
                    View on Takealot
                  </button>
                </div>
              </div>
            </div>

            {scrapedData.success ? (
              <>
                {/* Key Metrics */}
                <div className="p-6 border-b border-gray-200">
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">Market Intelligence</h3>
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                    <div className="bg-green-50 p-4 rounded-lg">
                      <div className="flex items-center">
                        <FiDollarSign className="h-8 w-8 text-green-600 mr-3" />
                        <div>
                          <p className="text-sm font-medium text-green-600">Winner Price</p>
                          <p className="text-2xl font-bold text-green-800">{formatCurrency(scrapedData.winnerPrice)}</p>
                          <p className="text-xs text-green-600">{scrapedData.winnerSeller}</p>
                        </div>
                      </div>
                    </div>

                    <div className="bg-blue-50 p-4 rounded-lg">
                      <div className="flex items-center">
                        <FiUsers className="h-8 w-8 text-blue-600 mr-3" />
                        <div>
                          <p className="text-sm font-medium text-blue-600">Total Sellers</p>
                          <p className="text-2xl font-bold text-blue-800">{scrapedData.totalSellers}</p>
                          <p className="text-xs text-blue-600">Active competitors</p>
                        </div>
                      </div>
                    </div>

                    <div className="bg-yellow-50 p-4 rounded-lg">
                      <div className="flex items-center">
                        <FiStar className="h-8 w-8 text-yellow-600 mr-3" />
                        <div>
                          <p className="text-sm font-medium text-yellow-600">Rating</p>
                          <div className="flex items-center">
                            <p className="text-2xl font-bold text-yellow-800 mr-2">{scrapedData.rating.toFixed(1)}</p>
                            <div className="flex">
                              {getRatingStars(scrapedData.rating)}
                            </div>
                          </div>
                          <p className="text-xs text-yellow-600">{scrapedData.reviewCount} reviews</p>
                        </div>
                      </div>
                    </div>

                    <div className="bg-purple-50 p-4 rounded-lg">
                      <div className="flex items-center">
                        <FiTrendingUp className="h-8 w-8 text-purple-600 mr-3" />
                        <div>
                          <p className="text-sm font-medium text-purple-600">Price Difference</p>
                          <p className="text-2xl font-bold text-purple-800">
                            {scrapedData.winDifference > 0 ? '+' : ''}{formatCurrency(scrapedData.winDifference)}
                          </p>
                          <p className="text-xs text-purple-600">
                            {scrapedData.winDifference > 0 ? 'Above winner' : 'At winner price'}
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* JSON Response Viewer */}
                {showJsonView && rawJsonResponse && (
                  <div className="p-6 border-b border-gray-200 bg-gray-50">
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="text-lg font-semibold text-gray-900">Raw API Response</h3>
                      <div className="flex items-center space-x-2">
                        <span className="text-sm text-gray-600">
                          Proxy Used: <span className="font-medium text-indigo-600">
                            {rawJsonResponse.scrapingResult?.proxyUsed || 'webshare'}
                          </span>
                        </span>
                        <span className="text-sm text-gray-600">
                          Duration: <span className="font-medium text-green-600">
                            {rawJsonResponse.scrapingResult?.scrapingDuration || 0}ms
                          </span>
                        </span>
                        <button
                          onClick={() => {
                            navigator.clipboard.writeText(JSON.stringify(rawJsonResponse, null, 2));
                            // You could add a toast notification here
                          }}
                          className="flex items-center px-3 py-1 bg-gray-600 text-white text-sm rounded hover:bg-gray-700 transition-colors"
                        >
                          <FiDownload className="h-3 w-3 mr-1" />
                          Copy JSON
                        </button>
                      </div>
                    </div>
                    <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
                      <div className="p-4 max-h-96 overflow-y-auto">
                        <pre className="text-sm text-gray-800 whitespace-pre-wrap font-mono">
                          {JSON.stringify(rawJsonResponse, null, 2)}
                        </pre>
                      </div>
                    </div>
                    <div className="mt-3 text-sm text-gray-600">
                      <p>
                        <strong>Field Analysis:</strong> This raw response shows all available data fields from the scraping API. 
                        Use this to understand the data structure and identify new fields for integration.
                      </p>
                    </div>
                  </div>
                )}

                {/* Sellers Table */}
                {scrapedData.sellers.length > 0 && (
                  <div className="p-6">
                    <h3 className="text-lg font-semibold text-gray-900 mb-4">Competitive Pricing Analysis</h3>
                    <div className="overflow-x-auto">
                      <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-gray-50">
                          <tr>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Rank</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Seller</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Price</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Stock Status</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Winner</th>
                          </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                          {scrapedData.sellers.map((seller, index) => (
                            <tr key={index} className={seller.isWinner ? 'bg-green-50' : ''}>
                              <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                                #{seller.rank}
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap">
                                <div className="text-sm font-medium text-gray-900">{seller.name}</div>
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap">
                                <div className="text-sm font-bold text-gray-900">{formatCurrency(seller.price)}</div>
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap">
                                <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${getStockStatusColor(seller.stock)}`}>
                                  {seller.stock}
                                </span>
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap">
                                {seller.isWinner && (
                                  <span className="inline-flex items-center px-2 py-1 text-xs font-medium text-green-800 bg-green-100 rounded-full">
                                    <FiCheckCircle className="h-3 w-3 mr-1" />
                                    Winner
                                  </span>
                                )}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </>
            ) : (
              // Error state
              <div className="p-6">
                <div className="bg-red-50 border border-red-200 rounded-lg p-6">
                  <div className="flex items-center">
                    <FiAlertCircle className="h-8 w-8 text-red-600 mr-3" />
                    <div>
                      <h3 className="text-lg font-semibold text-red-800">Scraping Failed</h3>
                      <p className="text-red-700 mt-1">{scrapedData.errorMessage}</p>
                      <button
                        onClick={() => selectedProduct && scrapeProductData(selectedProduct)}
                        disabled={isScraping}
                        className="mt-4 flex items-center px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 transition-colors"
                      >
                        <FiRefreshCw className="h-4 w-4 mr-2" />
                        Retry Scraping
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Scraping Metadata */}
            <div className="p-6 bg-gray-50 border-t border-gray-200">
              <div className="flex items-center justify-between mb-3">
                <h4 className="text-sm font-medium text-gray-900">Scraping Information</h4>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm text-gray-600">
                <div className="flex items-center">
                  <FiClock className="h-4 w-4 mr-2" />
                  <span>Scraped: {scrapedData.scrapedAt.toLocaleString()}</span>
                </div>
                {scrapedData.scrapingDuration && (
                  <div className="flex items-center">
                    <FiTrendingUp className="h-4 w-4 mr-2" />
                    <span>Duration: {formatDuration(scrapedData.scrapingDuration)}</span>
                  </div>
                )}
                {scrapedData.proxyUsed && (
                  <div className="flex items-center">
                    <FiShield className="h-4 w-4 mr-2" />
                    <span>Proxy: {scrapedData.proxyUsed}</span>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Search History */}
        {searchHistory.length > 0 && (
          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Recent Scraping History</h3>
            <div className="space-y-3">
              {searchHistory.slice(0, 5).map((item, index) => (
                <div key={index} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                  <div className="flex items-center space-x-3">
                    <div className={`w-2 h-2 rounded-full ${item.success ? 'bg-green-400' : 'bg-red-400'}`}></div>
                    <div>
                      <p className="text-sm font-medium text-gray-900 truncate max-w-xs">{item.title}</p>
                      <p className="text-xs text-gray-500">TSIN: {item.tsin} • {item.scrapedAt.toLocaleString()}</p>
                    </div>
                  </div>
                  <div className="flex items-center space-x-4">
                    {item.success && (
                      <div className="text-right">
                        <p className="text-sm font-medium text-gray-900">{formatCurrency(item.winnerPrice)}</p>
                        <p className="text-xs text-gray-500">{item.totalSellers} sellers</p>
                      </div>
                    )}
                    <button
                      onClick={() => setScrapedData(item)}
                      className="text-blue-600 hover:text-blue-800"
                    >
                      <FiEye className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Sample Data Display Modal */}
      <SampleDataDisplay 
        show={showSampleData} 
        onClose={() => setShowSampleData(false)} 
      />
    </div>
  );
}
