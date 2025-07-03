// src/modules/takealot/api/handlers.ts
// Takealot API request handlers

import { NextResponse } from 'next/server';
import { fetchAndSaveTakealotData, cleanupDuplicateRecords } from '../services/sync.service';
import { checkTakealotConnection, getTakealotProductTotals, getTakealotSalesTotals } from '../services/api.service';
import { createTakealotApiResponse, handleTakealotApiError } from './utils';

/**
 * Handle Takealot data sync requests
 */
export async function handleTakealotSync(
  endpoint: string,
  apiKey: string,
  adminId: string,
  dataType: 'products' | 'sales',
  maxPages?: number
): Promise<NextResponse> {
  try {
    const result = await fetchAndSaveTakealotData(
      endpoint,
      apiKey,
      adminId,
      dataType,
      maxPages
    );

    return createTakealotApiResponse(result.success, {
      totalItemsFetched: result.totalItemsFetched,
      totalErrors: result.totalErrors,
      dataType,
      maxPages
    }, result.success ? undefined : result.message);
  } catch (error) {
    return handleTakealotApiError(error);
  }
}

/**
 * Handle Takealot connection check requests
 */
export async function handleTakealotConnectionCheck(apiKey: string): Promise<NextResponse> {
  try {
    const result = await checkTakealotConnection(apiKey);
    
    return createTakealotApiResponse(result.success, result.details, result.success ? undefined : result.message);
  } catch (error) {
    return handleTakealotApiError(error);
  }
}

/**
 * Handle Takealot product totals check
 */
export async function handleTakealotProductTotals(apiKey: string): Promise<NextResponse> {
  try {
    const result = await getTakealotProductTotals(apiKey);
    
    return createTakealotApiResponse(result.success, {
      totalProducts: result.totalProducts,
      totalPages: result.totalPages
    }, result.success ? undefined : result.message);
  } catch (error) {
    return handleTakealotApiError(error);
  }
}

/**
 * Handle Takealot sales totals check
 */
export async function handleTakealotSalesTotals(apiKey: string): Promise<NextResponse> {
  try {
    const result = await getTakealotSalesTotals(apiKey);
    
    return createTakealotApiResponse(result.success, {
      totalSales: result.totalSales,
      totalPages: result.totalPages
    }, result.success ? undefined : result.message);
  } catch (error) {
    return handleTakealotApiError(error);
  }
}

/**
 * Handle Takealot data cleanup requests
 */
export async function handleTakealotCleanup(
  adminId: string,
  dataType: 'products' | 'sales'
): Promise<NextResponse> {
  try {
    const result = await cleanupDuplicateRecords(adminId, dataType);
    
    return createTakealotApiResponse(result.success, {
      duplicatesRemoved: result.duplicatesRemoved,
      dataType
    }, result.success ? undefined : result.message);
  } catch (error) {
    return handleTakealotApiError(error);
  }
}
