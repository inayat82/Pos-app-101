# Webshare Database Structure & Data Storage Plan
*Date: July 2, 2025*
*Status: Current Implementation Analysis*

## 📊 **CURRENT FIRESTORE COLLECTIONS**

Based on your Firebase screenshot and code analysis, here are the **5 Webshare collections** and their data storage:

```
📁 /superadmin/webshare/
├── 📁 config/           ← Account info, settings, credentials
├── 📁 proxies/          ← Proxy IP addresses and details  
├── 📁 sync_jobs/        ← Sync operation logs
├── 📁 dashboard/        ← Cached dashboard data
└── 📁 webshareSettings/ ← Legacy settings (to be migrated)
```

---

## 🗄️ **DETAILED DATA STORAGE MAPPING**

### **Collection 1: `config` - Account & Configuration Data**
**Path**: `/superadmin/webshare/config/main`
**Contains**: Account information, API credentials, and system settings

```typescript
// Account Information from Webshare API stored here:
{
  // API Configuration
  apiKey: string,                    // Webshare API key
  isEnabled: boolean,                // Integration status
  testStatus: 'connected|failed',    // API test result
  
  // NEW: Profile Data (from syncAccountInfo())
  profile: {
    id: number,                      // Webshare user ID
    email: string,                   // Account email
    username: string,                // Username
    first_name: string,              // User's first name
    last_name: string,               // User's last name
    created_at: string,              // Account creation date
    last_login: string,              // Last login timestamp
    timezone: string,                // User timezone
    is_verified: boolean             // Account verification status
  },
  
  // NEW: Subscription Data (from syncAccountInfo())
  subscription: {
    id: string,                      // Subscription ID
    plan_name: string,               // Plan name (e.g., "Premium")
    plan_type: string,               // Plan type
    proxy_limit: number,             // Max proxies allowed
    bandwidth_limit: number,         // Bandwidth limit
    current_usage: {
      proxy_count: number,           // Current proxy usage
      bandwidth_used: number,        // Current bandwidth used
      requests_made: number          // Total requests made
    },
    billing: {
      amount: number,                // Monthly cost
      currency: string,              // Currency (USD)
      billing_cycle: string,         // Billing frequency
      next_billing_date: string,     // Next payment date
      status: string                 // active, expired, etc.
    },
    expires_at: string,              // Subscription expiry
    auto_renew: boolean              // Auto-renewal status
  },
  
  // Sync Settings
  lastSyncAt: string,                // Last manual sync
  lastAutoSyncAt: string,            // Last automatic sync
  autoSyncEnabled: boolean,          // Auto-sync toggle
  autoSyncInterval: number,          // Sync frequency (minutes)
  
  // System Settings
  cronSettings: { ... },            // Cron job preferences
  preferences: { ... },             // User preferences
  createdAt: string,
  updatedAt: string
}
```

### **Collection 2: `proxies` - Proxy IP Database**
**Path**: `/superadmin/webshare/proxies/{docId}`
**Contains**: Individual proxy IP addresses and their details

```typescript
// Each proxy document (from syncProxies() or syncAllData()):
{
  // Proxy Identity
  id: string,                        // Our internal ID
  webshareId: string,                // Webshare's proxy ID
  
  // Connection Details
  username: string,                  // Auth username
  password: string,                  // Auth password
  proxy_address: string,             // IP address (e.g., "192.168.1.1")
  port: number,                      // Port number (e.g., 8080)
  proxy_type: string,                // HTTP, SOCKS5, etc.
  
  // Status & Validation
  valid: boolean,                    // Is proxy working?
  last_verification_status: string, // Last check result
  
  // Geographic Location
  country_code: string,              // Country (e.g., "US", "UK")
  city_name: string,                 // City name (optional)
  
  // Performance Metrics (NEW)
  performance: {
    avgResponseTime: number,         // Average response time
    successRate: number,             // Success percentage
    lastUsed: string,                // Last usage timestamp
    totalRequests: number,           // Request count
    errorCount: number               // Error count
  },
  
  // Metadata
  created_at: string,                // When proxy was created
  updated_at: string,                // Last update from Webshare
  syncedAt: string                   // When we last synced it
}
```

### **Collection 3: `sync_jobs` - Sync Operation Logs**
**Path**: `/superadmin/webshare/sync_jobs/{jobId}`
**Contains**: Logs of all sync operations for monitoring

```typescript
// Created whenever syncProxies(), syncAccountInfo(), or syncAllData() runs:
{
  id: string,                        // Job ID (e.g., "sync_1704196800000")
  status: 'started|completed|failed', // Job status
  startTime: string,                 // When sync started
  endTime: string,                   // When sync finished
  
  // Proxy Sync Results
  proxiesAdded: number,              // New proxies found
  proxiesUpdated: number,            // Existing proxies updated
  proxiesRemoved: number,            // Inactive proxies removed
  totalProxies: number,              // Total proxy count
  
  // Error Handling
  error?: string,                    // Error message if failed
  
  // NEW: Enhanced tracking
  syncType: 'proxies|account|all',   // What was synced
  dataSize: number,                  // Amount of data processed
  apiCallCount: number               // Number of API calls made
}
```

