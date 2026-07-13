export async function registerBackgroundSync(): Promise<boolean> {
  if (!('serviceWorker' in navigator) || !('SyncManager' in window)) {
    return false;
  }
  try {
    const registration = await navigator.serviceWorker.ready;
    const swReg = registration as ServiceWorkerRegistration & { sync: { register: (tag: string) => Promise<void> } };
    await swReg.sync.register('sync-reports');
    return true;
  } catch {
    return false;
  }
}

export async function sendMessageToSW(msg: Record<string, unknown>): Promise<unknown> {
  if (!('serviceWorker' in navigator)) return null;
  try {
    const registration = await navigator.serviceWorker.ready;
    registration.active?.postMessage(msg);
    return true;
  } catch {
    return null;
  }
}
