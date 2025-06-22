// src/lib/reportDatabaseService.ts

import { db } from '@/lib/firebase/firebase';
import { collection, doc, setDoc, getDoc, query, where, getDocs, orderBy, limit } from 'firebase/firestore';
import { getOptimizedProductData } from '@/lib/reportCacheService';

interface SavedReport {
  id: string;
  integrationId: string;
  reportType: string;
  data: any[];
  metadata: {
    totalProducts: number;
    totalSales: number;
    totalReturns: number;
    last30DaysSales: number;
    avgReturnRate: number;
    lastGenerated: Date;
    generatedBy: string;
    version: string;
  };
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Get saved report from database
 */
export async function getSavedReport(
  integrationId: string,
  reportType: string
): Promise<SavedReport | null> {
  try {
    const reportId = `${integrationId}_${reportType}`;
    const reportDoc = doc(db, 'savedReports', reportId);
    const reportSnapshot = await getDoc(reportDoc);

    if (reportSnapshot.exists()) {
      const data = reportSnapshot.data() as SavedReport;
      console.log(`Found saved report for ${reportType}, last generated:`, data.metadata.lastGenerated);
      return data;
    }

    console.log(`No saved report found for ${reportType}`);
    return null;
  } catch (error) {
    console.error('Error retrieving saved report:', error);
    return null;
  }
}

/**
 * Save report to database
 */
export async function saveReportToDatabase(
  integrationId: string,
  reportType: string,
  data: any[],
  userId: string
): Promise<void> {
  try {
    const reportId = `${integrationId}_${reportType}`;
    const now = new Date();

    // Calculate metadata
    const metadata = {
      totalProducts: data.length,
      totalSales: data.reduce((sum, p) => sum + p.totalSold, 0),
      totalReturns: data.reduce((sum, p) => sum + p.totalReturn, 0),
      last30DaysSales: data.reduce((sum, p) => sum + p.last30DaysSold, 0),
      avgReturnRate: data.length > 0 ? (data.reduce((sum, p) => sum + p.returnRate, 0) / data.length) : 0,
      lastGenerated: now,
      generatedBy: userId,
      version: '1.0'
    };

    const savedReport: SavedReport = {
      id: reportId,
      integrationId,
      reportType,
      data,
      metadata,
      createdAt: now,
      updatedAt: now
    };

    const reportDoc = doc(db, 'savedReports', reportId);
    await setDoc(reportDoc, savedReport);
    
    console.log(`Saved report for ${reportType} with ${data.length} products`);
  } catch (error) {
    console.error('Error saving report to database:', error);
    throw error;
  }
}

/**
 * Generate fresh report and save to database
 */
export async function generateAndSaveReport(
  integrationId: string,
  reportType: string,
  userId: string
): Promise<any[]> {
  try {
    console.log(`Generating fresh ${reportType} report...`);
    
    // Generate fresh data
    const data = await getOptimizedProductData(integrationId);
    
    // Save to database
    await saveReportToDatabase(integrationId, reportType, data, userId);
    
    return data;
  } catch (error) {
    console.error('Error generating and saving report:', error);
    throw error;
  }
}

/**
 * Get report history for an integration
 */
export async function getReportHistory(
  integrationId: string,
  reportType?: string,
  limitCount: number = 10
): Promise<SavedReport[]> {
  try {
    let reportsQuery;
    
    if (reportType) {
      reportsQuery = query(
        collection(db, 'savedReports'),
        where('integrationId', '==', integrationId),
        where('reportType', '==', reportType),
        orderBy('updatedAt', 'desc'),
        limit(limitCount)
      );
    } else {
      reportsQuery = query(
        collection(db, 'savedReports'),
        where('integrationId', '==', integrationId),
        orderBy('updatedAt', 'desc'),
        limit(limitCount)
      );
    }

    const snapshot = await getDocs(reportsQuery);
    return snapshot.docs.map(doc => doc.data() as SavedReport);
  } catch (error) {
    console.error('Error getting report history:', error);
    return [];
  }
}
