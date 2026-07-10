import Dexie, { type Table } from 'dexie';

export interface OfflineReport {
  id?: number;
  reportData: any; // The JSON data
  photoFile?: File; // The photo blob
  status: 'draft_offline' | 'syncing' | 'failed';
  createdAt: number;
}

export class ReencuentroDatabase extends Dexie {
  offlineReports!: Table<OfflineReport>;

  constructor() {
    super('ReencuentroDB');
    this.version(1).stores({
      offlineReports: '++id, status, createdAt' // Primary key and indexed props
    });
  }
}

export const db = new ReencuentroDatabase();
