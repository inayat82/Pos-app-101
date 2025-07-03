// API endpoint for Cron Job Management
import { NextRequest, NextResponse } from 'next/server';
import { collection, getDocs, doc, updateDoc, addDoc, deleteDoc, query, where, orderBy, limit } from 'firebase/firestore';
import { db } from '@/lib/firebase/firebase';

interface CronJob {
  id: string;
  name: string;
  description: string;
  schedule: string;
  type: string;
  status: string;
  lastRun: string | null;
  nextRun: string | null;
  runCount: number;
  successCount: number;
  errorCount: number;
  averageRunTime: number;
  lastError?: string;
  adminId?: string;
  integrationId?: string;
}

interface CronExecution {
  id: string;
  jobId: string;
  jobName: string;
  startTime: string;
  endTime: string | null;
  status: string;
  duration: number | null;
  recordsProcessed?: number;
  errorMessage?: string;
  logs: string[];
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const action = searchParams.get('action');

    switch (action) {
      case 'jobs':
        return await getCronJobs();
      case 'executions':
        return await getCronExecutions();
      case 'stats':
        return await getCronStats();
      case 'logs':
        return await getSystemLogs();
      default:
        return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    }
  } catch (error) {
    console.error('Error in cron management API:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const { action, jobId, jobData } = await request.json();

    switch (action) {
      case 'create':
        return await createCronJob(jobData);
      case 'update':
        return await updateCronJob(jobId, jobData);
      case 'start':
        return await startCronJob(jobId);
      case 'pause':
        return await pauseCronJob(jobId);
      case 'stop':
        return await stopCronJob(jobId);
      case 'delete':
        return await deleteCronJob(jobId);
      case 'execute':
        return await executeCronJob(jobId);
      default:
        return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    }
  } catch (error) {
    console.error('Error in cron management API POST:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

async function getCronJobs() {
  try {
    const cronJobsRef = collection(db, 'cronJobs');
    const snapshot = await getDocs(cronJobsRef);
    
    const jobs = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    })) as CronJob[];

    return NextResponse.json({ 
      success: true, 
      data: jobs 
    });
  } catch (error) {
    console.error('Error fetching cron jobs:', error);
    return NextResponse.json({ error: 'Failed to fetch cron jobs' }, { status: 500 });
  }
}

async function getCronExecutions() {
  try {
    const executionsRef = collection(db, 'cronExecutions');
    const q = query(executionsRef, orderBy('startTime', 'desc'), limit(50));
    const snapshot = await getDocs(q);
    
    const executions = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    })) as CronExecution[];

    return NextResponse.json({ 
      success: true, 
      data: executions 
    });
  } catch (error) {
    console.error('Error fetching cron executions:', error);
    return NextResponse.json({ error: 'Failed to fetch cron executions' }, { status: 500 });
  }
}

async function getCronStats() {
  try {
    // Calculate statistics from existing data
    const jobsSnapshot = await getDocs(collection(db, 'cronJobs'));
    const jobs = jobsSnapshot.docs.map(doc => doc.data());
    
    const executionsSnapshot = await getDocs(
      query(
        collection(db, 'cronExecutions'),
        orderBy('startTime', 'desc'),
        limit(100)
      )
    );
    const executions = executionsSnapshot.docs.map(doc => doc.data());
    
    // Calculate stats for last 24 hours
    const last24Hours = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const recent24hExecutions = executions.filter(exec => 
      new Date(exec.startTime) > last24Hours
    );
    
    const stats = {
      totalJobs: jobs.length,
      activeJobs: jobs.filter(job => job.status === 'active').length,
      pausedJobs: jobs.filter(job => job.status === 'paused').length,
      errorJobs: jobs.filter(job => job.status === 'error').length,
      totalExecutions24h: recent24hExecutions.length,
      successfulExecutions24h: recent24hExecutions.filter(exec => exec.status === 'completed').length,
      averageRunTime: executions.length > 0 
        ? executions.reduce((sum, exec) => sum + (exec.duration || 0), 0) / executions.length 
        : 0,
      systemLoad: Math.random() * 0.8 + 0.1 // Mock system load
    };

    return NextResponse.json({ 
      success: true, 
      data: stats 
    });
  } catch (error) {
    console.error('Error calculating cron stats:', error);
    return NextResponse.json({ error: 'Failed to calculate statistics' }, { status: 500 });
  }
}

async function getSystemLogs() {
  try {
    // In a real implementation, this would fetch from a logging system
    const mockLogs = [
      `[${new Date().toISOString()}] INFO: Cron daemon started successfully`,
      `[${new Date(Date.now() - 60000).toISOString()}] INFO: Executing job: system_health_check`,
      `[${new Date(Date.now() - 45000).toISOString()}] INFO: Job completed: system_health_check (15s)`,
      `[${new Date(Date.now() - 3600000).toISOString()}] INFO: Executing job: takealot_sync_all`,
      `[${new Date(Date.now() - 3555000).toISOString()}] INFO: Job completed: takealot_sync_all (45s)`,
    ];

    return NextResponse.json({ 
      success: true, 
      data: { logs: mockLogs } 
    });
  } catch (error) {
    console.error('Error fetching system logs:', error);
    return NextResponse.json({ error: 'Failed to fetch system logs' }, { status: 500 });
  }
}

