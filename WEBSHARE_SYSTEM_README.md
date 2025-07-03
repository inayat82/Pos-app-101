# Webshare Integration - Simple Working System

## Overview
This is the **ONLY** Webshare system in the application. All old/legacy files have been renamed with `old_` prefix.

## How It Works
1. **Add API Key**: Enter your Webshare API key in the Settings tab
2. **Auto-Sync**: Everything syncs automatically - proxies, account info, subscription details
3. **Dashboard**: View all data in the modern 3-tab dashboard

## File Structure (Active Files Only)
```
src/modules/webshare/
├── components/
│   ├── ModernDashboard.tsx    # Main dashboard component
│   └── index.tsx             # Component exports
├── services/
│   └── index.ts              # All backend services
├── types/
│   └── index.ts              # TypeScript definitions
├── pages/
│   └── index.tsx             # Main page wrapper
└── api/                      # API utilities
```

## API Endpoints
- **Single Endpoint**: `/api/superadmin/webshare-unified`
- **Actions**: config, proxies, dashboard, test-api, sync-proxies, sync-account, sync-all, save-config

## Database Collections (Firestore)
Only 2 collections are required:
1. `/superadmin/webshare/config` - Configuration and settings
2. `/superadmin/webshare/proxies` - Proxy data

All other collections are auto-created as needed.

## Usage
1. Go to SuperAdmin > Webshare
2. Enter API key in Settings tab
3. Click "Test API Key" to verify
4. Click "Sync All Data" to populate everything
5. View data in Account Info and Proxy Management tabs

## Auto-Sync
- Runs every hour automatically
- Updates all proxy data and account information
- Can be enabled/disabled in Settings

## Important Notes
- **NO legacy code is active** - everything with `old_` prefix is disabled
- **Single source of truth** - only ModernDashboard.tsx is the active UI
- **Automatic setup** - just add API key and everything works
- **Clean database** - only 2 required collections, others auto-created

This system is ready for production use.
