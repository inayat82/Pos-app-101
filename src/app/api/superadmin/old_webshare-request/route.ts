// Auto Price Webshare Proxy Request Handler
import { NextRequest, NextResponse } from 'next/server';
import { webshareService } from '@/modules/webshare/services';
import { autoPriceWebshareService } from '@/modules/auto-price/services/old_webshare.service';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { url, options = {}, proxyId } = body;

    if (!url) {
      return NextResponse.json({
        success: false,
        error: 'URL is required'
      }, { status: 400 });
    }

    // Get Auto Price Webshare service instance
    const autoPriceWebshare = autoPriceWebshareService;

    // Ensure we have fresh proxies
    await autoPriceWebshare.refreshProxies();

    // Get next available proxy
    const proxy = await autoPriceWebshare.getNextProxy();
    if (!proxy) {
      return NextResponse.json({
        success: false,
        error: 'No available proxies found'
      }, { status: 503 });
    }

    // Prepare proxy configuration
    const proxyAuth = `${proxy.username}:${proxy.password}`;
    const proxyUrl = `http://${proxyAuth}@${proxy.proxy_address}:${proxy.port}`;

    // Default request options
    const requestOptions = {
      method: options.method || 'GET',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5',
        'Accept-Encoding': 'gzip, deflate',
        'Connection': 'keep-alive',
        'Upgrade-Insecure-Requests': '1',
        ...options.headers
      },
      timeout: options.timeout || 30000,
      ...options
    };

    const startTime = Date.now();
    let responseData: any = null;
    let error: string | null = null;
    let statusCode = 200;

    try {
      // Make the request through the proxy
      const axios = require('axios');
      const HttpsProxyAgent = require('https-proxy-agent');
      
      const agent = new HttpsProxyAgent(proxyUrl);
      
      const response = await axios({
        url,
        ...requestOptions,
        httpsAgent: agent,
        httpAgent: agent,
        proxy: false // Disable axios built-in proxy to use our agent
      });

      responseData = {
        data: response.data,
        status: response.status,
        statusText: response.statusText,
        headers: response.headers
      };
      statusCode = response.status;

      // Log successful request
      await autoPriceWebshare.logRequest({
        url,
        proxyId: proxy.id,
        proxyAddress: `${proxy.proxy_address}:${proxy.port}`,
        success: true,
        responseTime: Date.now() - startTime,
        statusCode: response.status,
        error: null,
        timestamp: new Date().toISOString()
      });

    } catch (requestError: any) {
      error = requestError.message || 'Request failed';
      statusCode = requestError.response?.status || 500;

      // Log failed request
      await autoPriceWebshare.logRequest({
        url,
        proxyId: proxy.id,
        proxyAddress: `${proxy.proxy_address}:${proxy.port}`,
        success: false,
        responseTime: Date.now() - startTime,
        statusCode,
        error,
        timestamp: new Date().toISOString()
      });

      // Mark proxy as potentially problematic if it's a proxy-related error
      if (requestError.code === 'ECONNREFUSED' || requestError.code === 'ETIMEDOUT') {
        await autoPriceWebshare.markProxyAsProblematic(proxy.id);
      }
    }

    return NextResponse.json({
      success: !error,
      data: responseData,
      error,
      proxy: {
        id: proxy.id,
        address: `${proxy.proxy_address}:${proxy.port}`,
        country: proxy.country_code
      },
      responseTime: Date.now() - startTime
    }, { status: error ? statusCode : 200 });

  } catch (error: any) {
    console.error('Auto Price Webshare Request Error:', error);
    return NextResponse.json({
      success: false,
      error: error.message || 'Internal server error'
    }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const action = searchParams.get('action');

    const autoPriceWebshare = autoPriceWebshareService;

    switch (action) {
      case 'proxy-stats':
        const stats = await autoPriceWebshare.getProxyStats();
        return NextResponse.json({
          success: true,
          data: stats
        });

      case 'refresh-proxies':
        const refreshed = await autoPriceWebshare.refreshProxies();
        return NextResponse.json({
          success: refreshed,
          message: refreshed ? 'Proxies refreshed successfully' : 'Failed to refresh proxies'
        });

      case 'request-logs':
        const page = parseInt(searchParams.get('page') || '1');
        const limit = parseInt(searchParams.get('limit') || '50');
        const logs = await autoPriceWebshare.getRequestLogs(page, limit);
        return NextResponse.json({
          success: true,
          data: logs
        });

      default:
        return NextResponse.json({
          success: false,
          error: 'Invalid action. Use: proxy-stats, refresh-proxies, or request-logs'
        }, { status: 400 });
    }

  } catch (error: any) {
    console.error('Auto Price Webshare GET Error:', error);
    return NextResponse.json({
      success: false,
      error: error.message || 'Internal server error'
    }, { status: 500 });
  }
}
