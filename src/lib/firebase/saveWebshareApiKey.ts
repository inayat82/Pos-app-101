import { doc, setDoc, getDoc } from "firebase/firestore";
import { db } from "@/lib/firebase/firebase";

export interface WebshareApiKeyData {
  apiKey: string;
  testStatus: 'connected' | 'failed' | 'testing';
  lastTested: string;
  lastTestError?: string;
  createdAt: string;
  updatedAt: string;
}

export async function saveWebshareApiKey({ 
  apiKey, 
  testStatus = 'testing',
  lastTestError
}: { 
  apiKey: string; 
  testStatus?: 'connected' | 'failed' | 'testing';
  lastTestError?: string;
}) {
  const now = new Date().toISOString();
  
  const webshareData: WebshareApiKeyData = {
    apiKey,
    testStatus,
    lastTested: now,
    lastTestError,
    createdAt: now,
    updatedAt: now
  };

  // Save to superadmin webshare settings
  const webshareRef = doc(db, 'superadmin', 'webshareSettings');
  
  try {
    // Check if document exists to preserve createdAt
    const existingDoc = await getDoc(webshareRef);
    if (existingDoc.exists()) {
      const existingData = existingDoc.data() as WebshareApiKeyData;
      webshareData.createdAt = existingData.createdAt || now;
    }
    
    await setDoc(webshareRef, webshareData, { merge: true });
    console.log('Webshare API key saved successfully');
    return true;
  } catch (error) {
    console.error('Error saving Webshare API key:', error);
    throw error;
  }
}

export async function getWebshareApiKey(): Promise<WebshareApiKeyData | null> {
  try {
    const webshareRef = doc(db, 'superadmin', 'webshareSettings');
    const docSnap = await getDoc(webshareRef);
    
    if (docSnap.exists()) {
      return docSnap.data() as WebshareApiKeyData;
    }
    
    return null;
  } catch (error) {
    console.error('Error getting Webshare API key:', error);
    throw error;
  }
}

export async function updateWebshareTestStatus({
  testStatus,
  lastTestError
}: {
  testStatus: 'connected' | 'failed' | 'testing';
  lastTestError?: string;
}) {
  try {
    const webshareRef = doc(db, 'superadmin', 'webshareSettings');
    const updateData: Partial<WebshareApiKeyData> = {
      testStatus,
      lastTested: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    
    if (lastTestError !== undefined) {
      updateData.lastTestError = lastTestError;
    }
    
    await setDoc(webshareRef, updateData, { merge: true });
    console.log('Webshare test status updated:', testStatus);
    return true;
  } catch (error) {
    console.error('Error updating Webshare test status:', error);
    throw error;
  }
}
