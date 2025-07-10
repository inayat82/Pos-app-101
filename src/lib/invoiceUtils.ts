// Utility functions for invoice generation notifications and error handling

export const showSuccessNotification = (message: string, details?: string) => {
  // For now, using simple alert - can be replaced with toast library later
  alert(`✅ ${message}${details ? `\n\n${details}` : ''}`);
};

export const showErrorNotification = (message: string, error?: Error) => {
  const errorMessage = error ? `\n\nError: ${error.message}` : '';
  alert(`❌ ${message}${errorMessage}`);
};

export const showWarningNotification = (message: string, details?: string) => {
  alert(`⚠️ ${message}${details ? `\n\n${details}` : ''}`);
};

export const showInfoNotification = (message: string, details?: string) => {
  alert(`ℹ️ ${message}${details ? `\n\n${details}` : ''}`);
};

export const formatFileSize = (bytes: number): string => {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
};

export const truncateFileName = (fileName: string, maxLength: number = 30): string => {
  if (fileName.length <= maxLength) return fileName;
  const extension = fileName.split('.').pop();
  const nameWithoutExtension = fileName.substring(0, fileName.lastIndexOf('.'));
  const truncatedName = nameWithoutExtension.substring(0, maxLength - extension!.length - 4) + '...';
  return `${truncatedName}.${extension}`;
};

export const validateCSVFile = (file: File): { isValid: boolean; errors: string[] } => {
  const errors: string[] = [];
  
  // Check file type
  if (!file.name.toLowerCase().endsWith('.csv')) {
    errors.push('File must be a CSV file (.csv extension)');
  }
  
  // Check file size (10MB limit)
  const maxSize = 10 * 1024 * 1024; // 10MB
  if (file.size > maxSize) {
    errors.push(`File size must be less than ${formatFileSize(maxSize)}`);
  }
  
  // Check if file is empty
  if (file.size === 0) {
    errors.push('File is empty');
  }
  
  return {
    isValid: errors.length === 0,
    errors
  };
};

export const generateInvoiceFileName = (invoiceNumber: string): string => {
  return `invoice-${invoiceNumber}.pdf`;
};

export const getStatusColor = (status: string): string => {
  switch (status) {
    case 'generated':
      return 'bg-blue-100 text-blue-800';
    case 'downloaded':
      return 'bg-green-100 text-green-800';
    case 'sent':
      return 'bg-purple-100 text-purple-800';
    default:
      return 'bg-gray-100 text-gray-800';
  }
};

export const getStatusIcon = (status: string): string => {
  switch (status) {
    case 'generated':
      return '📄';
    case 'downloaded':
      return '⬇️';
    case 'sent':
      return '📤';
    default:
      return '❓';
  }
};
