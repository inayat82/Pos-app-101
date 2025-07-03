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
import { Switch } from '@/components/ui/switch';
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
  Clock,
  Activity,
  Globe,
  Eye,
  EyeOff
} from 'lucide-react';

interface WebshareConfig {
  apiKey: string;
  isEnabled: boolean;
  lastSyncAt: string | null;
  syncInterval: number;
  maxRetries: number;
  timeout: number;
  testStatus: 'connected' | 'failed' | 'testing' | 'not_tested';
  lastTestError: string | null;
  autoSyncEnabled: boolean;
  autoSyncInterval: number;
  lastAutoSyncAt: string | null;
  createdAt: string;
  updatedAt: string;
}

interface WebshareProxy {
  id: string;
  webshareId: string;
  username: string;
  password: string;
  proxy_address: string;
  port: number;
  valid: boolean;
  last_verification_status: string;
  country_code: string;
  city_name: string | null;
  syncedAt: string;
  proxy_type: string;
}

interface SystemStatus {
  isConfigured: boolean;
  isEnabled: boolean;
  testStatus: string;
  lastSync: string | null;
  totalProxies: number;
  lastSyncJob: any;
}

interface AutoSyncStatus {
  enabled: boolean;
  lastSync: string | null;
  nextSync: string | null;
  intervalMinutes: number;
}

