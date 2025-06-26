// Utility functions for API logs and data formatting

/**
 * Format duration from milliseconds to a readable string
 */
export const formatDuration = (duration: number | undefined): string => {
  if (!duration) return 'N/A';
  
  if (duration < 1000) {
    return `${duration}ms`;
  } else if (duration < 60000) {
    return `${(duration / 1000).toFixed(2)}s`;
  } else {
    const minutes = Math.floor(duration / 60000);
    const seconds = Math.floor((duration % 60000) / 1000);
    return `${minutes}m ${seconds}s`;
  }
};

/**
 * Format timestamp to date and time strings
 */
export const formatTimestamp = (timestamp: string | undefined): { date: string; time: string } => {
  if (!timestamp) return { date: 'N/A', time: 'N/A' };
  
  const date = new Date(timestamp);
  return {
    date: date.toLocaleDateString(),
    time: date.toLocaleTimeString()
  };
};

/**
 * Get status styling classes
 */
export const getStatusStyling = (status: string | undefined): string => {
  switch (status) {
    case 'success':
    case 'completed':
      return 'bg-emerald-100 text-emerald-800';
    case 'error':
    case 'failed':
      return 'bg-red-100 text-red-800';
    case 'running':
    case 'in-progress':
      return 'bg-yellow-100 text-yellow-800';
    default:
      return 'bg-gray-100 text-gray-800';
  }
};

/**
 * Get type styling classes
 */
export const getTypeStyling = (type: string | undefined): string => {
  switch (type) {
    case 'sales':
      return 'bg-blue-100 text-blue-800';
    case 'products':
      return 'bg-purple-100 text-purple-800';
    default:
      return 'bg-gray-100 text-gray-800';
  }
};

/**
 * Format status text for display
 */
export const formatStatusText = (status: string | undefined): string => {
  switch (status) {
    case 'success':
    case 'completed':
      return 'Success';
    case 'error':
    case 'failed':
      return 'Failed';
    case 'running':
    case 'in-progress':
      return 'Running';
    default:
      return 'Unknown';
  }
};

/**
 * Format type text for display
 */
export const formatTypeText = (type: string | undefined): string => {
  switch (type) {
    case 'sales':
      return 'Sales';
    case 'products':
      return 'Products';
    default:
      return 'Unknown';
  }
};

/**
 * Calculate pagination info
 */
export const calculatePaginationInfo = (
  currentPage: number,
  itemsPerPage: number,
  totalItems: number
): { start: number; end: number; total: number } => {
  const start = Math.min((currentPage - 1) * itemsPerPage + 1, totalItems);
  const end = Math.min(currentPage * itemsPerPage, totalItems);
  
  return { start, end, total: totalItems };
};

/**
 * Generate pagination buttons data
 */
export const generatePaginationButtons = (
  currentPage: number,
  totalPages: number,
  maxVisible: number = 5
): (number | 'ellipsis')[] => {
  const buttons: (number | 'ellipsis')[] = [];
  
  if (totalPages <= maxVisible) {
    // Show all pages if total is less than or equal to maxVisible
    for (let i = 1; i <= totalPages; i++) {
      buttons.push(i);
    }
  } else {
    // Always show first page
    buttons.push(1);
    
    if (currentPage > 3) {
      buttons.push('ellipsis');
    }
    
    // Show pages around current page
    const start = Math.max(2, currentPage - 1);
    const end = Math.min(totalPages - 1, currentPage + 1);
    
    for (let i = start; i <= end; i++) {
      if (i !== 1 && i !== totalPages) {
        buttons.push(i);
      }
    }
    
    if (currentPage < totalPages - 2) {
      buttons.push('ellipsis');
    }
    
    // Always show last page if more than 1 page
    if (totalPages > 1) {
      buttons.push(totalPages);
    }
  }
  
  return buttons;
};
