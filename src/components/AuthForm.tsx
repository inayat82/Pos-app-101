'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { EyeIcon, EyeSlashIcon } from '@heroicons/react/24/outline';
import Link from 'next/link';
import { useAuth } from '@/context/AuthContext'; // Assuming useAuth is correctly exported from AuthContext

interface AuthFormProps {
  isSignUp?: boolean;
}

const AuthForm: React.FC<AuthFormProps> = ({ isSignUp = false }) => {
  const { 
    signUp, 
    signIn, 
    error: authError, 
    loading: authLoading, 
    currentUser, 
    emailVerified, 
    resendVerificationEmail, 
    logout,
    setError: setAuthError 
  } = useAuth();
  
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [localError, setLocalError] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [isResending, setIsResending] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [showVerificationMessage, setShowVerificationMessage] = useState(false);

  useEffect(() => {
    // Show verification message if user is logged in, email not verified, and not in an auth operation
    if (currentUser && !emailVerified && !authLoading) {
      setShowVerificationMessage(true);
    } else {
      setShowVerificationMessage(false);
    }
  }, [currentUser, emailVerified, authLoading]);

  const validateForm = () => {
    if (!email) return "Email is required.";
    if (!/\S+@\S+\.\S+/.test(email)) return "Email is invalid.";
    if (!password) return "Password is required.";
    if (password.length < 6) return "Password must be at least 6 characters.";
    if (isSignUp && !name.trim()) return "Name is required for sign up.";
    return null;
  };
  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLocalError(null); // Clear local errors
    if (authError) setAuthError(null); // Clear previous auth error from context

    const validationError = validateForm();
    if (validationError) {
      setLocalError(validationError);
      return;
    }

    // AuthContext (signIn/signUp) will set authLoading to true.
    try {
      if (isSignUp) {
        await signUp(email, password, name, phone);
      } else {
        await signIn(email, password);
      }
      // On success, onAuthStateChanged in AuthContext handles redirection or keeps showing verify email message.
      // authLoading will be set to false by onAuthStateChanged or by the catch block in signIn/signUp.
    } catch (error: any) {
      console.error('Auth form error:', error);
      
      // Handle extension-specific errors
      if (error.message?.includes('message channel closed') || 
          error.message?.includes('listener indicated an asynchronous response')) {
        setLocalError('Browser extension conflict detected. Please try incognito mode or disable extensions.');
      } else {
        // Let AuthContext handle other errors via authError
        // Only set localError for non-Firebase errors that AuthContext might not catch
        if (!authError) {
          setLocalError(error.message || 'An unexpected error occurred');
        }
      }
    }
  };

  const handleResendVerification = async () => {
    setIsResending(true);
    setLocalError(null);
    if (authError) setAuthError(null);
    try {
      await resendVerificationEmail();
      alert('Verification email resent. Please check your inbox (and spam folder).');
    } catch (error: any) {
      setLocalError(error.message || "Failed to resend verification email.");
    } finally {
      setIsResending(false);
    }
  };

  const handleBackToLogin = async () => {
    setIsLoggingOut(true);
    setLocalError(null);
    if (authError) setAuthError(null);
    try {
      await logout();
      // logout() in AuthContext handles navigation to /auth/login
    } catch (error: any) {
      setLocalError(error.message || "Failed to log out.");
    } finally {
      setIsLoggingOut(false);
    }
  };
  
  // The main loading state (authLoading) is now handled by the button's disabled state and text.
  // The showVerificationMessage logic handles the post-login-but-not-verified state.

  if (showVerificationMessage && currentUser && !emailVerified) {
    return (
      <div className="w-full max-w-md p-8 space-y-6 bg-slate-800 shadow-xl rounded-lg text-slate-100">
        <h2 className="text-2xl font-semibold text-center">Verify Your Email</h2>
        <p className="text-center text-slate-300">
          A verification email has been sent to <strong>{currentUser.email}</strong>.
          Please check your inbox (and spam folder) and click the link to verify your account.
        </p>
        {localError && <p className="text-sm text-red-400 text-center mt-2">{localError}</p>}
        {authError && <p className="text-sm text-red-400 text-center mt-2">{authError}</p>} 
        <div className="mt-6 space-y-4">
          <button
            onClick={handleResendVerification}
            disabled={isResending || authLoading}
            className="w-full flex justify-center py-3 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-slate-800 focus:ring-indigo-500 disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {isResending ? 'Sending...' : 'Resend Verification Email'}
          </button>
          <button
            onClick={handleBackToLogin}
            disabled={isLoggingOut || authLoading}
            className="w-full flex justify-center py-3 px-4 border border-slate-600 rounded-md shadow-sm text-sm font-medium text-slate-300 bg-slate-700 hover:bg-slate-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-slate-800 focus:ring-indigo-500 disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {isLoggingOut ? 'Logging out...' : 'Back to Login'}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full max-w-md p-8 space-y-6 bg-slate-800 shadow-xl rounded-lg">
      <h2 className="text-3xl font-bold text-center text-white">
        {isSignUp ? 'Create Account' : 'Welcome Back'}
      </h2>
      <p className="text-center text-slate-400">
        {isSignUp ? 'Sign up to continue.' : 'Login to access your account.'}
      </p>
      <form onSubmit={handleSubmit} className="space-y-6">
        {isSignUp && (
          <>
            <div>
              <label htmlFor="name" className="block text-sm font-medium text-slate-300">
                Full Name
              </label>
              <input
                id="name"
                name="name"
                type="text"
                autoComplete="name"
                required={isSignUp}
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="mt-1 block w-full px-4 py-3 bg-slate-700 border border-slate-600 rounded-md shadow-sm placeholder-slate-500 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm text-white"
                placeholder="John Doe"
                disabled={authLoading}
              />
            </div>
            <div>
              <label htmlFor="phone" className="block text-sm font-medium text-slate-300">
                Phone Number (Optional)
              </label>
              <input
                id="phone"
                name="phone"
                type="tel"
                autoComplete="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="mt-1 block w-full px-4 py-3 bg-slate-700 border border-slate-600 rounded-md shadow-sm placeholder-slate-500 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm text-white"
                placeholder="+1234567890"
                disabled={authLoading}
              />
            </div>
          </>
        )}
        <div>
          <label htmlFor="email" className="block text-sm font-medium text-slate-300">
            Email address
          </label>
          <input
            id="email"
            name="email"
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="mt-1 block w-full px-4 py-3 bg-slate-700 border border-slate-600 rounded-md shadow-sm placeholder-slate-500 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm text-white"
            placeholder="you@example.com"
            disabled={authLoading}
          />
        </div>
        <div>
          <div className="flex items-center justify-between">
            <label htmlFor="password" className="block text-sm font-medium text-slate-300">
              Password
            </label>
            {!isSignUp && (
              <div className="text-sm">
                <a href="#" className="font-medium text-indigo-500 hover:text-indigo-400">
                  Forgot your password?
                </a>
              </div>
            )}
          </div>
          <div className="mt-1 relative">
            <input
              id="password"
              name="password"
              type={showPassword ? 'text' : 'password'}
              autoComplete={isSignUp ? 'new-password' : 'current-password'}
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="block w-full px-4 py-3 bg-slate-700 border border-slate-600 rounded-md shadow-sm placeholder-slate-500 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm text-white"
              placeholder="••••••••"
              disabled={authLoading}
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute inset-y-0 right-0 pr-3 flex items-center text-sm leading-5 text-slate-400 hover:text-slate-200"
              aria-label={showPassword ? 'Hide password' : 'Show password'}
              disabled={authLoading}
            >
              {showPassword ? (
                <EyeSlashIcon className="h-5 w-5" />
              ) : (
                <EyeIcon className="h-5 w-5" />
              )}
            </button>
          </div>
        </div>        {localError && (
          <div className="text-sm text-red-400">
            <p>{localError}</p>
            {localError.includes('extension conflict') && (
              <div className="mt-2 text-xs text-slate-400 bg-slate-700 p-2 rounded">
                <p className="font-medium">Troubleshooting tips:</p>
                <ul className="mt-1 space-y-1">
                  <li>• Open incognito/private window</li>
                  <li>• Disable browser extensions temporarily</li>
                  <li>• Clear browser cache</li>
                </ul>
              </div>
            )}
          </div>
        )}
        {authError && (
          <div className="text-sm text-red-400">
            <p>{authError}</p>
            {authError.includes('extension') && (
              <div className="mt-2 text-xs text-slate-400 bg-slate-700 p-2 rounded">
                <p className="font-medium">Try these solutions:</p>
                <ul className="mt-1 space-y-1">
                  <li>• Use incognito/private browsing</li>
                  <li>• Disable ad blockers and extensions</li>
                  <li>• Refresh and try again</li>
                </ul>
              </div>
            )}
          </div>
        )}

        <div>
          <button
            type="submit"
            disabled={authLoading}
            className="w-full flex justify-center py-3 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-slate-800 focus:ring-indigo-500 disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {authLoading ? 'Processing...' : (isSignUp ? 'Sign Up' : 'Login')}
          </button>
        </div>
      </form>
      <div className="mt-6 text-center">
        <p className="text-sm text-slate-400">
          {isSignUp ? 'Already have an account?' : "Don't have an account?"}
          <Link href={isSignUp ? '/auth/login' : '/auth/signup'} className="font-medium text-indigo-500 hover:text-indigo-400 ml-1">
            {isSignUp ? 'Login' : 'Sign Up'}
          </Link>
        </p>
      </div>
    </div>
  );
};

export default AuthForm;
