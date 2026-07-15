import Dexie, { type Table } from 'dexie';

export type ReportData = Record<string, unknown>;

export interface OfflineReport {
  id?: number;
  reportData: ReportData;
  photoFile?: File;
  csrfToken?: string;
  status: 'pending' | 'syncing' | 'failed';
  retryCount: number;
  createdAt: number;
}

export class ReencuentroDatabase extends Dexie {
  offlineReports!: Table<OfflineReport>;

  constructor() {
    super('ReencuentroDB');
    this.version(2).stores({
      offlineReports: '++id, status, createdAt'
    }).upgrade((tx) => {
      tx.table('offlineReports').toCollection().modify((report) => {
        if (report.status === 'draft_offline') {
          report.status = 'pending';
        }
        if (report.retryCount === undefined) {
          report.retryCount = 0;
        }
      });
    });
  }
}

export const db = new ReencuentroDatabase();

export async function getPendingCount(): Promise<number> {
  try {
    return await db.offlineReports.where('status').equals('pending').count();
  } catch {
    return 0;
  }
}

export async function addPendingReport(
  reportData: ReportData,
  photoFile?: File,
  csrfToken?: string
): Promise<number> {
  return db.offlineReports.add({
    reportData,
    photoFile,
    csrfToken,
    status: 'pending',
    retryCount: 0,
    createdAt: Date.now(),
  });
}
