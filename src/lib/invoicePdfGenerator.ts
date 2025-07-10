import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { format } from 'date-fns';
import { ReconInvoiceItem, ReconInvoiceSettings } from '@/types/recon-invoice';

export interface InvoiceGenerationData {
  items: ReconInvoiceItem[];
  settings: ReconInvoiceSettings;
  invoiceNumber: string;
  date: Date;
  fileName: string;
}

export interface InvoiceTemplate {
  id: string;
  name: string;
  colors: {
    headerBg: string;
    headerColor: string;
    borderColor: string;
    totalBg: string;
    totalColor: string;
    textColor: string;
    accentColor: string;
  };
}

export const invoiceTemplates: InvoiceTemplate[] = [
  {
    id: 'professional-blue',
    name: 'Professional Blue',
    colors: {
      headerBg: '#4A90E2',
      headerColor: '#FFFFFF',
      borderColor: '#DDDDDD',
      totalBg: '#34495E',
      totalColor: '#FFFFFF',
      textColor: '#333333',
      accentColor: '#4A90E2',
    },
  },
  {
    id: 'emerald-green',
    name: 'Emerald Green',
    colors: {
      headerBg: '#2ECC71',
      headerColor: '#FFFFFF',
      borderColor: '#DDDDDD',
      totalBg: '#16A085',
      totalColor: '#FFFFFF',
      textColor: '#333333',
      accentColor: '#2ECC71',
    },
  },
  {
    id: 'crimson-red',
    name: 'Crimson Red',
    colors: {
      headerBg: '#E74C3C',
      headerColor: '#FFFFFF',
      borderColor: '#DDDDDD',
      totalBg: '#C0392B',
      totalColor: '#FFFFFF',
      textColor: '#333333',
      accentColor: '#E74C3C',
    },
  },
  {
    id: 'purple-gradient',
    name: 'Purple Gradient',
    colors: {
      headerBg: '#9B59B6',
      headerColor: '#FFFFFF',
      borderColor: '#DDDDDD',
      totalBg: '#8E44AD',
      totalColor: '#FFFFFF',
      textColor: '#333333',
      accentColor: '#9B59B6',
    },
  },
  {
    id: 'orange-modern',
    name: 'Orange Modern',
    colors: {
      headerBg: '#F39C12',
      headerColor: '#FFFFFF',
      borderColor: '#DDDDDD',
      totalBg: '#E67E22',
      totalColor: '#FFFFFF',
      textColor: '#333333',
      accentColor: '#F39C12',
    },
  },
];

export class InvoicePdfGenerator {
  private static hexToRgb(hex: string): [number, number, number] {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result 
      ? [
          parseInt(result[1], 16),
          parseInt(result[2], 16),
          parseInt(result[3], 16)
        ]
      : [0, 0, 0];
  }

  private static cleanProductTitle(title: string): string {
    // Clean and format product title for better readability
    let cleanTitle = title
      // Remove common prefixes and suffixes
      .replace(/^\d+\.\s*/, '') // Remove leading numbers like "1. "
      .replace(/\s*-\s*\d+\s*items?$/i, '') // Remove trailing "- X items"
      .replace(/\s*\(SKU:.*?\)$/i, '') // Remove SKU information
      .replace(/\s*\[.*?\]$/i, '') // Remove bracketed information
      // Clean up extra characters and spacing
      .replace(/\s+/g, ' ') // Replace multiple spaces with single space
      .replace(/[^\w\s\-\(\)&,.]/g, '') // Remove special characters except common ones
      .trim();

    // Capitalize first letter of each word for better presentation
    cleanTitle = cleanTitle.replace(/\w\S*/g, (txt) => 
      txt.charAt(0).toUpperCase() + txt.substr(1).toLowerCase()
    );

    // Limit length to prevent table overflow
    if (cleanTitle.length > 60) {
      cleanTitle = cleanTitle.substring(0, 57) + '...';
    }

    return cleanTitle || title; // Fallback to original if cleaning fails
  }

