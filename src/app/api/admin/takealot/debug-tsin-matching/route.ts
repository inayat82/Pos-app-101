// Debug endpoint to check TSIN matching
import { NextRequest, NextResponse } from 'next/server';
import { dbAdmin as db } from '@/lib/firebase/firebaseAdmin';

export async function POST(request: NextRequest) {
  try {
    const { integrationId } = await request.json();

    if (!integrationId) {
      return NextResponse.json({ error: 'Integration ID required' }, { status: 400 });
    }    // Get sample of existing products
    const existingQuery = db.collection('takealot_offers')
      .where('integrationId', '==', integrationId)
      .limit(10);    const existingSnapshot = await existingQuery.get();
    const existingProducts: any[] = [];
    
    existingSnapshot.forEach((doc: any) => {
      const data = doc.data();
      existingProducts.push({
        docId: doc.id,
        tsin_id: data.tsin_id,
        offer_id: data.offer_id,
        selling_price: data.selling_price,
        rrp: data.rrp,
        sku: data.sku,
        allFields: Object.keys(data)
      });
    });

    // Get integration and API key
    const integrationDoc = await db.collection('takealotIntegrations').doc(integrationId).get();
    if (!integrationDoc.exists) {
      return NextResponse.json({ error: 'Integration not found' }, { status: 404 });
    }

    const apiKey = integrationDoc.data()?.apiKey;
    if (!apiKey) {
      return NextResponse.json({ error: 'API key not found' }, { status: 400 });
    }

    // Get sample from API
    const apiUrl = 'https://seller-api.takealot.com/v2/offers?page_size=10&page_number=1';
    const apiResponse = await fetch(apiUrl, {
      headers: {
        'Authorization': `Key ${apiKey}`,
        'Content-Type': 'application/json'
      }
    });

    const apiData = await apiResponse.json();    const apiProducts = (apiData.offers || []).slice(0, 5).map((product: any) => ({
      tsin_id: product.tsin_id,
      offer_id: product.offer_id,
      selling_price: product.selling_price,
      rrp: product.rrp,
      sku: product.sku,
      allFields: Object.keys(product)
    }));

    return NextResponse.json({
      success: true,
      debug: {
        existingInDatabase: existingProducts,
        fromAPI: apiProducts,
        summary: {
          totalExistingInDB: existingSnapshot.size,
          apiResponseFields: apiProducts.length > 0 ? apiProducts[0].allFields : [],
          dbFields: existingProducts.length > 0 ? existingProducts[0].allFields : []
        }
      }
    });

  } catch (error: any) {
    console.error('Debug TSIN matching error:', error);
    return NextResponse.json({ 
      success: false, 
      error: error.message 
    }, { status: 500 });
  }
}