async function createCronJob(jobData: Partial<CronJob>) {
  try {
    const cronJobsRef = collection(db, 'cronJobs');
    const newJob = {
      ...jobData,
      status: 'paused',
      runCount: 0,
      successCount: 0,
      errorCount: 0,
      averageRunTime: 0,
      lastRun: null,
      nextRun: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    const docRef = await addDoc(cronJobsRef, newJob);
    
    return NextResponse.json({ 
      success: true, 
      data: { id: docRef.id, ...newJob } 
    });
  } catch (error) {
    console.error('Error creating cron job:', error);
    return NextResponse.json({ error: 'Failed to create cron job' }, { status: 500 });
  }
}

async function updateCronJob(jobId: string, jobData: Partial<CronJob>) {
  try {
    const jobRef = doc(db, 'cronJobs', jobId);
    await updateDoc(jobRef, {
      ...jobData,
      updatedAt: new Date().toISOString()
    });

    return NextResponse.json({ 
      success: true, 
      message: 'Cron job updated successfully' 
    });
  } catch (error) {
    console.error('Error updating cron job:', error);
    return NextResponse.json({ error: 'Failed to update cron job' }, { status: 500 });
  }
}

async function startCronJob(jobId: string) {
  try {
    const jobRef = doc(db, 'cronJobs', jobId);
    await updateDoc(jobRef, {
      status: 'active',
      updatedAt: new Date().toISOString()
    });

    // Log the action
    await logCronExecution(jobId, 'Job started manually', 'info');

    return NextResponse.json({ 
      success: true, 
      message: 'Cron job started successfully' 
    });
  } catch (error) {
    console.error('Error starting cron job:', error);
    return NextResponse.json({ error: 'Failed to start cron job' }, { status: 500 });
  }
}

async function pauseCronJob(jobId: string) {
  try {
    const jobRef = doc(db, 'cronJobs', jobId);
    await updateDoc(jobRef, {
      status: 'paused',
      updatedAt: new Date().toISOString()
    });

    // Log the action
    await logCronExecution(jobId, 'Job paused manually', 'info');

    return NextResponse.json({ 
      success: true, 
      message: 'Cron job paused successfully' 
    });
  } catch (error) {
    console.error('Error pausing cron job:', error);
    return NextResponse.json({ error: 'Failed to pause cron job' }, { status: 500 });
  }
}

async function stopCronJob(jobId: string) {
  try {
    const jobRef = doc(db, 'cronJobs', jobId);
    await updateDoc(jobRef, {
      status: 'disabled',
      updatedAt: new Date().toISOString()
    });

    // Log the action
    await logCronExecution(jobId, 'Job stopped manually', 'warning');

    return NextResponse.json({ 
      success: true, 
      message: 'Cron job stopped successfully' 
    });
  } catch (error) {
    console.error('Error stopping cron job:', error);
    return NextResponse.json({ error: 'Failed to stop cron job' }, { status: 500 });
  }
}

async function deleteCronJob(jobId: string) {
  try {
    const jobRef = doc(db, 'cronJobs', jobId);
    await deleteDoc(jobRef);

    // Also delete related executions
    const executionsRef = collection(db, 'cronExecutions');
    const q = query(executionsRef, where('jobId', '==', jobId));
    const snapshot = await getDocs(q);
    
    const deletePromises = snapshot.docs.map(doc => deleteDoc(doc.ref));
    await Promise.all(deletePromises);

    return NextResponse.json({ 
      success: true, 
      message: 'Cron job deleted successfully' 
    });
  } catch (error) {
    console.error('Error deleting cron job:', error);
    return NextResponse.json({ error: 'Failed to delete cron job' }, { status: 500 });
  }
}

async function executeCronJob(jobId: string) {
  try {
    // This would trigger the actual job execution
    // For now, we'll just log it as a manual execution
    const executionRef = collection(db, 'cronExecutions');
    const execution = {
      jobId,
      jobName: 'Manual Execution',
      startTime: new Date().toISOString(),
      endTime: null,
      status: 'running',
      duration: null,
      logs: ['Manual execution triggered'],
      triggeredBy: 'manual'
    };

    const docRef = await addDoc(executionRef, execution);

    // Simulate job completion after a delay
    setTimeout(async () => {
      await updateDoc(docRef, {
        endTime: new Date().toISOString(),
        status: 'completed',
        duration: Math.floor(Math.random() * 60) + 10, // Random duration 10-70 seconds
        logs: [
          'Manual execution triggered',
          'Job started successfully',
          'Processing...',
          'Job completed successfully'
        ]
      });
    }, 2000);

    return NextResponse.json({ 
      success: true, 
      message: 'Cron job execution started',
      executionId: docRef.id
    });
  } catch (error) {
    console.error('Error executing cron job:', error);
    return NextResponse.json({ error: 'Failed to execute cron job' }, { status: 500 });
  }
}

async function logCronExecution(jobId: string, message: string, level: 'info' | 'warning' | 'error') {
  try {
    const logsRef = collection(db, 'cronLogs');
    await addDoc(logsRef, {
      jobId,
      message,
      level,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error logging cron execution:', error);
  }
}
