// Utility functions for integration settings and form validation

/**
 * Validate account name
 */
export const validateAccountName = (accountName: string): { isValid: boolean; error?: string } => {
  if (!accountName || accountName.trim().length === 0) {
    return { isValid: false, error: 'Account name is required' };
  }
  
  if (accountName.trim().length < 2) {
    return { isValid: false, error: 'Account name must be at least 2 characters long' };
  }
  
  if (accountName.trim().length > 100) {
    return { isValid: false, error: 'Account name must be less than 100 characters' };
  }
  
  return { isValid: true };
};

/**
 * Validate API key
 */
export const validateApiKey = (apiKey: string): { isValid: boolean; error?: string } => {
  if (!apiKey || apiKey.trim().length === 0) {
    return { isValid: false, error: 'API key is required' };
  }
  
  if (apiKey.trim().length < 10) {
    return { isValid: false, error: 'API key seems too short' };
  }
  
  return { isValid: true };
};

/**
 * Validate assigned user ID
 */
export const validateAssignedUser = (assignedUserId: string, currentUserId: string): { isValid: boolean; error?: string } => {
  if (!assignedUserId || assignedUserId.trim().length === 0) {
    return { isValid: false, error: 'Assigned user is required' };
  }
  
  return { isValid: true };
};

/**
 * Validate entire integration form
 */
export const validateIntegrationForm = (
  accountName: string,
  apiKey: string,
  assignedUserId: string,
  currentUserId: string
): { isValid: boolean; errors: { [key: string]: string } } => {
  const errors: { [key: string]: string } = {};
  
  const accountNameValidation = validateAccountName(accountName);
  if (!accountNameValidation.isValid) {
    errors.accountName = accountNameValidation.error!;
  }
  
  const apiKeyValidation = validateApiKey(apiKey);
  if (!apiKeyValidation.isValid) {
    errors.apiKey = apiKeyValidation.error!;
  }
  
  const assignedUserValidation = validateAssignedUser(assignedUserId, currentUserId);
  if (!assignedUserValidation.isValid) {
    errors.assignedUserId = assignedUserValidation.error!;
  }
  
  return {
    isValid: Object.keys(errors).length === 0,
    errors
  };
};

/**
 * Format user display name for dropdown
 */
export const formatUserDisplayName = (
  user: { name: string; email: string; role: string },
  isCurrentUser: boolean = false
): string => {
  if (isCurrentUser) {
    return 'Admin (Self)';
  }
  
  return `${user.name} (${user.email}) - ${user.role}`;
};

/**
 * Get assigned user name for display
 */
export const getAssignedUserName = (
  assignedUserId: string,
  currentUserId: string,
  subUsers: Array<{ id: string; name: string; email: string; role: string }>
): string => {
  if (assignedUserId === currentUserId) {
    return 'Admin (Self)';
  }
  
  const assignedUser = subUsers.find(user => user.id === assignedUserId);
  return assignedUser?.name || 'Unknown User';
};

/**
 * Sanitize form data before submission
 */
export const sanitizeIntegrationData = (data: {
  accountName: string;
  apiKey: string;
  assignedUserId: string;
}): {
  accountName: string;
  apiKey: string;
  assignedUserId: string;
} => {
  return {
    accountName: data.accountName.trim(),
    apiKey: data.apiKey.trim(),
    assignedUserId: data.assignedUserId.trim()
  };
};

/**
 * Check if form data has changed
 */
export const hasFormDataChanged = (
  original: { accountName: string; apiKey: string; assignedUserId: string },
  current: { accountName: string; apiKey: string; assignedUserId: string }
): boolean => {
  return (
    original.accountName !== current.accountName ||
    original.apiKey !== current.apiKey ||
    original.assignedUserId !== current.assignedUserId
  );
};

/**
 * Generate confirmation message for deletion
 */
export const generateDeleteConfirmationMessage = (accountName: string): string => {
  return `Are you sure you want to delete the integration "${accountName}"? This action cannot be undone and will remove all associated data including:

• All sales data
• All product data
• API logs and statistics
• Sync preferences
• All related configurations

Type "${accountName}" to confirm deletion.`;
};

/**
 * Mask API key for display
 */
export const maskApiKey = (apiKey: string, visibleChars: number = 4): string => {
  if (apiKey.length <= visibleChars) {
    return '*'.repeat(apiKey.length);
  }
  
  return apiKey.substring(0, visibleChars) + '*'.repeat(apiKey.length - visibleChars);
};

/**
 * Get field validation classes for styling
 */
export const getFieldValidationClasses = (
  isValid: boolean,
  hasError: boolean,
  baseClasses: string = ''
): string => {
  let classes = baseClasses;
  
  if (hasError) {
    classes += ' border-red-300 focus:border-red-500 focus:ring-red-500 bg-red-50';
  } else if (isValid) {
    classes += ' border-green-300 focus:border-green-500 focus:ring-green-500';
  } else {
    classes += ' border-gray-300 focus:border-emerald-500 focus:ring-emerald-500';
  }
  
  return classes;
};
