'use client';

import React from 'react';
import { X, Download, FileText, Calendar, DollarSign, Package, User, Building2, MapPin, Phone, Mail, Hash } from 'lucide-react';
import { ReconInvoice } from '@/types/recon-invoice';
import { format } from 'date-fns';

interface InvoiceDetailsModalProps {
  isOpen: boolean;
  onClose: () => void;
  invoice: ReconInvoice | null;
  onDownload?: (invoice: ReconInvoice) => void;
}

export default function InvoiceDetailsModal({ 
  isOpen, 
  onClose, 
  invoice,
  onDownload 
}: InvoiceDetailsModalProps) {
  if (!isOpen || !invoice) return null;

  const handleDownload = () => {
    if (onDownload) {
      onDownload(invoice);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg max-w-4xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-white border-b border-gray-200 p-6">
          <div className="flex justify-between items-center">
            <div>
              <h2 className="text-xl font-semibold text-gray-900">Invoice Details</h2>
              <p className="text-sm text-gray-500 mt-1">
                Generated on {format(invoice.generatedDate, 'MMMM dd, yyyy')} at {format(invoice.generatedDate, 'h:mm a')}
              </p>
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={handleDownload}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                <Download size={16} />
                Download PDF
              </button>
              <button
                onClick={onClose}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <X size={20} />
              </button>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="p-6">
          {/* Invoice Overview */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
            <div className="bg-blue-50 rounded-lg p-4">
              <div className="flex items-center gap-3 mb-2">
                <div className="p-2 bg-blue-100 rounded-lg">
                  <FileText size={18} className="text-blue-600" />
                </div>
                <div>
                  <p className="text-sm text-gray-600">Invoice Number</p>
                  <p className="font-semibold text-gray-900">{invoice.invoiceNumber}</p>
                </div>
              </div>
            </div>

            <div className="bg-green-50 rounded-lg p-4">
              <div className="flex items-center gap-3 mb-2">
                <div className="p-2 bg-green-100 rounded-lg">
                  <DollarSign size={18} className="text-green-600" />
                </div>
                <div>
                  <p className="text-sm text-gray-600">Total Amount</p>
                  <p className="font-semibold text-gray-900">R{invoice.totalAmount.toFixed(2)}</p>
                </div>
              </div>
            </div>

            <div className="bg-purple-50 rounded-lg p-4">
              <div className="flex items-center gap-3 mb-2">
                <div className="p-2 bg-purple-100 rounded-lg">
                  <Package size={18} className="text-purple-600" />
                </div>
                <div>
                  <p className="text-sm text-gray-600">Total Items</p>
                  <p className="font-semibold text-gray-900">{invoice.itemCount}</p>
                </div>
              </div>
            </div>
          </div>

          {/* Business & Customer Info */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
            {/* Business Information */}
            <div className="bg-gray-50 rounded-lg p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                <Building2 size={20} />
                Business Information
              </h3>
              <div className="space-y-3">
                <div>
                  <p className="text-sm text-gray-600">Company Name</p>
                  <p className="font-medium text-gray-900">{invoice.businessInfo.companyName}</p>
                </div>
                {invoice.businessInfo.tradingName && (
                  <div>
                    <p className="text-sm text-gray-600">Trading Name</p>
                    <p className="font-medium text-gray-900">{invoice.businessInfo.tradingName}</p>
                  </div>
                )}
                <div>
                  <p className="text-sm text-gray-600">Address</p>
                  <p className="font-medium text-gray-900">
                    {invoice.businessInfo.address}, {invoice.businessInfo.city} {invoice.businessInfo.postalCode}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Phone size={16} className="text-gray-500" />
                  <span className="text-sm text-gray-900">{invoice.businessInfo.phone}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Mail size={16} className="text-gray-500" />
                  <span className="text-sm text-gray-900">{invoice.businessInfo.email}</span>
                </div>
              </div>
            </div>

            {/* Customer Information */}
            <div className="bg-gray-50 rounded-lg p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                <User size={20} />
                Customer Information
              </h3>
              <div className="space-y-3">
                <div>
                  <p className="text-sm text-gray-600">Company Name</p>
                  <p className="font-medium text-gray-900">{invoice.customerInfo.companyName}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-600">Address</p>
                  <p className="font-medium text-gray-900">
                    {invoice.customerInfo.address}
                    {invoice.customerInfo.city && `, ${invoice.customerInfo.city}`}
                    {invoice.customerInfo.postalCode && ` ${invoice.customerInfo.postalCode}`}
                  </p>
                </div>
                {invoice.customerInfo.phone && (
                  <div className="flex items-center gap-2">
                    <Phone size={16} className="text-gray-500" />
                    <span className="text-sm text-gray-900">{invoice.customerInfo.phone}</span>
                  </div>
                )}
                {invoice.customerInfo.email && (
                  <div className="flex items-center gap-2">
                    <Mail size={16} className="text-gray-500" />
                    <span className="text-sm text-gray-900">{invoice.customerInfo.email}</span>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Invoice Items */}
          <div className="bg-gray-50 rounded-lg p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Invoice Items</h3>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-200">
                    <th className="text-left py-3 px-4 text-sm font-medium text-gray-700">Item Description</th>
                    <th className="text-center py-3 px-4 text-sm font-medium text-gray-700">TSIN</th>
                    <th className="text-center py-3 px-4 text-sm font-medium text-gray-700">Quantity</th>
                    <th className="text-right py-3 px-4 text-sm font-medium text-gray-700">Unit Price</th>
                    <th className="text-right py-3 px-4 text-sm font-medium text-gray-700">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {invoice.items.map((item, index) => (
                    <tr key={index} className="border-b border-gray-100">
                      <td className="py-3 px-4 text-sm text-gray-900">
                        <div className="max-w-xs truncate" title={item.title}>
                          {item.title}
                        </div>
                      </td>
                      <td className="py-3 px-4 text-sm text-gray-600 text-center">
                        <span className="font-mono text-xs bg-gray-100 px-2 py-1 rounded">
                          {item.tsin}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-sm text-gray-700 text-center">
                        {item.quantity}
                      </td>
                      <td className="py-3 px-4 text-sm text-gray-700 text-right">
                        R{item.unitPrice.toFixed(2)}
                      </td>
                      <td className="py-3 px-4 text-sm text-gray-900 text-right font-medium">
                        R{item.totalAmount.toFixed(2)}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="border-t-2 border-gray-200 bg-gray-100">
                    <td colSpan={4} className="py-3 px-4 text-sm font-semibold text-gray-900 text-right">
                      Total Amount:
                    </td>
                    <td className="py-3 px-4 text-sm font-bold text-gray-900 text-right">
                      R{invoice.totalAmount.toFixed(2)}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>

          {/* Additional Information */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-8">
            <div>
              <h4 className="text-sm font-medium text-gray-900 mb-2">Invoice Details</h4>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-600">CSV File:</span>
                  <span className="text-gray-900">{invoice.csvFileName}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Template Used:</span>
                  <span className="text-gray-900 capitalize">{invoice.templateUsed.replace(/-/g, ' ')}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Status:</span>
                  <span className={`px-2 py-1 rounded-full text-xs ${getStatusColor(invoice.status)}`}>
                    {invoice.status}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Integration:</span>
                  <span className="text-gray-900">{invoice.integrationName}</span>
                </div>
              </div>
            </div>

            {invoice.notes && (
              <div>
                <h4 className="text-sm font-medium text-gray-900 mb-2">Notes</h4>
                <p className="text-sm text-gray-700 bg-blue-50 p-3 rounded-lg">
                  {invoice.notes}
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// Helper function to get status color (moved here for self-contained component)
function getStatusColor(status: string) {
  switch (status) {
    case 'generated':
      return 'bg-green-100 text-green-800';
    case 'downloaded':
      return 'bg-blue-100 text-blue-800';
    case 'sent':
      return 'bg-purple-100 text-purple-800';
    default:
      return 'bg-gray-100 text-gray-800';
  }
}
