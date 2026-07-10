import { useEffect, useState } from 'react';
import { db } from '../db/offlineDb';
import { api } from '../services/api';

export function useBackgroundSync() {
  const [isOnline, setIsOnline] = useState(navigator.onLine);

  useEffect(() => {
    const handleOnline = async () => {
      setIsOnline(true);
      await syncOfflineReports();
    };

    const handleOffline = () => {
      setIsOnline(false);
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Initial sync check
    if (navigator.onLine) {
      syncOfflineReports();
    }

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const syncOfflineReports = async () => {
    try {
      const pendingReports = await db.offlineReports
        .where('status')
        .equals('draft_offline')
        .toArray();

      if (pendingReports.length === 0) return;

      console.log(`[Background Sync] Found ${pendingReports.length} pending reports to sync.`);

      for (const report of pendingReports) {
        try {
          // Mark as syncing
          await db.offlineReports.update(report.id!, { status: 'syncing' });

          const payload = { ...report.reportData };

          // Upload photo if present
          if (report.photoFile) {
            const formData = new FormData();
            formData.append('file', report.photoFile);
            const uploadRes = await api.post('/media', formData, { 
              headers: { 'Content-Type': 'multipart/form-data' } 
            });
            payload.photoUrl = uploadRes.data.url;
          }

          // Send data to backend
          await api.post('/persons', payload);

          // Delete from IndexedDB on success
          await db.offlineReports.delete(report.id!);
          console.log(`[Background Sync] Successfully synced report ID: ${report.id}`);
        } catch (err) {
          console.error(`[Background Sync] Failed to sync report ID: ${report.id}`, err);
          // Mark as failed or revert to draft_offline to retry later
          await db.offlineReports.update(report.id!, { status: 'draft_offline' });
        }
      }
    } catch (err) {
      console.error('[Background Sync] Error during sync process:', err);
    }
  };

  return { isOnline };
}
