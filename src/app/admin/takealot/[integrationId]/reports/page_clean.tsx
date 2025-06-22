'use client';

import React, { useEffect } from 'react';
import { 
  FiBarChart, 
  FiTrendingUp, 
  FiDollarSign, 
  FiPackage, 
  FiDownload, 
  FiRefreshCw,
  FiActivity,
  FiTarget
} from 'react-icons/fi';
import { useAuth } from '@/context/AuthContext';
import { usePageTitle } from '@/context/PageTitleContext';

export default function TakealotReportsPage({ params }: { params: { integrationId: string } }) {
  const { currentUser } = useAuth();
  const { setPageTitle } = usePageTitle();
  const { integrationId } = params;

  useEffect(() => {
    setPageTitle('Takealot Reports');
    return () => setPageTitle('');
  }, [setPageTitle]);

  // Function to handle report card clicks
  const handleReportCardClick = (reportTypeId: string) => {
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

  const reportTypes = [
    {
      id: 'products',
      name: 'Product Performance',
      description: 'Top selling products and inventory analysis',
      icon: FiPackage,
      color: 'bg-green-500',
      available: true
    },
    {
      id: 'overview',
      name: 'Sales Overview',
      description: 'General sales performance metrics',
      icon: FiBarChart,
      color: 'bg-blue-500',
      available: false
    },
    {
      id: 'trends',
      name: 'Sales Trends',
      description: 'Historical sales trends and patterns',
      icon: FiTrendingUp,
      color: 'bg-purple-500',
      available: false
    },
    {
      id: 'profitability',
      name: 'Profitability Analysis',
      description: 'Profit margins and financial performance',
      icon: FiDollarSign,
      color: 'bg-yellow-500',
      available: false
    },
    {
      id: 'inventory',
      name: 'Inventory Report',
      description: 'Stock levels and reorder recommendations',
      icon: FiTarget,
      color: 'bg-red-500',
      available: false
    },
    {
      id: 'returns',
      name: 'Returns Analysis',
      description: 'Product returns and refund patterns',
      icon: FiActivity,
      color: 'bg-orange-500',
      available: false
    }
  ];

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
              disabled
              className="flex items-center px-4 py-2 bg-gray-300 text-gray-500 rounded-lg cursor-not-allowed"
            >
              <FiRefreshCw className="mr-2" />
              Generate Report
            </button>
            <button
              disabled
              className="flex items-center px-4 py-2 bg-gray-300 text-gray-500 rounded-lg cursor-not-allowed"
            >
              <FiDownload className="mr-2" />
              Export
            </button>
          </div>
        </div>
      </div>

      {/* Available Reports Grid */}
      <div className="bg-white p-6 rounded-lg shadow-sm">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Available Reports</h2>
        <p className="text-sm text-gray-600 mb-6">Click on any report card to view it in a dedicated page</p>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {reportTypes.map((type) => {
            const IconComponent = type.icon;
            
            return (
              <div
                key={type.id}
                className={`p-4 rounded-lg border-2 cursor-pointer transition-all duration-200 transform hover:scale-105 ${
                  type.available
                    ? 'border-gray-200 hover:border-blue-300 hover:shadow-md'
                    : 'border-gray-200 hover:border-gray-300 opacity-75'
                }`}
                onClick={() => type.available && handleReportCardClick(type.id)}
              >
                <div className="flex items-center mb-2">
                  <div className={`p-2 rounded-lg ${type.color} mr-3 transition-transform duration-200`}>
                    <IconComponent className="h-5 w-5 text-white" />
                  </div>
                  <h3 className="font-semibold text-gray-900">{type.name}</h3>
                </div>
                <p className="text-sm text-gray-600 mb-3">{type.description}</p>
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium px-2 py-1 rounded-full bg-gray-100 text-gray-600">
                    Click to View
                  </span>
                  <div className="flex space-x-1">
                    {type.available ? (
                      <span className="text-xs bg-green-100 text-green-700 px-2 py-1 rounded-full font-medium">
                        Available
                      </span>
                    ) : (
                      <span className="text-xs bg-orange-100 text-orange-700 px-2 py-1 rounded-full font-medium">
                        Coming Soon
                      </span>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Quick Actions */}
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
            className="flex items-center p-4 bg-blue-50 rounded-lg hover:bg-blue-100 transition-colors opacity-75 cursor-not-allowed"
            disabled
          >
            <FiBarChart className="h-8 w-8 text-blue-600 mr-3" />
            <div className="text-left">
              <div className="font-medium text-gray-900">Sales Overview</div>
              <div className="text-sm text-gray-600">Coming soon</div>
            </div>
          </button>
          
          <button
            onClick={() => handleReportCardClick('trends')}
            className="flex items-center p-4 bg-purple-50 rounded-lg hover:bg-purple-100 transition-colors opacity-75 cursor-not-allowed"
            disabled
          >
            <FiTrendingUp className="h-8 w-8 text-purple-600 mr-3" />
            <div className="text-left">
              <div className="font-medium text-gray-900">Sales Trends</div>
              <div className="text-sm text-gray-600">Coming soon</div>
            </div>
          </button>
        </div>
      </div>

      {/* Coming Soon Notice */}
      <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6">
        <div className="flex items-center mb-4">
          <FiActivity className="h-6 w-6 text-yellow-600 mr-3" />
          <h2 className="text-lg font-semibold text-yellow-800">Report Features</h2>
        </div>
        <div className="space-y-3 text-yellow-700">
          <p>
            The Takealot Reports system provides comprehensive analytics for your integration:
          </p>
          <ul className="list-disc pl-6 space-y-1">
            <li><strong>Product Performance:</strong> ✅ Available - Detailed product analytics with optimized performance</li>
            <li><strong>Sales Analytics:</strong> 🚧 Coming Soon - Revenue and sales performance metrics</li>
            <li><strong>Trend Analysis:</strong> 🚧 Coming Soon - Historical data and forecasting</li>
            <li><strong>Profitability Reports:</strong> 🚧 Coming Soon - Margin analysis and financial insights</li>
            <li><strong>Inventory Management:</strong> 🚧 Coming Soon - Stock level monitoring and reorder alerts</li>
            <li><strong>Returns Analysis:</strong> 🚧 Coming Soon - Product return patterns and insights</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
