// Types for Recon Invoice functionality

export interface ReconInvoiceSettings {
  businessInfo: {
    companyName: string;
    tradingName?: string;
    address: string;
    city: string;
    postalCode: string;
    phone: string;
    email: string;
    vatNumber?: string;
    registrationNumber?: string;
  };
  defaultCustomerInfo: {
    companyName: string;
    address: string;
    city?: string;
    postalCode?: string;
    phone?: string;
    email?: string;
    registrationNumber?: string; // Company Registration Number
    taxReferenceNumber?: string; // Company Tax Reference Number  
    vatNumber?: string; // VAT Number
  };
  preferences: {
    invoicePrefix: string;
    defaultTemplate: string;
    autoNumbering: boolean;
    defaultNotes?: string;
  };
}

export interface ReconInvoiceItem {
  title: string;
  tsin: string;
  quantity: number;
  unitPrice: number;
  totalAmount: number;
}

export interface ReconInvoice {
  id: string;
  integrationId: string;
  integrationName: string;
  invoiceNumber: string;
  fileName: string;
  csvFileName: string;
  generatedDate: Date;
  monthYear: string;
  totalAmount: number;
  itemCount: number;
  templateUsed: string;
  pdfUrl?: string;
  status: 'generated' | 'downloaded' | 'sent';
  items: ReconInvoiceItem[];
  businessInfo: ReconInvoiceSettings['businessInfo'];
  customerInfo: ReconInvoiceSettings['defaultCustomerInfo'];
  notes?: string;
}

export interface CSVUploadData {
  file: File;
  parsedData: ReconInvoiceItem[];
  isValid: boolean;
  errors: string[];
}

// Extend existing TakealotIntegration interface
export interface TakealotIntegrationWithRecon {
  id: string;
  accountName: string;
  assignedUserId: string;
  adminId: string;
  apiKey?: string;
  status?: string;
  createdAt?: any;
  updatedAt?: any;
  reconInvoiceSettings?: ReconInvoiceSettings;
}
