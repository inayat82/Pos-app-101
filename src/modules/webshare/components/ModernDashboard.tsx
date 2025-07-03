'use client';

import React, { useState, useEffect } from 'react';
import { 
  Card, 
  CardContent, 
  CardDescription, 
  CardHeader, 
  CardTitle 
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { 
  CheckCircle, 
  XCircle, 
  RefreshCw, 
  Settings, 
  Monitor, 
  Database,
  AlertCircle,
  Loader2,
  User,
  Server,
  Globe,
  Clock,
  TrendingUp,
  DollarSign,
  Wifi,
  MapPin,
  Eye,
  EyeOff
} from 'lucide-react';
import { 
  WebshareConfig, 
  WebshareProxy, 
  SystemStatus,
  ApiResponse,
  WebshareDashboardData 
} from '../types';

// Modern Webshare Dashboard with 3 Tabs
export default function WebshareModernDashboard() {
  const [config, setConfig] = useState<WebshareConfig | null>(null);
  const [proxies, setProxies] = useState<WebshareProxy[]>([]);
  const [dashboardData, setDashboardData] = useState<WebshareDashboardData | null>(null);
  const [systemStatus, setSystemStatus] = useState<SystemStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [testing, setTesting] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [alert, setAlert] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [activeTab, setActiveTab] = useState<'account' | 'proxies' | 'settings'>('account');
  
  // Pagination state for proxy list
  const [currentPage, setCurrentPage] = useState(1);
  const [proxiesPerPage] = useState(50);
  
  const [formData, setFormData] = useState({
    apiKey: '',
    isEnabled: false,
    syncInterval: 60,
    maxRetries: 3,
    timeout: 30000
  });

  useEffect(() => {
    loadData();
    const interval = setInterval(loadData, 60000); // Refresh every minute
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (alert) {
      const timer = setTimeout(() => setAlert(null), 5000);
      return () => clearTimeout(timer);
    }
  }, [alert]);

  const loadData = async () => {
    try {
      console.log('🔄 Starting dashboard data load...');
      const startTime = performance.now();
      
      const [configResponse, proxiesResponse, statusResponse] = await Promise.all([
        fetch('/api/superadmin/webshare-unified?action=config'),
        fetch('/api/superadmin/webshare-unified?action=proxies&limit=100'), // Start with smaller batch for faster loading
        fetch('/api/superadmin/webshare-unified?action=status')
      ]);

      const [configData, proxiesData, statusData] = await Promise.all([
        configResponse.json(),
        proxiesResponse.json(),
        statusResponse.json()
      ]);

      const endTime = performance.now();
      console.log(`✅ Dashboard data loaded in ${(endTime - startTime).toFixed(2)}ms`);

      if (configData.success) {
        setConfig(configData.data);
        setFormData({
          apiKey: configData.data.apiKey || '',
          isEnabled: configData.data.isEnabled || false,
          syncInterval: configData.data.syncInterval || 60,
          maxRetries: configData.data.maxRetries || 3,
          timeout: configData.data.timeout || 30000
        });
      }

      if (proxiesData.success) {
        setProxies(proxiesData.data.proxies || []);
      }

      if (statusData.success) {
        setSystemStatus(statusData.data);
      }

      // Load dashboard data if API is configured
      if (configData.data?.apiKey && configData.data?.testStatus === 'connected') {
        await loadDashboardData();
      }
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
    }
  };

  // Load dashboard data from Webshare API
  const loadDashboardData = async () => {
    try {
      const response = await fetch('/api/superadmin/webshare-unified?action=dashboard');
      const data: ApiResponse<WebshareDashboardData> = await response.json();
      
      if (data.success && data.data) {
        setDashboardData(data.data);
      }
    } catch (error) {
      console.error('Error loading dashboard data:', error);
    }
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      
      const response = await fetch('/api/superadmin/webshare-unified?action=save-config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      });

      const data: ApiResponse = await response.json();
      
      if (data.success) {
        setAlert({ type: 'success', message: 'Configuration saved successfully' });
        await loadData();
      } else {
        setAlert({ type: 'error', message: data.message || 'Failed to save configuration' });
      }
    } catch (error) {
      console.error('Error saving config:', error);
      setAlert({ type: 'error', message: 'Failed to save configuration' });
    } finally {
      setSaving(false);
    }
  };

  const handleTestApi = async () => {
    if (!formData.apiKey.trim()) {
      setAlert({ type: 'error', message: 'Please enter an API key' });
      return;
    }

    try {
      setTesting(true);
      
      const response = await fetch('/api/superadmin/webshare-unified?action=test-api', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ apiKey: formData.apiKey })
      });

      const data: ApiResponse = await response.json();
      
      if (data.success && data.data.success) {
        setAlert({ 
          type: 'success', 
          message: `API key is valid! Found ${data.data.proxyCount || 0} proxies.` 
        });
        await loadData();
        await loadDashboardData();
      } else {
        setAlert({ 
          type: 'error', 
          message: data.data?.error || 'API key test failed' 
        });
      }
    } catch (error) {
      console.error('Error testing API:', error);
      setAlert({ type: 'error', message: 'Failed to test API key' });
    } finally {
      setTesting(false);
    }
  };

  // Load more proxies when needed (for pagination)
  const loadMoreProxies = async (limit: number = 1000) => {
    try {
      const response = await fetch(`/api/superadmin/webshare-unified?action=proxies&limit=${limit}`);
      const data = await response.json();
      
      if (data.success) {
        setProxies(data.data.proxies || []);
      }
    } catch (error) {
      console.error('Error loading more proxies:', error);
    }
  };

  const handleSyncProxies = async () => {
    try {
      setSyncing(true);
      
      const response = await fetch('/api/superadmin/webshare-unified?action=sync-proxies', {
        method: 'POST'
      });

      const data: ApiResponse = await response.json();
      
      if (data.success) {
        setAlert({ type: 'success', message: data.message || 'Proxies synced successfully' });
        await loadData();
      } else {
        setAlert({ type: 'error', message: data.message || 'Failed to sync proxies' });
      }
    } catch (error) {
      console.error('Error syncing proxies:', error);
      setAlert({ type: 'error', message: 'Failed to sync proxies' });
    } finally {
      setSyncing(false);
    }
  };

  const handleSyncAccount = async () => {
    try {
      setSyncing(true);
      
      const response = await fetch('/api/superadmin/webshare-unified?action=sync-account', {
        method: 'POST'
      });

      const data: ApiResponse = await response.json();
      
      if (data.success) {
        setAlert({ type: 'success', message: data.message || 'Account info synced successfully' });
        await loadData();
      } else {
        setAlert({ type: 'error', message: data.message || 'Failed to sync account info' });
      }
    } catch (error) {
      console.error('Error syncing account:', error);
      setAlert({ type: 'error', message: 'Failed to sync account info' });
    } finally {
      setSyncing(false);
    }
  };

  const handleSyncAll = async () => {
    try {
      setSyncing(true);
      
      const response = await fetch('/api/superadmin/webshare-unified?action=sync-all', {
        method: 'POST'
      });

      const data: ApiResponse = await response.json();
      
      if (data.success) {
        setAlert({ type: 'success', message: data.message || 'All data synced successfully' });
        await loadData();
      } else {
        setAlert({ type: 'error', message: data.message || 'Failed to sync all data' });
      }
    } catch (error) {
      console.error('Error syncing all data:', error);
      setAlert({ type: 'error', message: 'Failed to sync all data' });
    } finally {
      setSyncing(false);
    }
  };

  // Auto-sync function
  const handleAutoSync = async () => {
    try {
      setSyncing(true);
      
      // Sync proxies
      await handleSyncProxies();
      
      // Load account data
      await loadDashboardData();
      
      setAlert({ type: 'success', message: 'Auto-sync completed successfully' });
    } catch (error) {
      console.error('Auto-sync error:', error);
      setAlert({ type: 'error', message: 'Auto-sync failed' });
    } finally {
      setSyncing(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4" />
          <p>Loading Webshare Dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center space-x-3">
              <Globe className="h-8 w-8 text-blue-600" />
              <div>
                <h1 className="text-xl font-bold text-gray-900">Webshare Management</h1>
                <p className="text-sm text-gray-600">Comprehensive proxy management dashboard</p>
              </div>
            </div>
            <div className="flex items-center space-x-4">
              {systemStatus && (
                <Badge variant={systemStatus.isEnabled && systemStatus.testStatus === 'connected' ? 'default' : 'destructive'}>
                  {systemStatus.isEnabled && systemStatus.testStatus === 'connected' ? 'Connected' : 'Disconnected'}
                </Badge>
              )}
              <Button onClick={handleAutoSync} disabled={syncing} size="sm">
                {syncing ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                ) : (
                  <RefreshCw className="h-4 w-4 mr-2" />
                )}
                Auto Sync
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Alert */}
      {alert && (
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-4">
          <Alert className={alert.type === 'error' ? 'border-red-500 bg-red-50 text-red-700' : 'border-green-500 bg-green-50 text-green-700'}>
            {alert.type === 'error' ? (
              <AlertCircle className="h-4 w-4" />
            ) : (
              <CheckCircle className="h-4 w-4" />
            )}
            <AlertDescription>{alert.message}</AlertDescription>
          </Alert>
        </div>
      )}

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <Tabs value={activeTab} onValueChange={(value: any) => {
          setActiveTab(value);
          // Load all proxies when switching to proxies tab
          if (value === 'proxies' && proxies.length < 200) {
            loadMoreProxies(10000);
          }
        }} className="space-y-6">
          {/* Tab Navigation */}
          <TabsList className="grid w-full grid-cols-3 bg-white border">
            <TabsTrigger value="account" className="flex items-center space-x-2">
              <User className="h-4 w-4" />
              <span>Account Information</span>
            </TabsTrigger>
            <TabsTrigger value="proxies" className="flex items-center space-x-2">
              <Server className="h-4 w-4" />
              <span>Proxy Management</span>
            </TabsTrigger>
            <TabsTrigger value="settings" className="flex items-center space-x-2">
              <Settings className="h-4 w-4" />
              <span>Settings & Configuration</span>
            </TabsTrigger>
          </TabsList>

          {/* Tab 1: Account Information */}
          <TabsContent value="account" className="space-y-6">
            <AccountInformationTab 
              dashboardData={dashboardData} 
              loading={loading}
              onRefresh={loadDashboardData}
              onSyncAccount={handleSyncAccount}
              syncing={syncing}
            />
          </TabsContent>

          {/* Tab 2: Proxy Management */}
          <TabsContent value="proxies" className="space-y-6">
            <ProxyManagementTab 
              proxies={proxies}
              loading={loading}
              onSync={handleSyncProxies}
              onSyncAccount={handleSyncAccount}
              onSyncAll={handleSyncAll}
              syncing={syncing}
              currentPage={currentPage}
              setCurrentPage={setCurrentPage}
              proxiesPerPage={proxiesPerPage}
            />
          </TabsContent>

          {/* Tab 3: Settings & Configuration */}
          <TabsContent value="settings" className="space-y-6">
            <SettingsConfigurationTab 
              config={config}
              formData={formData}
              onFormDataChange={setFormData}
              onSave={handleSave}
              onTest={handleTestApi}
              saving={saving}
              testing={testing}
            />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}

