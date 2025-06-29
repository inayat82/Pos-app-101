// API route for Webshare proxy management
import { NextRequest, NextResponse } from 'next/server';
import { saveWebshareApiKey, updateWebshareTestStatus } from '@/lib/firebase/saveWebshareApiKey';

const WEBSHARE_API_BASE = 'https://proxy.webshare.io';

interface WebshareProxy {
  id: string;
  username: string;
  password: string;
  proxy_address: string;
  port: number;
  country_code: string;
  city_name: string;
  created_at: string;
  last_verification: string;
  valid: boolean;
  asn_number?: string;
  asn_name?: string;
}

interface WebshareApiResponse {
  count: number;
  next: string | null;
  previous: string | null;
  results: WebshareProxy[];
}

interface AggregatedUsageStats {
  bandwidth_total: number;
  bandwidth_average: number;
  requests_total: number;
  requests_successful: number;
  requests_failed: number;
  error_reasons: any[]; // Simplified for this example
  countries_used: { [key: string]: number };
  number_of_proxies_used: number;
  protocols_used: { [key: string]: number };
  average_concurrency: number;
  average_rps: number;
  last_request_sent_at: string | null;
}

// Helper function to aggregate stats from multiple API calls
async function handleAggregateStats(apiToken: string, days: number) {
  try {
    const now = new Date();
    const daysAgo = new Date();
    daysAgo.setDate(now.getDate() - days);

    const statsUrl = `${WEBSHARE_API_BASE}/api/v2/stats/?timestamp__gte=${daysAgo.toISOString()}&timestamp__lte=${now.toISOString()}`;

    // Make parallel requests for profile, subscription, stats, and ip-auth
    // Try multiple subscription endpoints as they might vary
    const [profileRes, subscriptionRes, subscriptionPlanRes, statsRes, ipAuthRes] = await Promise.allSettled([
      fetch(`${WEBSHARE_API_BASE}/api/v2/profile/`, {
        headers: { 'Authorization': `Token ${apiToken}` }
      }),
      fetch(`${WEBSHARE_API_BASE}/api/v2/subscription/`, {
        headers: { 'Authorization': `Token ${apiToken}` }
      }),
      fetch(`${WEBSHARE_API_BASE}/api/v2/subscription/plan/`, {
        headers: { 'Authorization': `Token ${apiToken}` }
      }),
      fetch(statsUrl, {
        headers: { 'Authorization': `Token ${apiToken}` }
      }),
      fetch(`${WEBSHARE_API_BASE}/api/v2/ip-authorization/`, {
        headers: { 'Authorization': `Token ${apiToken}` }
      })
    ]);

    const result: any = {
      profile: null,
      subscription: null,
      usageStats: null,
      ipAuth: null,
      errors: []
    };

    // Process profile data
    if (profileRes.status === 'fulfilled' && profileRes.value.ok) {
      result.profile = await profileRes.value.json();
    } else {
      result.errors.push('Failed to fetch profile data');
    }

    // Process subscription data - try multiple endpoints
    let subscriptionFound = false;
    
    // Try primary subscription endpoint first
    if (subscriptionRes.status === 'fulfilled' && subscriptionRes.value.ok) {
      const subscriptionData = await subscriptionRes.value.json();
      console.log('Subscription endpoint response:', JSON.stringify(subscriptionData, null, 2));
      
      // Handle different response formats
      if (Array.isArray(subscriptionData) && subscriptionData.length > 0) {
        const activeSubscription = subscriptionData.find(sub => sub.is_active) || subscriptionData[0];
        result.subscription = activeSubscription;
        subscriptionFound = true;
      } else if (subscriptionData && typeof subscriptionData === 'object' && subscriptionData.id) {
        result.subscription = subscriptionData;
        subscriptionFound = true;
      }
    }
    
    // Try subscription plan endpoint if primary failed
    if (!subscriptionFound && subscriptionPlanRes.status === 'fulfilled' && subscriptionPlanRes.value.ok) {
      const subscriptionPlanData = await subscriptionPlanRes.value.json();
      console.log('Subscription plan endpoint response:', JSON.stringify(subscriptionPlanData, null, 2));
      
      if (Array.isArray(subscriptionPlanData) && subscriptionPlanData.length > 0) {
        const activeSubscription = subscriptionPlanData.find(sub => sub.is_active) || subscriptionPlanData[0];
        result.subscription = activeSubscription;
        subscriptionFound = true;
      } else if (subscriptionPlanData && typeof subscriptionPlanData === 'object' && subscriptionPlanData.id) {
        result.subscription = subscriptionPlanData;
        subscriptionFound = true;
      }
    }
    
    if (!subscriptionFound) {
      result.errors.push('Failed to fetch subscription data from any endpoint');
      result.subscription = null;
    }

    // Process stats data
    if (statsRes.status === 'fulfilled' && statsRes.value.ok) {
      const rawStats = await statsRes.value.json();
      
      if (rawStats.results && rawStats.results.length > 0) {
        const aggregatedStats: AggregatedUsageStats = rawStats.results.reduce((acc: AggregatedUsageStats, current: any) => {
          acc.bandwidth_total += current.bandwidth_total;
          acc.requests_total += current.requests_total;
          acc.requests_successful += current.requests_successful;
          acc.requests_failed += current.requests_failed;
          
          // Aggregate countries
          for (const country in current.countries_used) {
            acc.countries_used[country] = (acc.countries_used[country] || 0) + current.countries_used[country];
          }
          
          // Aggregate protocols
          for (const protocol in current.protocols_used) {
            acc.protocols_used[protocol] = (acc.protocols_used[protocol] || 0) + current.protocols_used[protocol];
          }

          // Keep track of the latest request
          if (!acc.last_request_sent_at || new Date(current.last_request_sent_at) > new Date(acc.last_request_sent_at)) {
            acc.last_request_sent_at = current.last_request_sent_at;
          }
          
          return acc;
        }, {
          bandwidth_total: 0,
          requests_total: 0,
          requests_successful: 0,
          requests_failed: 0,
          countries_used: {},
          protocols_used: {},
          last_request_sent_at: null,
          // These will be averaged later
          bandwidth_average: 0,
          average_concurrency: 0,
          average_rps: 0,
          number_of_proxies_used: 0, // This will be taken from the last entry
          error_reasons: [], // Simplified
        });

        // Calculate averages and set latest values
        const count = rawStats.results.length;
        aggregatedStats.bandwidth_average = aggregatedStats.bandwidth_total / count;
        aggregatedStats.average_concurrency = rawStats.results.reduce((sum: number, r: any) => sum + r.average_concurrency, 0) / count;
        aggregatedStats.average_rps = rawStats.results.reduce((sum: number, r: any) => sum + r.average_rps, 0) / count;
        aggregatedStats.number_of_proxies_used = rawStats.results[count - 1].number_of_proxies_used; // Get the most recent count

        result.usageStats = aggregatedStats;
      } else {
        // Set empty/default stats if no results are returned
        result.usageStats = {
          bandwidth_total: 0,
          requests_total: 0,
          requests_successful: 0,
          requests_failed: 0,
          countries_used: {},
          protocols_used: {},
          last_request_sent_at: null,
          bandwidth_average: 0,
          average_concurrency: 0,
          average_rps: 0,
          number_of_proxies_used: 0,
          error_reasons: [],
        };
      }
    } else {
      result.errors.push('Failed to fetch stats data');
    }

    // Process IP auth data
    if (ipAuthRes.status === 'fulfilled' && ipAuthRes.value.ok) {
      result.ipAuth = await ipAuthRes.value.json();
    } else {
      result.errors.push('Failed to fetch IP authorization data');
    }

    return NextResponse.json({
      success: true,
      data: result,
      action: 'aggregate-stats'
    });

  } catch (error) {
    console.error('Error in handleAggregateStats:', error);
    return NextResponse.json({
      error: 'Failed to aggregate stats data',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const apiToken = searchParams.get('apiToken');
  const action = searchParams.get('action') || 'list';
  const page = searchParams.get('page') || '1';
  const pageSize = searchParams.get('page_size') || '100';
  const days = searchParams.get('days') || '7'; // For historical stats
  
  if (!apiToken) {
    return NextResponse.json({ 
      error: 'API token is required' 
    }, { status: 400 });
  }

  try {
    let endpoint = '';
    
    switch (action) {
      case 'list':
        endpoint = `/api/v2/proxy/list/?mode=direct&page=${page}&page_size=${pageSize}`;
        break;
      case 'stats':
        endpoint = '/api/v2/stats/';
        break;
      case 'profile':
        endpoint = '/api/v2/profile/';
        break;
      case 'subscription':
        endpoint = '/api/v2/subscription/plan/';
        break;
      case 'ip-auth':
        endpoint = '/api/v2/ip-authorization/';
        break;
      case 'usage-stats':
        // Get usage statistics for specified days (default 7)
        const daysAgo = new Date();
        daysAgo.setDate(daysAgo.getDate() - parseInt(days));
        const now = new Date();
        endpoint = `/api/v2/stats/?timestamp__gte=${daysAgo.toISOString()}&timestamp__lte=${now.toISOString()}`;
        break;
      case 'recent-stats':
        // Get stats for last 24 hours
        const yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1);
        const today = new Date();
        endpoint = `/api/v2/stats/?timestamp__gte=${yesterday.toISOString()}&timestamp__lte=${today.toISOString()}`;
        break;
      case 'aggregate-stats':
        // This will be handled specially to aggregate multiple API calls
        return await handleAggregateStats(apiToken, parseInt(days));
      default:
        endpoint = `/api/v2/proxy/list/?mode=direct&page=1&page_size=10`;
    }

    console.log(`Making Webshare API request to: ${WEBSHARE_API_BASE}${endpoint}`);
    
    const response = await fetch(`${WEBSHARE_API_BASE}${endpoint}`, {
      method: 'GET',
      headers: {
        'Authorization': `Token ${apiToken}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
    });

    console.log(`Webshare API response status: ${response.status}`);

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`Webshare API error: ${response.status} ${response.statusText}`, errorText);
      
      return NextResponse.json({ 
        error: `Webshare API error: ${response.status} ${response.statusText}`,
        details: errorText
      }, { status: response.status });
    }

    const data = await response.json();
    console.log(`Webshare API response data:`, {
      count: data.count,
      resultsLength: data.results?.length,
      hasNext: !!data.next
    });

    return NextResponse.json({
      success: true,
      data,
      action
    });

  } catch (error: any) {
    console.error('Error making Webshare API request:', error);
    return NextResponse.json({ 
      error: error.message || 'Failed to fetch from Webshare API',
      details: error.toString()
    }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { apiToken, action, ...requestData } = body;
    
    if (!apiToken) {
      return NextResponse.json({ 
        error: 'API token is required' 
      }, { status: 400 });
    }

    let endpoint = '';
    let method = 'POST';
    
    switch (action) {
      case 'test-connection':
        endpoint = '/api/v2/profile/';
        method = 'GET';
        break;
      case 'download':
        endpoint = '/api/v2/proxy/download/';
        method = 'GET';
        break;
      default:
        return NextResponse.json({ 
          error: 'Invalid action' 
        }, { status: 400 });
    }

    console.log(`Making Webshare ${method} request to: ${WEBSHARE_API_BASE}${endpoint}`);
    
    const response = await fetch(`${WEBSHARE_API_BASE}${endpoint}`, {
      method,
      headers: {
        'Authorization': `Token ${apiToken}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      ...(method === 'POST' && { body: JSON.stringify(requestData) }),
    });

    console.log(`Webshare API response status: ${response.status}`);

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`Webshare API error: ${response.status} ${response.statusText}`, errorText);
      
      // Update database with failed test status
      if (action === 'test-connection') {
        try {
          await updateWebshareTestStatus({
            testStatus: 'failed',
            lastTestError: `${response.status} ${response.statusText}: ${errorText}`
          });
        } catch (dbError) {
          console.error('Failed to update test status in database:', dbError);
        }
      }
      
      return NextResponse.json({ 
        error: `Webshare API error: ${response.status} ${response.statusText}`,
        details: errorText
      }, { status: response.status });
    }

    const data = await response.json();
    console.log(`Webshare API response successful for action: ${action}`);

    // If test connection was successful, save the API key to database
    if (action === 'test-connection') {
      try {
        await saveWebshareApiKey({
          apiKey: apiToken,
          testStatus: 'connected'
        });
        console.log('API key saved to database successfully');
      } catch (dbError) {
        console.error('Failed to save API key to database:', dbError);
        // Don't fail the request, just log the error
      }
    }

    return NextResponse.json({
      success: true,
      data,
      action
    });

  } catch (error: any) {
    console.error('Error in Webshare API POST request:', error);
    
    // Update database with failed test status if this was a test connection
    const body = await request.json().catch(() => ({}));
    if (body.action === 'test-connection') {
      try {
        await updateWebshareTestStatus({
          testStatus: 'failed',
          lastTestError: error.message || 'Unknown error'
        });
      } catch (dbError) {
        console.error('Failed to update test status in database:', dbError);
      }
    }
    
    return NextResponse.json({ 
      error: error.message || 'Failed to process Webshare API request',
      details: error.toString()
    }, { status: 500 });
  }
}
