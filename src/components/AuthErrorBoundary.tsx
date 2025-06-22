'use client';

import React from 'react';

interface AuthErrorBoundaryProps {
  children: React.ReactNode;
}

interface AuthErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

class AuthErrorBoundary extends React.Component<AuthErrorBoundaryProps, AuthErrorBoundaryState> {
  constructor(props: AuthErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): AuthErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    // Log extension-related errors differently
    if (error.message?.includes('message channel closed') || 
        error.message?.includes('listener indicated an asynchronous response')) {
      console.warn('Browser extension conflict caught by error boundary:', error.message);
    } else {
      console.error('Auth error caught by error boundary:', error, errorInfo);
    }
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: null });
    // Reload the page to reset Firebase auth state
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      const isExtensionError = this.state.error?.message?.includes('message channel closed') || 
                              this.state.error?.message?.includes('listener indicated an asynchronous response');

      return (
        <div className="min-h-screen flex items-center justify-center bg-gray-900 text-white p-4">
          <div className="max-w-md w-full bg-slate-800 rounded-lg p-6 text-center">
            <h2 className="text-xl font-semibold mb-4 text-red-400">
              {isExtensionError ? 'Browser Extension Conflict' : 'Authentication Error'}
            </h2>
            
            {isExtensionError ? (
              <div className="space-y-3 text-slate-300">
                <p>A browser extension is interfering with the login process.</p>
                <div className="text-sm bg-slate-700 p-3 rounded">
                  <p className="font-medium mb-2">Quick fixes:</p>
                  <ul className="text-left space-y-1">
                    <li>• Try logging in using incognito/private mode</li>
                    <li>• Temporarily disable browser extensions</li>
                    <li>• Clear browser cache and cookies</li>
                    <li>• Try a different browser</li>
                  </ul>
                </div>
              </div>
            ) : (
              <p className="text-slate-300 mb-4">
                An unexpected error occurred during authentication.
              </p>
            )}

            <button
              onClick={this.handleRetry}
              className="mt-4 px-6 py-2 bg-indigo-600 text-white rounded hover:bg-indigo-700 transition-colors"
            >
              Try Again
            </button>
            
            <div className="mt-4 text-xs text-slate-400">
              Error: {this.state.error?.message}
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default AuthErrorBoundary;
