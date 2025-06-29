// API endpoint for making HTTP requests through Webshare proxies
import { NextRequest, NextResponse } from 'next/server';
import { HttpsProxyAgent } from 'https-proxy-agent';
import { HttpProxyAgent } from 'http-proxy-agent';

interface ProxyConfig {
  host: string;
  port: number;
  username: string;
  password: string;
}

interface RequestConfig {
  url: string;
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE';
  headers?: Record<string, string>;
  body?: any;
  timeout?: number;
}

export async function POST(request: NextRequest) {
  try {
    const { proxy, request: requestConfig }: {
      proxy: ProxyConfig;
      request: RequestConfig;
    } = await request.json();

    if (!proxy || !requestConfig?.url) {
      return NextResponse.json({
        success: false,
        error: 'Proxy configuration and request URL are required'
      }, { status: 400 });
    }

    // Create proxy URL with authentication
    const proxyUrl = `http://${proxy.username}:${proxy.password}@${proxy.host}:${proxy.port}`;
    
    // Determine if we need HTTP or HTTPS proxy agent
    const isHttps = requestConfig.url.startsWith('https://');
    const agent = isHttps 
      ? new HttpsProxyAgent(proxyUrl) 
      : new HttpProxyAgent(proxyUrl);

    console.log(`Making ${requestConfig.method || 'GET'} request to ${requestConfig.url} through proxy ${proxy.host}:${proxy.port}`);

    // Make the request through the proxy
    const fetchOptions: RequestInit = {
      method: requestConfig.method || 'GET',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
        ...requestConfig.headers,
      },
      // @ts-ignore - Node.js fetch supports agent
      agent,
      signal: AbortSignal.timeout(requestConfig.timeout || 30000),
    };

    if (requestConfig.body && (requestConfig.method === 'POST' || requestConfig.method === 'PUT')) {
      fetchOptions.body = typeof requestConfig.body === 'string' 
        ? requestConfig.body 
        : JSON.stringify(requestConfig.body);
    }

    const response = await fetch(requestConfig.url, fetchOptions);
    
    let responseData;
    const contentType = response.headers.get('content-type');
    
    if (contentType && contentType.includes('application/json')) {
      responseData = await response.json();
    } else {
      responseData = await response.text();
    }

    console.log(`Proxy request completed: ${response.status} ${response.statusText}`);

    return NextResponse.json({
      success: response.ok,
      data: responseData,
      statusCode: response.status,
      headers: Object.fromEntries(response.headers.entries()),
      proxy: {
        host: proxy.host,
        port: proxy.port
      }
    });

  } catch (error: any) {
    console.error('Proxy request error:', error);
    
    let errorMessage = 'Unknown error occurred';
    let statusCode = 500;

    if (error.name === 'AbortError') {
      errorMessage = 'Request timeout';
      statusCode = 408;
    } else if (error.code === 'ECONNREFUSED') {
      errorMessage = 'Proxy connection refused';
      statusCode = 502;
    } else if (error.code === 'ETIMEDOUT') {
      errorMessage = 'Proxy connection timeout';
      statusCode = 504;
    } else if (error.message) {
      errorMessage = error.message;
    }

    return NextResponse.json({
      success: false,
      error: errorMessage,
      code: error.code,
      statusCode
    }, { status: statusCode });
  }
}
