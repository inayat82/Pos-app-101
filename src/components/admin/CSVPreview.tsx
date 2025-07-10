'use client';

import React, { useState } from 'react';
import { AlertTriangle, CheckCircle, FileText, X, Settings } from 'lucide-react';
import { CSVParseResult } from '@/lib/csvProcessingService';
import { ReconInvoiceItem } from '@/types/recon-invoice';

interface CSVPreviewProps {
  result: CSVParseResult;
  fileName: string;
  onDismiss: () => void;
  onGenerateInvoice: () => void; // Remove templateId parameter since it will come from settings
  onOpenSettings?: () => void; // New prop to open settings modal
  isGenerating?: boolean;
  defaultTemplate?: string; // For display purposes
}

export default function CSVPreview({ 
  result, 
  fileName, 
  onDismiss, 
  onGenerateInvoice,
  onOpenSettings,
  isGenerating = false,
  defaultTemplate = 'professional-blue' // Default fallback
}: CSVPreviewProps) {
  const { isValid, items, errors, warnings, totalAmount, itemCount } = result;
  const [selectedTemplate, setSelectedTemplate] = useState(defaultTemplate);

  const handleGenerateInvoice = () => {
    onGenerateInvoice(); // No longer pass templateId, it will come from user settings
  };

  return (
    <div className="space-y-6">
      {/* Results Header */}
      <div className="flex items-start justify-between">
        <div className="flex items-start gap-3">
          {isValid ? (
            <CheckCircle size={24} className="text-green-500 mt-1 flex-shrink-0" />
          ) : (
            <AlertTriangle size={24} className="text-red-500 mt-1 flex-shrink-0" />
          )}
          <div>
            <h3 className="text-lg font-semibold text-gray-900">
              CSV Processing {isValid ? 'Completed' : 'Failed'}
            </h3>
            <p className="text-sm text-gray-600 mt-1">
              File: {fileName}
            </p>
          </div>
        </div>
        <button 
          onClick={onDismiss}
          className="text-gray-400 hover:text-gray-600"
        >
          <X size={20} />
        </button>
      </div>

      {/* Summary Stats - Simplified without issues count */}
      <div className="grid grid-cols-2 gap-6">
        <div className="bg-gray-50 rounded-lg p-6 text-center">
          <div className="text-3xl font-bold text-gray-900">{itemCount}</div>
          <div className="text-sm text-gray-600 mt-1">Items Found</div>
        </div>
        <div className="bg-gray-50 rounded-lg p-6 text-center">
          <div className="text-3xl font-bold text-green-600">R{totalAmount.toFixed(2)}</div>
          <div className="text-sm text-gray-600 mt-1">Total Amount</div>
        </div>
      </div>

      {/* Critical Errors Only (still show if file can't be processed) */}
      {errors.length > 0 && !isValid && (
        <div className="p-4 bg-red-50 rounded-lg border border-red-200">
          <div className="flex items-start gap-3">
            <AlertTriangle size={20} className="text-red-500 mt-0.5 flex-shrink-0" />
            <div className="flex-1">
              <h4 className="font-medium text-red-900 mb-2">Critical Errors ({errors.length})</h4>
              <div className="space-y-1">
                {errors.slice(0, 3).map((error, index) => (
                  <p key={index} className="text-sm text-red-700">• {error}</p>
                ))}
                {errors.length > 3 && (
                  <p className="text-sm text-red-600 font-medium">
                    ... and {errors.length - 3} more errors
                  </p>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Template Selection Button */}
      {isValid && items.length > 0 && (
        <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg border">
          <div>
            <h4 className="font-medium text-gray-900">Invoice Template</h4>
            <p className="text-sm text-gray-600">Configure your invoice layout and colors</p>
          </div>
          <button
            onClick={onOpenSettings}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
          >
            <Settings size={16} />
            Select Template
          </button>
        </div>
      )}

      {/* Action Buttons */}
      <div className="flex gap-3 pt-4">
        {isValid && items.length > 0 && (
          <button 
            onClick={handleGenerateInvoice}
            disabled={isGenerating}
            className="flex-1 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-medium"
          >
            {isGenerating ? (
              <div className="flex items-center justify-center gap-2">
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                Generating Invoice...
              </div>
            ) : (
              <>Generate Invoice ({items.length} items)</>
            )}
          </button>
        )}
        <button 
          onClick={onDismiss}
          className="px-6 py-3 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
        >
          {isValid ? 'Upload Another File' : 'Try Again'}
        </button>
      </div>
    </div>
  );
}
