// src/lib/firebase/firebaseAdmin.ts
import admin from 'firebase-admin';

console.log("Attempting to initialize Firebase Admin SDK...");

if (!admin.apps.length) {
  try {
    // Use the project ID from environment variables
    const projectId = process.env.FIREBASE_PROJECT_ID || process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || 'app-101-45e45';
    
    console.log(`Initializing Firebase Admin with project ID: ${projectId}`);
      // Try to initialize with service account credentials if available
    const privateKey = process.env.FIREBASE_PRIVATE_KEY;
    const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
    
    let initConfig: any = {
      projectId: projectId,
      storageBucket: `${projectId}.firebasestorage.app`,
    };
    
    // If we have service account credentials, use them
    if (privateKey && clientEmail) {
      console.log("Using Firebase service account credentials from environment variables");
      initConfig.credential = admin.credential.cert({
        projectId: projectId,
        privateKey: privateKey.replace(/\\n/g, '\n'),
        clientEmail: clientEmail,
      });
    } else if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
      console.log("Using Firebase service account credentials from file");
      // Will automatically use the service account file    } else {
      console.log("No Firebase Admin credentials found, attempting to use default application credentials");
      // IMPORTANT: Never set emulator host in production
      // Explicitly check we're not setting emulator in production
      if (process.env.NODE_ENV === 'development' && process.env.VERCEL !== '1') {
        process.env.FIRESTORE_EMULATOR_HOST = process.env.FIRESTORE_EMULATOR_HOST || "localhost:8080";
        console.log("Development mode: Using Firestore emulator");
      } else {
        // Ensure emulator host is NOT set in production
        delete process.env.FIRESTORE_EMULATOR_HOST;
        console.log("Production mode: Connecting to production Firestore");
      }
    }
    
    // Initialize with configuration
    admin.initializeApp(initConfig);
    
    console.log("Firebase Admin SDK initialized successfully");
  } catch (error: any) {
    console.error("Firebase Admin SDK initialization failed:", error);
  }
} else {
  console.log("Firebase Admin SDK already initialized");
}

// Initialize Firebase Admin services
let authAdmin: admin.auth.Auth;
let dbAdmin: admin.firestore.Firestore;

try {
  if (admin.apps.length > 0) {
    authAdmin = admin.auth();
    dbAdmin = admin.firestore();
    console.log("Firebase Admin services initialized successfully");
  } else {
    throw new Error("No Firebase Admin app available");
  }
} catch (error: any) {
  console.error("Failed to initialize Firebase Admin services:", error);
  // Create placeholder objects to prevent crashes
  authAdmin = {} as admin.auth.Auth;
  dbAdmin = {} as admin.firestore.Firestore;
}

export { authAdmin, dbAdmin, admin as firebaseAdmin };
