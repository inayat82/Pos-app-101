# Webshare Proxy Implementation Plan for Takealot API Integration

**Date:** July 3, 2025  
**Status:** Implementation Ready  
**Priority:** High  

## Overview

This document outlines the comprehensive implementation plan for routing all Takealot sync requests (manual and cron jobs) through Webshare proxies. Based on Webshare API documentation analysis and current system architecture review.

## Current System Analysis

### ✅ Webshare Integration Status
- **Proxy Sync**: ✅ Working (full pagination, all proxies synced)
- **Dashboard**: ✅ Working (correct proxy count display)
- **API Management**: ✅ Working (test, sync, statistics endpoints)
- **Firestore Storage**: ✅ Working (proxies stored in `/superadmin/webshare/proxies`)

### ✅ Current Takealot Infrastructure  
- **Services Using Proxies**: `takealotProxyService` already integrated
- **Sync Services**: `ProductSyncService`, `SalesSyncService` already using proxy service
- **Cron Jobs**: 8+ cron jobs for different sync strategies
- **API Routes**: `/api/cron/takealot-*` endpoints for scheduled syncs

### 🔧 Current Proxy Implementation
The system **already has proxy integration**:
- `src/modules/takealot/services/proxy.service.ts` - Main proxy service
- `src/lib/salesSyncService.ts` - Uses `takealotProxyService.get()`
- `src/lib/productSyncService.ts` - Uses `takealotProxyService.get()`

**However, the actual HTTP request routing through proxies is NOT fully implemented.**

## Webshare API Documentation Analysis

### Proxy Usage Patterns
Based on https://apidocs.webshare.io/:

#### 1. **Direct Mode** (Recommended for our use)
```javascript
// Proxy object from API
{
  "id": "d-10513",
  "username": "username", 
  "password": "password",
  "proxy_address": "1.2.3.4",
  "port": 8168,
  "valid": true,
  "country_code": "US",
  "city_name": "New York"
}
```

#### 2. **HTTP Request Authentication**
Two authentication methods:
- **Username/Password**: `username:password@proxy_address:port`
- **IP Authorization**: Direct connection after IP whitelist setup

#### 3. **Rate Limits**
- General API: 180 requests/minute
- Proxy List Downloads: 20 requests/minute

## Implementation Plan

### Phase 1: Enhanced Proxy Request Infrastructure ⚡

#### 1.1 Create Enhanced makeRequest Method in webshareService
```typescript
// Add to src/modules/webshare/services/index.ts

/**
 * Make HTTP request through Webshare proxy
 */
async makeRequest(config: {
  url: string;
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE';
  headers?: Record<string, string>;
  data?: any;
  timeout?: number;
  retries?: number;
}): Promise<{
  success: boolean;
  data?: any;
  error?: string;
  statusCode?: number;
  proxyUsed?: string;
  responseTime?: number;
}> {
  // Implementation details below
}
```

#### 1.2 Update Proxy Selection Logic
```typescript
/**
 * Smart proxy selection with rotation and health checks
 */
private async getOptimalProxy(): Promise<WebshareProxy | null> {
  // Get proxies from Firestore
  // Filter valid proxies
  // Implement round-robin rotation
  // Consider geographic preference (South Africa for Takealot)
  // Track usage statistics
}
```

#### 1.3 Create Proxy Request Handler API Endpoint
```typescript
// src/app/api/proxy-request/route.ts
// Handles all HTTP requests through proxies
// Supports timeout, retries, proxy rotation
// Logs usage statistics
```

### Phase 2: Update Takealot Services ⚡

#### 2.1 Complete TakealotProxyService Implementation
**File**: `src/modules/takealot/services/proxy.service.ts`

Current issues to fix:
- `webshareService.makeRequest()` method doesn't exist yet
- Need to implement actual proxy routing logic

