'use client';

import React from 'react';
import { invoiceLayouts, InvoiceLayout } from '@/lib/invoicePdfGenerator';
import { Check, Layout } from 'lucide-react';

interface LayoutSelectionProps {
  selectedLayout: string;
  onLayoutSelect: (layoutId: string) => void;
  title?: string;
}

export default function LayoutSelection({ 
  selectedLayout, 
  onLayoutSelect,
  title = 'Choose Layout Style'
}: LayoutSelectionProps) {
  return (
    <div className="space-y-4">
      {title && <h4 className="font-medium text-gray-900">{title}</h4>}
      <div className="grid grid-cols-10 gap-2">
        {invoiceLayouts.map((layout) => (
          <div
            key={layout.id}
            className={`relative cursor-pointer rounded-lg border-2 p-2 transition-all hover:scale-105 ${
              selectedLayout === layout.id 
                ? 'border-blue-500 ring-2 ring-blue-500 ring-offset-1' 
                : 'border-gray-200 hover:border-gray-300'
            }`}
            onClick={() => onLayoutSelect(layout.id)}
          >
            {/* Layout Preview */}
            <div className="flex flex-col gap-1 rounded-md border bg-white p-1 min-h-[60px]">
              {/* Layout-specific preview */}
              {layout.id === 'professional' && (
                <>
                  <div className="h-2 w-full bg-gray-300 rounded-sm" />
                  <div className="space-y-1">
                    <div className="h-1 w-full bg-gray-200 rounded-full" />
                    <div className="h-1 w-4/5 bg-gray-200 rounded-full" />
                    <div className="h-1 w-3/4 bg-gray-200 rounded-full" />
                  </div>
                  <div className="h-2 w-3/4 bg-gray-300 rounded-sm self-end" />
                </>
              )}
              
              {layout.id === 'modern' && (
                <>
                  <div className="h-2 w-2/3 bg-gray-300 rounded-sm mx-auto" />
                  <div className="space-y-1">
                    <div className="h-1 w-full bg-gray-200 rounded-full" />
                    <div className="h-1 w-5/6 bg-gray-200 rounded-full" />
                  </div>
                  <div className="h-2 w-1/2 bg-gray-300 rounded-sm self-center" />
                </>
              )}
              
              {layout.id === 'minimal' && (
                <>
                  <div className="h-1 w-1/2 bg-gray-300 rounded-sm" />
                  <div className="space-y-1 mt-2">
                    <div className="h-0.5 w-full bg-gray-200 rounded-full" />
                    <div className="h-0.5 w-3/4 bg-gray-200 rounded-full" />
                  </div>
                  <div className="h-1 w-1/3 bg-gray-300 rounded-sm self-end mt-2" />
                </>
              )}
              
              {layout.id === 'bold' && (
                <>
                  <div className="h-3 w-full bg-gray-400 rounded-sm" />
                  <div className="space-y-1">
                    <div className="h-1 w-full bg-gray-300 rounded-full" />
                    <div className="h-1 w-4/5 bg-gray-300 rounded-full" />
                  </div>
                  <div className="h-3 w-2/3 bg-gray-400 rounded-sm self-end" />
                </>
              )}
              
              {layout.id === 'elegant' && (
                <>
                  <div className="h-2 w-2/3 bg-gray-300 rounded-sm mx-auto" />
                  <div className="h-0.5 w-1/2 bg-gray-300 rounded-full mx-auto" />
                  <div className="space-y-1 mt-1">
                    <div className="h-1 w-full bg-gray-200 rounded-full" />
                    <div className="h-1 w-5/6 bg-gray-200 rounded-full" />
                  </div>
                  <div className="h-2 w-1/2 bg-gray-300 rounded-full self-center" />
                </>
              )}
              
              {/* Default layout for remaining layouts */}
              {!['professional', 'modern', 'minimal', 'bold', 'elegant'].includes(layout.id) && (
                <>
                  <div className="h-2 w-full bg-gray-300 rounded-sm" />
                  <div className="space-y-1">
                    <div className="h-1 w-full bg-gray-200 rounded-full" />
                    <div className="h-1 w-4/5 bg-gray-200 rounded-full" />
                  </div>
                  <div className="h-2 w-3/4 bg-gray-300 rounded-sm self-end" />
                </>
              )}
            </div>
            
            {/* Layout Name */}
            <p className="text-center text-xs mt-1 font-medium text-gray-700">
              {layout.name}
            </p>
            <p className="text-center text-xs text-gray-500 leading-tight hidden">
              {layout.description}
            </p>
            
            {/* Selected Indicator */}
            {selectedLayout === layout.id && (
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
