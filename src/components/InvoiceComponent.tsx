import React from 'react';

interface InvoiceData {
  id: string;
  type: 'sale' | 'purchase';
  customerName?: string;
  supplierName?: string;
  invoiceNumber?: string;
  date: string;
  items: Array<{
    productName: string;
    sku?: string;
    quantity: number;
    unitPrice: number;
    totalPrice: number;
  }>;
  totalAmount: number;
  paymentMethod?: string;
  notes?: string;
}

interface InvoiceComponentProps {
  data: InvoiceData;
}

export const InvoiceComponent: React.FC<InvoiceComponentProps> = ({ data }) => {
  return (
    <div className="max-w-4xl mx-auto bg-white p-8 shadow-lg" id="invoice-content">
      {/* Invoice Header */}
      <div className="border-b-2 border-gray-200 pb-6 mb-6">
        <div className="flex justify-between items-start">
          <div>
            <h1 className="text-3xl font-bold text-gray-800">
              {data.type === 'sale' ? 'SALES INVOICE' : 'PURCHASE INVOICE'}
            </h1>
            <p className="text-gray-600 mt-2">POS System Invoice</p>
          </div>          <div className="text-right">
            <p className="text-sm text-gray-600">Invoice #</p>
            <p className="text-lg font-semibold">{data.invoiceNumber || `${data.type === 'sale' ? 'S' : 'P'}${data.id.slice(-2)}`}</p>
            <p className="text-sm text-gray-600 mt-2">Date: {data.date}</p>
          </div>
        </div>
      </div>

      {/* Customer/Supplier Info */}
      <div className="mb-6">
        <h3 className="text-lg font-semibold text-gray-800 mb-2">
          {data.type === 'sale' ? 'Bill To:' : 'Purchase From:'}
        </h3>
        <div className="bg-gray-50 p-4 rounded-lg">
          <p className="font-medium text-gray-800">
            {data.customerName || data.supplierName || 'Walk-in Customer'}
          </p>
          {data.paymentMethod && (
            <p className="text-sm text-gray-600 mt-1">Payment Method: {data.paymentMethod}</p>
          )}
        </div>
      </div>

      {/* Items Table */}
      <div className="mb-6">
        <table className="w-full border-collapse border border-gray-300">
          <thead>
            <tr className="bg-gray-100">
              <th className="border border-gray-300 px-4 py-3 text-left text-sm font-semibold text-gray-700">
                Product
              </th>
              <th className="border border-gray-300 px-4 py-3 text-left text-sm font-semibold text-gray-700">
                SKU
              </th>
              <th className="border border-gray-300 px-4 py-3 text-center text-sm font-semibold text-gray-700">
                Qty
              </th>
              <th className="border border-gray-300 px-4 py-3 text-right text-sm font-semibold text-gray-700">
                Unit Price
              </th>
              <th className="border border-gray-300 px-4 py-3 text-right text-sm font-semibold text-gray-700">
                Total
              </th>
            </tr>
          </thead>
          <tbody>
            {data.items.map((item, index) => (
              <tr key={index} className="hover:bg-gray-50">
                <td className="border border-gray-300 px-4 py-3 text-sm">
                  {item.productName}
                </td>
                <td className="border border-gray-300 px-4 py-3 text-sm text-gray-600">
                  {item.sku || 'N/A'}
                </td>
                <td className="border border-gray-300 px-4 py-3 text-center text-sm">
                  {item.quantity}
                </td>
                <td className="border border-gray-300 px-4 py-3 text-right text-sm">
                  R{item.unitPrice.toFixed(2)}
                </td>
                <td className="border border-gray-300 px-4 py-3 text-right text-sm font-medium">
                  R{item.totalPrice.toFixed(2)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Total Section */}
      <div className="flex justify-end mb-6">
        <div className="w-64">
          <div className="bg-gray-100 p-4 rounded-lg">
            <div className="flex justify-between items-center mb-2">
              <span className="text-sm font-medium text-gray-700">Subtotal:</span>
              <span className="text-sm font-medium">R{data.totalAmount.toFixed(2)}</span>
            </div>
            <div className="border-t border-gray-300 pt-2">
              <div className="flex justify-between items-center">
                <span className="text-lg font-bold text-gray-800">Total:</span>
                <span className="text-lg font-bold text-gray-800">R{data.totalAmount.toFixed(2)}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Notes */}
      {data.notes && (
        <div className="mb-6">
          <h3 className="text-sm font-semibold text-gray-700 mb-2">Notes:</h3>
          <p className="text-sm text-gray-600 bg-gray-50 p-3 rounded-lg">{data.notes}</p>
        </div>
      )}

      {/* Footer */}
      <div className="border-t border-gray-200 pt-6 text-center">
        <p className="text-sm text-gray-600">
          Generated by POS System on {new Date().toLocaleString()}
        </p>
        <p className="text-xs text-gray-500 mt-2">
          Thank you for your business!
        </p>
      </div>
    </div>
  );
};

export const generateInvoicePDF = (data: InvoiceData) => {
  // Create a new window for the invoice
  const printWindow = window.open('', '_blank', 'width=800,height=600');
  
  if (!printWindow) {
    alert('Please allow popups to view the invoice');
    return;
  }

  // Create the invoice HTML
  const invoiceHTML = `
    <!DOCTYPE html>
    <html>
    <head>
      <title>Invoice #${data.id.slice(-8).toUpperCase()}</title>
      <meta charset="utf-8">
      <style>
        body {
          font-family: Arial, sans-serif;
          margin: 0;
          padding: 20px;
          background-color: #f5f5f5;
        }
        .invoice-container {
          max-width: 800px;
          margin: 0 auto;
          background: white;
          padding: 40px;
          box-shadow: 0 0 10px rgba(0,0,0,0.1);
          border-radius: 8px;
        }
        .header {
          border-bottom: 2px solid #e5e5e5;
          padding-bottom: 20px;
          margin-bottom: 30px;
          display: flex;
          justify-content: space-between;
          align-items: start;
        }
        .header h1 {
          font-size: 28px;
          color: #333;
          margin: 0;
        }
        .header .invoice-info {
          text-align: right;
        }
        .customer-info {
          background: #f8f9fa;
          padding: 20px;
          border-radius: 8px;
          margin-bottom: 30px;
        }
        .customer-info h3 {
          margin: 0 0 10px 0;
          color: #333;
        }
        table {
          width: 100%;
          border-collapse: collapse;
          margin-bottom: 30px;
        }
        th, td {
          border: 1px solid #ddd;
          padding: 12px;
          text-align: left;
        }
        th {
          background-color: #f8f9fa;
          font-weight: 600;
          color: #333;
        }
        .text-right { text-align: right; }
        .text-center { text-align: center; }
        .total-section {
          display: flex;
          justify-content: flex-end;
          margin-bottom: 30px;
        }
        .total-box {
          width: 300px;
          background: #f8f9fa;
          padding: 20px;
          border-radius: 8px;
        }
        .total-row {
          display: flex;
          justify-content: space-between;
          margin-bottom: 10px;
        }
        .total-final {
          border-top: 1px solid #ddd;
          padding-top: 10px;
          font-weight: bold;
          font-size: 18px;
        }
        .notes {
          background: #f8f9fa;
          padding: 15px;
          border-radius: 8px;
          margin-bottom: 30px;
        }
        .footer {
          border-top: 1px solid #e5e5e5;
          padding-top: 20px;
          text-align: center;
          color: #666;
          font-size: 14px;
        }
        @media print {
          body { background: white; }
          .invoice-container { box-shadow: none; }
          .no-print { display: none; }
        }
        .print-button {
          background: #007bff;
          color: white;
          border: none;
          padding: 10px 20px;
          border-radius: 5px;
          cursor: pointer;
          margin-bottom: 20px;
        }
        .print-button:hover {
          background: #0056b3;
        }
      </style>
    </head>
    <body>
      <div class="invoice-container">
        <button class="print-button no-print" onclick="window.print()">Print Invoice</button>
        
        <div class="header">
          <div>
            <h1>${data.type === 'sale' ? 'SALES INVOICE' : 'PURCHASE INVOICE'}</h1>
            <p style="color: #666; margin: 5px 0;">POS System Invoice</p>
          </div>
          <div class="invoice-info">
            <p><strong>Invoice #${data.id.slice(-8).toUpperCase()}</strong></p>
            <p>Date: ${data.date}</p>
          </div>
        </div>

        <div class="customer-info">
          <h3>${data.type === 'sale' ? 'Bill To:' : 'Purchase From:'}</h3>
          <p><strong>${data.customerName || data.supplierName || 'Walk-in Customer'}</strong></p>
          ${data.paymentMethod ? `<p>Payment Method: ${data.paymentMethod}</p>` : ''}
        </div>

        <table>
          <thead>
            <tr>
              <th>Product</th>
              <th>SKU</th>
              <th class="text-center">Qty</th>
              <th class="text-right">Unit Price</th>
              <th class="text-right">Total</th>
            </tr>
          </thead>
          <tbody>
            ${data.items.map(item => `
              <tr>
                <td>${item.productName}</td>
                <td>${item.sku || 'N/A'}</td>
                <td class="text-center">${item.quantity}</td>
                <td class="text-right">R${item.unitPrice.toFixed(2)}</td>
                <td class="text-right">R${item.totalPrice.toFixed(2)}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>

        <div class="total-section">
          <div class="total-box">
            <div class="total-row">
              <span>Subtotal:</span>
              <span>R${data.totalAmount.toFixed(2)}</span>
            </div>
            <div class="total-row total-final">
              <span>Total:</span>
              <span>R${data.totalAmount.toFixed(2)}</span>
            </div>
          </div>
        </div>

        ${data.notes ? `
          <div class="notes">
            <h3 style="margin: 0 0 10px 0;">Notes:</h3>
            <p style="margin: 0;">${data.notes}</p>
          </div>
        ` : ''}

        <div class="footer">
          <p>Generated by POS System on ${new Date().toLocaleString()}</p>
          <p style="margin-top: 10px; font-size: 12px;">Thank you for your business!</p>
        </div>
      </div>
    </body>
    </html>
  `;

  printWindow.document.write(invoiceHTML);
  printWindow.document.close();
  printWindow.focus();
};

export default InvoiceComponent;