**New Implementation:**
```typescript
async makeRequest(
  method: 'GET' | 'POST' | 'PUT' | 'DELETE' = 'GET',
  endpoint: string,
  apiKey: string,
  params?: Record<string, any>,
  data?: any,
  options?: TakealotRequestOptions
): Promise<TakealotProxyResponse> {
  // Build full Takealot API URL
  // Get optimal proxy from webshareService
  // Make request through proxy with authentication
  // Handle retries and error cases
  // Log usage statistics
  // Return standardized response
}
```

#### 2.2 Test Integration in Existing Services
Both services already have the integration:
- ✅ `SalesSyncService.fetchSalesFromAPI()` uses `takealotProxyService.get()`
- ✅ `ProductSyncService.fetchProductsFromAPI()` uses `takealotProxyService.get()`

**Need to verify**: Actual HTTP request routing works properly

### Phase 3: Proxy Request Implementation 🔧

#### 3.1 Server-Side Proxy Handler
Since browsers cannot directly use HTTP/SOCKS proxies, implement server-side proxy routing:

```typescript
// src/app/api/proxy-request/route.ts
import { HttpsProxyAgent } from 'https-proxy-agent';
import { HttpProxyAgent } from 'http-proxy-agent';

export async function POST(request: NextRequest) {
  const { url, method, headers, data, proxyConfig } = await request.json();
  
  // Create proxy agent
  const proxyUrl = `http://${proxyConfig.username}:${proxyConfig.password}@${proxyConfig.proxy_address}:${proxyConfig.port}`;
  const agent = url.startsWith('https://') 
    ? new HttpsProxyAgent(proxyUrl)
    : new HttpProxyAgent(proxyUrl);
  
  // Make request through proxy
  const response = await fetch(url, {
    method,
    headers,
    body: data,
    // @ts-ignore - Node.js specific
    agent
  });
  
  return NextResponse.json({
    success: true,
    data: await response.json(),
    statusCode: response.status
  });
}
```

#### 3.2 Update webshareService.makeRequest()
```typescript
async makeRequest(config: ProxyRequestConfig): Promise<ProxyResponse> {
  // Get optimal proxy
  const proxy = await this.getOptimalProxy();
  
  // Make request through /api/proxy-request
  const response = await fetch('/api/proxy-request', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      url: config.url,
      method: config.method,
      headers: config.headers,
      data: config.data,
      proxyConfig: proxy
    })
  });
  
  return response.json();
}
```

### Phase 4: Cron Job Integration ✅

All cron jobs already use the services that have proxy integration:
- ✅ `takealot-hourly-100-products` → `ProductSyncService`
- ✅ `takealot-6hourly-all-products` → `ProductSyncService` 
- ✅ `takealot-nightly-sales` → `SalesSyncService`
- ✅ `takealot-hourly-30day-sales` → `SalesSyncService`
- ✅ Plus 4 more cron job variations

**No changes needed** - they will automatically use proxies once the underlying services are updated.

### Phase 5: Testing & Validation 🧪

#### 5.1 Unit Testing
- Test proxy selection algorithms
- Test request routing through proxies
- Test error handling and retries
- Test rate limiting compliance

#### 5.2 Integration Testing  
- Test all cron jobs with proxy routing
- Test manual sync operations
- Test proxy failover scenarios
- Verify Takealot API compatibility

#### 5.3 Performance Testing
- Measure request latency with/without proxies
- Test concurrent request handling
- Monitor proxy usage distribution
- Validate rate limiting effectiveness

## Implementation Priority Matrix

| Task | Priority | Effort | Dependencies |
|------|----------|--------|--------------|
| 1. Complete webshareService.makeRequest() | 🔴 Critical | Medium | Proxy Handler API |
| 2. Create /api/proxy-request endpoint | 🔴 Critical | Medium | None |
| 3. Test TakealotProxyService integration | 🟡 High | Low | Tasks 1,2 |
| 4. Validate existing cron jobs | 🟡 High | Low | Task 3 |
| 5. Performance optimization | 🟢 Medium | Medium | All above |
| 6. Monitoring & analytics | 🟢 Medium | Low | All above |

## Technical Implementation Details

### Proxy Authentication Formats

#### For Direct Connection:
```javascript
// HTTP Proxy URL format
const proxyUrl = `http://${username}:${password}@${proxy_address}:${port}`;

