import { useState, useEffect, useCallback } from 'react';
import { getPendingCount } from '../db/offlineDb';
import { registerBackgroundSync } from '../utils/sync-utils';

export function useNetworkStatus() {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [pendingCount, setPendingCount] = useState(0);

  const refreshPending = useCallback(async () => {
    const count = await getPendingCount();
    setPendingCount(count);
  }, []);

  useEffect(() => {
    refreshPending();

    const handleOnline = async () => {
      setIsOnline(true);
      await registerBackgroundSync();
      await refreshPending();
    };

    const handleOffline = () => {
      setIsOnline(false);
    };

    const handleSwMessage = (event: MessageEvent) => {
      if (event.data?.type === 'trigger-sync') {
        refreshPending();
      }
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    navigator.serviceWorker?.addEventListener('message', handleSwMessage);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      navigator.serviceWorker?.removeEventListener('message', handleSwMessage);
    };
  }, [refreshPending]);

  return { isOnline, pendingCount, refreshPending };
}
