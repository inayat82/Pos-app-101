// src/modules/takealot/api/utils.ts
// Takealot API utilities and helpers

import { NextRequest, NextResponse } from 'next/server';

/**
 * Validate Takealot API request parameters
 */
export function validateTakealotApiRequest(body: any): {
  isValid: boolean;
  error?: string;
  integrationId?: string;
  apiKey?: string;
} {
  if (!body.integrationId) {
    return {
      isValid: false,
      error: 'Integration ID is required'
    };
  }

  if (!body.apiKey) {
    return {
      isValid: false,
      error: 'API key is required'
    };
  }

  return {
    isValid: true,
    integrationId: body.integrationId,
    apiKey: body.apiKey
  };
}

/**
 * Create standardized API response
 */
export function createTakealotApiResponse(
  success: boolean,
  data?: any,
  error?: string,
  statusCode: number = 200
): NextResponse {
  const response = {
    success,
    timestamp: new Date().toISOString(),
    ...(data && { data }),
    ...(error && { error })
  };

  return NextResponse.json(response, { status: statusCode });
}

/**
 * Handle Takealot API errors consistently
 */
export function handleTakealotApiError(error: any): NextResponse {
  console.error('Takealot API Error:', error);

  let statusCode = 500;
  let message = 'Internal server error';

  if (error.statusCode) {
    statusCode = error.statusCode;
  }

  if (error.message) {
    message = error.message;
  }

  return createTakealotApiResponse(false, null, message, statusCode);
}

/**
 * Extract Takealot integration data from request
 */
export async function extractTakealotRequestData(request: NextRequest): Promise<{
  integrationId?: string;
  apiKey?: string;
  strategy?: string;
  dataType?: 'products' | 'sales';
  maxPages?: number;
}> {
  try {
    const body = await request.json();
    return {
      integrationId: body.integrationId,
      apiKey: body.apiKey,
      strategy: body.strategy,
      dataType: body.dataType,
      maxPages: body.maxPages
    };
  } catch (error) {
    return {};
  }
}