// Example Takealot API request through proxy
const response = await fetch('https://seller-api.takealot.com/v2/offers', {
  method: 'GET',
  headers: {
    'Authorization': 'Key YOUR_TAKEALOT_API_KEY',
    'Accept': 'application/json'
  },
  // Node.js specific - browser requests go through our proxy API
  agent: new HttpsProxyAgent(proxyUrl)
});
```

#### For Backbone Connection (Alternative):
```javascript
// Connect through p.webshare.io
const backboneUrl = `http://${username}:${password}@p.webshare.io:${port}`;
```

### Error Handling Strategy

```typescript
interface ProxyRequestResult {
  success: boolean;
  data?: any;
  error?: string;
  statusCode?: number;
  proxyUsed?: {
    id: string;
    address: string;
    country: string;
  };
  responseTime?: number;
  retryCount?: number;
}
```

### Rate Limiting Compliance

```typescript
// Implement request queuing to respect Webshare limits
class RateLimitedRequestQueue {
  private queue: RequestConfig[] = [];
  private processing = false;
  private readonly maxRequestsPerMinute = 160; // Safe margin under 180
  
  async enqueue(config: RequestConfig): Promise<ProxyRequestResult> {
    // Queue management logic
  }
}
```

## File Changes Required

### 🔧 Files to Modify

1. **`src/modules/webshare/services/index.ts`**
   - Add `makeRequest()` method
   - Add proxy selection logic
   - Add usage tracking

2. **`src/modules/takealot/services/proxy.service.ts`**
   - Fix `webshareService.makeRequest()` calls
   - Add proper error handling
   - Add request logging

3. **Create: `src/app/api/proxy-request/route.ts`**
   - Server-side proxy request handler
   - Support for HTTP/HTTPS proxy agents
   - Request/response logging

### ✅ Files Already Working
- All cron job files in `src/app/api/cron/takealot-*`
- `src/lib/salesSyncService.ts` 
- `src/lib/productSyncService.ts`
- Webshare dashboard and management

## Testing Checklist

- [ ] Proxy selection algorithm works
- [ ] HTTP requests route through proxies correctly
- [ ] Takealot API authentication works with proxies
- [ ] Error handling and retries function properly
- [ ] Rate limiting prevents API abuse
- [ ] All cron jobs work with proxy routing
- [ ] Manual sync operations work with proxies
- [ ] Proxy usage statistics are tracked
- [ ] Dashboard displays proxy usage data
- [ ] Performance is acceptable (< 5s response times)

## Success Metrics

1. **Functionality**: 100% of Takealot API requests go through Webshare proxies
2. **Reliability**: < 1% request failure rate due to proxy issues
3. **Performance**: < 3 second average response time for API calls
4. **Coverage**: All cron jobs and manual sync operations use proxies
5. **Monitoring**: Real-time proxy usage tracking and health monitoring

## Risk Mitigation

### High-Risk Scenarios
1. **Proxy Failures**: Implement automatic proxy rotation and health checks
2. **Rate Limiting**: Queue requests and respect API limits
3. **Authentication Issues**: Validate proxy credentials before use
4. **Performance Degradation**: Monitor response times and optimize proxy selection

### Fallback Strategy  
- If all proxies fail, temporarily allow direct requests with alerts
- Implement circuit breaker pattern for proxy failures
- Maintain health check endpoints for proxy validation

---

## Next Steps

1. **Immediate**: Implement `makeRequest()` method in webshareService
2. **Next**: Create `/api/proxy-request` server-side handler
3. **Then**: Test integration with existing TakealotProxyService
4. **Finally**: Validate all cron jobs and manual operations

This implementation will provide robust, scalable proxy routing for all Takealot API interactions while maintaining the existing architecture and functionality.
