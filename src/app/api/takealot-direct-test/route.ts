import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    console.log('=== DIRECT TAKEALOT TEST ===');
    
    const { apiKey, endpoint } = await request.json();

    if (!apiKey || !endpoint) {
      return NextResponse.json({ 
        error: 'Missing apiKey or endpoint' 
      }, { status: 400 });
    }

    // Build the full URL
    let fullEndpoint = endpoint;
    if (!endpoint.includes('?')) {
      if (endpoint.includes('/offers') || endpoint.includes('/sales')) {
        fullEndpoint += '?page_number=1&page_size=10';
      }
    }

    const url = `https://seller-api.takealot.com${fullEndpoint}`;
    
    console.log('Testing URL:', url);
    console.log('API Key length:', apiKey.length);
    console.log('API Key first 10:', apiKey.substring(0, 10));    // Make request to Takealot
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Authorization': `Key ${apiKey}`,
        'Accept': 'application/json',
        'User-Agent': 'POS-App-Test/1.0'
      }
    });

    console.log('Takealot response status:', response.status);
    console.log('Takealot response headers:', Object.fromEntries(response.headers.entries()));

    const data = await response.json();
    console.log('Takealot response data:', data);

    return NextResponse.json({
      success: response.ok,
      status: response.status,
      url: url,
      headers: {
        'Authorization': `Key ${apiKey}`,
        'Accept': 'application/json'
      },
      data: data,
      timestamp: new Date().toISOString()
    });

  } catch (error: any) {
    console.error('Direct test error:', error);
    return NextResponse.json({
      success: false,
      error: error.message,
      timestamp: new Date().toISOString()
    }, { status: 500 });
  }
}
