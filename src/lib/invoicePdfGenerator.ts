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

export interface InvoiceLayout {
  id: string;
  name: string;
  description: string;
}

export interface InvoiceColorScheme {
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

export interface InvoiceTemplate {
  layoutId: string;
  colorSchemeId: string;
  id: string;
  name: string;
  layout: InvoiceLayout;
  colorScheme: InvoiceColorScheme;
}

// Define 10 different layouts
export const invoiceLayouts: InvoiceLayout[] = [
  {
    id: 'professional',
    name: 'Professional',
    description: 'Clean, traditional business layout with standard margins and clear sections'
  },
  {
    id: 'modern',
    name: 'Modern',
    description: 'Contemporary design with reduced margins and centered elements'
  },
  {
    id: 'minimal',
    name: 'Minimal',
    description: 'Clean, uncluttered design with generous white space'
  },
  {
    id: 'bold',
    name: 'Bold',
    description: 'Strong visual impact with thick borders and prominent headers'
  },
  {
    id: 'elegant',
    name: 'Elegant',
    description: 'Refined design with decorative elements and centered styling'
  },
  {
    id: 'corporate',
    name: 'Corporate',
    description: 'Formal business layout with structured information hierarchy'
  },
  {
    id: 'creative',
    name: 'Creative',
    description: 'Dynamic layout with creative visual elements and accents'
  },
  {
    id: 'luxury',
    name: 'Luxury',
    description: 'Premium design with rounded corners and refined typography'
  },
  {
    id: 'tech',
    name: 'Tech',
    description: 'Modern tech-inspired design with angular elements'
  },
  {
    id: 'classic',
    name: 'Classic',
    description: 'Traditional invoice layout with timeless business styling'
  }
];

// Define 10 color schemes
export const invoiceColorSchemes: InvoiceColorScheme[] = [
  {
    id: 'blue',
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
    id: 'green',
    name: 'Emerald Green',
    colors: {
      headerBg: '#2ECC71',
      headerColor: '#FFFFFF',
      borderColor: '#E8F5E8',
      totalBg: '#16A085',
      totalColor: '#FFFFFF',
      textColor: '#2C3E50',
      accentColor: '#2ECC71',
    },
  },
  {
    id: 'red',
    name: 'Crimson Red',
    colors: {
      headerBg: '#E74C3C',
      headerColor: '#FFFFFF',
      borderColor: '#FCE4EC',
      totalBg: '#C0392B',
      totalColor: '#FFFFFF',
      textColor: '#2C3E50',
      accentColor: '#E74C3C',
    },
  },
  {
    id: 'purple',
    name: 'Royal Purple',
    colors: {
      headerBg: '#9B59B6',
      headerColor: '#FFFFFF',
      borderColor: '#F3E5F5',
      totalBg: '#8E44AD',
      totalColor: '#FFFFFF',
      textColor: '#4A4A4A',
      accentColor: '#9B59B6',
    },
  },
  {
    id: 'orange',
    name: 'Sunset Orange',
    colors: {
      headerBg: '#F39C12',
      headerColor: '#FFFFFF',
      borderColor: '#FFF3E0',
      totalBg: '#E67E22',
      totalColor: '#FFFFFF',
      textColor: '#5D4037',
      accentColor: '#F39C12',
    },
  },
  {
    id: 'dark',
    name: 'Midnight Dark',
    colors: {
      headerBg: '#2C3E50',
      headerColor: '#FFFFFF',
      borderColor: '#ECEFF1',
      totalBg: '#1A252F',
      totalColor: '#FFFFFF',
      textColor: '#37474F',
      accentColor: '#2C3E50',
    },
  },
  {
    id: 'indigo',
    name: 'Royal Indigo',
    colors: {
      headerBg: '#6366F1',
      headerColor: '#FFFFFF',
      borderColor: '#E8EAF6',
      totalBg: '#4F46E5',
      totalColor: '#FFFFFF',
      textColor: '#1A1A1A',
      accentColor: '#6366F1',
    },
  },
  {
    id: 'coral',
    name: 'Sunset Coral',
    colors: {
      headerBg: '#FF6B6B',
      headerColor: '#FFFFFF',
      borderColor: '#FFEBEE',
      totalBg: '#EE5A52',
      totalColor: '#FFFFFF',
      textColor: '#424242',
      accentColor: '#FF6B6B',
    },
  },
  {
    id: 'teal',
    name: 'Forest Teal',
    colors: {
      headerBg: '#14B8A6',
      headerColor: '#FFFFFF',
      borderColor: '#E0F2F1',
      totalBg: '#0F766E',
      totalColor: '#FFFFFF',
      textColor: '#263238',
      accentColor: '#14B8A6',
    },
  },
  {
    id: 'amethyst',
    name: 'Amethyst Purple',
    colors: {
      headerBg: '#A855F7',
      headerColor: '#FFFFFF',
      borderColor: '#F3E8FF',
      totalBg: '#9333EA',
      totalColor: '#FFFFFF',
      textColor: '#374151',
      accentColor: '#A855F7',
    },
  },
];

// Create combined templates (layout + color combinations)
export const invoiceTemplates: InvoiceTemplate[] = invoiceLayouts.flatMap(layout =>
  invoiceColorSchemes.map(colorScheme => ({
    layoutId: layout.id,
    colorSchemeId: colorScheme.id,
    id: `${layout.id}-${colorScheme.id}`,
    name: `${layout.name} ${colorScheme.name}`,
    layout,
    colorScheme
  }))
);

// Utility function to get a random template for new users
export const getRandomTemplate = (): string => {
  const randomIndex = Math.floor(Math.random() * invoiceTemplates.length);
  return invoiceTemplates[randomIndex].id;
};

// Utility function to get template by ID with fallback
export const getTemplateById = (templateId: string): InvoiceTemplate => {
  return invoiceTemplates.find(t => t.id === templateId) || invoiceTemplates[0];
};

// New utility functions for separate layout and color selection
export const getRandomLayout = (): string => {
  const randomIndex = Math.floor(Math.random() * invoiceLayouts.length);
  return invoiceLayouts[randomIndex].id;
};

export const getRandomColorScheme = (): string => {
  const randomIndex = Math.floor(Math.random() * invoiceColorSchemes.length);
  return invoiceColorSchemes[randomIndex].id;
};

export const getLayoutById = (layoutId: string): InvoiceLayout => {
  return invoiceLayouts.find(l => l.id === layoutId) || invoiceLayouts[0];
};

export const getColorSchemeById = (colorSchemeId: string): InvoiceColorScheme => {
  return invoiceColorSchemes.find(c => c.id === colorSchemeId) || invoiceColorSchemes[0];
};

export const createTemplateFromLayoutAndColor = (layoutId: string, colorSchemeId: string): InvoiceTemplate => {
  const layout = getLayoutById(layoutId);
  const colorScheme = getColorSchemeById(colorSchemeId);
  
  return {
    layoutId: layout.id,
    colorSchemeId: colorScheme.id,
    id: `${layout.id}-${colorScheme.id}`,
    name: `${layout.name} ${colorScheme.name}`,
    layout,
    colorScheme
  };
};

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
    if (!title || title.trim() === '') {
      return 'Product'; // Fallback for empty titles
    }

