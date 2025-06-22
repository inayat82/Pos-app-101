'use client';

import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import {
  Auth,
  User,
  UserCredential,
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut,
  sendEmailVerification,
} from 'firebase/auth';
import { doc, setDoc, getDoc, serverTimestamp, Timestamp } from 'firebase/firestore';
import { db, auth } from '@/lib/firebase/firebase'; // Corrected import path
import { UserProfile, UserRole, AnyUserProfile, BaseUserProfile, AdminUserProfile, SuperAdminProfile, TakealotUserProfile, POSUserProfile } from '@/types/user'; // Added missing specific profile types
import { useRouter } from 'next/navigation'; // Added for navigation

export interface AuthContextType { // Added export
  currentUser: User | null;
  userProfile: AnyUserProfile | null;
  loading: boolean;
  emailVerified: boolean; // Added
  signUp: (email: string, password: string, name?: string, phone?: string) => Promise<UserCredential>; 
  signIn: (email: string, password: string) => Promise<UserCredential>;
  logout: () => Promise<void>;
  resendVerificationEmail: () => Promise<void>; // Added
  error: string | null;
  setError: React.Dispatch<React.SetStateAction<string | null>>;
  isAdmin: boolean;
  isSuperAdmin: boolean;
  displayName: string; // Added displayName
}

export const AuthContext = createContext<AuthContextType | undefined>(undefined);

