// Auto Price Statistics Component
import React from 'react';
import { AutoPriceStats as AutoPriceStatsType } from '../../types/auto-price.types';
import { 
  FiPackage, 
  FiTrendingUp, 
  FiClock, 
  FiTarget,
  FiActivity,
  FiPercent
} from 'react-icons/fi';

interface AutoPriceStatsProps {
  stats: AutoPriceStatsType;
  scrapedPercentage: number;
  pendingPercentage: number;
}

export const AutoPriceStats: React.FC<AutoPriceStatsProps> = ({
  stats,
  scrapedPercentage,
  pendingPercentage
}) => {
  const formatCurrency = (amount: number) => `R${amount.toFixed(2)}`;
  
  const formatTime = (date?: Date) => {
    if (!date) return 'Never';
    return new Date(date).toLocaleString();
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-4">
      {/* Total Products */}
      <div className="bg-blue-50 rounded-lg p-4 border border-blue-100">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-blue-600">Total Products</p>
            <p className="text-2xl font-bold text-blue-900">{stats.totalProducts.toLocaleString()}</p>
          </div>
          <div className="p-3 bg-blue-100 rounded-full">
            <FiPackage className="w-6 h-6 text-blue-600" />
          </div>
        </div>
      </div>

      {/* Scraped Today */}
      <div className="bg-green-50 rounded-lg p-4 border border-green-100">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-green-600">Scraped Today</p>
            <p className="text-2xl font-bold text-green-900">{stats.scrapedToday.toLocaleString()}</p>
            <p className="text-xs text-green-600">{scrapedPercentage.toFixed(1)}% of total</p>
          </div>
          <div className="p-3 bg-green-100 rounded-full">
            <FiActivity className="w-6 h-6 text-green-600" />
          </div>
        </div>
      </div>

      {/* Pending Scraping */}
      <div className="bg-orange-50 rounded-lg p-4 border border-orange-100">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-orange-600">Pending Scraping</p>
            <p className="text-2xl font-bold text-orange-900">{stats.pendingScraping.toLocaleString()}</p>
            <p className="text-xs text-orange-600">{pendingPercentage.toFixed(1)}% pending</p>
          </div>
          <div className="p-3 bg-orange-100 rounded-full">
            <FiClock className="w-6 h-6 text-orange-600" />
          </div>
        </div>
      </div>

      {/* Average Win Difference */}
      <div className="bg-purple-50 rounded-lg p-4 border border-purple-100">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-purple-600">Avg. Win Difference</p>
            <p className={`text-2xl font-bold ${
              stats.averageWinDifference >= 0 ? 'text-red-900' : 'text-green-900'
            }`}>
              {formatCurrency(stats.averageWinDifference)}
            </p>
            <p className="text-xs text-purple-600">vs competitors</p>
          </div>
          <div className="p-3 bg-purple-100 rounded-full">
            <FiTrendingUp className="w-6 h-6 text-purple-600" />
          </div>
        </div>
      </div>

      {/* Success Rate */}
      <div className="bg-indigo-50 rounded-lg p-4 border border-indigo-100">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-indigo-600">Success Rate (24h)</p>
            <p className="text-2xl font-bold text-indigo-900">{stats.successRate24h.toFixed(1)}%</p>
            <p className="text-xs text-indigo-600">scraping success</p>
          </div>
          <div className="p-3 bg-indigo-100 rounded-full">
            <FiPercent className="w-6 h-6 text-indigo-600" />
          </div>
        </div>
      </div>

      {/* Last Activity */}
      <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-gray-600">Last Activity</p>
            <p className="text-sm font-bold text-gray-900">
              {formatTime(stats.lastScrapingActivity)}
            </p>
            <p className="text-xs text-gray-600">scraping activity</p>
          </div>
          <div className="p-3 bg-gray-200 rounded-full">
            <FiTarget className="w-6 h-6 text-gray-600" />
          </div>
        </div>
      </div>
    </div>
  );
};
