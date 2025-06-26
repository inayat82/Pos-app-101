// src/app/api/admin/takealot/optimized-fetch/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/firebase/firebase';
import { collection, query, where, getDocs, updateDoc, addDoc, doc, serverTimestamp } from 'firebase/firestore';

export async function POST(request: NextRequest) {
  let integrationId: string | undefined;
  let type: string | undefined;
  
  try {
    const requestData = await request.json();
    integrationId = requestData.integrationId;
    type = requestData.type;
    const limit = requestData.limit || 100;

    if (!integrationId || !type) {
      return NextResponse.json(
        { error: 'Integration ID and type are required' },
        { status: 400 }
      );
    }

    // Get integration details
    const integrationDoc = await getDocs(
      query(collection(db, 'takealotIntegrations'), where('__name__', '==', integrationId))
    );

    if (integrationDoc.empty) {
      return NextResponse.json(
        { error: 'Integration not found' },
        { status: 404 }
      );
    }

    const integration = integrationDoc.docs[0].data();
    const apiKey = integration.apiKey;

    if (!apiKey) {
      return NextResponse.json(
        { error: 'API key not found in integration' },
        { status: 400 }
      );
    }

    let apiUrl = '';
    let collectionName = '';
    let uniqueField = '';

    if (type === 'sales') {
      apiUrl = `https://seller-api.takealot.com/v2/sales?limit=${limit}`;
      collectionName = 'takealotSales';
      uniqueField = 'saleId';
    } else if (type === 'products') {
      apiUrl = `https://seller-api.takealot.com/v2/offers?limit=${limit}`;
      collectionName = 'takealotProducts';
      uniqueField = 'tsin';
    } else {
      return NextResponse.json(
        { error: 'Invalid type. Must be "sales" or "products"' },
        { status: 400 }
      );
    }

    console.log(`Fetching ${type} from Takealot API:`, apiUrl);

    // Fetch data from Takealot API
    const response = await fetch(apiUrl, {
      headers: {
        'Authorization': `Key ${apiKey}`,
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      throw new Error(`Takealot API error: ${response.status} ${response.statusText}`);
    }

    const apiData = await response.json();
    console.log(`Fetched ${apiData.results?.length || 0} ${type} from API`);

    if (!apiData.results || apiData.results.length === 0) {
      return NextResponse.json({
        status: 'success',
        message: `No ${type} data found`,
        totalFetched: 0,
        totalSaved: 0,
        totalUpdated: 0,
        newRecords: 0
      });
    }

    // Get existing records from database
    const existingRecordsQuery = query(
      collection(db, collectionName),
      where('integrationId', '==', integrationId)
    );
    const existingRecordsSnapshot = await getDocs(existingRecordsQuery);
    
    const existingRecords = new Map();
    existingRecordsSnapshot.forEach(doc => {
      const data = doc.data();
      if (data[uniqueField]) {
        existingRecords.set(data[uniqueField], { id: doc.id, data });
      }
    });

    console.log(`Found ${existingRecords.size} existing ${type} records in database`);

    let totalSaved = 0;
    let totalUpdated = 0;
    let newRecords = 0;
    const results = [];

    // Process each record
    for (const item of apiData.results) {
      try {
        const uniqueId = type === 'sales' ? item.sale_id : item.tsin;
        if (!uniqueId) continue;

        const baseData = {
          integrationId,
          lastUpdated: serverTimestamp(),
          apiData: item
        };        if (existingRecords.has(uniqueId)) {
          // Update existing record
          const existingRecord = existingRecords.get(uniqueId);
          const updateData: any = { 
            lastUpdated: serverTimestamp()
          };

          if (type === 'sales') {
            // For sales: only update status and amount in apiData
            updateData['apiData.status'] = item.status;
            updateData['apiData.amount'] = item.total_amount || item.amount;
            if (item.currency) updateData['apiData.currency'] = item.currency;
          } else if (type === 'products') {
            // For products: only update price, RRP, and SKU in apiData
            updateData['apiData.price'] = item.selling_price || item.price;
            updateData['apiData.rrp'] = item.rrp;
            updateData['apiData.sku'] = item.seller_sku || item.sku;
            if (item.stock_quantity !== undefined) updateData['apiData.stock_quantity'] = item.stock_quantity;
          }

          await updateDoc(doc(db, collectionName, existingRecord.id), updateData);
          totalUpdated++;
          results.push({ action: 'updated', id: uniqueId });
        } else {
          // Create new record
          const newRecordData = {
            ...baseData,
            // Store all the API data in apiData field
            apiData: item,
            createdAt: serverTimestamp()
          };

          await addDoc(collection(db, collectionName), newRecordData);
          newRecords++;
          results.push({ action: 'created', id: uniqueId });
        }

        totalSaved++;
      } catch (itemError) {
        console.error(`Error processing ${type} item:`, itemError);
      }
    }

    // Log the operation
    const logData = {
      integrationId,
      operation: `Optimized Fetch Last ${limit} ${type}`,
      type: type,
      trigger: 'Manual Optimized Fetch',
      totalRecords: apiData.results.length,
      recordsFetched: apiData.results.length,
      recordsSaved: totalSaved,
      recordsUpdated: totalUpdated,
      newRecords: newRecords,
      duplicates: 0,
      status: 'success',
      createdAt: new Date(),
      timestamp: new Date().toISOString(),
      duration: 0,
      details: {
        apiUrl,
        uniqueField,
        existingRecordsCount: existingRecords.size
      }
    };

    try {
      await addDoc(collection(db, 'takealotApiLogs'), {
        ...logData,
        createdAt: serverTimestamp()
      });
    } catch (logError) {
      console.error('Failed to log operation:', logError);
    }

    return NextResponse.json({
      status: 'success',
      message: `Successfully processed ${totalSaved} ${type} records. Updated: ${totalUpdated}, New: ${newRecords}`,
      totalFetched: apiData.results.length,
      totalSaved: totalSaved,
      totalUpdated: totalUpdated,
      newRecords: newRecords,
      results: results.slice(0, 10) // Return first 10 for debugging
    });
  } catch (error: any) {
    console.error('Error in optimized fetch:', error);
    
    // Log the error
    try {
      const errorLogData = {
        integrationId: integrationId || 'unknown',
        operation: `Optimized Fetch Error`,
        type: type || 'unknown',
        trigger: 'Manual Optimized Fetch',
        status: 'error',
        error: error.message,
        createdAt: new Date(),
        timestamp: new Date().toISOString()
      };

      await addDoc(collection(db, 'takealotApiLogs'), {
        ...errorLogData,
        createdAt: serverTimestamp()
      });
    } catch (logError) {
      console.error('Failed to log error:', logError);
    }

    return NextResponse.json(
      { error: `Failed to fetch ${type || 'data'}: ${error.message}` },
      { status: 500 }
    );
  }
}
