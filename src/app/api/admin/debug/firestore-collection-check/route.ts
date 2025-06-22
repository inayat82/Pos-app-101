import { NextResponse } from 'next/server';
import { dbAdmin as db } from '@/lib/firebase/firebaseAdmin'; // Corrected import: use dbAdmin as db
import { getUserAuth } from '@/lib/firebase/authUtils'; // Assuming auth utils are in firebase/authUtils

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const collectionName = searchParams.get('collection');
    const integrationId = searchParams.get('integrationId');

    const { session } = await getUserAuth();
    if (!session || !session.user || !session.user.id) {
      return NextResponse.json({ error: 'Unauthorized: User not logged in' }, { status: 401 });
    }
    const userId = session.user.id;

    // Basic role check (simplified) - In a real app, you'd have more robust role checking
    // For now, let's assume if the user is logged in, they can access debug routes for their integrations.
    // A proper check would involve verifying if this userId is an admin and if the integrationId belongs to them.

    if (!collectionName || !integrationId) {
      return NextResponse.json({ error: 'Missing collectionName or integrationId parameter' }, { status: 400 });
    }

    if (collectionName !== 'takealot_sales' && collectionName !== 'takealot_offers') {
        return NextResponse.json({ error: 'Invalid collection name. Only takealot_sales or takealot_offers are allowed.' }, { status: 400 });
    }

    const collectionPath = `users/${userId}/takealot_integrations/${integrationId}/${collectionName}`;
    
    const snapshot = await db.collection(collectionPath).limit(1).orderBy('date_added', 'desc').get();
    
    let lastUpdated = null;
    if (!snapshot.empty) {
      const docData = snapshot.docs[0].data();
      if (docData.date_added) {
        lastUpdated = docData.date_added;
      } else if (docData.sale_date) { // Fallback for sales if date_added isn't there
        lastUpdated = docData.sale_date;
      } else if (docData.offer_update_date) { // Fallback for offers
        lastUpdated = docData.offer_update_date;
      }
    }

    const countSnapshot = await db.collection(collectionPath).count().get();
    const count = countSnapshot.data().count;

    return NextResponse.json({ 
      message: `Data for ${collectionName}`, 
      count: count,
      lastUpdated: lastUpdated, // This will be a Firestore Timestamp object
      collectionPathAttempted: collectionPath 
    });

  } catch (error: any) {
    console.error('Error in firestore-collection-check:', error);
    return NextResponse.json({ error: 'Failed to check Firestore collection', details: error.message }, { status: 500 });
  }
}
