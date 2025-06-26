// src/lib/logUtils.ts
import { logRecorder } from './logRecorder';

/**
 * Simple logging utilities for application events
 * These functions will only log when on settings pages
 */

// Force log user actions (works on any page)
export const forceLogUserClick = (buttonName: string, result?: 'success' | 'error' | 'warning', details?: any) => {
  logRecorder.logCustom('page-action', result || 'info', 'User Action', `Clicked: ${buttonName}`, details, 'force-user-action');
};

export const forceLogFormSubmit = (formName: string, result?: 'success' | 'error' | 'warning', details?: any) => {
  logRecorder.logCustom('page-action', result || 'info', 'User Action', `Submitted: ${formName}`, details, 'force-form-submit');
};

// Regular functions (only work on settings pages)
export const logUserClick = (buttonName: string, result?: 'success' | 'error' | 'warning', details?: any) => {
  logRecorder.logUserAction(`Clicked: ${buttonName}`, details, result);
};

export const logFormSubmit = (formName: string, result?: 'success' | 'error' | 'warning', details?: any) => {
  logRecorder.logUserAction(`Submitted: ${formName}`, details, result);
};

export const logDataLoad = (dataType: string, result?: 'success' | 'error' | 'warning', details?: any) => {
  logRecorder.logUserAction(`Loaded: ${dataType}`, details, result);
};

// Log errors with context (works on any page when forced)
export const logError = (message: string, context?: string, details?: any) => {
  logRecorder.logError(message, details, context);
};

// Log successful operations (works on any page when forced)
export const logSuccess = (message: string, details?: any) => {
  logRecorder.logSuccess(message, details);
};

// Log API calls (works on any page)
export const logAPI = (method: string, endpoint: string, status?: number, responseTime?: number, errorDetails?: any) => {
  logRecorder.logApiCall(method, endpoint, status, responseTime, errorDetails);
};

// Force log anything (works on any page)
export const forceLog = (type: 'log' | 'error' | 'warn' | 'info', level: 'info' | 'warning' | 'error' | 'success', category: string, message: string, details?: any) => {
  logRecorder.forceLog(type, level, category, message, details, 'force-log');
};

// Debug functions for settings page
export const debugSettingsPage = () => {
  forceLog('log', 'info', 'Debug', 'Settings page debug triggered', {
    currentPage: typeof window !== 'undefined' ? window.location.pathname : 'unknown',
    url: typeof window !== 'undefined' ? window.location.href : 'unknown',
    timestamp: new Date().toISOString()
  });
};

export const testLogging = () => {
  console.log('🧪 Testing console log capture');
  console.warn('🧪 Testing console warn capture');
  console.error('🧪 Testing console error capture');
  forceLog('log', 'success', 'Test', 'Manual test log', { test: true });
  logRecorder.testLogging(); // Use the new test method
};

// Example usage:
// For settings pages (automatic filtering):
// logUserClick('Save Settings', 'success', { settingName: 'api-key' });
// logFormSubmit('Settings Form', 'error', { validationErrors: ['key required'] });

// For any page (forced logging):
// forceLogUserClick('Emergency Button', 'error', { reason: 'system failure' });
// forceLog('error', 'error', 'Critical Error', 'System crashed', { stack: '...' });

// For debugging:
// debugSettingsPage(); // Test if logging works
// testLogging(); // Test console capture

// Example usage:
// logUserClick('Save Product', 'success', { productId: '123' });
// logFormSubmit('Add Customer Form', 'error', { validationErrors: ['name required'] });
// logError('Failed to save data', 'Database Error', { table: 'products' });
// logSuccess('Product saved successfully', { productId: '123' });
// logAPI('POST', '/api/products', 201, 150);
