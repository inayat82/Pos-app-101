'use client';

import React, { useState, useEffect } from 'react';
import { 
  FiDatabase, 
  FiPlay, 
  FiLoader, 
  FiArrowLeft, 
  FiCheckCircle, 
  FiXCircle, 
  FiEye, 
  FiCode,
  FiRefreshCw,
  FiDownload,
  FiPackage,
  FiZap,
  FiClock,
  FiGlobe,
  FiImage,
  FiMapPin,
  FiServer
} from 'react-icons/fi';
import { useAuth } from '@/context/AuthContext';
import { usePageTitle } from '@/context/PageTitleContext';
import { useRouter } from 'next/navigation';

interface UserProduct {
  id: string;
  tsin: string;
  title: string;
  sku: string;
  currentPrice: number;
  status: string;
  imageUrl: string;
  offer_url?: string;
}

interface ScrapingResult {
  userProduct: UserProduct;
  scrapingSuccess: boolean;
  scrapedData: any;
  scrapingError: string | null;
  rawApiResponse: any;
  scrapingDuration: number;
  scrapedAt: string;
  proxyDetails?: {
    ip: string;
    location: string;
    provider: string;
  };
}

interface ScrapingResponse {
  success: boolean;
  integrationId: string;
  summary: {
    totalProducts: number;
    successfulScrapes: number;
    failedScrapes: number;
    scrapingMethod: string;
  };
  scrapingResults: ScrapingResult[];
  metadata: {
    scrapedAt: string;
    maxProductsRequested: number;
    actualProductsFound: number;
  };
}

