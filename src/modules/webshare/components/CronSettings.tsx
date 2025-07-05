import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { 
  Clock, 
  CheckCircle, 
  XCircle, 
  Settings,
  Zap,
  TrendingUp,
  Save,
  RefreshCw
} from 'lucide-react';

interface CronScheduleSettings {
  proxySyncSchedule: {
    enabled: boolean;
    interval: 'hourly' | '3hours' | '6hours' | '24hours' | 'custom';
    customInterval?: number;
    lastSync: string | null;
    nextSync: string | null;
  };
  accountSyncSchedule: {
    enabled: boolean;
    interval: 'hourly' | '3hours' | '6hours' | '24hours' | 'custom';
    customInterval?: number;
    lastSync: string | null;
    nextSync: string | null;
  };
  statsUpdateSchedule: {
    enabled: boolean;
    interval: 'hourly' | '3hours' | '6hours' | '24hours' | 'custom';
    customInterval?: number;
    lastUpdate: string | null;
    nextUpdate: string | null;
  };
  healthCheckSchedule: {
    enabled: boolean;
    interval: 'hourly' | '3hours' | '6hours' | '24hours' | 'custom';
    customInterval?: number;
    lastCheck: string | null;
    nextCheck: string | null;
  };
}

interface CronSettingsProps {
  cronSettings: CronScheduleSettings;
  onSave: (settings: CronScheduleSettings) => Promise<void>;
  onTest: (operationType: string) => Promise<void>;
}

const intervalOptions = [
  { value: 'hourly', label: 'Every Hour (Recommended for Proxies)', cost: 'High API usage' },
  { value: '3hours', label: 'Every 3 Hours (Balanced)', cost: 'Medium API usage' },
  { value: '6hours', label: 'Every 6 Hours (Low cost)', cost: 'Low API usage' },
  { value: '24hours', label: 'Daily (Minimal cost)', cost: 'Minimal API usage' },
  { value: 'custom', label: 'Custom Interval', cost: 'Variable cost' }
];

