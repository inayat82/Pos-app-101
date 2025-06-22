'use client';

import React from 'react';
import { FiPrinter, FiDownload, FiX } from 'react-icons/fi';

interface SaleItem {
  productId: string;
  productName: string;
  sku: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
}

interface Sale {
  id: string;
  date: string;
  customer: string;
  products: SaleItem[];
  subtotal: number;
  tax: number;
  total: number;
  totalItems: number;
  paymentMethod: string;
  status: 'Completed' | 'Pending' | 'Cancelled';
  notes?: string;
  createdAt?: any;
}

interface ReceiptModalProps {
  sale: Sale;
  isOpen: boolean;
  onClose: () => void;
}

const ReceiptModal: React.FC<ReceiptModalProps> = ({ sale, isOpen, onClose }) => {
  if (!isOpen) return null;

  const handlePrint = () => {
    window.print();
  };

  const handleDownload = () => {
    // Create a downloadable receipt
    const receiptContent = generateReceiptContent(sale);
    const blob = new Blob([receiptContent], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `receipt-${sale.id}.txt`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const generateReceiptContent = (sale: Sale): string => {
    const lines = [
      '========================================',
      '            POS SYSTEM RECEIPT',
      '========================================',
      '',
      `Receipt #: ${sale.id}`,
      `Date: ${new Date(sale.date).toLocaleString()}`,
      `Customer: ${sale.customer || 'Guest'}`,
      `Payment Method: ${sale.paymentMethod}`,
      '',
      '----------------------------------------',
      'ITEMS:',
      '----------------------------------------',
    ];

    sale.products.forEach(item => {
      lines.push(`${item.productName} (${item.sku})`);
      lines.push(`  Qty: ${item.quantity} x R${item.unitPrice.toFixed(2)} = R${item.totalPrice.toFixed(2)}`);
      lines.push('');
    });

    lines.push('----------------------------------------');
    lines.push(`Subtotal: R${sale.subtotal.toFixed(2)}`);
    lines.push(`Tax: R${sale.tax.toFixed(2)}`);
    lines.push(`TOTAL: R${sale.total.toFixed(2)}`);
    lines.push('----------------------------------------');
    lines.push('');
    lines.push('Thank you for your business!');
    lines.push('========================================');

    return lines.join('\n');
  };

  return (
    <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
      <div className="relative top-20 mx-auto p-5 border w-full max-w-2xl shadow-lg rounded-md bg-white">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-medium text-gray-900">Receipt</h3>
          <div className="flex space-x-2">
            <button
              onClick={handlePrint}
              className="flex items-center space-x-2 px-3 py-1 bg-blue-600 text-white rounded-md hover:bg-blue-700 text-sm"
            >
              <FiPrinter className="h-4 w-4" />
              <span>Print</span>
            </button>
            <button
              onClick={handleDownload}
              className="flex items-center space-x-2 px-3 py-1 bg-green-600 text-white rounded-md hover:bg-green-700 text-sm"
            >
              <FiDownload className="h-4 w-4" />
              <span>Download</span>
            </button>
            <button
              onClick={onClose}
              className="flex items-center space-x-2 px-3 py-1 bg-gray-600 text-white rounded-md hover:bg-gray-700 text-sm"
            >
              <FiX className="h-4 w-4" />
              <span>Close</span>
            </button>
          </div>
        </div>
        
        {/* Receipt Content */}
        <div className="bg-white p-6 border-2 border-gray-200 font-mono text-sm">
          <div className="text-center mb-4">
            <h2 className="text-xl font-bold">POS SYSTEM</h2>
            <p className="text-gray-600">Sales Receipt</p>
          </div>
          
          <div className="border-b border-dashed border-gray-300 pb-2 mb-4">
            <div className="flex justify-between">
              <span>Receipt #:</span>
              <span>{sale.id}</span>
            </div>
            <div className="flex justify-between">
              <span>Date:</span>
              <span>{new Date(sale.date).toLocaleString()}</span>
            </div>
            <div className="flex justify-between">
              <span>Customer:</span>
              <span>{sale.customer || 'Guest'}</span>
            </div>
            <div className="flex justify-between">
              <span>Payment:</span>
              <span>{sale.paymentMethod}</span>
            </div>
          </div>

          <div className="mb-4">
            <h3 className="font-bold mb-2">ITEMS:</h3>
            {sale.products.map((item, index) => (
              <div key={index} className="mb-2">
                <div className="flex justify-between">
                  <span className="font-medium">{item.productName}</span>
                  <span>R{item.totalPrice.toFixed(2)}</span>
                </div>
                <div className="text-gray-600 text-xs">
                  SKU: {item.sku} | Qty: {item.quantity} x R{item.unitPrice.toFixed(2)}
                </div>
              </div>
            ))}
          </div>

          <div className="border-t border-dashed border-gray-300 pt-2">
            <div className="flex justify-between">
              <span>Subtotal:</span>
              <span>R{sale.subtotal.toFixed(2)}</span>
            </div>
            <div className="flex justify-between">
              <span>Tax:</span>
              <span>R{sale.tax.toFixed(2)}</span>
            </div>
            <div className="flex justify-between font-bold text-lg">
              <span>TOTAL:</span>
              <span>R{sale.total.toFixed(2)}</span>
            </div>
          </div>

          <div className="text-center mt-4 text-gray-600">
            <p>Thank you for your business!</p>
            {sale.notes && (
              <p className="text-xs mt-2">Notes: {sale.notes}</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ReceiptModal;
