'use client';

import React from 'react';
import { invoiceTemplates, InvoiceTemplate } from '@/lib/invoicePdfGenerator';
import { Check } from 'lucide-react';

interface TemplateSelectionProps {
  selectedTemplate: string;
  onTemplateSelect: (templateId: string) => void;
}

export default function TemplateSelection({ 
  selectedTemplate, 
  onTemplateSelect 
}: TemplateSelectionProps) {
  return (
    <div className="space-y-4">
      <h4 className="font-medium text-gray-900">Choose Invoice Template</h4>
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        {invoiceTemplates.map((template) => (
          <div
            key={template.id}
            className={`relative cursor-pointer rounded-lg border-2 p-3 transition-all hover:scale-105 ${
              selectedTemplate === template.id 
                ? 'border-blue-500 ring-2 ring-blue-500 ring-offset-2' 
                : 'border-gray-200 hover:border-gray-300'
            }`}
            onClick={() => onTemplateSelect(template.id)}
          >
            {/* Template Preview */}
            <div className="flex flex-col gap-2 rounded-md border bg-white p-2">
              {/* Header */}
              <div 
                className="h-4 rounded-t-sm w-full" 
                style={{ backgroundColor: template.colors.headerBg }}
              />
              
              {/* Content Lines */}
              <div className="space-y-1 p-1">
                <div className="h-1 w-4/5 rounded-full bg-gray-200" />
                <div className="h-1 w-full rounded-full bg-gray-200" />
                <div className="h-1 w-3/4 rounded-full bg-gray-200" />
              </div>
              
              {/* Total Section */}
              <div 
                className="h-3 rounded-b-sm w-3/4 self-end" 
                style={{ backgroundColor: template.colors.totalBg }}
              />
            </div>
            
            {/* Template Name */}
            <p className="text-center text-xs mt-2 font-medium truncate text-gray-700">
              {template.name}
            </p>
            
            {/* Selected Indicator */}
            {selectedTemplate === template.id && (
              <div className="absolute -top-2 -right-2 bg-blue-500 rounded-full p-1">
                <Check size={12} className="text-white" />
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
