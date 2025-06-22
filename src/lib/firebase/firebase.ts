import { initializeApp as initializeClientApp, getApps as getClientApps, getApp as getClientApp, FirebaseApp } from 'firebase/app';
import { getAuth as getClientAuth, Auth, connectAuthEmulator } from 'firebase/auth';
import { getFirestore as getClientFirestore, Firestore, connectFirestoreEmulator } from 'firebase/firestore';
import { getStorage as getClientStorage, FirebaseStorage, connectStorageEmulator } from 'firebase/storage';
import firebaseConfig from './firebaseConfig';

let clientApp: FirebaseApp;
let auth: Auth;
let db: Firestore;
let storage: FirebaseStorage;

// Add error handler for extension conflicts
const setupExtensionConflictHandler = () => {
  if (typeof window !== 'undefined') {
    // Suppress browser extension listener errors
    window.addEventListener('unhandledrejection', (event) => {
      if (event.reason?.message?.includes('message channel closed') || 
          event.reason?.message?.includes('listener indicated an asynchronous response')) {
        console.warn('Browser extension conflict detected and suppressed:', event.reason.message);
        event.preventDefault();
      }
    });

    // Add error listener for Chrome extension conflicts
    window.addEventListener('error', (event) => {
      if (event.message?.includes('message channel closed') || 
          event.message?.includes('listener indicated an asynchronous response')) {
        console.warn('Browser extension error suppressed:', event.message);
        event.preventDefault();
      }
    });
  }
};

if (typeof window !== 'undefined' && !getClientApps().length) {
  // Setup extension conflict handler first
  setupExtensionConflictHandler();

  // Check if all necessary config values are present
  if (
    firebaseConfig.apiKey &&
    firebaseConfig.authDomain &&
    firebaseConfig.projectId &&
    firebaseConfig.storageBucket &&
    firebaseConfig.appId
  ) {
    try {
      console.log("Initializing Firebase Client SDK with config:", firebaseConfig);
      clientApp = initializeClientApp(firebaseConfig);
      auth = getClientAuth(clientApp);
      db = getClientFirestore(clientApp);
      storage = getClientStorage(clientApp);

      // Add Auth state persistence configuration to handle extension conflicts
      if (auth) {
        // Set auth language to prevent extension conflicts
        auth.languageCode = 'en';
        
        // Add additional error handling for auth operations
        auth.onAuthStateChanged((user) => {
          // This helps stabilize auth state during extension conflicts
        }, (error) => {
          if (error.message?.includes('message channel closed')) {
            console.warn('Auth state change error suppressed (extension conflict):', error.message);
          } else {
            console.error('Auth state change error:', error);
          }
        });
      }

      console.log("Firebase Client SDK initialized successfully with storage and extension conflict handling.");
    } catch (error) {
      console.error("Firebase Client SDK initialization error:", error);
      console.error("Using Config:", firebaseConfig); 
      // You might want to set up placeholder/mock objects or throw an error
      // depending on how your app should behave if Firebase fails to initialize
    }
  } else {
    console.error("Firebase config is missing essential values. Firebase Client SDK NOT initialized.");
    console.error("Current Config:", firebaseConfig);
    console.error("Missing values:", {
      apiKey: !firebaseConfig.apiKey,
      authDomain: !firebaseConfig.authDomain,
      projectId: !firebaseConfig.projectId,
      storageBucket: !firebaseConfig.storageBucket,
      appId: !firebaseConfig.appId
    });
    // Handle missing configuration - perhaps show an error to the user or disable Firebase features
  }
} else if (typeof window !== 'undefined' && getClientApps().length > 0) {
  // Setup extension conflict handler for existing apps
  setupExtensionConflictHandler();
  
  console.log("Firebase Client SDK already initialized.");
  clientApp = getClientApp();
  auth = getClientAuth(clientApp);
  db = getClientFirestore(clientApp);
  storage = getClientStorage(clientApp);
  
  // Add auth language setting for existing app
  if (auth) {
    auth.languageCode = 'en';
  }
} else {
  // This case should ideally not be hit in client-side code due to the typeof window check,
  // but as a safeguard:
  console.warn("Firebase client SDK initialization skipped (not in browser or already initialized without window check somehow).");
}

// Export them, they might be undefined if initialization failed or was skipped
export { clientApp, auth, db, storage }; // Export client instances
