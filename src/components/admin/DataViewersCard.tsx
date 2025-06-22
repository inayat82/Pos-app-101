// src/components/admin/DataViewersCard.tsx
import React from 'react';

export interface ApiViewerData {
  requestUrl?: string;
  requestHeaders?: Record<string, any>; // Using Record<string, any> for flexibility
  responseBody?: any;
  jobId?: string; // Optional: to know which job this data pertains to
  timestamp?: string; // Optional: when this data was captured
}

interface DataViewersCardProps {
  viewerData?: ApiViewerData | null;
}

const DataViewersCard: React.FC<DataViewersCardProps> = ({ viewerData }) => {
  const displayHeaders = viewerData?.requestHeaders || {
    "Content-Type": "application/json",
    "Note": "Headers will appear here after making an API request"
  };

  const hasData = viewerData?.requestUrl || viewerData?.responseBody;
  return (
    <div className="space-y-6">
      {!hasData && (
        <div className="text-center py-8">
          <div className="mx-auto w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mb-4">
            <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
          </div>
        </div>
      )}

      {hasData && (
        <>
          {viewerData?.jobId && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center">
                  <div className="w-2 h-2 bg-blue-500 rounded-full mr-2"></div>
                  <span className="text-sm font-medium text-blue-900">Job ID: {viewerData.jobId}</span>
                </div>
                {viewerData?.timestamp && (
                  <span className="text-xs text-blue-600">
                    {new Date(viewerData.timestamp).toLocaleString()}
                  </span>
                )}
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* API Request Link Viewer */}
            <div className="bg-gray-50 p-4 rounded-lg border">              <h3 className="text-lg font-medium text-gray-700 mb-2 flex items-center">
                <svg className="w-4 h-4 mr-2 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                </svg>
                Takealot API Request URL
                {viewerData?.requestUrl && (
                  <span className="ml-2 inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
                    Active
                  </span>
                )}
              </h3>
              <p className="text-sm text-gray-500 mb-2">The actual Takealot API endpoint being called</p>
              <div className="mt-1 p-3 bg-white rounded border min-h-[60px] text-xs text-gray-600 overflow-x-auto break-all">
                {viewerData?.requestUrl ? (
                  <a href={viewerData.requestUrl} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline font-mono">
                    {viewerData.requestUrl}
                  </a>
                ) : (
                  <span className="italic text-gray-400">Request URL will appear here...</span>
                )}
              </div>
            </div>

            {/* API Header Viewer */}
            <div className="bg-gray-50 p-4 rounded-lg border">              <h3 className="text-lg font-medium text-gray-700 mb-2 flex items-center">
                <svg className="w-4 h-4 mr-2 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                </svg>
                Request Headers
                {viewerData?.requestHeaders && (
                  <span className="ml-2 inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                    Captured
                  </span>
                )}
              </h3>
              <p className="text-sm text-gray-500 mb-2">Authentication and headers sent to Takealot API</p>
              <div className="mt-1 p-3 bg-white rounded border min-h-[60px] text-xs text-gray-600 overflow-x-auto">
                <pre className="font-mono whitespace-pre-wrap">
                  {viewerData?.requestHeaders 
                    ? JSON.stringify(viewerData.requestHeaders, null, 2)
                    : JSON.stringify(displayHeaders, null, 2)
                  }
                </pre>
              </div>
            </div>
          </div>

          {/* JSON Response Viewer */}
          <div className="bg-gray-50 p-4 rounded-lg border">
            <h3 className="text-lg font-medium text-gray-700 mb-2 flex items-center">
              <svg className="w-4 h-4 mr-2 text-purple-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              JSON Response
              {viewerData?.responseBody && (
                <span className="ml-2 text-xs bg-green-100 text-green-800 px-2 py-1 rounded">
                  {typeof viewerData.responseBody === 'object' ? 'Valid JSON' : 'Raw Data'}
                </span>
              )}
            </h3>
            <p className="text-sm text-gray-500 mb-2">Raw JSON response received from the API</p>
            <div className="mt-1 p-3 bg-white rounded border min-h-[120px] max-h-96 overflow-auto text-xs text-gray-600">
              {viewerData?.responseBody ? (
                <pre className="font-mono whitespace-pre-wrap">
                  {typeof viewerData.responseBody === 'string' 
                    ? viewerData.responseBody 
                    : JSON.stringify(viewerData.responseBody, null, 2)
                  }
                </pre>
              ) : (
                <span className="italic text-gray-400">JSON response will appear here...</span>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default DataViewersCard;