// Account Information Tab Component
function AccountInformationTab({ 
  dashboardData, 
  loading, 
  onRefresh,
  onSyncAccount,
  syncing 
}: {
  dashboardData: WebshareDashboardData | null;
  loading: boolean;
  onRefresh: () => void;
  onSyncAccount?: () => void;
  syncing?: boolean;
}) {
  if (loading || !dashboardData) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {[...Array(6)].map((_, i) => (
          <Card key={i} className="animate-pulse">
            <CardHeader>
              <div className="h-4 bg-gray-200 rounded w-3/4"></div>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <div className="h-3 bg-gray-200 rounded"></div>
                <div className="h-3 bg-gray-200 rounded w-5/6"></div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Account Actions Header */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span className="flex items-center space-x-2">
              <User className="h-5 w-5" />
              <span>Account Information</span>
            </span>
            <div className="flex space-x-2">
              <Button onClick={onRefresh} disabled={syncing} variant="outline" size="sm">
                <RefreshCw className="h-4 w-4 mr-2" />
                Refresh
              </Button>
              {onSyncAccount && (
                <Button onClick={onSyncAccount} disabled={syncing} size="sm">
                  {syncing ? (
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  ) : (
                    <User className="h-4 w-4 mr-2" />
                  )}
                  Sync Account Data
                </Button>
              )}
            </div>
          </CardTitle>
        </CardHeader>
      </Card>

      {/* Profile Overview */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Account Profile</CardTitle>
            <User className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <div className="text-2xl font-bold">
                {dashboardData.profile?.first_name} {dashboardData.profile?.last_name}
              </div>
              <p className="text-sm text-muted-foreground">
                {dashboardData.profile?.email}
              </p>
              <Badge variant={dashboardData.profile?.is_verified ? 'default' : 'secondary'}>
                {dashboardData.profile?.is_verified ? 'Verified' : 'Unverified'}
              </Badge>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Subscription Plan</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <div className="text-2xl font-bold">
                {dashboardData.subscription?.plan_name || 'N/A'}
              </div>
              <p className="text-sm text-muted-foreground">
                {dashboardData.subscription?.plan_type}
              </p>
              <Badge variant={dashboardData.subscription?.billing.status === 'active' ? 'default' : 'destructive'}>
                {dashboardData.subscription?.billing.status || 'Unknown'}
              </Badge>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Proxy Usage</CardTitle>
            <Server className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <div className="text-2xl font-bold">
                {dashboardData.proxySummary?.total || 0}
              </div>
              <p className="text-sm text-muted-foreground">
                {dashboardData.proxySummary?.valid || 0} valid proxies
              </p>
              <div className="text-sm">
                Success Rate: {((dashboardData.proxySummary?.valid || 0) / (dashboardData.proxySummary?.total || 1) * 100).toFixed(1)}%
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Usage Statistics */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <TrendingUp className="h-5 w-5" />
              <span>Usage Statistics</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-sm text-muted-foreground">Total Requests</p>
                <p className="text-2xl font-bold">{dashboardData.usageStats?.total_requests?.toLocaleString() || 0}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Success Rate</p>
                <p className="text-2xl font-bold text-green-600">
                  {dashboardData.usageStats?.success_rate?.toFixed(1) || 0}%
                </p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Bandwidth Used</p>
                <p className="text-2xl font-bold">
                  {((dashboardData.usageStats?.bandwidth_total || 0) / (1024 * 1024 * 1024)).toFixed(2)} GB
                </p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Countries</p>
                <p className="text-2xl font-bold">
                  {Object.keys(dashboardData.usageStats?.countries_used || {}).length}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <Clock className="h-5 w-5" />
              <span>Billing Information</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-3">
              <div className="flex justify-between">
                <span className="text-sm text-muted-foreground">Plan Cost:</span>
                <span className="font-medium">
                  {dashboardData.subscription?.billing.currency} {dashboardData.subscription?.billing.amount}
                  /{dashboardData.subscription?.billing.billing_cycle}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-muted-foreground">Next Billing:</span>
                <span className="font-medium">
                  {dashboardData.subscription?.billing.next_billing_date ? 
                    new Date(dashboardData.subscription.billing.next_billing_date).toLocaleDateString() : 'N/A'}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-muted-foreground">Auto Renew:</span>
                <Badge variant={dashboardData.subscription?.auto_renew ? 'default' : 'secondary'}>
                  {dashboardData.subscription?.auto_renew ? 'Enabled' : 'Disabled'}
                </Badge>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

// Proxy Management Tab Component
function ProxyManagementTab({ 
  proxies, 
  loading, 
  onSync, 
  syncing,
  onSyncAccount,
  onSyncAll,
  currentPage,
  setCurrentPage,
  proxiesPerPage 
}: {
  proxies: WebshareProxy[];
  loading: boolean;
  onSync: () => void;
  syncing: boolean;
  onSyncAccount?: () => void;
  onSyncAll?: () => void;
  currentPage: number;
  setCurrentPage: (page: number) => void;
  proxiesPerPage: number;
}) {
  const [searchTerm, setSearchTerm] = useState('');
  const [countryFilter, setCountryFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'valid' | 'invalid'>('all');

  const filteredProxies = proxies.filter(proxy => {
    const matchesSearch = proxy.proxy_address.includes(searchTerm) || 
                         proxy.country_code.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCountry = !countryFilter || proxy.country_code === countryFilter;
    const matchesStatus = statusFilter === 'all' || 
                         (statusFilter === 'valid' && proxy.valid) || 
                         (statusFilter === 'invalid' && !proxy.valid);
    
    return matchesSearch && matchesCountry && matchesStatus;
  });

  const countries = [...new Set(proxies.map(p => p.country_code))].sort();
  const validProxies = proxies.filter(p => p.valid).length;

  // Reset to first page when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, countryFilter, statusFilter]);

  // Pagination logic
  const indexOfLastProxy = currentPage * proxiesPerPage;
  const indexOfFirstProxy = indexOfLastProxy - proxiesPerPage;
  const currentProxies = filteredProxies.slice(indexOfFirstProxy, indexOfLastProxy);

  return (
    <div className="space-y-6">
      {/* Proxy Statistics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <Card>
          <CardContent className="flex items-center justify-between p-6">
            <div>
              <p className="text-sm font-medium text-muted-foreground">Total Proxies</p>
              <p className="text-2xl font-bold">{proxies.length}</p>
            </div>
            <Server className="h-8 w-8 text-blue-600" />
          </CardContent>
        </Card>

        <Card>
          <CardContent className="flex items-center justify-between p-6">
            <div>
              <p className="text-sm font-medium text-muted-foreground">Valid Proxies</p>
              <p className="text-2xl font-bold text-green-600">{validProxies}</p>
            </div>
            <CheckCircle className="h-8 w-8 text-green-600" />
          </CardContent>
        </Card>

        <Card>
          <CardContent className="flex items-center justify-between p-6">
            <div>
              <p className="text-sm font-medium text-muted-foreground">Countries</p>
              <p className="text-2xl font-bold">{countries.length}</p>
            </div>
            <MapPin className="h-8 w-8 text-purple-600" />
          </CardContent>
        </Card>

        <Card>
          <CardContent className="flex items-center justify-between p-6">
            <div>
              <p className="text-sm font-medium text-muted-foreground">Success Rate</p>
              <p className="text-2xl font-bold text-green-600">
                {proxies.length > 0 ? ((validProxies / proxies.length) * 100).toFixed(1) : 0}%
              </p>
            </div>
            <TrendingUp className="h-8 w-8 text-green-600" />
          </CardContent>
        </Card>
      </div>

      {/* Filters and Controls */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span className="flex items-center space-x-2">
              <Database className="h-5 w-5" />
              <span>Proxy Management</span>
            </span>
            <div className="flex space-x-2">
              <Button onClick={onSync} disabled={syncing} variant="outline" size="sm">
                {syncing ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                ) : (
                  <RefreshCw className="h-4 w-4 mr-2" />
                )}
                Sync Proxies
              </Button>
              {onSyncAccount && (
                <Button onClick={onSyncAccount} disabled={syncing} variant="outline" size="sm">
                  <User className="h-4 w-4 mr-2" />
                  Sync Account
                </Button>
              )}
              {onSyncAll && (
                <Button onClick={onSyncAll} disabled={syncing} size="sm">
                  <Globe className="h-4 w-4 mr-2" />
                  Sync All Data
                </Button>
              )}
            </div>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <Label htmlFor="search">Search Proxies</Label>
              <Input
                id="search"
                placeholder="Search by IP or country..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="country">Filter by Country</Label>
              <select 
                id="country"
                className="w-full p-2 border rounded-md"
                value={countryFilter}
                onChange={(e) => setCountryFilter(e.target.value)}
              >
                <option value="">All Countries</option>
                {countries.map(country => (
                  <option key={country} value={country}>{country}</option>
                ))}
              </select>
            </div>
            <div>
              <Label htmlFor="status">Filter by Status</Label>
              <select 
                id="status"
                className="w-full p-2 border rounded-md"
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value as any)}
              >
                <option value="all">All Status</option>
                <option value="valid">Valid Only</option>
                <option value="invalid">Invalid Only</option>
              </select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Proxy List */}
      <Card>
        <CardHeader>
          <CardTitle>Proxy List ({filteredProxies.length} proxies)</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full table-auto">
              <thead>
                <tr className="border-b">
                  <th className="text-left p-2">Proxy Address</th>
                  <th className="text-left p-2">Location</th>
                  <th className="text-left p-2">Status</th>
                  <th className="text-left p-2">Type</th>
                  <th className="text-left p-2">Last Updated</th>
                </tr>
              </thead>
              <tbody>
                {currentProxies.map((proxy) => (
                  <tr key={proxy.id} className="border-b hover:bg-gray-50">
                    <td className="p-2 font-mono text-sm">
                      {proxy.proxy_address}:{proxy.port}
                    </td>
                    <td className="p-2">
                      <div className="flex items-center space-x-2">
                        <span className="text-sm">{proxy.city_name || 'Unknown'}</span>
                        <Badge variant="outline">{proxy.country_code}</Badge>
                      </div>
                    </td>
                    <td className="p-2">
                      <Badge variant={proxy.valid ? 'default' : 'destructive'}>
                        {proxy.valid ? 'Valid' : 'Invalid'}
                      </Badge>
                    </td>
                    <td className="p-2">
                      <Badge variant="secondary">{proxy.proxy_type}</Badge>
                    </td>
                    <td className="p-2 text-sm text-muted-foreground">
                      {new Date(proxy.updated_at).toLocaleDateString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {filteredProxies.length > 50 && (
              <div className="mt-4 text-center text-sm text-muted-foreground">
                Showing {currentProxies.length} of {filteredProxies.length} proxies
              </div>
            )}
            {filteredProxies.length === 0 && (
              <div className="text-center py-8 text-muted-foreground">
                No proxies found matching your filters
              </div>
            )}
          </div>

          {/* Pagination Controls */}
          {filteredProxies.length > proxiesPerPage && (
            <div className="mt-4 flex items-center justify-between">
              <Button 
                onClick={() => setCurrentPage(Math.max(currentPage - 1, 1))} 
                disabled={currentPage === 1}
                variant="outline"
                size="sm"
                className="flex items-center space-x-2"
              >
                <RefreshCw className="h-4 w-4" />
                <span>Previous</span>
              </Button>
              <span className="text-sm text-gray-600">
                Page {currentPage} of {Math.ceil(filteredProxies.length / proxiesPerPage)}
              </span>
              <Button 
                onClick={() => setCurrentPage(currentPage + 1)} 
                disabled={currentPage * proxiesPerPage >= filteredProxies.length}
                variant="outline"
                size="sm"
                className="flex items-center space-x-2"
              >
                <span>Next</span>
                <RefreshCw className="h-4 w-4" />
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// Settings & Configuration Tab Component
function SettingsConfigurationTab({ 
  config, 
  formData, 
  onFormDataChange, 
  onSave, 
  onTest, 
  saving, 
  testing 
}: {
  config: WebshareConfig | null;
  formData: any;
  onFormDataChange: (data: any) => void;
  onSave: () => void;
  onTest: () => void;
  saving: boolean;
  testing: boolean;
}) {
  const [showApiKey, setShowApiKey] = useState(false);

  return (
    <div className="space-y-6">
      {/* API Configuration */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Settings className="h-5 w-5" />
            <span>API Configuration</span>
          </CardTitle>
          <CardDescription>
            Configure your Webshare API key and connection settings
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="apiKey">API Key</Label>
              <div className="relative">
                <Input
                  id="apiKey"
                  type={showApiKey ? "text" : "password"}
                  placeholder="Enter your Webshare API key"
                  value={formData.apiKey}
                  onChange={(e) => onFormDataChange({ ...formData, apiKey: e.target.value })}
                  className="pr-10"
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                  onClick={() => setShowApiKey(!showApiKey)}
                  tabIndex={-1}
                >
                  {showApiKey ? (
                    <EyeOff className="h-4 w-4 text-gray-400" />
                  ) : (
                    <Eye className="h-4 w-4 text-gray-400" />
                  )}
                  <span className="sr-only">
                    {showApiKey ? "Hide" : "Show"} API key
                  </span>
                </Button>
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="timeout">Timeout (ms)</Label>
              <Input
                id="timeout"
                type="number"
                value={formData.timeout}
                onChange={(e) => onFormDataChange({ ...formData, timeout: parseInt(e.target.value) })}
              />
            </div>
          </div>
          
          <div className="flex items-center space-x-2">
            <input
              type="checkbox"
              id="isEnabled"
              checked={formData.isEnabled}
              onChange={(e) => onFormDataChange({ ...formData, isEnabled: e.target.checked })}
              className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
            />
            <Label htmlFor="isEnabled">Enable Webshare Integration</Label>
          </div>

          <div className="flex space-x-2">
            <Button onClick={onTest} disabled={testing || !formData.apiKey.trim()}>
              {testing ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <Wifi className="h-4 w-4 mr-2" />
              )}
              Test Connection
            </Button>
            <Button onClick={onSave} disabled={saving}>
              {saving ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <CheckCircle className="h-4 w-4 mr-2" />
              )}
              Save Configuration
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Cron & Automation Settings */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Clock className="h-5 w-5" />
            <span>Cron & Automation Settings</span>
          </CardTitle>
          <CardDescription>
            Configure automatic sync intervals and scheduling
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="syncInterval">Sync Interval (minutes)</Label>
              <Input
                id="syncInterval"
                type="number"
                value={formData.syncInterval}
                onChange={(e) => onFormDataChange({ ...formData, syncInterval: parseInt(e.target.value) })}
              />
              <p className="text-sm text-muted-foreground">How often to sync proxy data automatically</p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="maxRetries">Max Retries</Label>
              <Input
                id="maxRetries"
                type="number"
                value={formData.maxRetries}
                onChange={(e) => onFormDataChange({ ...formData, maxRetries: parseInt(e.target.value) })}
              />
              <p className="text-sm text-muted-foreground">Maximum retry attempts for failed requests</p>
            </div>
          </div>

          <div className="space-y-3">
            <div className="flex items-center space-x-2">
              <input
                type="checkbox"
                id="autoSync"
                checked={config?.autoSyncEnabled || false}
                onChange={() => {}}
                className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
              />
              <Label htmlFor="autoSync">Enable Automatic Hourly Sync</Label>
            </div>
            <p className="text-sm text-muted-foreground">
              Last auto-sync: {config?.lastAutoSyncAt ? new Date(config.lastAutoSyncAt).toLocaleString() : 'Never'}
            </p>
          </div>
        </CardContent>
      </Card>

      {/* System Status */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Monitor className="h-5 w-5" />
            <span>System Status</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <p className="text-sm text-muted-foreground">Connection Status</p>
              <div className="flex items-center space-x-2 mt-1">
                {config?.testStatus === 'connected' ? (
                  <CheckCircle className="h-4 w-4 text-green-600" />
                ) : (
                  <XCircle className="h-4 w-4 text-red-600" />
                )}
                <span className="font-medium">
                  {config?.testStatus === 'connected' ? 'Connected' : 'Not Connected'}
                </span>
              </div>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Last Sync</p>
              <p className="font-medium mt-1">
                {config?.lastSyncAt ? new Date(config.lastSyncAt).toLocaleString() : 'Never'}
              </p>
            </div>
          </div>

          {/* Database Collections Status */}
          <div className="mt-6 border-t pt-6">
            <h4 className="text-sm font-medium mb-3">Database Collections Status</h4>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <div className="flex items-center space-x-2 p-2 bg-gray-50 rounded">
                <Database className="h-4 w-4 text-blue-600" />
                <div>
                  <p className="text-xs font-medium">config</p>
                  <p className="text-xs text-gray-600">Settings & API</p>
                </div>
              </div>
              <div className="flex items-center space-x-2 p-2 bg-gray-50 rounded">
                <Server className="h-4 w-4 text-green-600" />
                <div>
                  <p className="text-xs font-medium">proxies</p>
                  <p className="text-xs text-gray-600">Proxy Data</p>
                </div>
              </div>
              <div className="flex items-center space-x-2 p-2 bg-gray-50 rounded">
                <Clock className="h-4 w-4 text-purple-600" />
                <div>
                  <p className="text-xs font-medium">sync_jobs</p>
                  <p className="text-xs text-gray-600">Sync History</p>
                </div>
              </div>
              <div className="flex items-center space-x-2 p-2 bg-gray-50 rounded">
                <Monitor className="h-4 w-4 text-orange-600" />
                <div>
                  <p className="text-xs font-medium">websharedata</p>
                  <p className="text-xs text-gray-600">Cache & Stats</p>
                </div>
              </div>
            </div>
          </div>

          {config?.lastTestError && config.lastTestError.trim() && (
            <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-md">
              <p className="text-sm text-red-800">
                <strong>Last Error:</strong> {config.lastTestError}
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
