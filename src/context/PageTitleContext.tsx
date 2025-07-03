'use client';

import React, { createContext, useContext, useState, ReactNode } from 'react';

interface PageTitleContextType {
  pageTitle: string;
  accountName: string;
  setPageTitle: (title: string) => void;
  setAccountName: (name: string) => void;
  setPageInfo: (accountName: string, pageTitle: string) => void;
}

const PageTitleContext = createContext<PageTitleContextType | undefined>(undefined);

interface PageTitleProviderProps {
  children: ReactNode;
}

export const PageTitleProvider: React.FC<PageTitleProviderProps> = ({ children }) => {
  const [pageTitle, setPageTitle] = useState<string>('');
  const [accountName, setAccountName] = useState<string>('');

  const setPageInfo = (accountName: string, pageTitle: string) => {
    setAccountName(accountName);
    setPageTitle(pageTitle);
  };

  return (
    <PageTitleContext.Provider value={{ 
      pageTitle, 
      accountName, 
      setPageTitle, 
      setAccountName, 
      setPageInfo 
    }}>
      {children}
    </PageTitleContext.Provider>
  );
};

export const usePageTitle = () => {
  const context = useContext(PageTitleContext);
  if (context === undefined) {
    throw new Error('usePageTitle must be used within a PageTitleProvider');
  }
  return context;
};
