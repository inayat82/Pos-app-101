// Bulk Actions Component for Auto Price
import React, { useState } from 'react';
import { AutoPriceService } from '../../services/auto-price.service';
import { 
  FiPlay, 
  FiTrash2, 
  FiDownload, 
  FiRefreshCw,
  FiX,
  FiCheck
} from 'react-icons/fi';

interface BulkActionsProps {
  selectedCount: number;
  selectedProductIds: string[];
  integrationId: string;
  onClearSelection: () => void;
  onRefreshData: () => void;
}

export const BulkActions: React.FC<BulkActionsProps> = ({
  selectedCount,
  selectedProductIds,
  integrationId,
  onClearSelection,
  onRefreshData
}) => {
  const [isProcessing, setIsProcessing] = useState(false);
  const [processingAction, setProcessingAction] = useState<string>('');
  const [actionResult, setActionResult] = useState<{
    type: 'success' | 'error';
    message: string;
  } | null>(null);

  const showResult = (type: 'success' | 'error', message: string) => {
    setActionResult({ type, message });
    setTimeout(() => setActionResult(null), 5000);
  };

  const handleBulkScrape = async () => {
    setIsProcessing(true);
    setProcessingAction('scraping');
    
    try {
      const result = await AutoPriceService.bulkScrapeProducts({
        productIds: selectedProductIds,
        integrationId,
        priority: 'normal'
      });
      
      showResult('success', `Bulk scraping started! Job ID: ${result.jobId}`);
      onClearSelection();
      onRefreshData();
    } catch (error: any) {
      showResult('error', `Failed to start bulk scraping: ${error.message}`);
    } finally {
      setIsProcessing(false);
      setProcessingAction('');
    }
  };

  const handleClearScrapedData = async () => {
    if (!confirm(`Are you sure you want to clear scraped data for ${selectedCount} products? This action cannot be undone.`)) {
      return;
    }

    setIsProcessing(true);
    setProcessingAction('clearing');
    
    try {
      let successCount = 0;
      let errorCount = 0;

      // Process products one by one (could be optimized with batch API)
      for (const productId of selectedProductIds) {
        try {
          await AutoPriceService.clearScrapedData(productId);
          successCount++;
        } catch (error) {
          errorCount++;
        }
      }

      if (errorCount === 0) {
        showResult('success', `Cleared scraped data for ${successCount} products`);
      } else {
        showResult('error', `Cleared ${successCount} products, ${errorCount} failed`);
      }
      
      onClearSelection();
      onRefreshData();
    } catch (error: any) {
      showResult('error', `Failed to clear scraped data: ${error.message}`);
    } finally {
      setIsProcessing(false);
      setProcessingAction('');
    }
  };

  const handleRetryFailed = async () => {
    setIsProcessing(true);
    setProcessingAction('retrying');
    
    try {
      const result = await AutoPriceService.retryFailedScraping(
        integrationId,
        selectedProductIds
      );
      
      showResult('success', `Retry scraping started! ${result.message}`);
      onClearSelection();
      onRefreshData();
    } catch (error: any) {
      showResult('error', `Failed to retry scraping: ${error.message}`);
    } finally {
      setIsProcessing(false);
      setProcessingAction('');
    }
  };

  const handleExportSelected = async () => {
    setIsProcessing(true);
    setProcessingAction('exporting');
    
    try {
      // For now, we'll export all data with filters
      // In a real implementation, you'd modify the API to accept specific product IDs
      const blob = await AutoPriceService.exportData(integrationId, undefined, 'csv');
      
      // Create download link
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `auto-price-selected-${new Date().toISOString().split('T')[0]}.csv`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
      
      showResult('success', `Exported ${selectedCount} products successfully`);
    } catch (error: any) {
      showResult('error', `Failed to export data: ${error.message}`);
    } finally {
      setIsProcessing(false);
      setProcessingAction('');
    }
  };

  return (
    <div className="space-y-4">
      {/* Action Result */}
      {actionResult && (
        <div className={`p-3 rounded-lg flex items-center ${
          actionResult.type === 'success' 
            ? 'bg-green-50 border border-green-200 text-green-800'
            : 'bg-red-50 border border-red-200 text-red-800'
        }`}>
          {actionResult.type === 'success' ? (
            <FiCheck className="w-4 h-4 mr-2" />
          ) : (
            <FiX className="w-4 h-4 mr-2" />
          )}
          <span className="flex-1">{actionResult.message}</span>
          <button
            onClick={() => setActionResult(null)}
            className="text-current hover:opacity-70"
          >
            <FiX className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Bulk Actions */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <span className="text-sm font-medium text-blue-800">
            {selectedCount} product{selectedCount !== 1 ? 's' : ''} selected
          </span>
          
          <div className="flex items-center space-x-2">
            {/* Bulk Scrape */}
            <button
              onClick={handleBulkScrape}
              disabled={isProcessing}
              className="px-3 py-2 bg-green-600 text-white text-sm font-medium rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 flex items-center"
            >
              {processingAction === 'scraping' ? (
                <FiRefreshCw className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <FiPlay className="w-4 h-4 mr-2" />
              )}
              {processingAction === 'scraping' ? 'Starting...' : 'Scrape All'}
            </button>

            {/* Retry Failed */}
            <button
              onClick={handleRetryFailed}
              disabled={isProcessing}
              className="px-3 py-2 bg-orange-600 text-white text-sm font-medium rounded-lg hover:bg-orange-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 flex items-center"
            >
              {processingAction === 'retrying' ? (
                <FiRefreshCw className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <FiRefreshCw className="w-4 h-4 mr-2" />
              )}
              {processingAction === 'retrying' ? 'Starting...' : 'Retry Failed'}
            </button>

            {/* Export Selected */}
            <button
              onClick={handleExportSelected}
              disabled={isProcessing}
              className="px-3 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 flex items-center"
            >
              {processingAction === 'exporting' ? (
                <FiRefreshCw className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <FiDownload className="w-4 h-4 mr-2" />
              )}
              {processingAction === 'exporting' ? 'Exporting...' : 'Export'}
            </button>

            {/* Clear Scraped Data */}
            <button
              onClick={handleClearScrapedData}
              disabled={isProcessing}
              className="px-3 py-2 bg-red-600 text-white text-sm font-medium rounded-lg hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 flex items-center"
            >
              {processingAction === 'clearing' ? (
                <FiRefreshCw className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <FiTrash2 className="w-4 h-4 mr-2" />
              )}
              {processingAction === 'clearing' ? 'Clearing...' : 'Clear Data'}
            </button>
          </div>
        </div>

        {/* Clear Selection */}
        <button
          onClick={onClearSelection}
          className="px-3 py-2 bg-gray-100 text-gray-700 text-sm font-medium rounded-lg hover:bg-gray-200 transition-all duration-200 flex items-center"
        >
          <FiX className="w-4 h-4 mr-2" />
          Clear Selection
        </button>
      </div>

      {/* Processing Indicator */}
      {isProcessing && (
        <div className="flex items-center justify-center py-2">
          <div className="flex items-center text-blue-600">
            <FiRefreshCw className="w-4 h-4 mr-2 animate-spin" />
            <span className="text-sm">
              {processingAction === 'scraping' && 'Starting bulk scraping...'}
              {processingAction === 'clearing' && 'Clearing scraped data...'}
              {processingAction === 'retrying' && 'Setting up retry jobs...'}
              {processingAction === 'exporting' && 'Preparing export...'}
            </span>
          </div>
        </div>
      )}
    </div>
  );
};
