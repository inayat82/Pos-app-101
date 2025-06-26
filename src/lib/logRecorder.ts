// src/lib/logRecorder.ts
// COMPLETELY DISABLED LOG RECORDER - NO-OP IMPLEMENTATION
// This prevents any console noise, Firebase writes, or performance issues

export interface LogEntry {
  id: string;
  timestamp: string;
  type: 'log' | 'error' | 'warn' | 'info' | 'debug' | 'page-action' | 'api-call';
  level: 'info' | 'warning' | 'error' | 'success';
  category: string;
  message: string;
  details?: any;
  source?: string;
  page?: string;
  userAgent?: string;
  stackTrace?: string;
}

class LogRecorder {
  private logs: LogEntry[] = [];
  private maxLogs = 1000;
  private listeners: ((logs: LogEntry[]) => void)[] = [];
  private originalConsole: any = {};
  private isInitialized = false;
  private isRecording = false;

  constructor() {
    // NO-OP: Completely disabled constructor
    this.isInitialized = true;
    this.isRecording = false;
  }

  // NO-OP METHODS: All methods are disabled and return empty/default values
  
  private initialize() {
    // NO-OP: Disabled
  }

  private checkAndStartRecording() {
    // NO-OP: Disabled
  }

  private setupConsoleOverrides() {
    // NO-OP: Disabled
  }

  private setupErrorHandlers() {
    // NO-OP: Disabled
  }

  private setupNavigationTracking() {
    // NO-OP: Disabled
  }

  private handleNavigation(type: string, url?: string) {
    // NO-OP: Disabled
  }

  private shouldRecord(): boolean {
    return false;
  }

  private formatMessage(args: any[]): string {
    return '';
  }

  private generateId(): string {
    return '';
  }

  private createLog(logData: Omit<LogEntry, 'id' | 'timestamp' | 'page' | 'userAgent'>) {
    // NO-OP: Disabled
  }

  private async saveToFirestore(log: LogEntry) {
    // NO-OP: Disabled
  }

  private getPageName(): string {
    return '';
  }

  private notifyListeners() {
    // NO-OP: Disabled
  }

  // PUBLIC METHODS: All return empty/default values
  public subscribe(listener: (logs: LogEntry[]) => void) {
    // NO-OP: Return empty unsubscribe function
    return () => {};
  }

  public getLogs(): LogEntry[] {
    return [];
  }

  public clearLogs() {
    // NO-OP: Disabled
  }

  public exportLogs(): string {
    return '[]';
  }

  public getLogsByPage(page: string): LogEntry[] {
    return [];
  }

  public getLogsByCategory(category: string): LogEntry[] {
    return [];
  }

  public getLogsByTimeRange(startTime: string, endTime: string): LogEntry[] {
    return [];
  }

  public logUserAction(message: string, details?: any, level: 'info' | 'warning' | 'error' | 'success' = 'info') {
    // NO-OP: Disabled
  }

  public logApiCall(method: string, endpoint: string, status?: number, responseTime?: number, errorDetails?: any) {
    // NO-OP: Disabled
  }

  public logError(message: string, details?: any, context?: string) {
    // NO-OP: Disabled
  }

  public logSuccess(message: string, details?: any) {
    // NO-OP: Disabled
  }

  public forceLog(type: LogEntry['type'], level: LogEntry['level'], category: string, message: string, details?: any, source?: string) {
    // NO-OP: Disabled
  }

  public logCustom(type: LogEntry['type'], level: LogEntry['level'], category: string, message: string, details?: any, source?: string) {
    // NO-OP: Disabled
  }

  public testLogging() {
    // NO-OP: Disabled
  }
}

// Create and export singleton instance
export const logRecorder = new LogRecorder();
