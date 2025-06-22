import { getAuth } from "firebase/auth";
import { doc, setDoc } from "firebase/firestore";
import { db } from "@/lib/firebase/firebase";

export async function saveTakealotApiKey({ apiKey, userId }: { apiKey: string; userId: string }) {
  if (!userId) throw new Error("User not authenticated");
  
  // Note: This function is deprecated. API keys should now be saved directly in the takealotIntegrations collection
  // when creating or updating integrations. This function is kept for backwards compatibility.
  
  console.warn('saveTakealotApiKey is deprecated. Use takealotIntegrations collection instead.');
  
  // For backwards compatibility, we could update existing integrations here if needed
  // But generally, this should be handled through the integration management UI
}