export default function CronSettings({ cronSettings, onSave, onTest }: CronSettingsProps) {
  const [settings, setSettings] = useState<CronScheduleSettings>(cronSettings);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState<string | null>(null);
  const [alert, setAlert] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  useEffect(() => {
    setSettings(cronSettings);
  }, [cronSettings]);

  useEffect(() => {
    if (alert) {
      const timer = setTimeout(() => setAlert(null), 5000);
      return () => clearTimeout(timer);
    }
  }, [alert]);

  const handleSave = async () => {
    try {
      setSaving(true);
      await onSave(settings);
      setAlert({ type: 'success', message: 'Cron settings saved successfully!' });
    } catch (error) {
      setAlert({ type: 'error', message: 'Failed to save cron settings' });
    } finally {
      setSaving(false);
    }
  };

  const handleTest = async (operationType: string) => {
    try {
      setTesting(operationType);
      await onTest(operationType);
      setAlert({ type: 'success', message: `${operationType} operation tested successfully!` });
    } catch (error) {
      setAlert({ type: 'error', message: `Failed to test ${operationType} operation` });
    } finally {
      setTesting(null);
    }
  };

  const updateSchedule = (
    scheduleType: keyof CronScheduleSettings,
    field: string,
    value: any
  ) => {
    setSettings(prev => ({
      ...prev,
      [scheduleType]: {
        ...prev[scheduleType],
        [field]: value
      }
    }));
  };

  const getIntervalDescription = (interval: string) => {
    const option = intervalOptions.find(opt => opt.value === interval);
    return option ? option.cost : 'Unknown cost';
  };

  const formatLastExecution = (timestamp: string | null) => {
    if (!timestamp) return 'Never';
    const date = new Date(timestamp);
    const now = new Date();
    const diffMinutes = Math.floor((now.getTime() - date.getTime()) / (1000 * 60));
    
    if (diffMinutes < 60) return `${diffMinutes} minutes ago`;
    if (diffMinutes < 1440) return `${Math.floor(diffMinutes / 60)} hours ago`;
    return `${Math.floor(diffMinutes / 1440)} days ago`;
  };

  const renderScheduleCard = (
    title: string,
    description: string,
    scheduleType: keyof CronScheduleSettings,
    icon: React.ReactNode,
    testAction: string
  ) => {
    const schedule = settings[scheduleType] as any;
    
    return (
      <Card key={scheduleType} className="border-2 hover:border-blue-200 transition-colors">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              {icon}
              <div>
                <CardTitle className="text-lg">{title}</CardTitle>
                <CardDescription className="text-sm">{description}</CardDescription>
              </div>
            </div>
            <Badge variant={schedule.enabled ? "default" : "secondary"}>
              {schedule.enabled ? 'Enabled' : 'Disabled'}
            </Badge>
          </div>
        </CardHeader>
        
        <CardContent className="space-y-4">
          {/* Enable/Disable Toggle */}
          <div className="flex items-center justify-between">
            <Label className="font-medium">Enable Automatic Sync</Label>
            <Switch
              checked={schedule.enabled}
              onCheckedChange={(checked) => 
                updateSchedule(scheduleType, 'enabled', checked)
              }
            />
          </div>

          {schedule.enabled && (
            <>
              {/* Interval Selection */}
              <div className="space-y-2">
                <Label className="font-medium">Sync Interval</Label>
                <Select
                  value={schedule.interval}
                  onValueChange={(value) => 
                    updateSchedule(scheduleType, 'interval', value)
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {intervalOptions.map(option => (
                      <SelectItem key={option.value} value={option.value}>
                        <div className="flex flex-col">
                          <span>{option.label}</span>
                          <span className="text-xs text-gray-500">{option.cost}</span>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-gray-600">
                  Cost impact: {getIntervalDescription(schedule.interval)}
                </p>
              </div>

              {/* Custom Interval Input */}
              {schedule.interval === 'custom' && (
                <div className="space-y-2">
                  <Label className="font-medium">Custom Interval (minutes)</Label>
                  <Input
                    type="number"
                    min="1"
                    max="10080"
                    value={schedule.customInterval || 60}
                    onChange={(e) => 
                      updateSchedule(scheduleType, 'customInterval', parseInt(e.target.value) || 60)
                    }
                    placeholder="Enter minutes (1-10080)"
                  />
                  <p className="text-xs text-gray-600">
                    Range: 1 minute to 1 week (10,080 minutes)
                  </p>
                </div>
              )}

              {/* Last Execution Info */}
              <div className="bg-gray-50 p-3 rounded-lg space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="font-medium">Last Execution:</span>
                  <span className="text-gray-600">
                    {formatLastExecution(schedule.lastSync || schedule.lastUpdate || schedule.lastCheck)}
                  </span>
                </div>
                {(schedule.nextSync || schedule.nextUpdate || schedule.nextCheck) && (
                  <div className="flex items-center justify-between text-sm">
                    <span className="font-medium">Next Execution:</span>
                    <span className="text-gray-600">
                      {new Date(schedule.nextSync || schedule.nextUpdate || schedule.nextCheck).toLocaleString()}
                    </span>
                  </div>
                )}
              </div>

              {/* Test Button */}
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleTest(testAction)}
                disabled={testing === testAction}
                className="w-full"
              >
                {testing === testAction ? (
                  <>
                    <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                    Testing...
                  </>
                ) : (
                  <>
                    <Zap className="h-4 w-4 mr-2" />
                    Test {title} Now
                  </>
                )}
              </Button>
            </>
          )}
        </CardContent>
      </Card>
    );
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Cron & Automation Settings</h2>
          <p className="text-gray-600 mt-1">
            Configure automated sync intervals to reduce API costs and improve performance
          </p>
        </div>
        <Button onClick={handleSave} disabled={saving}>
          {saving ? (
            <>
              <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
              Saving...
            </>
          ) : (
            <>
              <Save className="h-4 w-4 mr-2" />
              Save Settings
            </>
          )}
        </Button>
      </div>

      {/* Alert */}
      {alert && (
        <Alert className={alert.type === 'success' ? 'border-green-200 bg-green-50' : 'border-red-200 bg-red-50'}>
          {alert.type === 'success' ? (
            <CheckCircle className="h-4 w-4 text-green-600" />
          ) : (
            <XCircle className="h-4 w-4 text-red-600" />
          )}
          <AlertDescription className={alert.type === 'success' ? 'text-green-800' : 'text-red-800'}>
            {alert.message}
          </AlertDescription>
        </Alert>
      )}

      {/* Cost Optimization Info */}
      <Card className="border-blue-200 bg-blue-50">
        <CardHeader>
          <CardTitle className="flex items-center text-blue-900">
            <TrendingUp className="h-5 w-5 mr-2" />
            Cost Optimization Tips
          </CardTitle>
        </CardHeader>
        <CardContent className="text-blue-800 space-y-2">
          <p>• <strong>Hourly sync:</strong> Best for real-time data, higher API usage</p>
          <p>• <strong>3-6 hour sync:</strong> Balanced approach, good for most use cases</p>
          <p>• <strong>Daily sync:</strong> Minimal cost, suitable for stable proxy lists</p>
          <p>• <strong>Smart CRUD:</strong> Only updates changed records, reducing database writes by up to 80%</p>
        </CardContent>
      </Card>

      {/* Schedule Configuration Cards */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {renderScheduleCard(
          'Proxy Sync',
          'Synchronize proxy list from Webshare API',
          'proxySyncSchedule',
          <RefreshCw className="h-5 w-5 text-blue-600" />,
          'proxies'
        )}
        
        {renderScheduleCard(
          'Account Sync',
          'Update account and subscription information',
          'accountSyncSchedule',
          <Settings className="h-5 w-5 text-green-600" />,
          'account'
        )}
        
        {renderScheduleCard(
          'Statistics Update',
          'Refresh proxy statistics and cache',
          'statsUpdateSchedule',
          <TrendingUp className="h-5 w-5 text-purple-600" />,
          'stats'
        )}
        
        {renderScheduleCard(
          'Health Check',
          'Monitor system health and performance',
          'healthCheckSchedule',
          <Clock className="h-5 w-5 text-orange-600" />,
          'health'
        )}
      </div>

      {/* Run All Operations */}
      <Card className="border-green-200">
        <CardHeader>
          <CardTitle className="flex items-center text-green-900">
            <Zap className="h-5 w-5 mr-2" />
            Manual Operations
          </CardTitle>
          <CardDescription>
            Run all scheduled operations manually for testing or immediate updates
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button
            onClick={() => handleTest('all')}
            disabled={testing === 'all'}
            size="lg"
            className="w-full bg-green-600 hover:bg-green-700"
          >
            {testing === 'all' ? (
              <>
                <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                Running All Operations...
              </>
            ) : (
              <>
                <Zap className="h-4 w-4 mr-2" />
                Run All Scheduled Operations
              </>
            )}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
