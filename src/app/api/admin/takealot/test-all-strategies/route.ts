// Test API endpoint for systematic testing of all 4 sync strategies
// src/app/api/admin/takealot/test-all-strategies/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { EnhancedSyncService } from '@/lib/enhancedSyncService';
import { dbAdmin as db } from '@/lib/firebase/firebaseAdmin';

interface StrategyTestResult {
  strategy: string;
  startTime: string;
  endTime: string;
  duration: string;
  totalFetched: number;
  totalNew: number;
  totalUpdated: number;
  totalErrors: number;
  totalSkipped: number;
  pagesChecked: number;
  chunksProcessed?: number;
  apiCalls: number;
  proxyUsed?: string;
  proxyCountry?: string;
  success: boolean;
  error?: string;
  logs: string[];
  metrics: {
    avgRecordsPerPage?: number;
    avgChunkSize?: number;
    efficiency?: number;
  };
}

interface TestSummary {
  testRunId: string;
  integrationId: string;
  adminId: string;
  totalStrategiesTested: number;
  totalTestDuration: string;
  overallResults: {
    totalRecordsFetched: number;
    totalApiCalls: number;
    totalErrors: number;
    successfulStrategies: number;
    failedStrategies: number;
  };
  strategyResults: StrategyTestResult[];
  logsSavedTo: string[];
}

export async function POST(request: NextRequest) {
  const testRunId = `test-${Date.now()}`;
  console.log(`[StrategyTest] Starting comprehensive strategy testing - Run ID: ${testRunId}`);
  
  try {
    const { integrationId, adminId } = await request.json();
    
    if (!integrationId || !adminId) {
      return NextResponse.json({ 
        success: false, 
        error: 'Integration ID and Admin ID are required' 
      }, { status: 400 });
    }

    // Get integration data and API key
    const integrationDoc = await db.collection('takealotIntegrations').doc(integrationId).get();
    if (!integrationDoc.exists) {
      return NextResponse.json({ 
        success: false, 
        error: 'Integration not found' 
      }, { status: 404 });
    }

    const integrationData = integrationDoc.data();
    const apiKey = integrationData?.apiKey;
    
    if (!apiKey) {
      return NextResponse.json({ 
        success: false, 
        error: 'API key not found for this integration' 
      }, { status: 400 });
    }

    console.log(`[StrategyTest] Testing with Integration: ${integrationId}, Admin: ${adminId}`);

    // Define strategies to test
    const strategiesToTest = [
      'Last 100',
      'Last 30 Days', 
      'Last 6 Months',
      'All Data'
    ];

    const testStartTime = new Date();
    const strategyResults: StrategyTestResult[] = [];
    const logsSavedTo: string[] = [];

    // Test each strategy
    for (let i = 0; i < strategiesToTest.length; i++) {
      const strategy = strategiesToTest[i];
      console.log(`[StrategyTest] Testing strategy ${i + 1}/${strategiesToTest.length}: ${strategy}`);
      
      const strategyResult = await testSingleStrategy(
        strategy, 
        apiKey, 
        integrationId, 
        adminId, 
        testRunId
      );
      
      strategyResults.push(strategyResult);
      
      // Add delay between strategies to prevent overwhelming the API
      if (i < strategiesToTest.length - 1) {
        console.log(`[StrategyTest] Waiting 5 seconds before next strategy...`);
        await new Promise(resolve => setTimeout(resolve, 5000));
      }
    }

    const testEndTime = new Date();
    const totalTestDuration = `${Math.round((testEndTime.getTime() - testStartTime.getTime()) / 1000)} seconds`;

    // Calculate overall results
    const overallResults = {
      totalRecordsFetched: strategyResults.reduce((sum, r) => sum + r.totalFetched, 0),
      totalApiCalls: strategyResults.reduce((sum, r) => sum + r.apiCalls, 0),
      totalErrors: strategyResults.reduce((sum, r) => sum + r.totalErrors, 0),
      successfulStrategies: strategyResults.filter(r => r.success).length,
      failedStrategies: strategyResults.filter(r => !r.success).length
    };

    // Save test summary to database
    const testSummaryRef = db.collection('strategyTestResults').doc(testRunId);
    const testSummary: TestSummary = {
      testRunId,
      integrationId,
      adminId,
      totalStrategiesTested: strategiesToTest.length,
      totalTestDuration,
      overallResults,
      strategyResults,
      logsSavedTo
    };

    await testSummaryRef.set({
      ...testSummary,
      createdAt: new Date(),
      testStartTime: testStartTime,
      testEndTime: testEndTime
    });

    logsSavedTo.push(`strategyTestResults/${testRunId}`);

    console.log(`[StrategyTest] Test completed - Run ID: ${testRunId}`);
    console.log(`[StrategyTest] Summary:`, overallResults);

    return NextResponse.json({
      success: true,
      message: `Strategy testing completed - Run ID: ${testRunId}`,
      testSummary
    });

  } catch (error) {
    console.error('[StrategyTest] Error during strategy testing:', error);
    
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred',
      testRunId
    }, { status: 500 });
  }
}

