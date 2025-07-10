import { db } from '@/lib/firebase/firebase';
import { collection, doc, setDoc, getDocs, query, where, orderBy, limit, deleteDoc, updateDoc } from 'firebase/firestore';
import { ReconInvoice, ReconInvoiceItem, ReconInvoiceSettings } from '@/types/recon-invoice';
import { InvoicePdfGenerator, InvoiceGenerationData } from './invoicePdfGenerator';

export class InvoiceStorageService {
  private static COLLECTION_NAME = 'reconInvoices';

  /**
   * Generate and store a new invoice
   */
  static async generateAndStoreInvoice(
    integrationId: string,
    integrationName: string,
    csvFileName: string,
    items: ReconInvoiceItem[],
    settings: ReconInvoiceSettings,
    templateId: string = 'professional-blue'
  ): Promise<{ invoice: ReconInvoice; pdfBlob: Blob }> {
    try {
      // Generate invoice number
      const invoiceNumber = await this.generateInvoiceNumber(integrationId, settings.preferences.invoicePrefix);
      
      // Create invoice data
      const now = new Date();
      const monthYear = now.toISOString().slice(0, 7); // YYYY-MM format
      
      const invoiceData: InvoiceGenerationData = {
        items,
        settings,
        invoiceNumber,
        date: now,
        fileName: csvFileName
      };

      // Generate PDF
      const pdfBlob = await InvoicePdfGenerator.generateInvoicePDF(invoiceData, templateId);
      
      // Create invoice record
      const invoiceId = `${integrationId}_${invoiceNumber}_${now.getTime()}`;
      const totalAmount = items.reduce((sum, item) => sum + item.totalAmount, 0);
      
      const invoice: ReconInvoice = {
        id: invoiceId,
        integrationId,
        integrationName,
        invoiceNumber,
        fileName: `${invoiceNumber}.pdf`,
        csvFileName,
        generatedDate: now,
        monthYear,
        totalAmount,
        itemCount: items.length,
        templateUsed: templateId,
        status: 'generated',
        items,
        businessInfo: settings.businessInfo,
        customerInfo: settings.defaultCustomerInfo,
        notes: settings.preferences.defaultNotes,
      };

      // Store invoice record in Firebase
      await setDoc(doc(db, this.COLLECTION_NAME, invoiceId), {
        ...invoice,
        generatedDate: now, // Firestore will handle the timestamp
      });

      return { invoice, pdfBlob };
    } catch (error) {
      console.error('Error generating and storing invoice:', error);
      throw new Error(`Failed to generate invoice: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get invoices for a specific integration
   */
  static async getInvoicesForIntegration(
    integrationId: string,
    limitCount: number = 50
  ): Promise<ReconInvoice[]> {
    try {
      const q = query(
        collection(db, this.COLLECTION_NAME),
        where('integrationId', '==', integrationId),
        orderBy('generatedDate', 'desc'),
        limit(limitCount)
      );
      
      const querySnapshot = await getDocs(q);
      return querySnapshot.docs.map(doc => ({
        ...doc.data(),
        id: doc.id,
        generatedDate: doc.data().generatedDate.toDate(),
      })) as ReconInvoice[];
    } catch (error) {
      console.error('Error fetching invoices:', error);
      throw new Error(`Failed to fetch invoices: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Update invoice status
   */
  static async updateInvoiceStatus(
    invoiceId: string,
    status: ReconInvoice['status']
  ): Promise<void> {
    try {
      await setDoc(doc(db, this.COLLECTION_NAME, invoiceId), {
        status,
        updatedAt: new Date()
      }, { merge: true });
    } catch (error) {
      console.error('Error updating invoice status:', error);
      throw new Error(`Failed to update invoice status: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Generate next invoice number
   */
  private static async generateInvoiceNumber(
    integrationId: string,
    prefix: string
  ): Promise<string> {
    try {
      // Get existing invoices for this integration
      const q = query(
        collection(db, this.COLLECTION_NAME),
        where('integrationId', '==', integrationId),
        orderBy('generatedDate', 'desc'),
        limit(1)
      );
      
      const querySnapshot = await getDocs(q);
      
      if (querySnapshot.empty) {
        // First invoice for this integration
        return `${prefix}001`;
      } else {
        // Get last invoice number and increment
        const lastInvoice = querySnapshot.docs[0].data();
        const lastNumber = lastInvoice.invoiceNumber;
        
        // Extract number from invoice number (assuming format like "INV-001")
        const numberMatch = lastNumber.match(/(\d+)$/);
        if (numberMatch) {
          const nextNumber = parseInt(numberMatch[1], 10) + 1;
          return `${prefix}${nextNumber.toString().padStart(3, '0')}`;
        } else {
          // Fallback if pattern doesn't match
          return `${prefix}${Date.now().toString().slice(-3)}`;
        }
      }
    } catch (error) {
      console.error('Error generating invoice number:', error);
      // Fallback to timestamp-based number
      return `${prefix}${Date.now().toString().slice(-3)}`;
    }
  }

  /**
   * Get invoice statistics for integration
   */
  static async getInvoiceStats(integrationId: string): Promise<{
    totalInvoices: number;
    totalAmount: number;
    currentMonth: number;
    currentMonthAmount: number;
  }> {
    try {
      const q = query(
        collection(db, this.COLLECTION_NAME),
        where('integrationId', '==', integrationId)
      );
      
      const querySnapshot = await getDocs(q);
      const invoices = querySnapshot.docs.map(doc => doc.data());
      
      const now = new Date();
      const currentMonth = now.toISOString().slice(0, 7); // YYYY-MM format
      
      const stats = {
        totalInvoices: invoices.length,
        totalAmount: invoices.reduce((sum, inv) => sum + (inv.totalAmount || 0), 0),
        currentMonth: invoices.filter(inv => inv.monthYear === currentMonth).length,
        currentMonthAmount: invoices
          .filter(inv => inv.monthYear === currentMonth)
          .reduce((sum, inv) => sum + (inv.totalAmount || 0), 0)
      };
      
      return stats;
    } catch (error) {
      console.error('Error getting invoice stats:', error);
      return {
        totalInvoices: 0,
        totalAmount: 0,
        currentMonth: 0,
        currentMonthAmount: 0
      };
    }
  }

  /**
   * Download invoice as PDF
   */
  static async downloadInvoicePDF(
    invoice: ReconInvoice,
    templateId: string = 'professional-blue'
  ): Promise<void> {
    try {
      // Reconstruct invoice data
      const invoiceData: InvoiceGenerationData = {
        items: invoice.items,
        settings: {
          businessInfo: invoice.businessInfo,
          defaultCustomerInfo: invoice.customerInfo,
          preferences: {
            invoicePrefix: invoice.invoiceNumber.replace(/\d+$/, ''),
            defaultTemplate: templateId,
            autoNumbering: true,
            defaultNotes: invoice.notes
          }
        },
        invoiceNumber: invoice.invoiceNumber,
        date: invoice.generatedDate,
        fileName: invoice.csvFileName
      };

      // Generate PDF
      const pdfBlob = await InvoicePdfGenerator.generateInvoicePDF(invoiceData, templateId);
      
      // Download PDF
      InvoicePdfGenerator.downloadPDF(pdfBlob, invoice.fileName);
      
      // Update status to downloaded
      await this.updateInvoiceStatus(invoice.id, 'downloaded');
    } catch (error) {
      console.error('Error downloading invoice PDF:', error);
      throw new Error(`Failed to download invoice: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Delete an invoice from the database
   */
  static async deleteInvoice(invoiceId: string): Promise<void> {
    try {
      await deleteDoc(doc(db, this.COLLECTION_NAME, invoiceId));
    } catch (error) {
      console.error('Error deleting invoice:', error);
      throw new Error(`Failed to delete invoice: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
}
