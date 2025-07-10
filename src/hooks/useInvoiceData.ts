import { useState, useEffect } from 'react';
import { ReconInvoice } from '@/types/recon-invoice';
import { InvoiceStorageService } from '@/lib/invoiceStorageService';

interface InvoiceStats {
  totalInvoices: number;
  totalAmount: number;
  currentMonth: number;
  currentMonthAmount: number;
}

export function useInvoiceData(integrationId: string) {
  const [invoices, setInvoices] = useState<ReconInvoice[]>([]);
  const [stats, setStats] = useState<InvoiceStats>({
    totalInvoices: 0,
    totalAmount: 0,
    currentMonth: 0,
    currentMonthAmount: 0
  });
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchInvoiceData = async () => {
    if (!integrationId) return;

    try {
      setIsLoading(true);
      setError(null);

      const [invoiceList, invoiceStats] = await Promise.all([
        InvoiceStorageService.getInvoicesForIntegration(integrationId),
        InvoiceStorageService.getInvoiceStats(integrationId)
      ]);

      setInvoices(invoiceList);
      setStats(invoiceStats);
    } catch (err) {
      console.error('Error fetching invoice data:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch invoice data');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchInvoiceData();
  }, [integrationId]);

  const refreshData = () => {
    fetchInvoiceData();
  };

  const downloadInvoice = async (invoice: ReconInvoice) => {
    try {
      await InvoiceStorageService.downloadInvoicePDF(invoice);
      // Refresh data to update status
      refreshData();
    } catch (error) {
      console.error('Error downloading invoice:', error);
      throw error;
    }
  };

  const deleteInvoice = async (invoiceId: string) => {
    try {
      await InvoiceStorageService.deleteInvoice(invoiceId);
      // Refresh data to remove deleted invoice from list
      refreshData();
    } catch (error) {
      console.error('Error deleting invoice:', error);
      throw error;
    }
  };

  return {
    invoices,
    stats,
    isLoading,
    error,
    refreshData,
    downloadInvoice,
    deleteInvoice
  };
}
