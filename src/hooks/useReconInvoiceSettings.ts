import { useState, useEffect } from 'react';
import { ReconInvoiceSettingsService } from '@/lib/firebase/reconInvoiceSettingsService';
import { ReconInvoiceSettings } from '@/types/recon-invoice';

export const useReconInvoiceSettings = (integrationId: string) => {
  const [settings, setSettings] = useState<ReconInvoiceSettings | null>(null);
  const [integrationInfo, setIntegrationInfo] = useState<{ accountName: string; adminId: string } | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Load settings and integration info
  const loadData = async () => {
    try {
      setIsLoading(true);
      setError(null);

      // Load integration basic info
      const integrationData = await ReconInvoiceSettingsService.getIntegrationInfo(integrationId);
      setIntegrationInfo(integrationData);

      // Load existing settings
      const existingSettings = await ReconInvoiceSettingsService.getSettings(integrationId);
      if (existingSettings) {
        setSettings(existingSettings);
      } else if (integrationData) {
        // Create default settings if none exist
        const defaultSettings = ReconInvoiceSettingsService.createDefaultSettings(integrationData.accountName);
        setSettings(defaultSettings);
      }
    } catch (err) {
      console.error('Error loading recon invoice data:', err);
      setError(err instanceof Error ? err.message : 'Failed to load data');
    } finally {
      setIsLoading(false);
    }
  };

  // Save settings
  const saveSettings = async (newSettings: ReconInvoiceSettings): Promise<void> => {
    try {
      // Validate settings
      const validation = ReconInvoiceSettingsService.validateSettings(newSettings);
      if (!validation.isValid) {
        throw new Error('Please fix the following errors:\n' + validation.errors.join('\n'));
      }

      // Save to Firebase
      await ReconInvoiceSettingsService.saveSettings(integrationId, newSettings);
      setSettings(newSettings);
    } catch (error) {
      console.error('Error saving settings:', error);
      throw error;
    }
  };

  // Check if settings are properly configured
  const isSettingsConfigured = () => {
    if (!settings) return false;
    
    const requiredBusinessFields = [
      settings.businessInfo.companyName,
      settings.businessInfo.address,
      settings.businessInfo.city,
      settings.businessInfo.postalCode,
      settings.businessInfo.email,
    ];

    const requiredCustomerFields = [
      settings.defaultCustomerInfo.companyName,
      settings.defaultCustomerInfo.address,
      settings.defaultCustomerInfo.registrationNumber,
      settings.defaultCustomerInfo.taxReferenceNumber,
      settings.defaultCustomerInfo.vatNumber,
    ];

    const requiredPreferenceFields = [
      settings.preferences.invoicePrefix
    ];

    const allRequiredFields = [...requiredBusinessFields, ...requiredCustomerFields, ...requiredPreferenceFields];
    return allRequiredFields.every(field => field && field.trim().length > 0);
  };

  // Get settings status message
  const getSettingsStatusMessage = () => {
    if (!settings) return { type: 'warning', message: 'Settings not loaded' };
    
    if (isSettingsConfigured()) {
      return { 
        type: 'success', 
        message: `Invoice settings configured for ${settings.businessInfo.companyName}` 
      };
    } else {
      return { 
        type: 'warning', 
        message: 'Please configure your business information in settings before generating invoices' 
      };
    }
  };

  useEffect(() => {
    if (integrationId) {
      loadData();
    }
  }, [integrationId]);

  return {
    settings,
    integrationInfo,
    isLoading,
    error,
    saveSettings,
    reloadData: loadData,
    isSettingsConfigured: isSettingsConfigured(),
    settingsStatus: getSettingsStatusMessage()
  };
};
