// Completely isolated test endpoint - no Firebase dependencies
export async function POST(request) {
  try {
    console.log('=== CLEAN TAKEALOT TEST (NO FIREBASE) ===');
    
    const body = await request.json();
    const { apiKey, endpoint } = body;

    if (!apiKey || !endpoint) {
      return new Response(JSON.stringify({ 
        error: 'Missing apiKey or endpoint' 
      }), { 
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Build URL exactly like Postman
    let fullEndpoint = endpoint;
    if (!endpoint.includes('?')) {
      if (endpoint.includes('/offers') || endpoint.includes('/sales')) {
        fullEndpoint += '?page_number=1&page_size=100';
      }
    }

    const url = `https://seller-api.takealot.com${fullEndpoint}`;
    
    console.log('Making request to:', url);
    console.log('API Key (first 10):', apiKey.substring(0, 10));

    // Make request exactly like Postman
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Authorization': `Key ${apiKey}`,
        'Accept': 'application/json'
      }
    });

    console.log('Response status:', response.status);
    
    const data = await response.json();
    console.log('Response data:', data);

    // Return success response
    return new Response(JSON.stringify({
      success: true,
      status: response.status,
      url: url,
      headers: {
        'Authorization': `Key ${apiKey}`,
        'Accept': 'application/json'
      },
      data: data,
      timestamp: new Date().toISOString()
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Clean test error:', error);
    return new Response(JSON.stringify({
      success: false,
      error: error.message,
      timestamp: new Date().toISOString()
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}
