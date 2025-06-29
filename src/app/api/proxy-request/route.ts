import { NextRequest, NextResponse } from 'next/server';
import { HttpsProxyAgent } from 'https-proxy-agent';

interface ProxyRequestBody {
  url: string;
  method: string;
  headers?: Record<string, string>;
  body?: string;
  proxy: {
    host: string;
    port: number;
    username: string;
    password: string;
  };
}

export async function POST(request: NextRequest) {
  try {
    const body: ProxyRequestBody = await request.json();
    
    if (!body.url || !body.proxy) {
      return NextResponse.json(
        { error: 'Missing required fields: url and proxy' },
        { status: 400 }
      );
    }

    // Create proxy agent
    const proxyUrl = `http://${body.proxy.username}:${body.proxy.password}@${body.proxy.host}:${body.proxy.port}`;
    const agent = new HttpsProxyAgent(proxyUrl);

    // Prepare fetch options
    const fetchOptions: RequestInit = {
      method: body.method || 'GET',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        ...body.headers,
      },
      // @ts-ignore - Node.js specific option
      agent: body.url.startsWith('https') ? agent : undefined,
    };

    if (body.body && (body.method === 'POST' || body.method === 'PUT' || body.method === 'PATCH')) {
      fetchOptions.body = body.body;
    }

    // Make the request through proxy
    const response = await fetch(body.url, fetchOptions);
    
    // Get response data
    const responseText = await response.text();
    let responseData;
    
    try {
      responseData = JSON.parse(responseText);
    } catch {
      responseData = responseText;
    }

    // Return the response
    return NextResponse.json({
      success: true,
      status: response.status,
      statusText: response.statusText,
      headers: Object.fromEntries(response.headers.entries()),
      data: responseData,
    });

  } catch (error: any) {
    console.error('Proxy request failed:', error);
    
    return NextResponse.json(
      { 
        success: false,
        error: error.message || 'Proxy request failed',
        details: error.toString(),
      },
      { status: 500 }
    );
  }
}

export async function GET() {
  return NextResponse.json(
    { message: 'Proxy request endpoint. Use POST method.' },
    { status: 405 }
  );
}
