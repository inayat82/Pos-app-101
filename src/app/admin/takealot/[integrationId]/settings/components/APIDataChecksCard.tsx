'use client';

import React, { useState, useEffect } from 'react';
import { FiZap, FiPackage, FiTrendingUp } from 'react-icons/fi';
import { Timestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase/firebase';
import { doc, getDoc } from 'firebase/firestore';

interface APIDataChecksCardProps {
  integrationId: string;
  apiKey: string;
  showMessage: (type: 'success' | 'error', message: string) => void;
  loadApiLogs: () => void;
}

interface ApiCheckResult {
  status: 'success' | 'error' | 'info' | null;
  message: string;
  totalProducts?: number;
  totalPages?: number;
  totalSales?: number;
}

const APIDataChecksCard: React.FC<APIDataChecksCardProps> = ({
  integrationId,
  apiKey,
  showMessage,
  loadApiLogs
}) => {
  // API & Data Checks State
  const [isCheckingApiConnection, setIsCheckingApiConnection] = useState(false);
  const [apiConnectionResult, setApiConnectionResult] = useState<ApiCheckResult>({ status: null, message: '' });

  const [isCheckingProducts, setIsCheckingProducts] = useState(false);
  const [productCheckResult, setProductCheckResult] = useState<ApiCheckResult>({ status: null, message: '' });
  
  const [isCheckingSales, setIsCheckingSales] = useState(false);
  const [salesCheckResult, setSalesCheckResult] = useState<ApiCheckResult>({ status: null, message: '' });

  // State to hold the last checked times from Firestore
  const [lastCheckedTimes, setLastCheckedTimes] = useState<{
    connection?: Timestamp | null;
    products?: Timestamp | null;
    sales?: Timestamp | null;
  }>({});

  const [savedApiCheckData, setSavedApiCheckData] = useState<{
    products?: { totalProducts: number; totalPages: number; checkedAt: Timestamp; rawData?: any };
    sales?: { totalSales: number; totalPages: number; checkedAt: Timestamp; rawData?: any };
    lastConnectionCheck?: { status: 'success' | 'error'; message: string; testedAt: Timestamp };
  } | null>(null);

  // Load saved API check data
  const loadSavedApiCheckData = async () => {
    if (!integrationId) return;
    try {
      const apiCheckDataRef = doc(db, `takealotIntegrations/${integrationId}/diagnostics`, 'apiChecks');
      const docSnap = await getDoc(apiCheckDataRef);
      if (docSnap.exists()) {
        const data = docSnap.data() as any;
        setSavedApiCheckData(data);
        
        // Update lastCheckedTimes from the loaded data
        setLastCheckedTimes({
          connection: data.lastConnectionCheck?.testedAt || null,
          products: data.products?.checkedAt || null,
          sales: data.sales?.checkedAt || null,
        });
        
        // Always show success messages if data exists and is valid
        if (data.products && typeof data.products.totalProducts === 'number') {
          setProductCheckResult({
            status: 'success',
            message: 'Successfully fetched product totals.',
            totalProducts: data.products.totalProducts,
            totalPages: data.products.totalPages || 0
          });
        }
        
        if (data.sales && typeof data.sales.totalSales === 'number') {
          setSalesCheckResult({
            status: 'success',
            message: 'Successfully fetched sales totals.',
            totalSales: data.sales.totalSales,
            totalPages: data.sales.totalPages || 0
          });
        }
        
        if (data.lastConnectionCheck && data.lastConnectionCheck.status) {
          setApiConnectionResult({
            status: data.lastConnectionCheck.status,
            message: data.lastConnectionCheck.message || 'Connection status available'
          });
        }
      } else {
        // Clear states if no saved data
        setSavedApiCheckData(null);
        setLastCheckedTimes({});
        setProductCheckResult({ status: null, message: '' });
        setSalesCheckResult({ status: null, message: '' });
        setApiConnectionResult({ status: null, message: '' });
      }
    } catch (error: any) {
      console.error("Failed to load saved API check data:", error);
      showMessage('error', 'Failed to load previous check data');
    }
  };

  // Load data on component mount
  useEffect(() => {
    loadSavedApiCheckData();
  }, [integrationId]);

  // Handler for checking API connection
  const handleCheckApiConnection = async () => {
    if (!integrationId || !apiKey) {
      showMessage('error', 'Integration ID or API Key is missing.');
      return;
    }
    setIsCheckingApiConnection(true);
    setApiConnectionResult({ status: 'info', message: 'Testing connection...' });
    try {
      console.log('Testing API connection...');
      
      const response = await fetch('/api/admin/takealot/check-connection', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ integrationId, apiKey }),
      });
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error('Error response:', errorText);
        throw new Error(`HTTP ${response.status}: ${errorText}`);
      }
      
      const result = await response.json();
      console.log('Connection test result:', result);
      
      if (result.status === 'success') {
        setApiConnectionResult({ status: 'success', message: result.message || 'API connection successful.' });
        showMessage('success', result.message || 'API connection successful.');
      } else {
        setApiConnectionResult({ status: 'error', message: result.message || 'Connection test failed.' });
        showMessage('error', result.message || 'Connection test failed.');
      }
    } catch (err: any) {
      console.error('Connection test failed:', err);
      const errorMessage = err.message || 'Unknown error occurred';
      setApiConnectionResult({ status: 'error', message: `Connection failed: ${errorMessage}` });
      showMessage('error', `Connection test failed: ${errorMessage}`);
    } finally {
      setIsCheckingApiConnection(false);
      // Reload data to get updated timestamps
      setTimeout(() => loadSavedApiCheckData(), 1000);
      loadApiLogs(); // Refresh API logs
    }
  };

  // Handler for checking total products
  const handleCheckTotalProducts = async () => {
    if (!integrationId || !apiKey) {
      showMessage('error', 'Integration ID or API Key is missing.');
      return;
    }
    setIsCheckingProducts(true);
    setProductCheckResult({ status: 'info', message: 'Checking products...' });
    try {
      const response = await fetch('/api/admin/takealot/check-products', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ integrationId, apiKey }),
      });
      const result = await response.json();
      
      if (response.ok && result.status === 'success') {
        // Validate the data before setting
        const totalProducts = typeof result.totalProducts === 'number' ? result.totalProducts : 0;
        const totalPages = typeof result.totalPages === 'number' ? result.totalPages : 0;
        
        setProductCheckResult({ 
          status: 'success', 
          message: result.message || 'Successfully fetched product data', 
          totalProducts, 
          totalPages 
        });
        showMessage('success', `Products check completed: ${totalProducts.toLocaleString()} products found`);
      } else {
        setProductCheckResult({ status: 'error', message: result.message || 'Product check failed.' });
        showMessage('error', result.message || 'Product check failed.');
      }
    } catch (err: any) {
      const errorMessage = err.message || 'Network error occurred';
      setProductCheckResult({ status: 'error', message: `Error: ${errorMessage}` });
      showMessage('error', `Product check request failed: ${errorMessage}`);
    } finally {
      setIsCheckingProducts(false);
      // Reload data to get updated timestamps
      setTimeout(() => loadSavedApiCheckData(), 1000);
      loadApiLogs(); // Refresh API logs
    }
  };

  // Handler for checking sales data
  const handleCheckSalesData = async () => {
    if (!integrationId || !apiKey) {
      showMessage('error', 'Integration ID or API Key is missing.');
      return;
    }
    setIsCheckingSales(true);
    setSalesCheckResult({ status: 'info', message: 'Checking sales data...' });
    try {
      const response = await fetch('/api/admin/takealot/check-sales', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ integrationId, apiKey }),
      });
      const result = await response.json();
      
      if (response.ok && result.status === 'success') {
        // Validate the data before setting
        const totalSales = typeof result.totalSales === 'number' ? result.totalSales : 0;
        const totalPages = typeof result.totalPages === 'number' ? result.totalPages : 0;
        
        setSalesCheckResult({ 
          status: 'success', 
          message: result.message || 'Successfully fetched sales data', 
          totalSales, 
          totalPages 
        });
        showMessage('success', `Sales check completed: ${totalSales.toLocaleString()} sales found`);
      } else {
        setSalesCheckResult({ status: 'error', message: result.message || 'Sales check failed.' });
        showMessage('error', result.message || 'Sales check failed.');
      }
    } catch (err: any) {
      const errorMessage = err.message || 'Network error occurred';
      setSalesCheckResult({ status: 'error', message: `Error: ${errorMessage}` });
      showMessage('error', `Sales check request failed: ${errorMessage}`);
    } finally {
      setIsCheckingSales(false);
      // Reload data to get updated timestamps
      setTimeout(() => loadSavedApiCheckData(), 1000);
      loadApiLogs(); // Refresh API logs
    }
  };

  // Helper function to format timestamp
  const formatTimestamp = (timestamp: Timestamp | null) => {
    if (!timestamp) return null;
    const date = timestamp.toDate();
    return date.toLocaleString();
  };

  // Helper function to get status color
  const getStatusColor = (status: 'success' | 'error' | 'info' | null) => {
    switch (status) {
      case 'success':
        return 'text-green-600 bg-green-50 border-green-200';
      case 'error':
        return 'text-red-600 bg-red-50 border-red-200';
      case 'info':
        return 'text-blue-600 bg-blue-50 border-blue-200';
      default:
        return 'text-gray-600 bg-gray-50 border-gray-200';
    }
  };

  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h2 className="text-xl font-semibold text-gray-900 mb-2">API & Data Checks</h2>
          <p className="text-sm text-gray-600">Test your API connection and retrieve key metrics from Takealot</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* API Connection Check */}
        <div className="bg-blue-50 rounded-xl p-5 border border-blue-200">
          <div className="flex items-center space-x-3 mb-4">
            <div className="p-2 bg-blue-500 rounded-lg">
              <FiZap className="w-5 h-5 text-white" />
            </div>
            <div>
              <h3 className="font-semibold text-gray-900">API Connection</h3>
              <p className="text-sm text-gray-600">Verify authentication</p>
            </div>
          </div>
          
          {lastCheckedTimes.connection && (
            <div className="mb-4 text-sm text-gray-600">
              <span className="font-medium">Last: </span>
              <span>{formatTimestamp(lastCheckedTimes.connection)}</span>
            </div>
          )}
          
          <button
            onClick={handleCheckApiConnection}
            disabled={isCheckingApiConnection || !apiKey}
            className={`w-full px-4 py-2.5 text-sm font-semibold rounded-lg transition-all duration-200 ${
              isCheckingApiConnection || !apiKey
                ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                : 'bg-blue-600 hover:bg-blue-700 text-white shadow-md hover:shadow-lg transform hover:-translate-y-0.5'
            }`}
          >
            {isCheckingApiConnection ? 'Testing...' : 'Test Connection'}
          </button>
          
          {apiConnectionResult.message && (
            <div className={`mt-3 p-3 rounded-lg text-sm ${getStatusColor(apiConnectionResult.status)}`}>
              <p className="font-medium">{apiConnectionResult.message}</p>
            </div>
          )}
        </div>

        {/* Products Check */}
        <div className="bg-purple-50 rounded-xl p-5 border border-purple-200">
          <div className="flex items-center space-x-3 mb-4">
            <div className="p-2 bg-purple-500 rounded-lg">
              <FiPackage className="w-5 h-5 text-white" />
            </div>
            <div>
              <h3 className="font-semibold text-gray-900">Product Catalog</h3>
              <p className="text-sm text-gray-600">Total products & pages</p>
            </div>
          </div>
          
          {lastCheckedTimes.products && (
            <div className="mb-4 text-sm text-gray-600">
              <span className="font-medium">Last: </span>
              <span>{formatTimestamp(lastCheckedTimes.products)}</span>
            </div>
          )}
          
          <button
            onClick={handleCheckTotalProducts}
            disabled={isCheckingProducts || !apiKey}
            className={`w-full px-4 py-2.5 text-sm font-semibold rounded-lg transition-all duration-200 ${
              isCheckingProducts || !apiKey
                ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                : 'bg-purple-600 hover:bg-purple-700 text-white shadow-md hover:shadow-lg transform hover:-translate-y-0.5'
            }`}
          >
            {isCheckingProducts ? 'Checking...' : 'Check Products'}
          </button>
          
          {productCheckResult.message && (
            <div className={`mt-3 p-3 rounded-lg text-sm ${getStatusColor(productCheckResult.status)}`}>
              <p className="font-medium">{productCheckResult.message}</p>
              {productCheckResult.totalProducts !== undefined && (
                <div className="mt-2 grid grid-cols-2 gap-2 text-center">
                  <div>
                    <div className="text-xs text-gray-600">Products</div>
                    <div className="font-bold text-purple-600">{productCheckResult.totalProducts.toLocaleString()}</div>
                  </div>
                  <div>
                    <div className="text-xs text-gray-600">Pages</div>
                    <div className="font-bold text-purple-600">{productCheckResult.totalPages}</div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Sales Check */}
        <div className="bg-green-50 rounded-xl p-5 border border-green-200">
          <div className="flex items-center space-x-3 mb-4">
            <div className="p-2 bg-green-500 rounded-lg">
              <FiTrendingUp className="w-5 h-5 text-white" />
            </div>
            <div>
              <h3 className="font-semibold text-gray-900">Sales Overview</h3>
              <p className="text-sm text-gray-600">Recent sales activity</p>
            </div>
          </div>
          
          {lastCheckedTimes.sales && (
            <div className="mb-4 text-sm text-gray-600">
              <span className="font-medium">Last: </span>
              <span>{formatTimestamp(lastCheckedTimes.sales)}</span>
            </div>
          )}
          
          <button
            onClick={handleCheckSalesData}
            disabled={isCheckingSales || !apiKey}
            className={`w-full px-4 py-2.5 text-sm font-semibold rounded-lg transition-all duration-200 ${
              isCheckingSales || !apiKey
                ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                : 'bg-green-600 hover:bg-green-700 text-white shadow-md hover:shadow-lg transform hover:-translate-y-0.5'
            }`}
          >
            {isCheckingSales ? 'Checking...' : 'Check Sales'}
          </button>
          
          {salesCheckResult.message && (
            <div className={`mt-3 p-3 rounded-lg text-sm ${getStatusColor(salesCheckResult.status)}`}>
              <p className="font-medium">{salesCheckResult.message}</p>
              {salesCheckResult.totalSales !== undefined && (
                <div className="mt-2 grid grid-cols-2 gap-2 text-center">
                  <div>
                    <div className="text-xs text-gray-600">Sales</div>
                    <div className="font-bold text-green-600">{salesCheckResult.totalSales.toLocaleString()}</div>
                  </div>
                  <div>
                    <div className="text-xs text-gray-600">Pages</div>
                    <div className="font-bold text-green-600">{salesCheckResult.totalPages}</div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default APIDataChecksCard;
