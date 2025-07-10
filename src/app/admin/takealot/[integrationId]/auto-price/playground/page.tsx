'use client';

import React, { useState, useEffect } from 'react';
import { FiSearch, FiPlay, FiLoader, FiCheck, FiX, FiArrowLeft, FiExternalLink, FiClock, FiShield, FiTrendingUp, FiStar, FiUsers } from 'react-icons/fi';
import { useAuth } from '@/context/AuthContext';
import { usePageTitle } from '@/context/PageTitleContext';

interface ScrapingResult {
  tsin: string;
  url: string;
  offer_url?: string;
  title: string;
  price: number;
  rating: number;
  reviewCount: number;
  winnerSeller: string;
  winnerSellerPrice: number;
  totalSellers: number;
  imageUrl: string;
  availability: string;
  breadcrumbs: string[];
  competitors?: Array<{
    name: string;
    price: number;
    inStock: boolean;
  }>;
  scrapingDuration: number;
  proxyUsed: string;
  timestamp: Date;
  success: boolean;
  errorMessage?: string;
}

interface SearchProduct {
  tsin: string;
  title: string;
  url: string;
  offer_url?: string;
  imageUrl?: string;
  currentPrice?: number;
}

export default function ScrapingPlaygroundPage({ params }: { params: Promise<{ integrationId: string }> }) {
  const { currentUser } = useAuth();
  const { setPageTitle } = usePageTitle();
  
  // Fix for Next.js 15 - params are now async
  const resolvedParams = React.use(params);
  const { integrationId } = resolvedParams;

  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<SearchProduct[]>([]);
  const [selectedProduct, setSelectedProduct] = useState<SearchProduct | null>(null);
  const [scrapingResult, setScrapingResult] = useState<ScrapingResult | null>(null);
  const [isSearching, setIsSearching] = useState(false);
  const [isScraping, setIsScraping] = useState(false);
  const [searchHistory, setSearchHistory] = useState<ScrapingResult[]>([]);

  useEffect(() => {
    setPageTitle('Scraping Playground - Takealot Auto Price');
    return () => setPageTitle('');
  }, [setPageTitle]);

  const searchProducts = async () => {
    if (!searchQuery.trim()) return;

    setIsSearching(true);
    try {
      // First, try to find products in our database
      const response = await fetch(`/api/admin/auto-price/search-products?integrationId=${integrationId}&query=${encodeURIComponent(searchQuery)}`);
      
      if (response.ok) {
        const products = await response.json();
        setSearchResults(products);
      } else {
        // If no products found, suggest manual TSIN input
        setSearchResults([]);
      }
    } catch (error) {
      console.error('Error searching products:', error);
      setSearchResults([]);
    } finally {
      setIsSearching(false);
    }
  };

  const scrapeProduct = async (product: SearchProduct) => {
    if (!product.tsin) return;

    setIsScraping(true);
    setScrapingResult(null);

    try {
      const response = await fetch('/api/admin/auto-price/scrape-single', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          integrationId,
          tsin: product.tsin,
          testMode: true, // This indicates it's a playground test
        }),
      });

      const result = await response.json();

      if (response.ok) {
        const scrapingResult: ScrapingResult = {
          ...result,
          timestamp: new Date(),
        };
        setScrapingResult(scrapingResult);
        
        // Add to history
        setSearchHistory(prev => [scrapingResult, ...prev.slice(0, 9)]); // Keep last 10
      } else {
        setScrapingResult({
          tsin: product.tsin,
          url: product.url,
          title: product.title,
          price: 0,
          rating: 0,
          reviewCount: 0,
          winnerSeller: '',
          winnerSellerPrice: 0,
          totalSellers: 0,
          imageUrl: '',
          availability: '',
          breadcrumbs: [],
          scrapingDuration: 0,
          proxyUsed: '',
          timestamp: new Date(),
          success: false,
          errorMessage: result.error || 'Scraping failed',
        });
      }
    } catch (error) {
      console.error('Error scraping product:', error);
      setScrapingResult({
        tsin: product.tsin,
        url: product.url,
        title: product.title,
        price: 0,
        rating: 0,
        reviewCount: 0,
        winnerSeller: '',
        winnerSellerPrice: 0,
        totalSellers: 0,
        imageUrl: '',
        availability: '',
        breadcrumbs: [],
        scrapingDuration: 0,
        proxyUsed: '',
        timestamp: new Date(),
        success: false,
        errorMessage: 'Network error or unexpected failure',
      });
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

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-6xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <button
              onClick={() => window.close()}
              className="flex items-center px-3 py-2 text-gray-600 hover:text-gray-800 transition-colors"
            >
              <FiArrowLeft className="h-4 w-4 mr-2" />
              Back to Auto Price
            </button>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Scraping Playground</h1>
              <p className="text-gray-600">Test and analyze Takealot product scraping in real-time</p>
            </div>
          </div>
        </div>

        {/* Search Section */}
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Search for Products</h2>
          
          <div className="flex space-x-4 mb-4">
            <div className="flex-1">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && searchProducts()}
                placeholder="Enter product name, SKU, or TSIN ID number..."
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
            <button
              onClick={searchProducts}
              disabled={isSearching || !searchQuery.trim()}
              className="flex items-center px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {isSearching ? (
                <FiLoader className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <FiSearch className="h-4 w-4 mr-2" />
              )}
              Search
            </button>
          </div>

          {/* Manual TSIN Input */}
          {searchResults.length === 0 && !isSearching && searchQuery.trim() && /^\d+$/.test(searchQuery.trim()) && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
              <div className="flex items-center mb-3">
                <FiSearch className="h-5 w-5 text-blue-600 mr-2" />
                <h3 className="text-lg font-semibold text-blue-800">TSIN ID Detected</h3>
              </div>
              <p className="text-blue-700 mb-4">
                No products found in your database, but the search query looks like a TSIN ID number. 
                You can test scraping this product directly from Takealot to see what data we can extract.
              </p>
              <div className="bg-white rounded-lg p-4 mb-4">
                <p className="text-sm text-gray-600 mb-2">Product URL:</p>
                <a 
                  href={`https://www.takealot.com/p/${searchQuery.trim()}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-600 hover:text-blue-800 underline break-all"
                  onClick={(e) => {
                    e.preventDefault();
                    window.open(`https://www.takealot.com/p/${searchQuery.trim()}`, '_blank', 'noopener,noreferrer');
                  }}
                >
                  https://www.takealot.com/p/{searchQuery.trim()}
                </a>
              </div>
              <div className="flex space-x-3">
                <button
                  onClick={() => {
                    const manualProduct = {
                      tsin: searchQuery.trim(),
                      title: `Test Product TSIN: ${searchQuery.trim()}`,
                      url: `https://www.takealot.com/p/${searchQuery.trim()}`,
                    };
                    setSelectedProduct(manualProduct);
                    scrapeProduct(manualProduct);
                  }}
                  disabled={isScraping}
                  className="flex items-center px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {isScraping ? (
                    <FiLoader className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <FiPlay className="h-4 w-4 mr-2" />
                  )}
                  {isScraping ? 'Scraping...' : 'Start Scraping Test'}
                </button>
                <button
                  onClick={() => window.open(`https://www.takealot.com/p/${searchQuery.trim()}`, '_blank', 'noopener,noreferrer')}
                  className="flex items-center px-4 py-3 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors"
                >
                  <FiExternalLink className="h-4 w-4 mr-2" />
                  View on Takealot
                </button>
              </div>
            </div>
          )}

          {/* Search Results */}
          {searchResults.length > 0 && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {searchResults.map((product) => (
                <div key={product.tsin} className="border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow">
                  <div className="flex items-start space-x-3">
                    {product.imageUrl && (
                      <img
                        src={product.imageUrl}
                        alt={product.title}
                        className="w-16 h-16 object-cover rounded-lg"
                      />
                    )}
                    <div className="flex-1 min-w-0">
                      <h3 className="text-sm font-medium text-gray-900 truncate">{product.title}</h3>
                      <p className="text-xs text-gray-500 mt-1">TSIN: {product.tsin}</p>
                      <p className="text-xs text-blue-600 mt-1 truncate">
                        <a 
                          href={product.offer_url || product.url} 
                          target="_blank" 
                          rel="noopener noreferrer" 
                          className="hover:underline"
                          onClick={(e) => {
                            e.preventDefault();
                            window.open(product.offer_url || product.url, '_blank', 'noopener,noreferrer');
                          }}
                        >
                          {product.offer_url || product.url}
                        </a>
                      </p>
                      {product.currentPrice && (
                        <p className="text-sm font-semibold text-green-600 mt-1">
                          {formatCurrency(product.currentPrice)}
                        </p>
                      )}
                      <button
                        onClick={() => {
                          setSelectedProduct(product);
                          scrapeProduct(product);
                        }}
                        className="mt-2 flex items-center px-3 py-1 bg-indigo-600 text-white text-xs rounded-md hover:bg-indigo-700 transition-colors"
                      >
                        <FiPlay className="h-3 w-3 mr-1" />
                        Scrape
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Scraping Progress */}
        {isScraping && selectedProduct && (
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center space-x-4">
              <FiLoader className="h-6 w-6 text-blue-600 animate-spin" />
              <div>
                <h3 className="text-lg font-semibold text-gray-900">Scraping in Progress</h3>
                <p className="text-gray-600">Fetching data for TSIN: {selectedProduct.tsin}</p>
              </div>
            </div>
          </div>
        )}

        {/* Scraping Results */}
        {scrapingResult && (
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-semibold text-gray-900">Scraping Results</h2>
              <div className="flex items-center space-x-2">
                {scrapingResult.success ? (
                  <div className="flex items-center text-green-600">
                    <FiCheck className="h-4 w-4 mr-1" />
                    Success
                  </div>
                ) : (
                  <div className="flex items-center text-red-600">
                    <FiX className="h-4 w-4 mr-1" />
                    Failed
                  </div>
                )}
                <div className="flex items-center text-gray-500 text-sm">
                  <FiClock className="h-4 w-4 mr-1" />
                  {formatDuration(scrapingResult.scrapingDuration)}
                </div>
              </div>
            </div>

            {scrapingResult.success ? (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Product Information */}
                <div className="space-y-4">
                  <div className="flex items-start space-x-4">
                    {scrapingResult.imageUrl && (
                      <img
                        src={scrapingResult.imageUrl}
                        alt={scrapingResult.title}
                        className="w-24 h-24 object-cover rounded-lg"
                      />
                    )}
                    <div className="flex-1">
                      <h3 className="text-lg font-semibold text-gray-900">{scrapingResult.title}</h3>
                      <p className="text-gray-600">TSIN: {scrapingResult.tsin}</p>
                      <button
                        onClick={() => window.open(scrapingResult.offer_url || scrapingResult.url, '_blank', 'noopener,noreferrer')}
                        className="inline-flex items-center text-blue-600 hover:text-blue-800 text-sm mt-1 cursor-pointer"
                      >
                        <FiExternalLink className="h-3 w-3 mr-1" />
                        View on Takealot
                      </button>
                    </div>
                  </div>

                  {/* Breadcrumbs */}
                  {scrapingResult.breadcrumbs.length > 0 && (
                    <div>
                      <h4 className="text-sm font-medium text-gray-700 mb-2">Category</h4>
                      <p className="text-sm text-gray-600">{scrapingResult.breadcrumbs.join(' > ')}</p>
                    </div>
                  )}
                </div>

                {/* Metrics */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-green-50 p-4 rounded-lg">
                    <div className="flex items-center">
                      <FiTrendingUp className="h-5 w-5 text-green-600 mr-2" />
                      <span className="text-sm font-medium text-green-800">Current Price</span>
                    </div>
                    <p className="text-2xl font-bold text-green-900 mt-1">
                      {formatCurrency(scrapingResult.price)}
                    </p>
                  </div>

                  <div className="bg-blue-50 p-4 rounded-lg">
                    <div className="flex items-center">
                      <FiStar className="h-5 w-5 text-blue-600 mr-2" />
                      <span className="text-sm font-medium text-blue-800">Rating</span>
                    </div>
                    <p className="text-2xl font-bold text-blue-900 mt-1">
                      {scrapingResult.rating.toFixed(1)}
                    </p>
                    <p className="text-xs text-blue-700">{scrapingResult.reviewCount} reviews</p>
                  </div>

                  <div className="bg-purple-50 p-4 rounded-lg">
                    <div className="flex items-center">
                      <FiUsers className="h-5 w-5 text-purple-600 mr-2" />
                      <span className="text-sm font-medium text-purple-800">Winner Seller</span>
                    </div>
                    <p className="text-lg font-bold text-purple-900 mt-1">
                      {formatCurrency(scrapingResult.winnerSellerPrice)}
                    </p>
                    <p className="text-xs text-purple-700">{scrapingResult.winnerSeller}</p>
                  </div>

                  <div className="bg-orange-50 p-4 rounded-lg">
                    <div className="flex items-center">
                      <FiShield className="h-5 w-5 text-orange-600 mr-2" />
                      <span className="text-sm font-medium text-orange-800">Total Sellers</span>
                    </div>
                    <p className="text-2xl font-bold text-orange-900 mt-1">
                      {scrapingResult.totalSellers}
                    </p>
                  </div>
                </div>

                {/* Technical Details */}
                <div className="lg:col-span-2 bg-gray-50 p-4 rounded-lg">
                  <h4 className="text-sm font-medium text-gray-700 mb-3">Technical Details</h4>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                    <div>
                      <span className="text-gray-600">Proxy Used:</span>
                      <p className="font-medium">{scrapingResult.proxyUsed || 'N/A'}</p>
                    </div>
                    <div>
                      <span className="text-gray-600">Duration:</span>
                      <p className="font-medium">{formatDuration(scrapingResult.scrapingDuration)}</p>
                    </div>
                    <div>
                      <span className="text-gray-600">Availability:</span>
                      <p className="font-medium">{scrapingResult.availability}</p>
                    </div>
                    <div>
                      <span className="text-gray-600">Timestamp:</span>
                      <p className="font-medium">{scrapingResult.timestamp.toLocaleTimeString()}</p>
                    </div>
                  </div>
                </div>

                {/* Competitors Table */}
                {scrapingResult.competitors && scrapingResult.competitors.length > 0 && (
                  <div className="lg:col-span-2 bg-white border rounded-lg">
                    <div className="p-4 border-b bg-gray-50">
                      <h4 className="text-lg font-semibold text-gray-900">Competing Sellers</h4>
                      <p className="text-sm text-gray-600">All sellers found for this product</p>
                    </div>
                    <div className="overflow-x-auto">
                      <table className="w-full">
                        <thead className="bg-gray-50">
                          <tr>
                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                              Seller
                            </th>
                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                              Price
                            </th>
                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                              Status
                            </th>
                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                              Position
                            </th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-200">
                          {scrapingResult.competitors
                            .sort((a, b) => a.price - b.price)
                            .map((competitor, index) => (
                            <tr key={index} className={competitor.name === scrapingResult.winnerSeller ? 'bg-green-50' : ''}>
                              <td className="px-4 py-3">
                                <div className="flex items-center">
                                  {competitor.name === scrapingResult.winnerSeller && (
                                    <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800 mr-2">
                                      Winner
                                    </span>
                                  )}
                                  <span className="font-medium text-gray-900">{competitor.name}</span>
                                </div>
                              </td>
                              <td className="px-4 py-3">
                                <span className="text-lg font-semibold text-gray-900">
                                  {formatCurrency(competitor.price)}
                                </span>
                              </td>
                              <td className="px-4 py-3">
                                <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                                  competitor.inStock 
                                    ? 'bg-green-100 text-green-800' 
                                    : 'bg-red-100 text-red-800'
                                }`}>
                                  {competitor.inStock ? 'In Stock' : 'Out of Stock'}
                                </span>
                              </td>
                              <td className="px-4 py-3">
                                <span className="text-sm text-gray-600">
                                  #{index + 1} cheapest
                                </span>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                <h4 className="text-red-800 font-medium mb-2">Scraping Failed</h4>
                <p className="text-red-700">{scrapingResult.errorMessage}</p>
                <div className="mt-3 text-sm text-red-600">
                  <p>TSIN: {scrapingResult.tsin}</p>
                  <p>URL: {scrapingResult.url}</p>
                  <p>Proxy: {scrapingResult.proxyUsed || 'N/A'}</p>
                </div>
              </div>
            )}
          </div>
        )}

        {/* History */}
        {searchHistory.length > 0 && (
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Recent Tests</h2>
            <div className="space-y-3">
              {searchHistory.slice(0, 5).map((result, index) => (
                <div key={index} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                  <div className="flex items-center space-x-3">
                    {result.success ? (
                      <FiCheck className="h-4 w-4 text-green-600" />
                    ) : (
                      <FiX className="h-4 w-4 text-red-600" />
                    )}
                    <div>
                      <p className="font-medium text-gray-900 truncate max-w-xs">{result.title}</p>
                      <p className="text-sm text-gray-600">TSIN: {result.tsin}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    {result.success && (
                      <p className="font-semibold text-green-600">{formatCurrency(result.price)}</p>
                    )}
                    <p className="text-xs text-gray-500">{result.timestamp.toLocaleTimeString()}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
