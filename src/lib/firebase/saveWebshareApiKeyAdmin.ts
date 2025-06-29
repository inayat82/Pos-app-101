// Server-side Firebase operations for Webshare API key management
import { dbAdmin } from "@/lib/firebase/firebaseAdmin";

export interface WebshareApiKeyData {
  apiKey: string;
  testStatus: 'connected' | 'failed' | 'testing';
  lastTested: string;
  lastTestError?: string;
  createdAt: string;
  updatedAt: string;
}

export async function saveWebshareApiKeyAdmin({ 
  apiKey, 
  testStatus = 'testing',
  lastTestError
}: { 
  apiKey: string; 
  testStatus?: 'connected' | 'failed' | 'testing';
  lastTestError?: string;
}) {
  console.log('saveWebshareApiKeyAdmin called with:', { 
    hasApiKey: !!apiKey,
    apiKeyLength: apiKey?.length,
    testStatus 
  });
  
  const now = new Date().toISOString();
  
  const webshareData: WebshareApiKeyData = {
    apiKey,
    testStatus,
    lastTested: now,
    lastTestError: lastTestError || undefined,
    createdAt: now,
    updatedAt: now
  };

  try {
    console.log('Attempting to access dbAdmin...');
    
    if (!dbAdmin) {
      throw new Error('Firebase dbAdmin is not initialized');
    }
    
    const webshareRef = dbAdmin.collection('superadmin').doc('webshareSettings');
    console.log('Firestore reference created');
    
    // Check if document exists to preserve createdAt
    console.log('Checking existing document...');
    const existingDoc = await webshareRef.get();
    console.log('Existing document check completed, exists:', existingDoc.exists);
    
    if (existingDoc.exists) {
      const existingData = existingDoc.data() as WebshareApiKeyData;
      webshareData.createdAt = existingData.createdAt || now;
      console.log('Preserved existing createdAt:', webshareData.createdAt);
    }
    
    // Clean the data to ensure no undefined values
    const cleanData = {
      apiKey: webshareData.apiKey,
      testStatus: webshareData.testStatus,
      lastTested: webshareData.lastTested,
      lastTestError: webshareData.lastTestError,
      createdAt: webshareData.createdAt,
      updatedAt: webshareData.updatedAt
    };
    
    console.log('Saving clean data to Firestore:', cleanData);
    await webshareRef.set(cleanData, { merge: true });
    console.log('Webshare API key saved successfully to Firestore');
    return true;
  } catch (error) {
    console.error('Error saving Webshare API key:', error);
    console.error('Error details:', error);
    throw error;
  }
}

export async function getWebshareApiKeyAdmin(): Promise<WebshareApiKeyData | null> {
  try {
    const webshareRef = dbAdmin.collection('superadmin').doc('webshareSettings');
    const docSnap = await webshareRef.get();
    
    if (docSnap.exists) {
      return docSnap.data() as WebshareApiKeyData;
    }
    
    return null;
  } catch (error) {
    console.error('Error getting Webshare API key:', error);
    throw error;
  }
}

export async function updateWebshareTestStatusAdmin({
  testStatus,
  lastTestError
}: {
  testStatus: 'connected' | 'failed' | 'testing';
  lastTestError?: string;
}) {
  try {
    const webshareRef = dbAdmin.collection('superadmin').doc('webshareSettings');
    const updateData: Partial<WebshareApiKeyData> = {
      testStatus,
      lastTested: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    
    if (lastTestError !== undefined) {
      updateData.lastTestError = lastTestError;
    }
    
    await webshareRef.set(updateData, { merge: true });
    console.log('Webshare test status updated:', testStatus);
    return true;
  } catch (error) {
    console.error('Error updating Webshare test status:', error);
    throw error;
  }
}
