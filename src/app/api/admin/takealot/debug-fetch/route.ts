// src/app/api/admin/takealot/debug-fetch/route.ts
import { NextRequest, NextResponse } from 'next/server';

const TAKEALOT_API_BASE = 'https://seller-api.takealot.com';

export async function POST(request: NextRequest) {
  try {
    const { apiKey, type } = await request.json();

    if (!apiKey || !type) {
      return NextResponse.json({ 
        error: 'Missing apiKey or type' 
      }, { status: 400 });
    }

    const endpoint = type === 'offers' ? '/v2/offers' : '/V2/sales';
    const url = `${TAKEALOT_API_BASE}${endpoint}?page_size=5&page_number=1`;

    console.log(`DEBUG: Making request to ${url}`);

    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Authorization': `Key ${apiKey}`,
        'Accept': 'application/json',
      },
    });

    console.log(`DEBUG: Response status: ${response.status}`);

    const responseText = await response.text();
    console.log(`DEBUG: Raw response: ${responseText.substring(0, 1000)}...`);

    let data;
    try {
      data = JSON.parse(responseText);
    } catch (e) {
      data = { error: 'Invalid JSON response', rawResponse: responseText };
    }

    return NextResponse.json({
      success: response.ok,
      status: response.status,
      url: url,
      responseKeys: Object.keys(data),
      dataCount: Array.isArray(data) ? data.length : (data.results?.length || data.data?.length || 0),
      rawData: data
    });

  } catch (error: any) {
    console.error('DEBUG: Error:', error);
    return NextResponse.json({ 
      error: error.message,
      stack: error.stack 
    }, { status: 500 });
  }
}