export default function old_WebshareProxyManagerWithAutoSync() {
  const [config, setConfig] = useState<WebshareConfig | null>(null);
  const [proxies, setProxies] = useState<WebshareProxy[]>([]);
  const [systemStatus, setSystemStatus] = useState<SystemStatus | null>(null);
  const [autoSyncStatus, setAutoSyncStatus] = useState<AutoSyncStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [testing, setTesting] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [autoSyncing, setAutoSyncing] = useState(false);
  const [showApiKey, setShowApiKey] = useState(false);
  const [alert, setAlert] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  
  const [formData, setFormData] = useState({
    apiKey: '',
    isEnabled: false,
    syncInterval: 60,
    maxRetries: 3,
    timeout: 30000,
    autoSyncEnabled: false,
    autoSyncInterval: 60
  });

  // Load initial data
  useEffect(() => {
    loadData();
  }, []);

  // Auto-refresh auto-sync status every minute
  useEffect(() => {
    if (config?.autoSyncEnabled) {
      const interval = setInterval(() => {
        loadAutoSyncStatus();
      }, 60000); // Check every minute

      return () => clearInterval(interval);
    }
  }, [config?.autoSyncEnabled]);

  const showAlert = (type: 'success' | 'error', message: string) => {
    setAlert({ type, message });
    setTimeout(() => setAlert(null), 5000);
  };

  const loadData = async () => {
    try {
      setLoading(true);
      
      // Load config, system status, and auto-sync status
      const [configRes, statusRes, autoSyncRes] = await Promise.all([
        fetch('/api/superadmin/webshare-unified?action=config'),
        fetch('/api/superadmin/webshare-unified?action=status'),
        fetch('/api/superadmin/webshare-unified?action=auto-sync-status')
      ]);

      if (configRes.ok) {
        const configData = await configRes.json();
        if (configData.success) {
          setConfig(configData.data);
          setFormData({
            apiKey: configData.data.apiKey || '',
            isEnabled: configData.data.isEnabled || false,
            syncInterval: configData.data.syncInterval || 60,
            maxRetries: configData.data.maxRetries || 3,
            timeout: configData.data.timeout || 30000,
            autoSyncEnabled: configData.data.autoSyncEnabled || false,
            autoSyncInterval: configData.data.autoSyncInterval || 60
          });
        }
      }

      let statusData = null;
      if (statusRes.ok) {
        statusData = await statusRes.json();
        if (statusData.success) {
          setSystemStatus(statusData.data);
        }
      }

      if (autoSyncRes.ok) {
        const autoSyncData = await autoSyncRes.json();
        if (autoSyncData.success) {
          setAutoSyncStatus(autoSyncData.data);
        }
      }

      // Load proxies if configured (use already parsed statusData)
      if (statusData && statusData.success && statusData.data.isConfigured) {
        await loadProxies();
      }

    } catch (error) {
      console.error('Error loading data:', error);
      showAlert('error', 'Failed to load WebShare data');
    } finally {
      setLoading(false);
    }
  };

  const loadProxies = async () => {
    try {
      const response = await fetch('/api/superadmin/webshare-unified?action=proxies&limit=50');
      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          setProxies(data.data.proxies || []);
        }
      }
    } catch (error) {
      console.error('Error loading proxies:', error);
    }
  };

  const loadAutoSyncStatus = async () => {
    try {
      const response = await fetch('/api/superadmin/webshare-unified?action=auto-sync-status');
      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          setAutoSyncStatus(data.data);
        }
      }
    } catch (error) {
      console.error('Error loading auto-sync status:', error);
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

      const data = await response.json();
      
      if (data.success) {
        setConfig(data.data);
        showAlert('success', 'Configuration saved successfully');
        await loadData(); // Reload system status and auto-sync status
      } else {
        showAlert('error', data.error || 'Failed to save configuration');
      }
    } catch (error) {
      console.error('Error saving config:', error);
      showAlert('error', 'Failed to save configuration');
    } finally {
      setSaving(false);
    }
  };

  const handleTestApi = async () => {
    if (!formData.apiKey.trim()) {
      showAlert('error', 'Please enter an API key');
      return;
    }

    try {
      setTesting(true);
      
      const response = await fetch('/api/superadmin/webshare-unified?action=test-api', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ apiKey: formData.apiKey })
      });

      const data = await response.json();
      
      if (data.success && data.data.success) {
        showAlert('success', `API key is valid! Found ${data.data.proxyCount || 0} proxies.`);
        await loadData(); // Reload to get updated test status
      } else {
        showAlert('error', data.data?.error || 'API key test failed');
      }
    } catch (error) {
      console.error('Error testing API:', error);
      showAlert('error', 'Failed to test API key');
    } finally {
      setTesting(false);
    }
  };

  const handleSyncProxies = async () => {
    try {
      setSyncing(true);
      
      const response = await fetch('/api/superadmin/webshare-unified?action=sync-proxies', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({})
      });

      const data = await response.json();
      
      if (data.success) {
        const job = data.data;
        showAlert('success', `Sync completed! Added: ${job.proxiesAdded}, Updated: ${job.proxiesUpdated}, Removed: ${job.proxiesRemoved}`);
        await loadData(); // Reload all data
      } else {
        showAlert('error', data.error || 'Failed to sync proxies');
      }
    } catch (error) {
      console.error('Error syncing proxies:', error);
      showAlert('error', 'Failed to sync proxies');
    } finally {
      setSyncing(false);
    }
  };

  const handleAutoSyncNow = async () => {
    try {
      setAutoSyncing(true);
      
      const response = await fetch('/api/superadmin/webshare-unified?action=auto-sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({})
      });

      const data = await response.json();
      
      if (data.success) {
        const job = data.data;
        showAlert('success', `Auto-sync completed! Added: ${job.proxiesAdded}, Updated: ${job.proxiesUpdated}, Removed: ${job.proxiesRemoved}`);
        await loadData(); // Reload all data
      } else {
        showAlert('error', data.error || 'Failed to perform auto-sync');
      }
    } catch (error) {
      console.error('Error performing auto-sync:', error);
      showAlert('error', 'Failed to perform auto-sync');
    } finally {
      setAutoSyncing(false);
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

  const formatDateTime = (isoString: string | null) => {
    if (!isoString) return 'Never';
    return new Date(isoString).toLocaleString();
  };

  const getTimeUntilNextSync = () => {
    if (!autoSyncStatus?.nextSync) return 'N/A';
    
    const now = new Date();
    const nextSync = new Date(autoSyncStatus.nextSync);
    const diff = nextSync.getTime() - now.getTime();
    
    if (diff <= 0) return 'Due now';
    
    const minutes = Math.floor(diff / (1000 * 60));
    const hours = Math.floor(minutes / 60);
    
    if (hours > 0) {
      return `${hours}h ${minutes % 60}m`;
    }
    return `${minutes}m`;
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
          <p className="text-muted-foreground">Manage your WebShare proxy integration with auto-sync</p>
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

      <Tabs defaultValue="config" className="space-y-4">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="config" className="flex items-center gap-2">
            <Settings className="h-4 w-4" />
            Configuration
          </TabsTrigger>
          <TabsTrigger value="auto-sync" className="flex items-center gap-2">
            <Clock className="h-4 w-4" />
            Auto-Sync
          </TabsTrigger>
          <TabsTrigger value="proxies" className="flex items-center gap-2">
            <Globe className="h-4 w-4" />
            Proxies
          </TabsTrigger>
          <TabsTrigger value="monitoring" className="flex items-center gap-2">
            <Monitor className="h-4 w-4" />
            Monitoring
          </TabsTrigger>
        </TabsList>

        <TabsContent value="config" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>API Configuration</CardTitle>
              <CardDescription>Configure your WebShare API settings</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="apiKey">API Key</Label>
                <div className="flex gap-2">
                  <Input
                    id="apiKey"
                    type={showApiKey ? "text" : "password"}
                    placeholder="Enter your WebShare API key"
                    value={formData.apiKey}
                    onChange={(e) => setFormData({ ...formData, apiKey: e.target.value })}
                  />
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => setShowApiKey(!showApiKey)}
                  >
                    {showApiKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </Button>
                </div>
              </div>

              <div className="flex items-center space-x-2">
                <Switch
                  id="isEnabled"
                  checked={formData.isEnabled}
                  onCheckedChange={(checked) => setFormData({ ...formData, isEnabled: checked })}
                />
                <Label htmlFor="isEnabled">Enable WebShare Integration</Label>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="syncInterval">Sync Interval (minutes)</Label>
                  <Input
                    id="syncInterval"
                    type="number"
                    min="1"
                    value={formData.syncInterval}
                    onChange={(e) => setFormData({ ...formData, syncInterval: parseInt(e.target.value) || 60 })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="maxRetries">Max Retries</Label>
                  <Input
                    id="maxRetries"
                    type="number"
                    min="1"
                    max="10"
                    value={formData.maxRetries}
                    onChange={(e) => setFormData({ ...formData, maxRetries: parseInt(e.target.value) || 3 })}
                  />
                </div>
              </div>

              <div className="flex gap-2">
                <Button onClick={handleSaveConfig} disabled={saving}>
                  {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                  Save Configuration
                </Button>
                <Button 
                  variant="outline" 
                  onClick={handleTestApi} 
                  disabled={testing || !formData.apiKey.trim()}
                >
                  {testing ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                  Test Connection
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="auto-sync" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Auto-Sync Configuration</CardTitle>
              <CardDescription>Automatically sync proxy IPs from WebShare every hour</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center space-x-2">
                <Switch
                  id="autoSyncEnabled"
                  checked={formData.autoSyncEnabled}
                  onCheckedChange={(checked) => setFormData({ ...formData, autoSyncEnabled: checked })}
                />
                <Label htmlFor="autoSyncEnabled">Enable Auto-Sync</Label>
              </div>

              <div className="space-y-2">
                <Label htmlFor="autoSyncInterval">Auto-Sync Interval (minutes)</Label>
                <Input
                  id="autoSyncInterval"
                  type="number"
                  min="15"
                  max="1440"
                  value={formData.autoSyncInterval}
                  onChange={(e) => setFormData({ ...formData, autoSyncInterval: parseInt(e.target.value) || 60 })}
                  disabled={!formData.autoSyncEnabled}
                />
                <p className="text-sm text-muted-foreground">
                  Recommended: 60 minutes (1 hour) for optimal performance
                </p>
              </div>

              {autoSyncStatus && (
                <div className="grid grid-cols-2 gap-4 p-4 bg-gray-50 rounded-lg">
                  <div>
                    <p className="text-sm font-medium text-gray-600">Status</p>
                    <p className="text-lg font-semibold">
                      {autoSyncStatus.enabled ? 'Enabled' : 'Disabled'}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-600">Last Auto-Sync</p>
                    <p className="text-lg font-semibold">
                      {formatDateTime(autoSyncStatus.lastSync)}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-600">Next Auto-Sync</p>
                    <p className="text-lg font-semibold">
                      {autoSyncStatus.enabled ? getTimeUntilNextSync() : 'N/A'}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-600">Interval</p>
                    <p className="text-lg font-semibold">
                      {autoSyncStatus.intervalMinutes} minutes
                    </p>
                  </div>
                </div>
              )}

              <div className="flex gap-2">
                <Button onClick={handleSaveConfig} disabled={saving}>
                  {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                  Save Auto-Sync Settings
                </Button>
                <Button 
                  variant="outline" 
                  onClick={handleAutoSyncNow} 
                  disabled={autoSyncing || !formData.autoSyncEnabled || !config?.isEnabled}
                >
                  {autoSyncing ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <RefreshCw className="h-4 w-4 mr-2" />}
                  Sync Now
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="proxies" className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Proxy List</CardTitle> 
                  <CardDescription>Manage your WebShare proxy endpoints</CardDescription>
                </div>
                <Button 
                  onClick={handleSyncProxies} 
                  disabled={syncing || !config?.isEnabled}
                  variant="outline"
                >
                  {syncing ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <RefreshCw className="h-4 w-4 mr-2" />}
                  Manual Sync
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {proxies.length === 0 ? (
                  <div className="text-center py-8">
                    <Database className="h-12 w-12 mx-auto text-gray-400 mb-4" />
                    <p className="text-gray-500">No proxies available</p>
                    <p className="text-sm text-gray-400">Configure your API key and sync to load proxies</p>
                  </div>
                ) : (
                  <div className="grid gap-4">
                    {proxies.slice(0, 10).map((proxy) => (
                      <div key={proxy.id} className="flex items-center justify-between p-3 border rounded-lg">
                        <div className="flex items-center gap-3">
                          <Badge variant={proxy.valid ? "default" : "destructive"}>
                            {proxy.valid ? "Active" : "Inactive"}
                          </Badge>
                          <span className="font-mono text-sm">
                            {proxy.proxy_address}:{proxy.port}
                          </span>
                          <Badge variant="outline">{proxy.country_code}</Badge>
                          {proxy.city_name && (
                            <span className="text-sm text-gray-500">{proxy.city_name}</span>
                          )}
                        </div>
                        <div className="text-sm text-gray-500">
                          {proxy.proxy_type}
                        </div>
                      </div>
                    ))}
                    {proxies.length > 10 && (
                      <p className="text-sm text-gray-500 text-center">
                        ... and {proxies.length - 10} more proxies
                      </p>
                    )}
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="monitoring" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>System Status</CardTitle>
              <CardDescription>Monitor WebShare integration health</CardDescription>
            </CardHeader>
            <CardContent>
              {systemStatus && (
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Configuration Status</Label>
                    <div className="flex items-center gap-2">
                      {systemStatus.isConfigured ? (
                        <CheckCircle className="h-4 w-4 text-green-500" />
                      ) : (
                        <XCircle className="h-4 w-4 text-red-500" />
                      )}
                      <span>{systemStatus.isConfigured ? 'Configured' : 'Not Configured'}</span>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label>Integration Status</Label>
                    <div className="flex items-center gap-2">
                      {systemStatus.isEnabled ? (
                        <CheckCircle className="h-4 w-4 text-green-500" />
                      ) : (
                        <XCircle className="h-4 w-4 text-red-500" />
                      )}
                      <span>{systemStatus.isEnabled ? 'Enabled' : 'Disabled'}</span>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label>Last Sync</Label>
                    <p className="text-sm">{formatDateTime(systemStatus.lastSync)}</p>
                  </div>
                  <div className="space-y-2">
                    <Label>Total Proxies</Label>
                    <p className="text-lg font-semibold">{systemStatus.totalProxies}</p>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
