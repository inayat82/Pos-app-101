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
  MapPin
} from 'lucide-react';
import { 
  WebshareConfig, 
  WebshareProxy, 
  SystemStatus,
  ApiResponse,
  WebshareDashboardData 
} from '../types';

// Modern Webshare Dashboard with 3 Tabs
export default function WebshareManager() {
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
  
  const [formData, setFormData] = useState({
    apiKey: '',
    isEnabled: false,
    syncInterval: 60,
    maxRetries: 3,
    timeout: 30000
  });

  // Load initial data
  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      
      // Load config and system status
      const [configRes, statusRes] = await Promise.all([
        fetch('/api/superadmin/webshare-unified?action=config'),
        fetch('/api/superadmin/webshare-unified?action=status')
      ]);

      if (configRes.ok) {
        const configData: ApiResponse<WebshareConfig> = await configRes.json();
        if (configData.success && configData.data) {
          setConfig(configData.data);
          setFormData({
            apiKey: configData.data.apiKey || '',
            isEnabled: configData.data.isEnabled || false,
            syncInterval: configData.data.syncInterval || 60,
            maxRetries: configData.data.maxRetries || 3,
            timeout: configData.data.timeout || 30000
          });
        }
      }

      if (statusRes.ok) {
        const statusData: ApiResponse<SystemStatus> = await statusRes.json();
        if (statusData.success && statusData.data) {
          setSystemStatus(statusData.data);
        }
      }

      // Load proxies if configured
      if (statusRes.ok) {
        const statusData: ApiResponse<SystemStatus> = await statusRes.json();
        if (statusData.success && statusData.data?.isConfigured) {
          await loadProxies();
        }
      }

    } catch (error) {
      console.error('Error loading data:', error);
      setAlert({ type: 'error', message: 'Failed to load WebShare data' });
    } finally {
      setLoading(false);
    }
  };

  const loadProxies = async () => {
    try {
      const response = await fetch('/api/superadmin/webshare-unified?action=proxies&limit=50');
      if (response.ok) {
        const data: ApiResponse = await response.json();
        if (data.success) {
          setProxies(data.data.proxies || []);
        }
      }
    } catch (error) {
      console.error('Error loading proxies:', error);
    }
  };

  const handleSaveConfig = async () => {
    try {
      setSaving(true);
      
      const response = await fetch('/api/superadmin/webshare-unified?action=save-config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      });

      const data: ApiResponse<WebshareConfig> = await response.json();
      
      if (data.success && data.data) {
        setConfig(data.data);
        setAlert({ type: 'success', message: 'Configuration saved successfully' });
        await loadData(); // Reload system status
      } else {
        setAlert({ type: 'error', message: data.error || 'Failed to save configuration' });
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
        await loadData(); // Reload to get updated test status
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

  const handleSyncProxies = async () => {
    try {
      setSyncing(true);
      
      const response = await fetch('/api/superadmin/webshare?action=sync-proxies', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({})
      });

      const data: ApiResponse = await response.json();
      
      if (data.success) {
        const job = data.data;
        setAlert({ 
          type: 'success', 
          message: `Sync completed! Added: ${job.proxiesAdded}, Updated: ${job.proxiesUpdated}, Removed: ${job.proxiesRemoved}` 
        });
        await loadData(); // Reload all data
      } else {
        setAlert({ type: 'error', message: data.error || 'Failed to sync proxies' });
      }
    } catch (error) {
      console.error('Error syncing proxies:', error);
      setAlert({ type: 'error', message: 'Failed to sync proxies' });
    } finally {
      setSyncing(false);
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'connected':
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'failed':
        return <XCircle className="h-4 w-4 text-red-500" />;
      case 'testing':
        return <Loader2 className="h-4 w-4 text-blue-500 animate-spin" />;
      default:
        return <AlertCircle className="h-4 w-4 text-gray-500" />;
    }
  };

  const getStatusBadge = (status: string) => {
    const variant = status === 'connected' ? 'default' : 
                   status === 'failed' ? 'destructive' : 
                   status === 'testing' ? 'secondary' : 'outline';
    
    return (
      <Badge variant={variant} className="flex items-center gap-1">
        {getStatusIcon(status)}
        {status.charAt(0).toUpperCase() + status.slice(1)}
      </Badge>
    );
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="h-8 w-8 animate-spin" />
        <span className="ml-2">Loading WebShare data...</span>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto p-4 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">WebShare Proxy Management</h1>
          <p className="text-muted-foreground">Unified WebShare proxy integration</p>
        </div>
        {systemStatus && (
          <div className="flex items-center gap-2">
            {getStatusBadge(systemStatus.testStatus)}
            <span className="text-sm text-muted-foreground">
              {systemStatus.totalProxies} proxies
            </span>
          </div>
        )}
      </div>

      {alert && (
        <Alert className={alert.type === 'error' ? 'border-red-200 bg-red-50' : 'border-green-200 bg-green-50'}>
          <AlertDescription>{alert.message}</AlertDescription>
        </Alert>
      )}

      <Tabs defaultValue="configuration" className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="configuration" className="flex items-center gap-2">
            <Settings className="h-4 w-4" />
            Configuration
          </TabsTrigger>
          <TabsTrigger value="proxies" className="flex items-center gap-2">
            <Database className="h-4 w-4" />
            Proxies ({proxies.length})
          </TabsTrigger>
          <TabsTrigger value="monitoring" className="flex items-center gap-2">
            <Monitor className="h-4 w-4" />
            Monitoring
          </TabsTrigger>
        </TabsList>

        <TabsContent value="configuration">
          <Card>
            <CardHeader>
              <CardTitle>WebShare Configuration</CardTitle>
              <CardDescription>
                Configure your WebShare API settings and proxy synchronization
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="apiKey">API Key</Label>
                  <Input
                    id="apiKey"
                    type="password"
                    value={formData.apiKey}
                    onChange={(e) => setFormData({ ...formData, apiKey: e.target.value })}
                    placeholder="Enter your WebShare API key"
                  />
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="syncInterval">Sync Interval (minutes)</Label>
                  <Input
                    id="syncInterval"
                    type="number"
                    value={formData.syncInterval}
                    onChange={(e) => setFormData({ ...formData, syncInterval: parseInt(e.target.value) || 60 })}
                    min="1"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="maxRetries">Max Retries</Label>
                  <Input
                    id="maxRetries"
                    type="number"
                    value={formData.maxRetries}
                    onChange={(e) => setFormData({ ...formData, maxRetries: parseInt(e.target.value) || 3 })}
                    min="1"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="timeout">Timeout (ms)</Label>
                  <Input
                    id="timeout"
                    type="number"
                    value={formData.timeout}
                    onChange={(e) => setFormData({ ...formData, timeout: parseInt(e.target.value) || 30000 })}
                    min="1000"
                  />
                </div>
              </div>

              <div className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  id="isEnabled"
                  checked={formData.isEnabled}
                  onChange={(e) => setFormData({ ...formData, isEnabled: e.target.checked })}
                  className="rounded"
                />
                <Label htmlFor="isEnabled">Enable WebShare Integration</Label>
              </div>

              <div className="flex gap-2">
                <Button 
                  onClick={handleTestApi} 
                  disabled={testing || !formData.apiKey.trim()}
                  variant="outline"
                >
                  {testing ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Testing...
                    </>
                  ) : (
                    'Test API Key'
                  )}
                </Button>
                
                <Button 
                  onClick={handleSaveConfig} 
                  disabled={saving}
                >
                  {saving ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    'Save Configuration'
                  )}
                </Button>

                {systemStatus?.isConfigured && (
                  <Button 
                    onClick={handleSyncProxies} 
                    disabled={syncing || !formData.isEnabled}
                    variant="outline"
                  >
                    {syncing ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Syncing...
                      </>
                    ) : (
                      <>
                        <RefreshCw className="h-4 w-4 mr-2" />
                        Sync Proxies
                      </>
                    )}
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Proxy List Tab */}
        <TabsContent value="proxies">
          <Card>
            <CardHeader>
              <CardTitle>Proxy List</CardTitle>
              <CardDescription>
                View and manage your synchronized WebShare proxies
              </CardDescription>
            </CardHeader>
            <CardContent>
              {proxies.length === 0 ? (
                <div className="text-center py-8">
                  <Database className="h-12 w-12 mx-auto text-gray-400 mb-4" />
                  <p className="text-gray-500">No proxies found. Sync your proxies to see them here.</p>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {proxies.slice(0, 12).map((proxy) => (
                      <Card key={proxy.id} className="p-4">
                        <div className="flex items-center justify-between mb-2">
                          <Badge variant={proxy.valid ? 'default' : 'destructive'}>
                            {proxy.valid ? 'Active' : 'Inactive'}
                          </Badge>
                          <span className="text-xs text-muted-foreground">
                            {proxy.proxy_type}
                          </span>
                        </div>
                        <div className="space-y-1 text-sm">
                          <p><strong>Address:</strong> {proxy.proxy_address}:{proxy.port}</p>
                          <p><strong>Location:</strong> {proxy.country_code} {proxy.city_name && `• ${proxy.city_name}`}</p>
                          <p><strong>Username:</strong> {proxy.username}</p>
                          <p className="text-xs text-muted-foreground">
                            Synced: {new Date(proxy.syncedAt).toLocaleString()}
                          </p>
                        </div>
                      </Card>
                    ))}
                  </div>
                  
                  {proxies.length > 12 && (
                    <p className="text-center text-muted-foreground">
                      Showing 12 of {proxies.length} proxies
                    </p>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Monitoring Tab */}
        <TabsContent value="monitoring">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>System Status</CardTitle>
              </CardHeader>
              <CardContent>
                {systemStatus ? (
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <span>Configuration Status:</span>
                      {getStatusBadge(systemStatus.isConfigured ? 'connected' : 'not_tested')}
                    </div>
                    <div className="flex items-center justify-between">
                      <span>Integration Status:</span>
                      <Badge variant={systemStatus.isEnabled ? 'default' : 'outline'}>
                        {systemStatus.isEnabled ? 'Enabled' : 'Disabled'}
                      </Badge>
                    </div>
                    <div className="flex items-center justify-between">
                      <span>Total Proxies:</span>
                      <Badge variant="outline">{systemStatus.totalProxies}</Badge>
                    </div>
                    <div className="flex items-center justify-between">
                      <span>Last Sync:</span>
                      <span className="text-sm text-muted-foreground">
                        {systemStatus.lastSync ? new Date(systemStatus.lastSync).toLocaleString() : 'Never'}
                      </span>
                    </div>
                  </div>
                ) : (
                  <p>Loading system status...</p>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Quick Actions</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <Button 
                  onClick={() => window.location.reload()} 
                  variant="outline" 
                  className="w-full"
                >
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Refresh Data
                </Button>
                
                <Button 
                  onClick={handleSyncProxies} 
                  disabled={syncing || !systemStatus?.isEnabled}
                  className="w-full"
                >
                  {syncing ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Syncing Proxies...
                    </>
                  ) : (
                    <>
                      <Database className="h-4 w-4 mr-2" />
                      Force Sync Proxies
                    </>
                  )}
                </Button>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