    // For CSV data, we want to preserve the complete title as much as possible
    // Only do minimal cleaning to ensure PDF compatibility
    let cleanTitle = title
      .trim()
      // Remove only clearly problematic characters that break PDF rendering
      .replace(/[\x00-\x1F\x7F-\x9F]/g, '') // Remove control characters
      .replace(/[<>{}[\]]/g, '') // Remove only clearly problematic characters
      // Clean up excessive whitespace
      .replace(/\s+/g, ' ') // Replace multiple spaces with single space
      .trim();

    // Only remove obvious metadata patterns at the end, not product specs
    cleanTitle = cleanTitle
      .replace(/\s*\(SKU:.*?\)$/i, '') // Remove SKU information at end
      .replace(/\s*-\s*\d+\s*items?$/i, '') // Remove trailing "- X items"
      .replace(/^\d+\.\s*/, ''); // Remove leading numbers like "1. "

    // Don't modify capitalization - preserve original formatting
    // Don't split on dashes - many product names legitimately contain dashes

    // Increase length limit significantly to show complete product names
    if (cleanTitle.length > 80) {
      // Find a good breaking point near the limit
      const breakPoint = cleanTitle.lastIndexOf(' ', 77);
      if (breakPoint > 40) {
        cleanTitle = cleanTitle.substring(0, breakPoint) + '...';
      } else {
        cleanTitle = cleanTitle.substring(0, 77) + '...';
      }
    }

