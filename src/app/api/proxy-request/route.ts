// Enhanced API endpoint for making HTTP requests through Webshare proxies
// This handles the server-side proxy routing since browsers cannot directly use HTTP/SOCKS proxies

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
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
  headers?: Record<string, string>;
  data?: any;
  timeout?: number;
  proxy: ProxyConfig;
}

export async function POST(request: NextRequest) {
  const startTime = Date.now();
  
  try {
    const requestConfig: RequestConfig = await request.json();

    if (!requestConfig.proxy || !requestConfig.url) {
      return NextResponse.json({
        success: false,
        error: 'Proxy configuration and request URL are required'
      }, { status: 400 });
    }

    const { proxy, url, method = 'GET', headers = {}, data, timeout = 30000 } = requestConfig;

    // Validate proxy configuration
    if (!proxy.host || !proxy.port || !proxy.username || !proxy.password) {
      return NextResponse.json({
        success: false,
        error: 'Complete proxy configuration required (host, port, username, password)'
      }, { status: 400 });
    }

    // Create proxy URL with authentication
    const proxyUrl = `http://${proxy.username}:${proxy.password}@${proxy.host}:${proxy.port}`;
    
    // Determine if we need HTTP or HTTPS proxy agent
    const isHttps = url.startsWith('https://');
    const agent = isHttps 
      ? new HttpsProxyAgent(proxyUrl) 
      : new HttpProxyAgent(proxyUrl);

    console.log(`[ProxyRequest] Making ${method} request to ${url} through proxy ${proxy.host}:${proxy.port}`);

    // Set up request options
    const fetchOptions: RequestInit = {
      method,
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
        ...headers,
      },
      // @ts-ignore - Node.js fetch supports agent
      agent,
      signal: AbortSignal.timeout(timeout),
    };

    // Add body for POST/PUT requests
    if (data && (method === 'POST' || method === 'PUT' || method === 'PATCH')) {
      fetchOptions.body = typeof data === 'string' ? data : JSON.stringify(data);
    }

    // Make the request through the proxy
    const response = await fetch(url, fetchOptions);
    
    // Parse response based on content type
    let responseData;
    const contentType = response.headers.get('content-type');
    
    try {
      if (contentType && contentType.includes('application/json')) {
        responseData = await response.json();
      } else {
        responseData = await response.text();
      }
    } catch (parseError) {
      console.warn('[ProxyRequest] Failed to parse response, returning raw text');
      responseData = await response.text();
    }

    const responseTime = Date.now() - startTime;
    console.log(`[ProxyRequest] Request completed in ${responseTime}ms: ${response.status} ${response.statusText}`);

    return NextResponse.json({
      success: response.ok,
      data: responseData,
      statusCode: response.status,
      statusText: response.statusText,
      headers: Object.fromEntries(response.headers.entries()),
      responseTime,
      proxy: {
        host: proxy.host,
        port: proxy.port,
        country: 'unknown' // Could be enhanced to track proxy country
      }
    });

  } catch (error: any) {
    const responseTime = Date.now() - startTime;
    console.error('[ProxyRequest] Request error:', error);
    
    let errorMessage = 'Unknown error occurred';
    let statusCode = 500;

    // Categorize common errors
    if (error.name === 'AbortError') {
      errorMessage = 'Request timeout';
      statusCode = 408;
    } else if (error.code === 'ECONNREFUSED') {
      errorMessage = 'Proxy connection refused - proxy may be offline';
      statusCode = 502;
    } else if (error.code === 'ETIMEDOUT') {
      errorMessage = 'Proxy connection timeout';
      statusCode = 504;
    } else if (error.code === 'ENOTFOUND') {
      errorMessage = 'Proxy host not found - check proxy address';
      statusCode = 502;
    } else if (error.code === 'ECONNRESET') {
      errorMessage = 'Proxy connection reset';
      statusCode = 502;
    } else if (error.code === 'EHOSTUNREACH') {
      errorMessage = 'Proxy host unreachable';
      statusCode = 502;
    } else if (error.code === 'EPROTO') {
      errorMessage = 'Proxy protocol error';
      statusCode = 502;
    } else if (error.message) {
      errorMessage = error.message;
    }

    return NextResponse.json({
      success: false,
      error: errorMessage,
      code: error.code,
      statusCode,
      responseTime
    }, { status: Math.min(statusCode, 599) }); // Ensure valid HTTP status code
  }
}

export async function GET() {
  return NextResponse.json({
    message: 'Webshare Proxy Request Handler',
    description: 'Use POST method to make HTTP requests through Webshare proxies',
    usage: {
      method: 'POST',
      body: {
        url: 'string (required)',
        method: 'GET|POST|PUT|DELETE (optional, default: GET)',
        headers: 'object (optional)',
        data: 'any (optional, for POST/PUT)',
        timeout: 'number (optional, default: 30000ms)',
        proxy: {
          host: 'string (required)',
          port: 'number (required)',
          username: 'string (required)',
          password: 'string (required)'
        }
      }
    }
  });
}
