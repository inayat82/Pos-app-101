'use client';

import React, { useState, useRef } from 'react';
import { Upload, FileText, X, AlertTriangle, CheckCircle } from 'lucide-react';
import { CSVProcessingService, CSVParseResult } from '@/lib/csvProcessingService';

interface CSVUploadAreaProps {
  onFileProcessed: (result: CSVParseResult, file: File) => void;
  isProcessing?: boolean;
  disabled?: boolean;
}

export default function CSVUploadArea({ 
  onFileProcessed, 
  isProcessing = false, 
  disabled = false 
}: CSVUploadAreaProps) {
  const [isDragOver, setIsDragOver] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Handle file selection
  const handleFileSelect = async (file: File) => {
    setUploadError(null);

    // Validate file first
    const validation = CSVProcessingService.validateFile(file);
    if (!validation.isValid) {
      setUploadError(validation.errors.join(', '));
      return;
    }

    try {
      // Process the CSV file
      const result = await CSVProcessingService.parseCSVFile(file);
      onFileProcessed(result, file);
    } catch (error) {
      setUploadError(`Failed to process file: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };

  // Handle drag and drop
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    if (!disabled && !isProcessing) {
      setIsDragOver(true);
    }
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);

    if (disabled || isProcessing) return;

    const files = Array.from(e.dataTransfer.files);
    if (files.length > 0) {
      handleFileSelect(files[0]);
    }
  };

  // Handle file input change
  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length > 0) {
      handleFileSelect(files[0]);
    }
    // Reset input value to allow same file selection
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  // Open file dialog
  const openFileDialog = () => {
    if (!disabled && !isProcessing && fileInputRef.current) {
      fileInputRef.current.click();
    }
  };

  return (
    <div className="space-y-4">
      {/* Upload Area */}
      <div 
        className={`
          border-2 border-dashed rounded-lg p-8 text-center transition-all duration-200 cursor-pointer
          ${isDragOver ? 'border-blue-500 bg-blue-50' : 'border-gray-300 hover:border-gray-400'}
          ${disabled || isProcessing ? 'opacity-50 cursor-not-allowed' : ''}
        `}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={openFileDialog}
      >
        {isProcessing ? (
          <div className="space-y-4">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
            <div>
              <h3 className="text-lg font-medium text-gray-900 mb-2">
                Processing CSV File...
              </h3>
              <p className="text-gray-600">
                Please wait while we validate and parse your data
              </p>
            </div>
          </div>
        ) : (
          <>
            <Upload size={48} className={`mx-auto mb-4 ${isDragOver ? 'text-blue-500' : 'text-gray-400'}`} />
            <h3 className="text-lg font-medium text-gray-900 mb-2">
              Upload CSV File
            </h3>
            <p className="text-gray-600 mb-4">
              Drag & drop your CSV file here, or click to browse
            </p>
            <button 
              type="button"
              disabled={disabled || isProcessing}
              className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Choose File
            </button>
          </>
        )}
      </div>

      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        accept=".csv"
        onChange={handleFileInputChange}
        className="hidden"
      />

      {/* Upload Error */}
      {uploadError && (
        <div className="p-4 bg-red-50 rounded-lg border border-red-200">
          <div className="flex items-start gap-3">
            <AlertTriangle size={20} className="text-red-500 mt-0.5 flex-shrink-0" />
            <div>
              <h4 className="font-medium text-red-900 mb-1">Upload Error</h4>
              <p className="text-sm text-red-700">{uploadError}</p>
            </div>
            <button 
              onClick={() => setUploadError(null)}
              className="ml-auto text-red-500 hover:text-red-700"
            >
              <X size={16} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
