import { useEffect, useCallback, useRef } from 'react';
import { db, getPendingCount } from '../db/offlineDb';
import { api } from '../services/api';
import { registerBackgroundSync, sendMessageToSW } from '../utils/sync-utils';
import { refreshCsrfToken } from '../services/api';

const MAX_RETRIES = 3;

export function useBackgroundSync() {
  const syncingRef = useRef(false);

  const syncOfflineReports = useCallback(async () => {
    if (syncingRef.current) return;
    syncingRef.current = true;

    try {
      const pendingReports = await db.offlineReports
        .where('status')
        .equals('pending')
        .toArray();

      if (pendingReports.length === 0) {
        syncingRef.current = false;
        return;
      }

      await refreshCsrfToken();

      for (const report of pendingReports) {
        try {
          await db.offlineReports.update(report.id!, { status: 'syncing' });

          const payload = { ...report.reportData };

          if (report.photoFile) {
            const formData = new FormData();
            formData.append('file', report.photoFile);
            const uploadRes = await api.post('/media', formData, {
              headers: { 'Content-Type': 'multipart/form-data' },
            });
            payload.photoUrl = uploadRes.data.url;
          }

          await api.post('/persons', payload);
          await db.offlineReports.delete(report.id!);
        } catch (err) {
          const nextRetry = (report.retryCount ?? 0) + 1;
          if (nextRetry >= MAX_RETRIES) {
            await db.offlineReports.update(report.id!, {
              status: 'failed',
              retryCount: nextRetry,
            });
          } else {
            await db.offlineReports.update(report.id!, {
              status: 'pending',
              retryCount: nextRetry,
            });
          }
        }
      }
    } catch {
    } finally {
      syncingRef.current = false;
      const count = await getPendingCount();
      sendMessageToSW({ type: 'pending-count', count });
    }
  }, []);

  useEffect(() => {
    const handleOnline = async () => {
      const hasSync = await registerBackgroundSync();
      if (!hasSync) {
        await syncOfflineReports();
      }
    };

    const handleSwMessage = (event: MessageEvent) => {
      if (event.data?.type === 'trigger-sync') {
        syncOfflineReports();
      }
    };

    window.addEventListener('online', handleOnline);
    navigator.serviceWorker?.addEventListener('message', handleSwMessage);

    if (navigator.onLine) {
      getPendingCount().then((count) => {
        if (count > 0) syncOfflineReports();
      });
    }

    return () => {
      window.removeEventListener('online', handleOnline);
      navigator.serviceWorker?.removeEventListener('message', handleSwMessage);
    };
  }, [syncOfflineReports]);

  return { syncNow: syncOfflineReports };
}