interface AuthProviderProps {
  children: ReactNode;
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [userProfile, setUserProfile] = useState<AnyUserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [emailVerified, setEmailVerified] = useState(false);
  const router = useRouter();

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setLoading(true);
      setError(null); // Clear previous errors on auth state change
      try {
        if (user) {
          await user.reload();
          const freshUser = auth.currentUser; 
          setCurrentUser(freshUser);

          if (freshUser) {
            setEmailVerified(freshUser.emailVerified);
            const userDocRef = doc(db, 'users', freshUser.uid);
            const userDocSnap = await getDoc(userDocRef);

            if (userDocSnap.exists()) {
              const profileData = userDocSnap.data() as AnyUserProfile;
              setUserProfile(profileData);

              // Ensure admin document exists if user role is Admin
              if (profileData.role === UserRole.Admin) {
                const adminDocRef = doc(db, 'admins', freshUser.uid);
                const adminDocSnap = await getDoc(adminDocRef);
                if (!adminDocSnap.exists()) {
                  // Admin document doesn't exist, create it.
                  // This is a fallback, ideally it's created on sign up.
                  console.warn(`Admin document missing for UID: ${freshUser.uid}. Creating now.`);
                  const adminData = {
                    adminUID: freshUser.uid,
                    email: freshUser.email!,
                    name: profileData.name || freshUser.email?.split('@')[0] || 'Admin User',
                    createdAt: serverTimestamp() as Timestamp,
                  };
                  await setDoc(adminDocRef, adminData);
                  console.log('Fallback: Admin document created in /admins collection for UID:', freshUser.uid);
                }
              }

              if (freshUser.emailVerified) {
                // Check if current path is an auth path or the root path before redirecting
                const currentPath = window.location.pathname;
                const isOnAuthPage = currentPath.startsWith('/auth/login') || currentPath.startsWith('/auth/signup');
                const isOnRootPage = currentPath === '/';

                if (profileData.role === UserRole.Admin) {
                  if (isOnAuthPage || isOnRootPage) router.push('/admin/dashboard');
                } else if (profileData.role === UserRole.SuperAdmin) {
                  if (isOnAuthPage || isOnRootPage) router.push('/superadmin/dashboard');
                } else {
                  // Handle other roles or default redirect if necessary
                  if (isOnAuthPage || isOnRootPage) router.push('/'); // Fallback to root
                }
              } else {
                // User is logged in but email is not verified.
                // AuthForm will show the "Verify Your Email" message.
                // No redirect here, let AuthForm handle the UI for verification.
              }
            } else {
              setUserProfile(null);
              console.warn("User profile not found in Firestore for UID:", freshUser.uid);
              setError("Your user profile was not found. Please contact support.");
              // If profile doesn't exist, logout the user to prevent inconsistent state
              await signOut(auth);
              // setCurrentUser(null) and setEmailVerified(false) will be handled by the subsequent auth state change
            }
          } else {
            // This case should ideally not be reached if 'user' is initially true
            setCurrentUser(null);
            setUserProfile(null);
            setEmailVerified(false);
          }
        } else {
          setCurrentUser(null);
          setUserProfile(null);
          setEmailVerified(false);
          // User is logged out. If they are on a protected route, redirect to login.
          // This is a basic check. For more complex apps, use route guards.
          // const protectedPaths = ['/admin', '/superadmin', '/']; // Define protected paths
          // if (protectedPaths.some(path => window.location.pathname.startsWith(path)) && window.location.pathname !== '/auth/login') {
          //   router.push('/auth/login');
          // }
        }
      } catch (err: any) {
        console.error("Error in onAuthStateChanged handler:", err);
        setUserProfile(null);
        setCurrentUser(null); // Ensure user is cleared on error
        setEmailVerified(false);
        setError(err.message || "An error occurred during authentication.");
      } finally {
        setLoading(false);
      }
    });
    return () => unsubscribe();
  }, [router]);

  const signUp = async (email: string, password: string, name?: string, phone?: string) => {
    setLoading(true);
    setError(null);
    try {
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      const user = userCredential.user;

      const userProfileData: AdminUserProfile = {
        uid: user.uid,
        email: user.email!,
        role: UserRole.Admin, 
        name: name || user.email?.split('@')[0] || 'Admin User',
        createdAt: serverTimestamp() as Timestamp,
        phone: phone,
      };
      await setDoc(doc(db, 'users', user.uid), userProfileData);

      // Ensure corresponding document in 'admins' collection is created for Admin users
      if (userProfileData.role === UserRole.Admin) {
        const adminData = {
          adminUID: user.uid,
          email: user.email!,
          name: userProfileData.name,
          createdAt: serverTimestamp() as Timestamp,
        };
        // Check if it already exists before setting, though unlikely for a new signup
        const adminDocRef = doc(db, 'admins', user.uid);
        const adminDocSnap = await getDoc(adminDocRef);
        if (!adminDocSnap.exists()) {
            await setDoc(adminDocRef, adminData);
            console.log('Admin document created in /admins collection for UID:', user.uid);
        } else {
            console.log('Admin document already exists in /admins for UID:', user.uid);
        }
      }

      await sendEmailVerification(userCredential.user);
      console.log('Verification email sent.');
      // setLoading(false); // onAuthStateChanged will handle this
      return userCredential;
    } catch (err: any) {
      console.error("Error signing up:", err);
      setError(err.message || 'Failed to sign up. Please try again.');
      setLoading(false); 
      throw err; 
    } 
  };
  const signIn = async (email: string, password: string) => {
    setLoading(true);
    setError(null);
    try {
      // Add retry logic for extension conflicts
      let userCredential;
      let retryCount = 0;
      const maxRetries = 3;

      while (retryCount < maxRetries) {
        try {
          userCredential = await signInWithEmailAndPassword(auth, email, password);
          break;
        } catch (retryError: any) {
          if (retryError.message?.includes('message channel closed') || 
              retryError.message?.includes('listener indicated an asynchronous response')) {
            console.warn(`Login attempt ${retryCount + 1} failed due to extension conflict, retrying...`);
            retryCount++;
            if (retryCount < maxRetries) {
              // Wait a short time before retrying
              await new Promise(resolve => setTimeout(resolve, 500));
              continue;
            }
          }
          throw retryError;
        }
      }

      if (!userCredential) {
        throw new Error('Failed to sign in after multiple attempts');
      }

      // onAuthStateChanged will handle user state, profile loading, and redirection
      return userCredential;
    } catch (err: any) {
      console.error("Error signing in:", err);
      
      // Handle extension-specific errors with user-friendly messages
      if (err.message?.includes('message channel closed') || 
          err.message?.includes('listener indicated an asynchronous response')) {
        setError('Login temporarily interrupted by browser extension. Please try again or disable browser extensions.');
      } else {
        setError(err.message || 'Failed to sign in. Please check your credentials.');
      }
      
      setLoading(false); 
      throw err; 
    }
  };

  const logout = async () => {
    setError(null);
    try {
      await signOut(auth);
      // States (currentUser, userProfile, emailVerified) will be reset by onAuthStateChanged
      // setLoading(true) here can cause a brief flicker, onAuthStateChanged handles loading.
      if (router) {
        router.push('/auth/login');
      }
    } catch (err: any) {
      console.error("Error signing out:", err);
      setError(err.message || 'Failed to sign out.');
      setLoading(false); // Ensure loading is false on error during logout
      throw err;
    }
  };

  const resendVerificationEmail = async () => {
    // setLoading(true); // Already handled by the button state in AuthForm
    setError(null);
    if (currentUser) {
      try {
        await sendEmailVerification(currentUser);
        console.log('Verification email resent.');
        // setLoading(false); // Handled by AuthForm
      } catch (err: any) {
        console.error("Error resending verification email:", err);
        setError(err.message || 'Failed to resend verification email.');
        // setLoading(false); // Handled by AuthForm
        throw err;
      }
    } else {
      const errMsg = 'No user is currently signed in to resend verification email.';
      console.error(errMsg);
      setError(errMsg);
      // setLoading(false); // Handled by AuthForm
      throw new Error(errMsg);
    }
  };
  const isAdmin = userProfile?.role?.toLowerCase() === UserRole.Admin.toLowerCase();
  const isSuperAdmin = userProfile?.role?.toLowerCase() === UserRole.SuperAdmin.toLowerCase();

  const displayName = userProfile?.name || (currentUser?.email ? currentUser.email.split('@')[0] : 'User');

  const value = {
    currentUser,
    userProfile,
    loading,
    emailVerified, // Added
    signUp,
    signIn,
    logout,
    resendVerificationEmail, // Added
    error,
    setError,
    isAdmin,
    isSuperAdmin,
    displayName, // Expose displayName
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
