'use client';

import React, { ReactNode, useEffect } from 'react';
import { usePageTitle } from '@/context/PageTitleContext';

interface POSLayoutProps {
  children: ReactNode;
  pageTitle: string;
  pageDescription: string;
  breadcrumbs?: { label: string; href?: string }[];
}

const POSLayout: React.FC<POSLayoutProps> = ({ 
  children, 
  pageTitle, 
  pageDescription, 
  breadcrumbs = []
}) => {
  const { setPageTitle } = usePageTitle();

  // Set the page title for the top bar
  useEffect(() => {
    setPageTitle(`${pageTitle} - ${pageDescription}`);
    return () => setPageTitle(''); // Clean up on unmount
  }, [setPageTitle, pageTitle, pageDescription]);

  return (
    <div className="bg-white min-h-screen">
      {/* Full width content without black header */}
      <div className="w-full">
        {children}
      </div>
    </div>
  );
};

export default POSLayout;