### **Collection 4: `dashboard` - Cached Dashboard Data**
**Path**: `/superadmin/webshare/dashboard/current`
**Contains**: Pre-calculated dashboard data for fast loading

```typescript
// Generated by getEnhancedDashboardData():
{
  // Account Summary
  profile: { ...profileData },       // Copy of profile from config
  subscription: { ...subscriptionData }, // Copy of subscription from config
  
  // Usage Statistics (NEW)
  usageStats: {
    total_requests: number,          // Total API requests
    success_rate: number,            // Overall success rate
    bandwidth_total: number,         // Total bandwidth used
    countries_used: object,          // Usage by country
    last_30_days: {
      requests: number,              // Recent requests
      bandwidth: number,             // Recent bandwidth
      errors: number                 // Recent errors
    }
  },
  
  // Proxy Summary
  proxySummary: {
    total: number,                   // Total proxy count
    valid: number,                   // Valid proxies
    invalid: number,                 // Invalid proxies
    countries: string[],             // Available countries
    avgResponseTime: number          // Average response time
  },
  
  lastUpdated: string                // Cache timestamp
}
```

### **Collection 5: `webshareSettings` - Legacy Settings (Migration Needed)**
**Path**: `/superadmin/webshare/webshareSettings/{docId}`
**Contains**: Old settings format (will be migrated to `config`)

```typescript
// Legacy format - TO BE MIGRATED:
{
  // Old settings that need to be moved to config collection
  oldApiKey?: string,
  oldSettings?: object,
  migrationStatus?: 'pending|completed'
}
```

---

## 🔄 **DATA FLOW: FROM API TO DATABASE**

### **When `syncAccountInfo()` is called:**
```typescript
1. 📡 Fetch from Webshare API:
   - GET /api/v2/profile/     → Profile data
   - GET /api/v2/subscription/ → Subscription data

2. 💾 Store in Database:
   - Update: /superadmin/webshare/config/main
   - Add profile and subscription fields
   - Update lastSyncAt timestamp

3. 📊 Update Dashboard Cache:
   - Refresh: /superadmin/webshare/dashboard/current
   - Include new account data
```

### **When `syncProxies()` is called:**
```typescript
1. 📡 Fetch from Webshare API:
   - GET /api/v2/proxy/list/ → All proxy data (paginated)

2. 💾 Store in Database:
   - Add/Update: /superadmin/webshare/proxies/{docId}
   - Remove inactive proxies
   - Log operation: /superadmin/webshare/sync_jobs/{jobId}

3. 📊 Update Dashboard Cache:
   - Refresh proxy counts and statistics
```

### **When `syncAllData()` is called:**
```typescript
1. 📡 Fetch from Webshare API:
   - Profile, Subscription, Proxies, Usage Stats (parallel)

2. 💾 Store in Database:
   - Update ALL collections with fresh data
   - Complete refresh of entire Webshare dataset

3. 📊 Rebuild Dashboard Cache:
   - Complete refresh with all new data
```

---

## 🎯 **COLLECTION USAGE OPTIMIZATION**

### **High-Frequency Access (Fast Queries)**
- **`config`**: Account info, settings (read on every page load)
- **`dashboard`**: Cached summary data (displayed on dashboard)

### **Medium-Frequency Access** 
- **`proxies`**: Proxy list (filtered/searched by users)
- **`sync_jobs`**: Recent sync history (monitoring tab)

### **Low-Frequency Access**
- **`webshareSettings`**: Legacy data (migration only)

---

## 📈 **DATA SIZE ESTIMATES**

### **Collection Sizes:**
```
config:           ~5KB per document  (1 document)
proxies:          ~2KB per proxy     (500-5000 proxies)
sync_jobs:        ~1KB per job       (kept last 100 jobs)
dashboard:        ~10KB              (1 document, cached)
webshareSettings: ~1KB               (legacy, minimal)

TOTAL: ~1-10MB depending on proxy count
```

### **API Call Efficiency:**
- **Account Sync**: 2 API calls → 1 database write
- **Proxy Sync**: 1-10 API calls → 500-5000 database writes (batched)
- **Full Sync**: 3-12 API calls → Complete refresh

---

## 🚀 **NEXT STEPS FOR OPTIMIZATION**

### **Immediate Actions:**
1. **Migrate Legacy Data**: Move `webshareSettings` to `config`
2. **Add Indexes**: Optimize proxy queries by country/status
3. **Clean Old Sync Jobs**: Keep only last 100 entries

### **Performance Enhancements:**
1. **Caching Strategy**: Use `dashboard` collection for fast loads
2. **Batch Operations**: Group proxy updates for efficiency
3. **Background Sync**: Use cron jobs for automated updates

### **Data Governance:**
1. **Retention Policy**: Auto-delete old sync jobs
2. **Backup Strategy**: Regular exports of critical config data
3. **Monitoring**: Track database usage and performance

---

**🎯 SUMMARY**: Your 5 collections store different aspects of the Webshare integration, with `config` holding account data, `proxies` storing IP addresses, and the others providing logging, caching, and legacy support. The modern dashboard fetches from these collections to display comprehensive business intelligence.**