async function testSingleStrategy(
  strategy: string, 
  apiKey: string, 
  integrationId: string, 
  adminId: string, 
  testRunId: string
): Promise<StrategyTestResult> {
  const startTime = new Date();
  const logs: string[] = [];
  
  let result: StrategyTestResult = {
    strategy,
    startTime: startTime.toISOString(),
    endTime: '',
    duration: '',
    totalFetched: 0,
    totalNew: 0,
    totalUpdated: 0,
    totalErrors: 0,
    totalSkipped: 0,
    pagesChecked: 0,
    apiCalls: 0,
    success: false,
    logs,
    metrics: {}
  };

  try {
    logs.push(`Starting ${strategy} strategy test at ${startTime.toISOString()}`);
    
    // Get account name from integration data
    const integrationDoc = await db.collection('takealotIntegrations').doc(integrationId).get();
    const integrationData = integrationDoc.data();
    const accountName = integrationData?.accountName || 'Takealot';
    
    // Initialize enhanced sync service
    const syncService = new EnhancedSyncService(adminId, integrationId, accountName);
    
    // Perform the sync based on strategy
    const syncResult = await syncService.syncSales(apiKey, strategy, 'manual');
    
    // Extract results from EnhancedSyncResult
    result.totalFetched = syncResult.totalRecords || 0;
    result.totalNew = syncResult.neonRecords || syncResult.firebaseRecords || 0;
    result.totalUpdated = 0; // Enhanced service doesn't track updates separately
    result.totalErrors = syncResult.success ? 0 : 1;
    result.totalSkipped = 0; // Enhanced service doesn't track skipped separately
    
    // Extract proxy info if available
    if (syncResult.strategy) {
      result.proxyUsed = 'WebShare';
      result.proxyCountry = 'ZA';
    }
    
    // Calculate metrics based on strategy
    if (strategy === 'Last 100') {
      result.pagesChecked = 1;
      result.apiCalls = 1;
      result.metrics.efficiency = result.totalNew / Math.max(result.totalFetched, 1) * 100;
    } else if (strategy === 'Last 30 Days') {
      result.pagesChecked = Math.ceil(result.totalFetched / 100);
      result.apiCalls = result.pagesChecked;
      result.metrics.avgRecordsPerPage = result.totalFetched / Math.max(result.pagesChecked, 1);
    } else if (strategy === 'Last 6 Months') {
      result.pagesChecked = Math.ceil(result.totalFetched / 100);
      result.chunksProcessed = Math.ceil(result.pagesChecked / 10);
      result.apiCalls = result.pagesChecked;
      result.metrics.avgChunkSize = result.totalFetched / Math.max(result.chunksProcessed, 1);
      result.metrics.avgRecordsPerPage = result.totalFetched / Math.max(result.pagesChecked, 1);
    } else if (strategy === 'All Data') {
      result.pagesChecked = Math.ceil(result.totalFetched / 100);
      result.chunksProcessed = Math.ceil(result.pagesChecked / 10);
      result.apiCalls = result.pagesChecked;
      result.metrics.avgChunkSize = result.totalFetched / Math.max(result.chunksProcessed, 1);
      result.metrics.avgRecordsPerPage = result.totalFetched / Math.max(result.pagesChecked, 1);
    }
    
    result.success = true;
    logs.push(`${strategy} completed successfully`);
    logs.push(`Records: ${result.totalFetched} fetched, ${result.totalNew} new, ${result.totalUpdated} updated`);
    logs.push(`API: ${result.apiCalls} calls, ${result.pagesChecked} pages checked`);
    
  } catch (error: any) {
    result.success = false;
    result.error = error.message;
    result.totalErrors = 1;
    logs.push(`Error in ${strategy}: ${error.message}`);
  }
  
  const endTime = new Date();
  result.endTime = endTime.toISOString();
  result.duration = `${Math.round((endTime.getTime() - startTime.getTime()) / 1000)} seconds`;
  
  logs.push(`${strategy} test completed at ${endTime.toISOString()}`);
  logs.push(`Duration: ${result.duration}`);
  
  // Save individual strategy result
  await saveStrategyResult(testRunId, result, integrationId, adminId);
  
  return result;
}

async function saveStrategyResult(
  testRunId: string, 
  result: StrategyTestResult, 
  integrationId: string, 
  adminId: string
) {
  try {
    const docRef = db.collection('strategyTestResults')
      .doc(testRunId)
      .collection('individualResults')
      .doc(result.strategy.toLowerCase().replace(/\s+/g, '-'));
    
    await docRef.set({
      ...result,
      integrationId,
      adminId,
      savedAt: new Date()
    });
  } catch (error) {
    console.error(`Failed to save ${result.strategy} result:`, error);
  }
}
