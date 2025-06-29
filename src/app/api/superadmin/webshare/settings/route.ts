// API route to get and save Webshare API key for SuperAdmin
import { NextRequest, NextResponse } from 'next/server';
import { getWebshareApiKeyAdmin, saveWebshareApiKeyAdmin } from '@/lib/firebase/saveWebshareApiKeyAdmin';

export async function GET(request: NextRequest) {
  try {
    const webshareData = await getWebshareApiKeyAdmin();
    
    if (webshareData) {
      return NextResponse.json({
        success: true,
        data: {
          hasApiKey: true,
          testStatus: webshareData.testStatus,
          lastTested: webshareData.lastTested,
          lastTestError: webshareData.lastTestError,
          // Don't send the actual API key for security
          apiKey: webshareData.apiKey // We'll mask this in the frontend
        }
      });
    } else {
      return NextResponse.json({
        success: true,
        data: {
          hasApiKey: false,
          testStatus: null,
          lastTested: null,
          lastTestError: null,
          apiKey: null
        }
      });
    }
  } catch (error: any) {
    console.error('Error getting Webshare API key:', error);
    return NextResponse.json({ 
      error: error.message || 'Failed to get Webshare API key',
      details: error.toString()
    }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    console.log('POST /api/superadmin/webshare/settings - Starting request');
    
    const body = await request.json();
    console.log('Request body received:', { 
      hasApiKey: !!body.apiKey, 
      apiKeyLength: body.apiKey?.length,
      testStatus: body.testStatus 
    });
    
    const { apiKey, testStatus, lastTestError } = body;
    
    if (!apiKey || typeof apiKey !== 'string' || apiKey.trim().length === 0) {
      console.log('Invalid API key provided');
      return NextResponse.json({ 
        success: false,
        error: 'API key is required' 
      }, { status: 400 });
    }
    
    console.log('Attempting to save API key...');
    
    // Save the API key with the provided status
    await saveWebshareApiKeyAdmin({ 
      apiKey: apiKey.trim(), 
      testStatus: testStatus || 'testing',
      lastTestError 
    });
    
    console.log('API key saved successfully');
    
    return NextResponse.json({
      success: true,
      message: 'API key saved successfully'
    });
  } catch (error: any) {
    console.error('Error saving Webshare API key:', error);
    console.error('Error stack:', error.stack);
    return NextResponse.json({ 
      success: false,
      error: error.message || 'Failed to save Webshare API key',
      details: error.toString()
    }, { status: 500 });
  }
}