export default function UserProductsScrapePage({ params }: { params: Promise<{ integrationId: string }> }) {
  const { currentUser } = useAuth();
  const { setPageTitle } = usePageTitle();
  const router = useRouter();
  
  const [integrationId, setIntegrationId] = useState<string>('');
  const [isLoading, setIsLoading] = useState(false);
  const [scrapingData, setScrapingData] = useState<ScrapingResponse | null>(null);
  const [selectedResult, setSelectedResult] = useState<ScrapingResult | null>(null);
  const [viewMode, setViewMode] = useState<'summary' | 'json' | 'raw'>('summary');
  const [maxProducts, setMaxProducts] = useState(10);

  useEffect(() => {
    const getIntegrationId = async () => {
      const resolvedParams = await params;
      setIntegrationId(resolvedParams.integrationId);
    };
    getIntegrationId();
  }, [params]);

  useEffect(() => {
    setPageTitle('Your Products Scraper - JSON Analysis');
    return () => setPageTitle('');
  }, [setPageTitle]);

  const handleScrapeUserProducts = async () => {
    if (!integrationId) return;

    setIsLoading(true);
    try {
      const response = await fetch('/api/admin/auto-price/scrape-user-products', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          integrationId,
          maxProducts
        }),
      });

      const data = await response.json();

      if (data.success) {
        setScrapingData(data);
      } else {
        alert(`Scraping failed: ${data.error}`);
      }
    } catch (error) {
      console.error('Error scraping user products:', error);
      alert('Failed to scrape products');
    } finally {
      setIsLoading(false);
    }
  };

  const downloadJson = () => {
    if (!scrapingData) return;
    
    const dataStr = JSON.stringify(scrapingData, null, 2);
    const dataBlob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(dataBlob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `user-products-scraping-${integrationId}-${new Date().toISOString().split('T')[0]}.json`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const renderJsonView = (data: any, title: string) => {
    return (
      <div className="bg-gray-900 text-green-400 p-4 rounded-lg font-mono text-sm overflow-x-auto">
        <div className="text-gray-400 mb-2 font-sans text-xs uppercase tracking-wide">{title}</div>
        <pre className="whitespace-pre-wrap">{JSON.stringify(data, null, 2)}</pre>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-gray-50 py-2">
      <div className="w-full px-2 sm:px-4 lg:px-6">
        {/* Header - Compact */}
        <div className="mb-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <button
                onClick={() => router.back()}
                className="p-1.5 rounded-lg border border-gray-300 hover:bg-gray-100 transition-colors"
              >
                <FiArrowLeft className="h-4 w-4" />
              </button>
              <div>
                <h1 className="text-xl font-bold text-gray-900 flex items-center">
                  <FiDatabase className="mr-2 h-6 w-6 text-blue-600" />
                  Your Products Scraper
                </h1>
                <p className="text-gray-600 text-sm">
                  Scrape and analyze your Takealot products data in JSON format
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Control Panel - Compact */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 mb-4">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div className="flex items-center space-x-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Max Products to Scrape
                </label>
                <select
                  value={maxProducts}
                  onChange={(e) => setMaxProducts(Number(e.target.value))}
                  className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  disabled={isLoading}
                >
                  <option value={5}>5 products</option>
                  <option value={10}>10 products</option>
                  <option value={20}>20 products</option>
                  <option value={50}>50 products</option>
                </select>
              </div>
            </div>

            <div className="flex items-center space-x-2">
              {scrapingData && (
                <button
                  onClick={downloadJson}
                  className="flex items-center px-3 py-1.5 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors text-sm"
                >
                  <FiDownload className="mr-2 h-4 w-4" />
                  Download JSON
                </button>
              )}
              
              <button
                onClick={handleScrapeUserProducts}
                disabled={isLoading || !integrationId}
                className="flex items-center px-4 py-1.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400 transition-colors text-sm"
              >
                {isLoading ? (
                  <>
                    <FiLoader className="mr-2 h-4 w-4 animate-spin" />
                    Scraping...
                  </>
                ) : (
                  <>
                    <FiPlay className="mr-2 h-4 w-4" />
                    Scrape My Products
                  </>
                )}
              </button>
            </div>
          </div>
        </div>

        {/* Results */}
        <div className="space-y-6">
          {/* Compact Scraping Summary */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 mb-4">
            <h2 className="text-lg font-semibold text-gray-900 mb-3 flex items-center">
              <FiZap className="mr-2 h-5 w-5 text-blue-600" />
              Scraping Summary
            </h2>
            
            {scrapingData ? (
              <>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-3">
                  <div className="bg-blue-50 p-3 rounded-lg">
                    <div className="text-xl font-bold text-blue-600">{scrapingData.summary.totalProducts}</div>
                    <div className="text-xs text-gray-600">Total Products</div>
                  </div>
                  <div className="bg-green-50 p-3 rounded-lg">
                    <div className="text-xl font-bold text-green-600">{scrapingData.summary.successfulScrapes}</div>
                    <div className="text-xs text-gray-600">Successful</div>
                  </div>
                  <div className="bg-red-50 p-3 rounded-lg">
                    <div className="text-xl font-bold text-red-600">{scrapingData.summary.failedScrapes}</div>
                    <div className="text-xs text-gray-600">Failed</div>
                  </div>
                  <div className="bg-purple-50 p-3 rounded-lg">
                    <div className="text-xl font-bold text-purple-600">{scrapingData.summary.scrapingMethod}</div>
                    <div className="text-xs text-gray-600">Fast Parallel</div>
                  </div>
                </div>
                
                {/* Compact Summary Info */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
                  <div className="flex items-center text-gray-600">
                    <FiClock className="mr-1 h-3 w-3" />
                    Last Scraped: {new Date(scrapingData.metadata?.scrapedAt || Date.now()).toLocaleString()}
                  </div>
                  <div className="flex items-center text-gray-600">
                    <FiDatabase className="mr-1 h-3 w-3" />
                    Integration: {scrapingData.integrationId}
                  </div>
                  <div className="flex items-center text-gray-600">
                    <FiServer className="mr-1 h-3 w-3" />
                    Status: <span className="ml-1 text-green-600 font-medium">Active</span>
                  </div>
                </div>
              </>
            ) : (
              <div className="text-center py-4 text-gray-500">
                <FiDatabase className="mx-auto h-8 w-8 mb-2" />
                <p className="text-sm">No scraping data available yet</p>
                <p className="text-xs">Run a scraping operation to see results</p>
              </div>
            )}
          </div>

          {/* Compact Products Results Table */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
            <h3 className="text-lg font-semibold text-gray-900 mb-3 flex items-center">
              <FiPackage className="mr-2 h-5 w-5 text-blue-600" />
              Products Results
            </h3>
            
            {scrapingData && scrapingData.scrapingResults ? (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-200 bg-gray-50">
                      <th className="text-left py-2 px-3 font-medium text-gray-900">Status</th>
                      <th className="text-left py-2 px-3 font-medium text-gray-900">Image</th>
                      <th className="text-left py-2 px-3 font-medium text-gray-900">Product</th>
                      <th className="text-left py-2 px-3 font-medium text-gray-900">TSIN/SKU</th>
                      <th className="text-left py-2 px-3 font-medium text-gray-900">Price</th>
                      <th className="text-left py-2 px-3 font-medium text-gray-900">Stock</th>
                      <th className="text-left py-2 px-3 font-medium text-gray-900">Timestamp</th>
                      <th className="text-left py-2 px-3 font-medium text-gray-900">Proxy</th>
                      <th className="text-left py-2 px-3 font-medium text-gray-900">Duration</th>
                      <th className="text-left py-2 px-3 font-medium text-gray-900">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {scrapingData.scrapingResults.map((result, index) => (
                      <tr key={index} className="border-b border-gray-100 hover:bg-gray-50">
                        <td className="py-2 px-3">
                          {result.scrapingSuccess ? (
                            <FiCheckCircle className="h-4 w-4 text-green-600" />
                          ) : (
                            <FiXCircle className="h-4 w-4 text-red-600" />
                          )}
                        </td>
                        <td className="py-2 px-3">
                          {result.userProduct.imageUrl || result.scrapedData?.image_url ? (
                            <img 
                              src={result.scrapedData?.image_url || result.userProduct.imageUrl} 
                              alt={result.userProduct.title}
                              className="w-8 h-8 object-cover rounded border border-gray-200"
                              onError={(e) => {
                                const target = e.target as HTMLImageElement;
                                target.style.display = 'none';
                                target.nextElementSibling?.classList.remove('hidden');
                              }}
                            />
                          ) : (
                            <div className="w-8 h-8 bg-gray-100 rounded border border-gray-200 flex items-center justify-center">
                              <FiImage className="h-3 w-3 text-gray-400" />
                            </div>
                          )}
                        </td>
                        <td className="py-2 px-3 max-w-xs">
                          <div className="truncate font-medium text-gray-900" title={result.userProduct.title}>
                            {result.userProduct.title}
                          </div>
                        </td>
                        <td className="py-2 px-3">
                          <div className="text-xs">
                            <div className="font-mono text-gray-600">TSIN: {result.userProduct.tsin}</div>
                            <div className="font-mono text-gray-500">SKU: {result.userProduct.sku}</div>
                          </div>
                        </td>
                        <td className="py-2 px-3">
                          <div className="font-medium text-green-600">
                            {result.scrapedData?.price || `R ${result.userProduct.currentPrice}`}
                          </div>
                        </td>
                        <td className="py-2 px-3">
                          <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                            result.scrapedData?.stock?.toLowerCase().includes('in stock') 
                              ? 'bg-green-100 text-green-800' 
                              : result.scrapedData?.stock?.toLowerCase().includes('out of stock')
                              ? 'bg-red-100 text-red-800'
                              : 'bg-yellow-100 text-yellow-800'
                          }`}>
                            {result.scrapedData?.stock || 'Unknown'}
                          </span>
                        </td>
                        <td className="py-2 px-3 text-xs text-gray-500">
                          {new Date(result.scrapedAt).toLocaleString()}
                        </td>
                        <td className="py-2 px-3 text-xs">
                          {result.proxyDetails ? (
                            <div className="text-gray-600">
                              <div className="font-mono">{result.proxyDetails.ip}</div>
                              <div className="text-gray-500">{result.proxyDetails.location}</div>
                            </div>
                          ) : (
                            <span className="text-gray-500">Direct</span>
                          )}
                        </td>
                        <td className="py-2 px-3 text-xs text-gray-500">
                          {result.scrapingDuration}ms
                        </td>
                        <td className="py-2 px-3">
                          <button
                            onClick={() => setSelectedResult(result)}
                            className="flex items-center px-2 py-1 bg-blue-100 text-blue-700 rounded hover:bg-blue-200 transition-colors text-xs"
                          >
                            <FiEye className="mr-1 h-3 w-3" />
                            View
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="text-center py-8 text-gray-500">
                <FiPackage className="mx-auto h-8 w-8 mb-2" />
                <p className="text-sm">No product results available yet</p>
                <p className="text-xs">Run a scraping operation to see product data</p>
              </div>
            )}
          </div>

          {/* Compact View Mode Selector */}
          {scrapingData && (
            <div className="space-y-4">
              <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-3">
                <div className="flex items-center space-x-4">
                  <span className="text-sm font-medium text-gray-700">View Mode:</span>
                  <div className="flex space-x-2">
                    {(['summary', 'json', 'raw'] as const).map((mode) => (
                      <button
                        key={mode}
                        onClick={() => setViewMode(mode)}
                        className={`px-3 py-1 rounded text-sm font-medium transition-colors ${
                          viewMode === mode
                            ? 'bg-blue-600 text-white'
                            : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                        }`}
                      >
                        {mode === 'summary' && 'Summary'}
                        {mode === 'json' && 'Scraped Data JSON'}
                        {mode === 'raw' && 'Raw API Response'}
                      </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Results Display */}
            {viewMode === 'summary' && (
              <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                  <FiPackage className="mr-2 h-5 w-5 text-blue-600" />
                  Products Results
                </h3>
                
                <div className="space-y-4">
                  {scrapingData.scrapingResults.map((result, index) => (
                    <div key={index} className="border border-gray-200 rounded-lg p-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-3">
                          {result.scrapingSuccess ? (
                            <FiCheckCircle className="h-5 w-5 text-green-600" />
                          ) : (
                            <FiXCircle className="h-5 w-5 text-red-600" />
                          )}
                          <div>
                            <h4 className="font-medium text-gray-900">{result.userProduct.title}</h4>
                            <div className="text-sm text-gray-600">
                              TSIN: {result.userProduct.tsin} | SKU: {result.userProduct.sku}
                            </div>
                          </div>
                        </div>
                        
                        <button
                          onClick={() => setSelectedResult(result)}
                          className="flex items-center px-3 py-1 bg-blue-100 text-blue-700 rounded-lg hover:bg-blue-200 transition-colors"
                        >
                          <FiEye className="mr-1 h-4 w-4" />
                          View Data
                        </button>
                      </div>
                      
                      {result.scrapingError && (
                        <div className="mt-2 text-sm text-red-600 bg-red-50 p-2 rounded">
                          Error: {result.scrapingError}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {viewMode === 'json' && (
              <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                  <FiCode className="mr-2 h-5 w-5 text-blue-600" />
                  Complete Scraping Data (JSON)
                </h3>
                {renderJsonView(scrapingData, "Complete Scraping Results")}
              </div>
            )}

            {viewMode === 'raw' && (
              <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                  <FiCode className="mr-2 h-5 w-5 text-blue-600" />
                  Raw API Responses
                </h3>
                <div className="space-y-4">
                  {scrapingData.scrapingResults.map((result, index) => (
                    result.rawApiResponse && (
                      <div key={index}>
                        <h4 className="font-medium text-gray-900 mb-2">
                          {result.userProduct.title} (TSIN: {result.userProduct.tsin})
                        </h4>
                        {renderJsonView(result.rawApiResponse, `Raw API Response ${index + 1}`)}
                      </div>
                    )
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
        </div>

        {/* Individual Result Modal */}
        {selectedResult && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
              <div className="p-6 border-b border-gray-200">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-semibold text-gray-900">
                    {selectedResult.userProduct.title}
                  </h3>
                  <button
                    onClick={() => setSelectedResult(null)}
                    className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                  >
                    <FiXCircle className="h-5 w-5" />
                  </button>
                </div>
                <div className="text-sm text-gray-600 mt-1">
                  TSIN: {selectedResult.userProduct.tsin} | Duration: {selectedResult.scrapingDuration}ms
                </div>
              </div>
              
              <div className="p-6 space-y-6">
                {selectedResult.scrapedData && (
                  <div>
                    <h4 className="font-medium text-gray-900 mb-3">Scraped Data</h4>
                    {renderJsonView(selectedResult.scrapedData, "Scraped Product Data")}
                  </div>
                )}
                
                {selectedResult.rawApiResponse && (
                  <div>
                    <h4 className="font-medium text-gray-900 mb-3">Raw API Response</h4>
                    {renderJsonView(selectedResult.rawApiResponse, "Raw API Response")}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* No Data State */}
        {!scrapingData && !isLoading && (
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-8 text-center">
            <FiDatabase className="mx-auto h-8 w-8 text-gray-400 mb-3" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">No Scraping Data</h3>
            <p className="text-gray-600 text-sm">
              Click "Scrape My Products" to start analyzing your Takealot products data.
              <br />
              This will only scrape products that belong to your integration.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