    // Ensure we return something meaningful
    return cleanTitle.length >= 2 ? cleanTitle : title.substring(0, 80);
  }

  static async generateInvoicePDF(
    data: InvoiceGenerationData,
    templateId: string = 'professional-blue'
  ): Promise<Blob> {
    const template = invoiceTemplates.find(t => t.id === templateId) || invoiceTemplates[0];
    const colors = template.colorScheme.colors;
    const layout = template.layout;
    const { items, settings, invoiceNumber, date, fileName } = data;

    const doc = new jsPDF();
    const totalAmount = items.reduce((sum, item) => sum + item.totalAmount, 0);
    const pageHeight = doc.internal.pageSize.height;
    const pageWidth = doc.internal.pageSize.width;

    // Design-specific margin and layout adjustments
    let leftMargin = 25;
    let rightMargin = 25;
    let headerFontSize = 24;
    let invoiceTextStyle = 'bold';
    
    // Adjust based on design type
    switch (layout.id) {
      case 'modern':
        leftMargin = 20; rightMargin = 20; headerFontSize = 28;
        break;
      case 'minimal':
        leftMargin = 35; rightMargin = 35; headerFontSize = 20;
        break;
      case 'bold':
        leftMargin = 15; rightMargin = 15; headerFontSize = 32;
        break;
      case 'elegant':
        leftMargin = 40; rightMargin = 40; headerFontSize = 22;
        break;
      case 'corporate':
        leftMargin = 30; rightMargin = 30; headerFontSize = 26;
        break;
      case 'creative':
        leftMargin = 20; rightMargin = 20; headerFontSize = 30;
        break;
      case 'luxury':
        leftMargin = 45; rightMargin = 45; headerFontSize = 24;
        break;
      case 'tech':
        leftMargin = 18; rightMargin = 18; headerFontSize = 26;
        break;
      case 'classic':
        leftMargin = 35; rightMargin = 35; headerFontSize = 22;
        break;
    }
    const usableWidth = pageWidth - leftMargin - rightMargin;
    const billToStartX = leftMargin + (usableWidth * 0.52);

    // Convert colors to RGB
    const headerBgRgb = this.hexToRgb(colors.headerBg);
    const accentColorRgb = this.hexToRgb(colors.accentColor);
    const textColorRgb = this.hexToRgb(colors.textColor);

    // 1. Header Section with design-specific styling
    doc.setFontSize(headerFontSize);
    doc.setFont('helvetica', invoiceTextStyle as any);
    doc.setTextColor(...accentColorRgb);
    
    // Design-specific header layout
    if (layout.id === 'minimal') {
      doc.text('INVOICE', pageWidth / 2, 22, { align: 'center' });
    } else if (layout.id === 'bold') {
      doc.setFillColor(...headerBgRgb);
      doc.rect(leftMargin - 5, 10, pageWidth - leftMargin - rightMargin + 10, 20, 'F');
      doc.setTextColor(255, 255, 255);
      doc.text('TAX INVOICE', leftMargin, 22);
    } else if (layout.id === 'elegant' || layout.id === 'luxury') {
      doc.text('TAX INVOICE', pageWidth / 2, 22, { align: 'center' });
      // Add decorative line
      doc.setDrawColor(...accentColorRgb);
      doc.setLineWidth(2);
      doc.line(pageWidth/2 - 40, 26, pageWidth/2 + 40, 26);
    } else if (layout.id === 'tech') {
      doc.text('TAX INVOICE', leftMargin, 22);
      // Add tech-style corner accents
      doc.setDrawColor(...accentColorRgb);
      doc.setLineWidth(3);
      doc.line(leftMargin, 10, leftMargin + 15, 10);
      doc.line(leftMargin, 10, leftMargin, 25);
      doc.line(pageWidth - rightMargin, 10, pageWidth - rightMargin - 15, 10);
      doc.line(pageWidth - rightMargin, 10, pageWidth - rightMargin, 25);
    } else if (layout.id === 'creative') {
      doc.text('TAX INVOICE', leftMargin, 22);
      // Add creative elements
      doc.setFillColor(...accentColorRgb);
      doc.circle(pageWidth - 30, 20, 8, 'F');
    } else {
      // Default professional style
      doc.text('TAX INVOICE', leftMargin, 22);
    }
    
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...textColorRgb);
    doc.text(`Invoice #: ${invoiceNumber}`, pageWidth - rightMargin, 16, { align: 'right' });
    doc.text(`Date: ${format(date, 'dd MMMM yyyy')}`, pageWidth - rightMargin, 22, { align: 'right' });
    doc.text(`Source File: ${fileName}`, pageWidth - rightMargin, 28, { align: 'right' });

    // Line separator with design-specific styling
    doc.setDrawColor(...accentColorRgb);
    doc.setLineWidth(layout.id === 'bold' ? 2 : layout.id === 'minimal' ? 0.5 : 1);
    doc.line(leftMargin, 32, pageWidth - rightMargin, 32);

    // 2. Business Information Section
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...textColorRgb);
    doc.text('From:', leftMargin, 48);
    doc.text('Bill To:', billToStartX, 48);

    // Add vertical separator line (design-specific)
    if (layout.id !== 'minimal') {
      doc.setDrawColor(200, 200, 200);
      doc.setLineWidth(0.5);
      const separatorX = billToStartX - 15;
      doc.line(separatorX, 42, separatorX, 115);
    }

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    
    // From address (Business Info)
    const businessInfo = settings.businessInfo;
    const fromLines = [
      businessInfo.companyName,
      businessInfo.tradingName ? `Trading as: ${businessInfo.tradingName}` : '',
      businessInfo.address,
      `${businessInfo.city}, ${businessInfo.postalCode}`,
      `Phone: ${businessInfo.phone}`,
      `Email: ${businessInfo.email}`,
      businessInfo.registrationNumber ? `Registration Number: ${businessInfo.registrationNumber}` : '',
      businessInfo.vatNumber ? `VAT Number: ${businessInfo.vatNumber}` : '',
    ].filter(line => line.trim() !== '');

    let yPosition = 54;
    fromLines.forEach((line, index) => {
      if (index === 0) {
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(10);
        doc.text(line, leftMargin, yPosition);
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(9);
      } else {
        doc.text(line, leftMargin, yPosition);
      }
      yPosition += 5;
    });

    // To address (Customer Info)
    const customerInfo = settings.defaultCustomerInfo;
    const maxBillToWidth = pageWidth - billToStartX - rightMargin;
    
    const toLines = [
      customerInfo.companyName,
      customerInfo.registrationNumber ? `Registration Number: ${customerInfo.registrationNumber}` : '',
      customerInfo.address,
      customerInfo.city && customerInfo.postalCode 
        ? `${customerInfo.city}, ${customerInfo.postalCode}`
        : customerInfo.city || customerInfo.postalCode || '',
      customerInfo.phone ? `Phone: ${customerInfo.phone}` : '',
      customerInfo.email ? `Email: ${customerInfo.email}` : '',
      customerInfo.vatNumber ? `VAT Number: ${customerInfo.vatNumber}` : '',
      customerInfo.taxReferenceNumber ? `Tax Reference: ${customerInfo.taxReferenceNumber}` : '',
    ].filter(line => line.trim() !== '');

    yPosition = 54;
    toLines.forEach((line, index) => {
      if (index === 0) {
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(10);
        // Use splitTextToSize for company name to handle long names
        const companyNameLines = doc.splitTextToSize(line, maxBillToWidth);
        companyNameLines.forEach((nameLine: string, nameIndex: number) => {
          doc.text(nameLine, billToStartX, yPosition + (nameIndex * 5));
        });
        yPosition += (companyNameLines.length - 1) * 5; // Adjust for multiple lines
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(9);
      } else {
        // Use splitTextToSize for long addresses and other text
        const wrappedLines = doc.splitTextToSize(line, maxBillToWidth);
        wrappedLines.forEach((wrappedLine: string, wrapIndex: number) => {
          doc.text(wrappedLine, billToStartX, yPosition + (wrapIndex * 5));
        });
        yPosition += (wrappedLines.length - 1) * 5; // Adjust for multiple lines
      }
      yPosition += 5; // Increased line spacing for better readability
    });

    // Calculate table start position
    const startY = Math.max(54 + (fromLines.length * 5), 54 + (toLines.length * 5)) + 25;

    // 3. Items Table with design-specific styling
    const tableHead = [['Title', 'TSIN', 'Quantity', 'Unit Price', 'Amount']];
    const tableBody = items.map(item => [
      this.cleanProductTitle(item.title),
      item.tsin,
      item.quantity.toString(),
      `R ${item.unitPrice.toFixed(2)}`,
      `R ${item.totalAmount.toFixed(2)}`
    ]);

    // Design-specific table styling
    let tableTheme: 'striped' | 'grid' | 'plain' = 'grid';
    let alternateRowColor: [number, number, number] = [248, 249, 250];
    
    switch (layout.id) {
      case 'minimal':
        tableTheme = 'plain';
        break;
      case 'bold':
        tableTheme = 'grid';
        alternateRowColor = [240, 240, 240];
        break;
      case 'elegant':
      case 'luxury':
        tableTheme = 'striped';
        alternateRowColor = [252, 252, 252];
        break;
      case 'tech':
        tableTheme = 'grid';
        alternateRowColor = [245, 248, 250];
        break;
    }

    autoTable(doc, {
      startY: startY,
      head: tableHead,
      body: tableBody,
      theme: tableTheme,
      margin: { left: leftMargin, right: rightMargin },
      headStyles: {
        fillColor: headerBgRgb,
        textColor: this.hexToRgb(colors.headerColor),
        fontStyle: 'bold',
        fontSize: layout.id === 'bold' ? 10 : 9,
        halign: 'center',
      },
      styles: {
        font: 'helvetica',
        fontSize: layout.id === 'luxury' ? 9 : 8,
        cellPadding: layout.id === 'minimal' ? 3 : layout.id === 'luxury' ? 5 : 4,
        textColor: textColorRgb,
        lineColor: layout.id === 'minimal' ? [230, 230, 230] : [200, 200, 200],
        lineWidth: layout.id === 'bold' ? 1 : 0.5,
      },
      columnStyles: {
        0: { 
          cellWidth: layout.id === 'minimal' || layout.id === 'luxury' ? 90 : 85,
          halign: 'left',
          valign: 'middle'
        },
        1: { 
          cellWidth: 22,
          halign: 'center',
          valign: 'middle'
        },
        2: { 
          cellWidth: 16,
          halign: 'center',
          valign: 'middle'
        },
        3: { 
          cellWidth: 22,
          halign: 'right',
          valign: 'middle'
        },
        4: { 
          cellWidth: 24,
          halign: 'right',
          valign: 'middle',
          fontStyle: 'bold'
        },
      },
      alternateRowStyles: {
        fillColor: alternateRowColor
      },
      didDrawPage: (data: any) => {
        const totalPages = (doc.internal as any).getNumberOfPages();
        doc.setFontSize(8);
        doc.setTextColor(150, 150, 150);
        doc.text(
          `Page ${data.pageNumber} of ${totalPages}`,
          pageWidth / 2,
          pageHeight - 15,
          { align: 'center' }
        );
      }
    });

    const finalY = (doc as any).lastAutoTable.finalY || startY + 50;

    // 4. Total Section with design-specific styling
    const totalSectionY = finalY + 10;
    
    if (pageHeight - totalSectionY < 40) {
      doc.addPage();
      const newFinalY = 20;
      this.drawDesignSpecificTotalSection(doc, newFinalY, totalAmount, colors, layout.id, pageWidth, rightMargin);
    } else {
      this.drawDesignSpecificTotalSection(doc, totalSectionY, totalAmount, colors, layout.id, pageWidth, rightMargin);
    }

    // 5. Notes Section
    let finalNotesY = totalSectionY + 35;
    if (pageHeight - totalSectionY < 40) {
      finalNotesY = 85;
    }

    if (settings.preferences.defaultNotes) {
      doc.setFontSize(9);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(...textColorRgb);
      doc.text('Notes:', leftMargin, finalNotesY);
      
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8);
      const notesLines = doc.splitTextToSize(settings.preferences.defaultNotes, pageWidth - leftMargin - rightMargin);
      doc.text(notesLines, leftMargin, finalNotesY + 6);
    }

    return new Blob([doc.output('blob')], { type: 'application/pdf' });
  }

  // Design-specific total section
  private static drawDesignSpecificTotalSection(
    doc: jsPDF, 
    startY: number, 
    totalAmount: number, 
    colors: InvoiceColorScheme['colors'],
    designId: string,
    pageWidth: number,
    rightMargin: number = 20
  ): void {
    const totalBgRgb = this.hexToRgb(colors.totalBg);
    const totalColorRgb = this.hexToRgb(colors.totalColor);
    const accentColorRgb = this.hexToRgb(colors.accentColor);
    
    const totalY = startY + 10;
    let totalBoxWidth = 80;
    
    // Design-specific adjustments
    switch (designId) {
      case 'minimal':
        totalBoxWidth = 70;
        break;
      case 'bold':
        totalBoxWidth = 90;
        break;
      case 'luxury':
      case 'elegant':
        totalBoxWidth = 85;
        break;
    }
    
    const totalBoxX = pageWidth - rightMargin - totalBoxWidth;
    
    // Design-specific total styling
    if (designId === 'minimal') {
      // Minimal: Just text with underline
      doc.setFontSize(10);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(...totalBgRgb);
      doc.text('TOTAL AMOUNT', totalBoxX + (totalBoxWidth / 2), totalY + 5, { align: 'center' });
      doc.setFontSize(14);
      doc.text(`R ${totalAmount.toFixed(2)}`, totalBoxX + (totalBoxWidth / 2), totalY + 15, { align: 'center' });
      // Underline
      doc.setDrawColor(...accentColorRgb);
      doc.setLineWidth(1);
      doc.line(totalBoxX + 10, totalY + 17, totalBoxX + totalBoxWidth - 10, totalY + 17);
    } else if (designId === 'bold') {
      // Bold: Thick border with shadow effect
      doc.setFillColor(...totalBgRgb);
      doc.rect(totalBoxX + 2, totalY + 2, totalBoxWidth, 25, 'F'); // Shadow
      doc.setFillColor(40, 40, 40);
      doc.rect(totalBoxX, totalY, totalBoxWidth, 25, 'F'); // Main box
      doc.setFontSize(11);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(255, 255, 255);
      doc.text('TOTAL AMOUNT', totalBoxX + (totalBoxWidth / 2), totalY + 10, { align: 'center' });
      doc.setFontSize(16);
      doc.text(`R ${totalAmount.toFixed(2)}`, totalBoxX + (totalBoxWidth / 2), totalY + 20, { align: 'center' });
    } else if (designId === 'elegant' || designId === 'luxury') {
      // Elegant: Rounded corners with border
      doc.setFillColor(...totalBgRgb);
      doc.roundedRect(totalBoxX, totalY, totalBoxWidth, 25, 3, 3, 'F');
      doc.setDrawColor(...accentColorRgb);
      doc.setLineWidth(1);
      doc.roundedRect(totalBoxX, totalY, totalBoxWidth, 25, 3, 3, 'S');
      doc.setFontSize(10);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(...totalColorRgb);
      doc.text('TOTAL AMOUNT', totalBoxX + (totalBoxWidth / 2), totalY + 10, { align: 'center' });
      doc.setFontSize(14);
      doc.text(`R ${totalAmount.toFixed(2)}`, totalBoxX + (totalBoxWidth / 2), totalY + 20, { align: 'center' });
    } else if (designId === 'tech') {
      // Tech: Angular design with corner cuts
      doc.setFillColor(...totalBgRgb);
      // Draw a polygon for angular look
      doc.setDrawColor(...totalBgRgb);
      doc.setLineWidth(0);
      doc.lines([[0, 0], [totalBoxWidth - 5, 0], [totalBoxWidth, 5], [totalBoxWidth, 25], [5, 25], [0, 20]], totalBoxX, totalY, [1, 1], 'F');
      doc.setFontSize(10);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(...totalColorRgb);
      doc.text('TOTAL AMOUNT', totalBoxX + (totalBoxWidth / 2), totalY + 10, { align: 'center' });
      doc.setFontSize(14);
      doc.text(`R ${totalAmount.toFixed(2)}`, totalBoxX + (totalBoxWidth / 2), totalY + 20, { align: 'center' });
    } else {
      // Default professional style
      doc.setFillColor(...totalBgRgb);
      doc.rect(totalBoxX, totalY, totalBoxWidth, 25, 'F');
      doc.setDrawColor(...totalBgRgb);
      doc.setLineWidth(1);
      doc.rect(totalBoxX, totalY, totalBoxWidth, 25);
      doc.setFontSize(10);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(...totalColorRgb);
      doc.text('TOTAL AMOUNT', totalBoxX + (totalBoxWidth / 2), totalY + 10, { align: 'center' });
      doc.setFontSize(14);
      doc.text(`R ${totalAmount.toFixed(2)}`, totalBoxX + (totalBoxWidth / 2), totalY + 20, { align: 'center' });
    }
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