  static async generateInvoicePDF(
    data: InvoiceGenerationData,
    templateId: string = 'professional-blue'
  ): Promise<Blob> {
    const template = invoiceTemplates.find(t => t.id === templateId) || invoiceTemplates[0];
    const { colors } = template;
    const { items, settings, invoiceNumber, date, fileName } = data;

    const doc = new jsPDF();
    const totalAmount = items.reduce((sum, item) => sum + item.totalAmount, 0);
    const pageHeight = doc.internal.pageSize.height;
    const pageWidth = doc.internal.pageSize.width;

    // Convert colors to RGB
    const headerBgRgb = this.hexToRgb(colors.headerBg);
    const accentColorRgb = this.hexToRgb(colors.accentColor);
    const textColorRgb = this.hexToRgb(colors.textColor);

    // 1. Header Section
    doc.setFontSize(24);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...accentColorRgb);
    doc.text('TAX INVOICE', 14, 22);
    
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...textColorRgb);
    doc.text(`Invoice #: ${invoiceNumber}`, pageWidth - 14, 16, { align: 'right' });
    doc.text(`Date: ${format(date, 'dd MMMM yyyy')}`, pageWidth - 14, 22, { align: 'right' });
    doc.text(`Source File: ${fileName}`, pageWidth - 14, 28, { align: 'right' });

    // Line separator
    doc.setDrawColor(...accentColorRgb);
    doc.setLineWidth(1);
    doc.line(14, 32, pageWidth - 14, 32);

    // 2. Business Information Section - Improved spacing and layout
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...textColorRgb);
    doc.text('From:', 14, 44);
    doc.text('Bill To:', 120, 44); // Moved further right for more space

    // Add vertical separator line between From and Bill To sections
    doc.setDrawColor(200, 200, 200);
    doc.setLineWidth(0.5);
    doc.line(110, 38, 110, 100); // Extended vertical line to accommodate more content

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    
    // From address (Business Info) - Improved formatting
    const businessInfo = settings.businessInfo;
    const fromLines = [
      // Company name (will be bold)
      businessInfo.companyName,
      // Trading name if different
      businessInfo.tradingName ? `Trading as: ${businessInfo.tradingName}` : '',
      // Address information
      businessInfo.address,
      `${businessInfo.city}, ${businessInfo.postalCode}`,
      // Contact information grouped
      `Phone: ${businessInfo.phone}`,
      `Email: ${businessInfo.email}`,
      // Registration and tax information
      businessInfo.registrationNumber ? `Registration Number: ${businessInfo.registrationNumber}` : '',
      businessInfo.vatNumber ? `VAT Number: ${businessInfo.vatNumber}` : '',
    ].filter(line => line.trim() !== '');

    let yPosition = 50;
    fromLines.forEach((line, index) => {
      if (index === 0) {
        // Make company name bold and slightly larger
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(10);
        doc.text(line, 14, yPosition);
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(9);
      } else {
        doc.text(line, 14, yPosition);
      }
      yPosition += 4.5; // Increased line spacing for better readability
    });

    // To address (Customer Info) - Improved formatting with more space
    const customerInfo = settings.defaultCustomerInfo;
    const toLines = [
      // Company name in bold style (will be handled separately)
      customerInfo.companyName,
      // Registration info grouped together
      customerInfo.registrationNumber ? `Registration Number: ${customerInfo.registrationNumber}` : '',
      // Address information
      customerInfo.address,
      customerInfo.city && customerInfo.postalCode 
        ? `${customerInfo.city}, ${customerInfo.postalCode}`
        : customerInfo.city || customerInfo.postalCode || '',
      // Contact information grouped
      customerInfo.phone ? `Phone: ${customerInfo.phone}` : '',
      customerInfo.email ? `Email: ${customerInfo.email}` : '',
      // Tax information grouped
      customerInfo.vatNumber ? `VAT Number: ${customerInfo.vatNumber}` : '',
      customerInfo.taxReferenceNumber ? `Tax Reference: ${customerInfo.taxReferenceNumber}` : '',
    ].filter(line => line.trim() !== '');

    yPosition = 50;
    toLines.forEach((line, index) => {
      if (index === 0) {
        // Make company name bold and slightly larger
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(10);
        doc.text(line, 120, yPosition); // Adjusted x position
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(9);
      } else {
        doc.text(line, 120, yPosition); // Adjusted x position
      }
      yPosition += 4.5; // Increased line spacing for better readability
    });

    // Calculate table start position with more buffer space
    const startY = Math.max(50 + (fromLines.length * 4.5), 50 + (toLines.length * 4.5)) + 15; // Increased buffer

    // 3. Items Table
    const tableHead = [['Item Description', 'TSIN', 'Quantity', 'Unit Price', 'Amount']];
    const tableBody = items.map(item => [
      // Clean and format the title - remove extra text and keep only essential product name
      this.cleanProductTitle(item.title),
      item.tsin,
      item.quantity.toString(),
      `R ${item.unitPrice.toFixed(2)}`,
      `R ${item.totalAmount.toFixed(2)}`
    ]);

    autoTable(doc, {
      startY: startY,
      head: tableHead,
      body: tableBody,
      theme: 'grid',
      headStyles: {
        fillColor: headerBgRgb,
        textColor: this.hexToRgb(colors.headerColor),
        fontStyle: 'bold',
        fontSize: 9,
        halign: 'center',
      },
      styles: {
        font: 'helvetica',
        fontSize: 8,
        cellPadding: 4,
        textColor: textColorRgb,
        lineColor: [200, 200, 200],
        lineWidth: 0.5,
      },
      columnStyles: {
        0: { 
          cellWidth: 90, // Increased width for item description
          halign: 'left',
          valign: 'middle'
        }, // Item Description - wider for better readability
        1: { 
          cellWidth: 28, // Slightly increased for TSIN
          halign: 'center',
          valign: 'middle'
        }, // TSIN
        2: { 
          cellWidth: 22, // Slightly increased for quantity
          halign: 'center',
          valign: 'middle'
        }, // Quantity
        3: { 
          cellWidth: 28, // Increased for unit price
          halign: 'right',
          valign: 'middle'
        }, // Unit Price
        4: { 
          cellWidth: 32, // Increased for amount
          halign: 'right',
          valign: 'middle',
          fontStyle: 'bold'
        }, // Amount - bold for emphasis
      },
      alternateRowStyles: {
        fillColor: [248, 249, 250] // Light gray for alternate rows
      },
      didDrawPage: (data: any) => {
        // Footer with page numbers
        const totalPages = (doc.internal as any).getNumberOfPages();
        doc.setFontSize(8);
        doc.setTextColor(150, 150, 150);
        doc.text(
          `Page ${data.pageNumber} of ${totalPages}`,
          pageWidth / 2,
          pageHeight - 10,
          { align: 'center' }
        );
      }
    });

    const finalY = (doc as any).lastAutoTable.finalY || startY + 50;

    // 4. Total Section
    const totalSectionY = finalY + 10;
    
    // Check if we need a new page for totals
    if (pageHeight - totalSectionY < 40) {
      doc.addPage();
      const newFinalY = 20;
      this.drawTotalSection(doc, newFinalY, totalAmount, colors, pageWidth);
    } else {
      this.drawTotalSection(doc, totalSectionY, totalAmount, colors, pageWidth);
    }

    // 5. Notes Section (if any)
    let finalNotesY = totalSectionY + 35;
    if (pageHeight - totalSectionY < 40) {
      finalNotesY = 85; // On new page
    }

    if (settings.preferences.defaultNotes) {
      doc.setFontSize(9);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(...textColorRgb);
      doc.text('Notes:', 14, finalNotesY);
      
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8);
      const notesLines = doc.splitTextToSize(settings.preferences.defaultNotes, pageWidth - 28);
      doc.text(notesLines, 14, finalNotesY + 6);
      finalNotesY += 6 + (notesLines.length * 3);
    }

    // Add a professional footer note
    const footerY = Math.max(finalNotesY + 20, pageHeight - 30);
    doc.setFontSize(7);
    doc.setFont('helvetica', 'italic');
    doc.setTextColor(100, 100, 100);
    doc.text(
      'This is a computer-generated invoice and does not require a signature.',
      pageWidth / 2,
      footerY,
      { align: 'center' }
    );

    // Return as Blob
    return new Blob([doc.output('blob')], { type: 'application/pdf' });
  }

  private static drawTotalSection(
    doc: jsPDF, 
    startY: number, 
    totalAmount: number, 
    colors: InvoiceTemplate['colors'],
    pageWidth: number
  ): void {
    const totalBgRgb = this.hexToRgb(colors.totalBg);
    const totalColorRgb = this.hexToRgb(colors.totalColor);
    
    // Add some spacing before total
    const totalY = startY + 10;
    
    // Draw total background with rounded corners effect
    doc.setFillColor(...totalBgRgb);
    doc.rect(pageWidth - 85, totalY, 71, 25, 'F');
    
    // Add a subtle border
    doc.setDrawColor(...totalBgRgb);
    doc.setLineWidth(1);
    doc.rect(pageWidth - 85, totalY, 71, 25);
    
    // Draw total text with better spacing
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...totalColorRgb);
    doc.text('TOTAL AMOUNT', pageWidth - 80, totalY + 10);
    
    // Make the amount more prominent
    doc.setFontSize(14);
    doc.text(`R ${totalAmount.toFixed(2)}`, pageWidth - 19, totalY + 20, { align: 'right' });
  }

  static downloadPDF(blob: Blob, fileName: string): void {
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }
}
