'use client';

import React, { useState } from 'react';
import { useParams } from 'next/navigation';
import { Settings, FileText, Download, Calendar, DollarSign, Trash2 } from 'lucide-react';
import ReconInvoiceSettingsModal from '@/components/admin/ReconInvoiceSettingsModal';
import CSVUploadArea from '@/components/admin/CSVUploadArea';
import CSVPreview from '@/components/admin/CSVPreview';
import { useReconInvoiceSettings } from '@/hooks/useReconInvoiceSettings';
import { useInvoiceData } from '@/hooks/useInvoiceData';
import { ReconInvoiceSettings, ReconInvoice } from '@/types/recon-invoice';
import { CSVParseResult } from '@/lib/csvProcessingService';
import { format } from 'date-fns';
import { showSuccessNotification, showErrorNotification, getStatusColor } from '@/lib/invoiceUtils';
import InvoiceDetailsModal from '@/components/admin/InvoiceDetailsModal';

interface ReconInvoicePageProps {}

export default function ReconInvoicePage({}: ReconInvoicePageProps) {
  const params = useParams();
  const integrationId = params.integrationId as string;
  
  // State management
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [csvResult, setCsvResult] = useState<CSVParseResult | null>(null);
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [isProcessingCsv, setIsProcessingCsv] = useState(false);
  const [isGeneratingInvoice, setIsGeneratingInvoice] = useState(false);
  const [selectedInvoice, setSelectedInvoice] = useState<ReconInvoice | null>(null);
  const [isInvoiceDetailsOpen, setIsInvoiceDetailsOpen] = useState(false);
  
  // Use custom hook for settings management
  const { 
    settings, 
    integrationInfo, 
    isLoading, 
    error,
    saveSettings,
    isSettingsConfigured,
    settingsStatus
  } = useReconInvoiceSettings(integrationId);

  // Use custom hook for invoice data
  const {
    invoices,
    stats,
    isLoading: isLoadingInvoices,
    error: invoicesError,
    refreshData,
    downloadInvoice,
    deleteInvoice
  } = useInvoiceData(integrationId);

  // Handle CSV file processing
  const handleFileProcessed = (result: CSVParseResult, file: File) => {
    setCsvResult(result);
    setUploadedFile(file);
    setIsProcessingCsv(false);
  };

  // Handle invoice generation
  const handleGenerateInvoice = async (templateId: string = 'professional-blue') => {
    if (!csvResult || !uploadedFile || !settings) return;

    setIsGeneratingInvoice(true);
    try {
      const { InvoiceStorageService } = await import('@/lib/invoiceStorageService');
      const { InvoicePdfGenerator } = await import('@/lib/invoicePdfGenerator');
      
      // Generate and store invoice
      const { invoice, pdfBlob } = await InvoiceStorageService.generateAndStoreInvoice(
        integrationId,
        integrationInfo?.accountName || 'Unknown Integration',
        uploadedFile.name,
        csvResult.items,
        settings,
        templateId
      );
      
      // Download PDF
      InvoicePdfGenerator.downloadPDF(pdfBlob, invoice.fileName);
      
      showSuccessNotification(
        `Invoice ${invoice.invoiceNumber} generated successfully!`,
        `Total Amount: R${invoice.totalAmount.toFixed(2)}\nItems: ${invoice.itemCount}\nTemplate: ${templateId}`
      );
      
      // Refresh invoice data
      refreshData();
      
      // Reset state
      setCsvResult(null);
      setUploadedFile(null);
    } catch (error) {
      console.error('Error generating invoice:', error);
      showErrorNotification('Failed to generate invoice', error instanceof Error ? error : undefined);
    } finally {
      setIsGeneratingInvoice(false);
    }
  };

  // Handle dismissing CSV preview
  const handleDismissPreview = () => {
    setCsvResult(null);
    setUploadedFile(null);
    setIsProcessingCsv(false);
  };

  // Handle viewing invoice details
  const handleViewInvoice = (invoice: ReconInvoice) => {
    setSelectedInvoice(invoice);
    setIsInvoiceDetailsOpen(true);
  };

  // Handle closing invoice details modal
  const handleCloseInvoiceDetails = () => {
    setIsInvoiceDetailsOpen(false);
    setSelectedInvoice(null);
  };

  // Handle deleting invoice
  const handleDeleteInvoice = async (invoice: ReconInvoice) => {
    if (window.confirm(`Are you sure you want to delete invoice ${invoice.invoiceNumber}? This action cannot be undone.`)) {
      try {
        await deleteInvoice(invoice.id);
        showSuccessNotification(
          'Invoice deleted successfully!',
          `Invoice ${invoice.invoiceNumber} has been removed from the database.`
        );
      } catch (error) {
        console.error('Error deleting invoice:', error);
        showErrorNotification('Failed to delete invoice', error instanceof Error ? error : undefined);
      }
    }
  };

  // Handle settings save
  const handleSaveSettings = async (newSettings: ReconInvoiceSettings) => {
    try {
      await saveSettings(newSettings);
      alert('Settings saved successfully!');
    } catch (error) {
      console.error('Error saving settings:', error);
      throw error; // Re-throw to let modal handle it
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading integration data...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <p className="text-red-600 mb-4">Error: {error}</p>
          <button 
            onClick={() => window.location.reload()} 
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow-sm border-b">
        <div className="w-full px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-6">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">
                Recon Invoice
              </h1>
              <p className="text-sm text-gray-600 mt-1">
                {integrationInfo?.accountName || 'Loading...'} - Integration
              </p>
            </div>
            <button 
              onClick={() => setIsSettingsOpen(true)}
              className="flex items-center gap-2 px-4 py-2 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
            >
              <Settings size={20} />
              <span>Settings</span>
            </button>
          </div>
        </div>
      </div>

      {/* Main Content - Full Width */}
      <div className="w-full px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 xl:grid-cols-4 gap-8">
          
          {/* Upload Section - Takes 3 columns on XL screens */}
          <div className="xl:col-span-3">
            <div className="bg-white rounded-lg shadow-sm border p-6">
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-lg font-semibold text-gray-900">
                  Generate New Invoice
                </h2>
                {csvResult && (
                  <div className="flex items-center gap-2 text-sm text-gray-600">
                    <FileText size={16} />
                    <span>{csvResult.itemCount} items • R{csvResult.totalAmount.toFixed(2)}</span>
                  </div>
                )}
              </div>
              
              {/* CSV Upload or Preview */}
              {csvResult ? (
                <CSVPreview
                  result={csvResult}
                  fileName={uploadedFile?.name || 'Unknown file'}
                  onDismiss={handleDismissPreview}
                  onGenerateInvoice={handleGenerateInvoice}
                  isGenerating={isGeneratingInvoice}
                />
              ) : (
                <CSVUploadArea 
                  onFileProcessed={handleFileProcessed}
                  isProcessing={isProcessingCsv}
                  disabled={!isSettingsConfigured}
                />
              )}
            </div>
          </div>

          {/* Quick Stats */}
          <div className="xl:col-span-1">
            <div className="space-y-6">
              <div className="bg-white rounded-lg shadow-sm border p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">
                  {csvResult ? 'Current Upload' : 'Quick Stats'}
                </h3>
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-gray-600">
                      {csvResult ? 'Items to Process' : 'Total Invoices'}
                    </span>
                    <span className="font-semibold">
                      {csvResult ? csvResult.itemCount : (isLoadingInvoices ? '...' : stats.totalInvoices)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-gray-600">
                      {csvResult ? 'Estimated Amount' : 'This Month'}
                    </span>
                    <span className="font-semibold">
                      {csvResult ? `R${csvResult.totalAmount.toFixed(2)}` : (isLoadingInvoices ? '...' : stats.currentMonth)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-gray-600">
                      {csvResult ? 'Validation Issues' : 'Total Amount'}
                    </span>
                    <span className={`font-semibold ${csvResult && csvResult.errors.length > 0 ? 'text-red-600' : ''}`}>
                      {csvResult ? csvResult.errors.length + csvResult.warnings.length : (isLoadingInvoices ? '...' : `R${stats.totalAmount.toFixed(2)}`)}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Invoice History Section - Full Width */}
        <div className="mt-8">
          <div className="bg-white rounded-lg shadow-sm border">
            <div className="px-6 py-4 border-b border-gray-200">
              <div className="flex justify-between items-center">
                <h2 className="text-lg font-semibold text-gray-900">
                  Invoice History
                </h2>
                <div className="flex gap-2">
                  <input
                    type="text"
                    placeholder="Search invoices..."
                    className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  <button className="px-4 py-2 bg-gray-100 hover:bg-gray-200 rounded-lg text-sm transition-colors">
                    Filter
                  </button>
                </div>
              </div>
            </div>
            
            <div className="p-6">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-gray-200">
                      <th className="text-left py-3 px-4 text-sm font-medium text-gray-700">Date</th>
                      <th className="text-left py-3 px-4 text-sm font-medium text-gray-700">Invoice #</th>
                      <th className="text-left py-3 px-4 text-sm font-medium text-gray-700">File Name</th>
                      <th className="text-left py-3 px-4 text-sm font-medium text-gray-700">Items</th>
                      <th className="text-left py-3 px-4 text-sm font-medium text-gray-700">Amount</th>
                      <th className="text-left py-3 px-4 text-sm font-medium text-gray-700">Status</th>
                      <th className="text-left py-3 px-4 text-sm font-medium text-gray-700">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {isLoadingInvoices ? (
                      <tr>
                        <td colSpan={7} className="text-center py-12">
                          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
                          <p className="text-gray-500">Loading invoices...</p>
                        </td>
                      </tr>
                    ) : invoicesError ? (
                      <tr>
                        <td colSpan={7} className="text-center py-12 text-red-500">
                          <p>Error loading invoices: {invoicesError}</p>
                          <button 
                            onClick={refreshData}
                            className="mt-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                          >
                            Retry
                          </button>
                        </td>
                      </tr>
                    ) : invoices.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="text-center py-12 text-gray-500">
                          <FileText size={48} className="mx-auto mb-4 text-gray-300" />
                          <p className="text-lg">No invoices found</p>
                          <p className="text-sm">Upload your first CSV file to generate an invoice</p>
                        </td>
                      </tr>
                    ) : (
                      invoices.map((invoice) => (
                        <tr key={invoice.id} className="border-b border-gray-100 hover:bg-gray-50">
                          <td className="py-3 px-4 text-sm text-gray-900">
                            {format(invoice.generatedDate, 'MMM dd, yyyy HH:mm')}
                          </td>
                          <td className="py-3 px-4 text-sm font-medium text-blue-600">
                            {invoice.invoiceNumber}
                          </td>
                          <td className="py-3 px-4 text-sm text-gray-700">
                            <div className="flex items-center gap-2">
                              <FileText size={14} className="text-gray-400" />
                              {invoice.csvFileName}
                            </div>
                          </td>
                          <td className="py-3 px-4 text-sm text-gray-700">
                            <span className="bg-blue-100 text-blue-800 px-2 py-1 rounded-full text-xs">
                              {invoice.itemCount} items
                            </span>
                          </td>
                          <td className="py-3 px-4 text-sm text-gray-900 font-medium">
                            R{invoice.totalAmount.toFixed(2)}
                          </td>
                          <td className="py-3 px-4 text-sm">
                            <span className={`px-2 py-1 rounded-full text-xs ${getStatusColor(invoice.status)}`}>
                              {invoice.status}
                            </span>
                          </td>
                          <td className="py-3 px-4 text-sm">
                            <div className="flex items-center gap-2">
                              <button
                                onClick={() => downloadInvoice(invoice)}
                                className="text-blue-600 hover:text-blue-800 transition-colors p-1 rounded hover:bg-blue-50"
                                title="Download Invoice"
                              >
                                <Download size={16} />
                              </button>
                              <button
                                onClick={() => handleViewInvoice(invoice)}
                                className="text-gray-600 hover:text-gray-800 transition-colors p-1 rounded hover:bg-gray-50"
                                title="View Details"
                              >
                                <FileText size={16} />
                              </button>
                              <button
                                onClick={() => handleDeleteInvoice(invoice)}
                                className="text-red-600 hover:text-red-800 transition-colors p-1 rounded hover:bg-red-50"
                                title="Delete Invoice"
                              >
                                <Trash2 size={16} />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
                
                {/* Pagination would go here if needed */}
                {invoices.length > 0 && (
                  <div className="mt-4 flex justify-between items-center text-sm text-gray-500">
                    <span>Showing {invoices.length} invoices</span>
                    <span>Total: R{stats.totalAmount.toFixed(2)}</span>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Settings Modal */}
      {integrationInfo && (
        <ReconInvoiceSettingsModal
          isOpen={isSettingsOpen}
          onClose={() => setIsSettingsOpen(false)}
          integrationId={integrationId}
          integrationName={integrationInfo.accountName}
          onSave={handleSaveSettings}
          initialSettings={settings || undefined}
        />
      )}

      {/* Invoice Details Modal */}
      <InvoiceDetailsModal
        isOpen={isInvoiceDetailsOpen}
        onClose={handleCloseInvoiceDetails}
        invoice={selectedInvoice}
        onDownload={downloadInvoice}
      />
    </div>
  );
}
