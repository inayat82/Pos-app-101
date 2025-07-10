'use client';

import React, { useState } from 'react';
import { X, Building2, User, Settings as SettingsIcon } from 'lucide-react';
import { ReconInvoiceSettings } from '@/types/recon-invoice';

interface ReconInvoiceSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  integrationId: string;
  integrationName: string;
  onSave: (settings: ReconInvoiceSettings) => Promise<void>;
  initialSettings?: ReconInvoiceSettings;
}

export default function ReconInvoiceSettingsModal({
  isOpen,
  onClose,
  integrationId,
  integrationName,
  onSave,
  initialSettings
}: ReconInvoiceSettingsModalProps) {
  const [activeTab, setActiveTab] = useState<'business' | 'customer' | 'preferences'>('business');
  const [isSaving, setIsSaving] = useState(false);
  const [settings, setSettings] = useState<ReconInvoiceSettings>(
    initialSettings || {
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
    }
  );

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await onSave(settings);
      onClose();
    } catch (error) {
      console.error('Error saving settings:', error);
      alert('Failed to save settings. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  if (!isOpen) return null;

  const tabs = [
    { id: 'business', label: 'Business Info', icon: Building2 },
    { id: 'customer', label: 'Takealot Details', icon: User },
    { id: 'preferences', label: 'Preferences', icon: SettingsIcon },
  ];

  const renderBusinessForm = () => (
    <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Company Name *
          </label>
          <input
            type="text"
            value={settings.businessInfo.companyName}
            onChange={(e) => setSettings({
              ...settings,
              businessInfo: { ...settings.businessInfo, companyName: e.target.value }
            })}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="Your Business Name"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Trading Name
          </label>
          <input
            type="text"
            value={settings.businessInfo.tradingName}
            onChange={(e) => setSettings({
              ...settings,
              businessInfo: { ...settings.businessInfo, tradingName: e.target.value }
            })}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="Trading As"
          />
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Business Address *
        </label>
        <textarea
          value={settings.businessInfo.address}
          onChange={(e) => setSettings({
            ...settings,
            businessInfo: { ...settings.businessInfo, address: e.target.value }
          })}
          rows={3}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          placeholder="Street address, building number"
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            City *
          </label>
          <input
            type="text"
            value={settings.businessInfo.city}
            onChange={(e) => setSettings({
              ...settings,
              businessInfo: { ...settings.businessInfo, city: e.target.value }
            })}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="City"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Postal Code *
          </label>
          <input
            type="text"
            value={settings.businessInfo.postalCode}
            onChange={(e) => setSettings({
              ...settings,
              businessInfo: { ...settings.businessInfo, postalCode: e.target.value }
            })}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="0000"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Phone Number
          </label>
          <input
            type="tel"
            value={settings.businessInfo.phone}
            onChange={(e) => setSettings({
              ...settings,
              businessInfo: { ...settings.businessInfo, phone: e.target.value }
            })}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="+27 11 123 4567"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Email Address *
          </label>
          <input
            type="email"
            value={settings.businessInfo.email}
            onChange={(e) => setSettings({
              ...settings,
              businessInfo: { ...settings.businessInfo, email: e.target.value }
            })}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="business@example.com"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            VAT Number
          </label>
          <input
            type="text"
            value={settings.businessInfo.vatNumber}
            onChange={(e) => setSettings({
              ...settings,
              businessInfo: { ...settings.businessInfo, vatNumber: e.target.value }
            })}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="4123456789"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Registration Number
          </label>
          <input
            type="text"
            value={settings.businessInfo.registrationNumber}
            onChange={(e) => setSettings({
              ...settings,
              businessInfo: { ...settings.businessInfo, registrationNumber: e.target.value }
            })}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="2021/123456/07"
          />
        </div>
      </div>
    </div>
  );

  const renderCustomerForm = () => (
    <div className="space-y-4">
      <div className="p-4 bg-blue-50 rounded-lg">
        <h4 className="font-medium text-blue-900 mb-2">Standard Takealot Invoice Details</h4>
        <p className="text-sm text-blue-700">
          These are the required Takealot company details that must appear on all invoices to Takealot.com. 
          These details are pre-filled but can be edited if needed.
        </p>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Company Name *
        </label>
        <input
          type="text"
          value={settings.defaultCustomerInfo.companyName}
          onChange={(e) => setSettings({
            ...settings,
            defaultCustomerInfo: { ...settings.defaultCustomerInfo, companyName: e.target.value }
          })}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          placeholder="TakealotOnline(RF) (Pty) Ltd"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Physical Address *
        </label>
        <textarea
          value={settings.defaultCustomerInfo.address}
          onChange={(e) => setSettings({
            ...settings,
            defaultCustomerInfo: { ...settings.defaultCustomerInfo, address: e.target.value }
          })}
          rows={5}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          placeholder="12th Floor&#10;10 Rua Vasco Da Gama Plain&#10;Foreshore&#10;Cape Town&#10;8000"
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            City
          </label>
          <input
            type="text"
            value={settings.defaultCustomerInfo.city || ''}
            onChange={(e) => setSettings({
              ...settings,
              defaultCustomerInfo: { ...settings.defaultCustomerInfo, city: e.target.value }
            })}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="Cape Town"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Postal Code
          </label>
          <input
            type="text"
            value={settings.defaultCustomerInfo.postalCode || ''}
            onChange={(e) => setSettings({
              ...settings,
              defaultCustomerInfo: { ...settings.defaultCustomerInfo, postalCode: e.target.value }
            })}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="8000"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Company Registration Number *
          </label>
          <input
            type="text"
            value={settings.defaultCustomerInfo.registrationNumber || ''}
            onChange={(e) => setSettings({
              ...settings,
              defaultCustomerInfo: { ...settings.defaultCustomerInfo, registrationNumber: e.target.value }
            })}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="2010/020248/07"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Company Tax Reference Number *
          </label>
          <input
            type="text"
            value={settings.defaultCustomerInfo.taxReferenceNumber || ''}
            onChange={(e) => setSettings({
              ...settings,
              defaultCustomerInfo: { ...settings.defaultCustomerInfo, taxReferenceNumber: e.target.value }
            })}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="9910006148"
          />
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          VAT Number *
        </label>
        <input
          type="text"
          value={settings.defaultCustomerInfo.vatNumber || ''}
          onChange={(e) => setSettings({
            ...settings,
            defaultCustomerInfo: { ...settings.defaultCustomerInfo, vatNumber: e.target.value }
          })}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          placeholder="4470208333"
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Phone Number
          </label>
          <input
            type="tel"
            value={settings.defaultCustomerInfo.phone || ''}
            onChange={(e) => setSettings({
              ...settings,
              defaultCustomerInfo: { ...settings.defaultCustomerInfo, phone: e.target.value }
            })}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="+27 21 XXX XXXX (Optional)"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Email Address
          </label>
          <input
            type="email"
            value={settings.defaultCustomerInfo.email || ''}
            onChange={(e) => setSettings({
              ...settings,
              defaultCustomerInfo: { ...settings.defaultCustomerInfo, email: e.target.value }
            })}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="contact@takealot.com (Optional)"
          />
        </div>
      </div>

      <div className="mt-6 p-4 bg-green-50 rounded-lg">
        <h4 className="font-medium text-green-900 mb-2">Invoice Requirements Checklist:</h4>
        <ul className="text-sm text-green-700 space-y-1">
          <li>✓ Contains "Tax Invoice" wording (handled automatically)</li>
          <li>✓ Company name and registration details</li>
          <li>✓ Physical address</li>
          <li>✓ VAT registration number</li>
          <li>✓ Tax reference number</li>
          <li>✓ Serial number and date (handled automatically)</li>
        </ul>
      </div>
    </div>
  );

  const renderPreferencesForm = () => (
    <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Invoice Prefix *
          </label>
          <input
            type="text"
            value={settings.preferences.invoicePrefix}
            onChange={(e) => setSettings({
              ...settings,
              preferences: { ...settings.preferences, invoicePrefix: e.target.value }
            })}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="MT-"
          />
          <p className="text-xs text-gray-500 mt-1">
            Example: "MT-" will generate invoices like "MT-001", "MT-002"
          </p>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Default Template
          </label>
          <select
            value={settings.preferences.defaultTemplate}
            onChange={(e) => setSettings({
              ...settings,
              preferences: { ...settings.preferences, defaultTemplate: e.target.value }
            })}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="professional-blue">Professional Blue</option>
            <option value="emerald-green">Emerald Green</option>
            <option value="crimson-red">Crimson Red</option>
            <option value="midnight-dark">Midnight Dark</option>
            <option value="amethyst-purple">Amethyst Purple</option>
          </select>
        </div>
      </div>

      <div className="flex items-center">
        <input
          type="checkbox"
          id="autoNumbering"
          checked={settings.preferences.autoNumbering}
          onChange={(e) => setSettings({
            ...settings,
            preferences: { ...settings.preferences, autoNumbering: e.target.checked }
          })}
          className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
        />
        <label htmlFor="autoNumbering" className="ml-2 text-sm text-gray-700">
          Enable automatic invoice numbering
        </label>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Default Notes
        </label>
        <textarea
          value={settings.preferences.defaultNotes}
          onChange={(e) => setSettings({
            ...settings,
            preferences: { ...settings.preferences, defaultNotes: e.target.value }
          })}
          rows={3}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          placeholder="Default notes to include in invoices (optional)"
        />
      </div>
    </div>
  );

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <div>
            <h2 className="text-xl font-semibold text-gray-900">
              Invoice Settings
            </h2>
            <p className="text-sm text-gray-600 mt-1">
              Configure settings for {integrationName}
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {/* Tabs */}
        <div className="border-b border-gray-200">
          <nav className="flex space-x-8 px-6">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id as any)}
                  className={`flex items-center gap-2 py-4 px-1 border-b-2 font-medium text-sm transition-colors ${
                    activeTab === tab.id
                      ? 'border-blue-500 text-blue-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700'
                  }`}
                >
                  <Icon size={16} />
                  {tab.label}
                </button>
              );
            })}
          </nav>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto max-h-[60vh]">
          {activeTab === 'business' && renderBusinessForm()}
          {activeTab === 'customer' && renderCustomerForm()}
          {activeTab === 'preferences' && renderPreferencesForm()}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 p-6 border-t border-gray-200">
          <button
            onClick={onClose}
            className="px-4 py-2 text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={isSaving}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
          >
            {isSaving ? 'Saving...' : 'Save Settings'}
          </button>
        </div>
      </div>
    </div>
  );
}
