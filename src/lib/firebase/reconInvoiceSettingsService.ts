import { doc, getDoc, setDoc, updateDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase/firebase';
import { ReconInvoiceSettings } from '@/types/recon-invoice';

export class ReconInvoiceSettingsService {
  /**
   * Save or update recon invoice settings for a specific integration
   */
  static async saveSettings(integrationId: string, settings: ReconInvoiceSettings): Promise<void> {
    try {
      const integrationRef = doc(db, 'takealotIntegrations', integrationId);
      
      // Update the integration document with the new settings
      await updateDoc(integrationRef, {
        reconInvoiceSettings: settings,
        updatedAt: new Date()
      });
      
      console.log('Recon invoice settings saved successfully');
    } catch (error) {
      console.error('Error saving recon invoice settings:', error);
      throw new Error('Failed to save settings. Please try again.');
    }
  }

  /**
   * Get recon invoice settings for a specific integration
   */
  static async getSettings(integrationId: string): Promise<ReconInvoiceSettings | null> {
    try {
      const integrationRef = doc(db, 'takealotIntegrations', integrationId);
      const integrationSnap = await getDoc(integrationRef);
      
      if (integrationSnap.exists()) {
        const data = integrationSnap.data();
        return data.reconInvoiceSettings || null;
      }
      
      return null;
    } catch (error) {
      console.error('Error getting recon invoice settings:', error);
      throw new Error('Failed to load settings. Please try again.');
    }
  }

  /**
   * Get integration basic info (account name, etc.)
   */
  static async getIntegrationInfo(integrationId: string): Promise<{ accountName: string; adminId: string } | null> {
    try {
      const integrationRef = doc(db, 'takealotIntegrations', integrationId);
      const integrationSnap = await getDoc(integrationRef);
      
      if (integrationSnap.exists()) {
        const data = integrationSnap.data();
        return {
          accountName: data.accountName || 'Unknown Account',
          adminId: data.adminId || ''
        };
      }
      
      return null;
    } catch (error) {
      console.error('Error getting integration info:', error);
      throw new Error('Failed to load integration information.');
    }
  }

  /**
   * Initialize default settings for an integration
   */
  static createDefaultSettings(integrationName: string): ReconInvoiceSettings {
    return {
      businessInfo: {
        companyName: '',
        tradingName: integrationName,
        address: '',
        city: '',
        postalCode: '',
        phone: '',
        email: '',
        vatNumber: '',
        registrationNumber: '',
      },
      defaultCustomerInfo: {
        companyName: 'TakealotOnline(RF) (Pty) Ltd',
        address: '12th Floor\n10 Rua Vasco Da Gama Plain\nForeshore\nCape Town\n8000',
        city: 'Cape Town',
        postalCode: '8000',
        phone: '',
        email: '',
        registrationNumber: '2010/020248/07',
        taxReferenceNumber: '9910006148',
        vatNumber: '4470208333',
      },
      preferences: {
        invoicePrefix: `${integrationName.substring(0, 2).toUpperCase()}-`,
        defaultTemplate: 'professional-blue',
        autoNumbering: true,
        defaultNotes: '',
      },
    };
  }

  /**
   * Validate required settings fields
   */
  static validateSettings(settings: ReconInvoiceSettings): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];

    console.log('Validating settings:', settings); // Debug log

    // Business info validation
    if (!settings.businessInfo.companyName.trim()) {
      errors.push('Company name is required');
    }
    if (!settings.businessInfo.address.trim()) {
      errors.push('Business address is required');
    }
    if (!settings.businessInfo.city.trim()) {
      errors.push('City is required');
    }
    if (!settings.businessInfo.postalCode.trim()) {
      errors.push('Postal code is required');
    }
    if (!settings.businessInfo.email.trim()) {
      errors.push('Email address is required');
    }

    // Email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (settings.businessInfo.email && !emailRegex.test(settings.businessInfo.email)) {
      errors.push('Invalid business email address');
    }
    if (settings.defaultCustomerInfo.email && !emailRegex.test(settings.defaultCustomerInfo.email)) {
      errors.push('Invalid customer email address');
    }

    // Customer info validation (Takealot details)
    if (!settings.defaultCustomerInfo.companyName.trim()) {
      errors.push('Customer/company name is required');
    }
    if (!settings.defaultCustomerInfo.address.trim()) {
      errors.push('Customer address is required');
    }
    if (!settings.defaultCustomerInfo.registrationNumber?.trim()) {
      errors.push('Company registration number is required');
    }
    if (!settings.defaultCustomerInfo.taxReferenceNumber?.trim()) {
      errors.push('Company tax reference number is required');
    }
    if (!settings.defaultCustomerInfo.vatNumber?.trim()) {
      errors.push('VAT number is required');
    }

    // Preferences validation
    if (!settings.preferences.invoicePrefix.trim()) {
      errors.push('Invoice prefix is required');
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }
}
