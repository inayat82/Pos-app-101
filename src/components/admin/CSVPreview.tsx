'use client';

import React, { useState } from 'react';
import { AlertTriangle, CheckCircle, FileText, X } from 'lucide-react';
import { CSVParseResult } from '@/lib/csvProcessingService';
import { ReconInvoiceItem } from '@/types/recon-invoice';
import TemplateSelection from './TemplateSelection';

interface CSVPreviewProps {
  result: CSVParseResult;
  fileName: string;
  onDismiss: () => void;
  onGenerateInvoice: (templateId: string) => void;
  isGenerating?: boolean;
}

export default function CSVPreview({ 
  result, 
  fileName, 
  onDismiss, 
  onGenerateInvoice,
  isGenerating = false 
}: CSVPreviewProps) {
  const { isValid, items, errors, warnings, totalAmount, itemCount } = result;
  const [selectedTemplate, setSelectedTemplate] = useState('professional-blue');

  const handleGenerateInvoice = () => {
    onGenerateInvoice(selectedTemplate);
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

      {/* Summary Stats */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-gray-50 rounded-lg p-4 text-center">
          <div className="text-2xl font-bold text-gray-900">{itemCount}</div>
          <div className="text-sm text-gray-600">Items Found</div>
        </div>
        <div className="bg-gray-50 rounded-lg p-4 text-center">
          <div className="text-2xl font-bold text-gray-900">R{totalAmount.toFixed(2)}</div>
          <div className="text-sm text-gray-600">Total Amount</div>
        </div>
        <div className="bg-gray-50 rounded-lg p-4 text-center">
          <div className="text-2xl font-bold text-gray-900">{errors.length + warnings.length}</div>
          <div className="text-sm text-gray-600">Issues</div>
        </div>
      </div>

      {/* Errors */}
      {errors.length > 0 && (
        <div className="p-4 bg-red-50 rounded-lg border border-red-200">
          <div className="flex items-start gap-3">
            <AlertTriangle size={20} className="text-red-500 mt-0.5 flex-shrink-0" />
            <div className="flex-1">
              <h4 className="font-medium text-red-900 mb-2">Errors ({errors.length})</h4>
              <div className="space-y-1">
                {errors.slice(0, 5).map((error, index) => (
                  <p key={index} className="text-sm text-red-700">• {error}</p>
                ))}
                {errors.length > 5 && (
                  <p className="text-sm text-red-600 font-medium">
                    ... and {errors.length - 5} more errors
                  </p>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Warnings */}
      {warnings.length > 0 && (
        <div className="p-4 bg-yellow-50 rounded-lg border border-yellow-200">
          <div className="flex items-start gap-3">
            <AlertTriangle size={20} className="text-yellow-500 mt-0.5 flex-shrink-0" />
            <div className="flex-1">
              <h4 className="font-medium text-yellow-900 mb-2">Warnings ({warnings.length})</h4>
              <div className="space-y-1">
                {warnings.slice(0, 3).map((warning, index) => (
                  <p key={index} className="text-sm text-yellow-700">• {warning}</p>
                ))}
                {warnings.length > 3 && (
                  <p className="text-sm text-yellow-600 font-medium">
                    ... and {warnings.length - 3} more warnings
                  </p>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Data Preview */}
      {items.length > 0 && (
        <div className="bg-white border rounded-lg">
          <div className="px-4 py-3 border-b border-gray-200">
            <h4 className="font-medium text-gray-900">
              Data Preview ({items.length} items)
            </h4>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="text-left py-2 px-4 text-sm font-medium text-gray-700">Title</th>
                  <th className="text-left py-2 px-4 text-sm font-medium text-gray-700">TSIN</th>
                  <th className="text-right py-2 px-4 text-sm font-medium text-gray-700">Qty</th>
                  <th className="text-right py-2 px-4 text-sm font-medium text-gray-700">Unit Price</th>
                  <th className="text-right py-2 px-4 text-sm font-medium text-gray-700">Total</th>
                </tr>
              </thead>
              <tbody>
                {items.slice(0, 10).map((item, index) => (
                  <tr key={index} className="border-b border-gray-100">
                    <td className="py-2 px-4 text-sm text-gray-900 max-w-xs truncate">
                      {item.title}
                    </td>
                    <td className="py-2 px-4 text-sm text-gray-700">
                      {item.tsin}
                    </td>
                    <td className="py-2 px-4 text-sm text-gray-700 text-right">
                      {item.quantity}
                    </td>
                    <td className="py-2 px-4 text-sm text-gray-700 text-right">
                      R{item.unitPrice.toFixed(2)}
                    </td>
                    <td className="py-2 px-4 text-sm text-gray-900 text-right font-medium">
                      R{item.totalAmount.toFixed(2)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {items.length > 10 && (
              <div className="p-3 text-center text-sm text-gray-500 bg-gray-50">
                ... and {items.length - 10} more items
              </div>
            )}
          </div>
        </div>
      )}

      {/* Template Selection */}
      {isValid && items.length > 0 && (
        <TemplateSelection
          selectedTemplate={selectedTemplate}
          onTemplateSelect={setSelectedTemplate}
        />
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
