'use client';

import React from 'react';
import { invoiceColorSchemes, InvoiceColorScheme } from '@/lib/invoicePdfGenerator';
import { Check } from 'lucide-react';

interface ColorSchemeSelectionProps {
  selectedColorScheme: string;
  onColorSchemeSelect: (colorSchemeId: string) => void;
  title?: string;
}

export default function ColorSchemeSelection({ 
  selectedColorScheme, 
  onColorSchemeSelect,
  title = 'Choose Color Scheme'
}: ColorSchemeSelectionProps) {
  return (
    <div className="space-y-4">
      {title && <h4 className="font-medium text-gray-900">{title}</h4>}
      <div className="grid grid-cols-5 sm:grid-cols-6 lg:grid-cols-8 xl:grid-cols-10 gap-2">
        {invoiceColorSchemes.map((colorScheme) => (
          <div
            key={colorScheme.id}
            className={`relative cursor-pointer rounded-lg border-2 p-2 transition-all hover:scale-105 ${
              selectedColorScheme === colorScheme.id 
                ? 'border-blue-500 ring-2 ring-blue-500 ring-offset-1' 
                : 'border-gray-200 hover:border-gray-300'
            }`}
            onClick={() => onColorSchemeSelect(colorScheme.id)}
          >
            {/* Color Scheme Preview */}
            <div className="flex flex-col gap-1 rounded-md border bg-white p-1">
              {/* Header */}
              <div 
                className="h-2 rounded-t-sm w-full" 
                style={{ backgroundColor: colorScheme.colors.headerBg }}
              />
              
              {/* Content Lines */}
              <div className="space-y-0.5 p-0.5">
                <div className="h-0.5 w-4/5 rounded-full bg-gray-200" />
                <div className="h-0.5 w-full rounded-full bg-gray-200" />
                <div className="h-0.5 w-3/4 rounded-full bg-gray-200" />
              </div>
              
              {/* Total Section */}
              <div 
                className="h-1.5 rounded-b-sm w-3/4 self-end" 
                style={{ backgroundColor: colorScheme.colors.totalBg }}
              />
            </div>
            
            {/* Color Scheme Name */}
            <p className="text-center text-xs mt-1 font-medium truncate text-gray-700">
              {colorScheme.name}
            </p>
            
            {/* Selected Indicator */}
            {selectedColorScheme === colorScheme.id && (
              <div className="absolute -top-1 -right-1 bg-blue-500 rounded-full p-0.5">
                <Check size={10} className="text-white" />
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
