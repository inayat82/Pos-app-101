// src/lib/firebase/firebaseAdmin.ts
import admin from 'firebase-admin';
import * as fs from 'fs';
import * as path from 'path';

console.log("Attempting to initialize Firebase Admin SDK...");

if (!admin.apps.length) {
  try {
    let projectId: string;
    let initConfig: any;
    
    // First, try to use the service account file directly (most reliable)
    const serviceAccountPath = path.join(process.cwd(), 'firebase-service-account.json');
    if (fs.existsSync(serviceAccountPath)) {
      console.log("Using Firebase service account credentials from firebase-service-account.json file");
      
      try {
        const serviceAccount = JSON.parse(fs.readFileSync(serviceAccountPath, 'utf8'));
        projectId = serviceAccount.project_id;
        
        initConfig = {
          credential: admin.credential.cert(serviceAccount),
          projectId: projectId,
          storageBucket: `${projectId}.firebasestorage.app`,
        };
        
        console.log(`Initializing Firebase Admin with project ID: ${projectId} (from file)`);
      } catch (parseError) {
        console.error("Failed to parse firebase-service-account.json:", parseError);
        throw parseError;
      }
    }
    // Fallback to complete JSON service account (environment variable)
    else if (process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON) {
      console.log("Using Firebase service account credentials from GOOGLE_APPLICATION_CREDENTIALS_JSON");
      
      try {
        const serviceAccount = JSON.parse(process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON);
        projectId = serviceAccount.project_id;
        
        initConfig = {
          credential: admin.credential.cert(serviceAccount),
          projectId: projectId,
          storageBucket: `${projectId}.firebasestorage.app`,
        };
        
        console.log(`Initializing Firebase Admin with project ID: ${projectId} (from JSON)`);
      } catch (parseError) {
        console.error("Failed to parse GOOGLE_APPLICATION_CREDENTIALS_JSON:", parseError);
        throw parseError;
      }
    } 
    // Fallback to individual environment variables
    else if (process.env.FIREBASE_SERVICE_ACCOUNT_PROJECT_ID && 
             process.env.FIREBASE_SERVICE_ACCOUNT_PRIVATE_KEY && 
             process.env.FIREBASE_SERVICE_ACCOUNT_CLIENT_EMAIL) {
      console.log("Using Firebase service account credentials from individual environment variables");
      
      projectId = process.env.FIREBASE_SERVICE_ACCOUNT_PROJECT_ID;
      
      initConfig = {
        credential: admin.credential.cert({
          projectId: projectId,
          privateKey: process.env.FIREBASE_SERVICE_ACCOUNT_PRIVATE_KEY.replace(/\\n/g, '\n'),
          clientEmail: process.env.FIREBASE_SERVICE_ACCOUNT_CLIENT_EMAIL,
        }),
        projectId: projectId,
        storageBucket: `${projectId}.firebasestorage.app`,
      };
      
      console.log(`Initializing Firebase Admin with project ID: ${projectId} (from individual vars)`);
    }
    // Legacy fallback
    else if (process.env.FIREBASE_PRIVATE_KEY && process.env.FIREBASE_CLIENT_EMAIL) {
      console.log("Using legacy Firebase service account credentials");
      
      projectId = process.env.FIREBASE_PROJECT_ID || process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || 'app-101-45e45';
      
      initConfig = {
        credential: admin.credential.cert({
          projectId: projectId,
          privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n'),
          clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
        }),
        projectId: projectId,
        storageBucket: `${projectId}.firebasestorage.app`,
      };
      
      console.log(`Initializing Firebase Admin with project ID: ${projectId} (legacy)`);
    }
    // Application Default Credentials (local development)
    else if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
      console.log("Using Firebase service account credentials from file");
      projectId = process.env.FIREBASE_PROJECT_ID || process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || 'app-101-45e45';
      
      initConfig = {
        projectId: projectId,
        storageBucket: `${projectId}.firebasestorage.app`,
      };
      
      console.log(`Initializing Firebase Admin with project ID: ${projectId} (from file)`);
    } else {
      throw new Error("No Firebase Admin credentials found. Please set GOOGLE_APPLICATION_CREDENTIALS_JSON or individual service account environment variables.");
    }

    // Set up emulator for development only
    if (process.env.USE_FIRESTORE_EMULATOR === 'true' && process.env.NODE_ENV === 'development' && process.env.VERCEL !== '1') {
      process.env.FIRESTORE_EMULATOR_HOST = process.env.FIRESTORE_EMULATOR_HOST || "localhost:8080";
      console.log("Development mode: Using Firestore emulator (explicitly enabled)");
    } else {
      // Ensure emulator host is NOT set in production
      delete process.env.FIRESTORE_EMULATOR_HOST;
      console.log("Production mode: Connecting to production Firestore");
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
