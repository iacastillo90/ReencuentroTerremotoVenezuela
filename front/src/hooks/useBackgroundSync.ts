/**
 * hooks/useBackgroundSync.js — Sincronización offline → servidor
 *
 * PROPÓSITO:
 *   Cuando el usuario crea un reporte sin conexión (offline),
 *   este hook detecta cuando vuelve la conectividad y envía
 *   los reportes pendientes al backend automáticamente.
 *
 * ¿CÓMO FUNCIONA?
 *   1. Escucha los eventos 'online' y 'offline' del navegador.
 *   2. Al iniciar, si hay conexión, ejecuta syncOfflineReports().
 *   3. syncOfflineReports() lee de IndexedDB (db.offlineReports)
 *      todos los reportes con status 'draft_offline'.
 *   4. Por cada reporte:
 *      a) Marca status → 'syncing' (para evitar doble envío).
 *      b) Si hay foto, la sube a /media via FormData.
 *      c) Envía los datos a POST /persons.
 *      d) Si ok → elimina el reporte de IndexedDB.
 *      e) Si falla → regresa a 'draft_offline' (reintento futuro).
 *
 * DEPENDENCIAS:
 *   - db (offlineDb.ts): Dexie database con tabla offlineReports.
 *   - api (services/api.ts): instancia Axios con CSRF.
 *
 * RETORNA:
 *   { isOnline }: boolean que indica el estado de conectividad.
 */
import { useEffect, useState } from 'react';
import { db } from '../db/offlineDb';
import { api } from '../services/api';

export function useBackgroundSync() {
  const [isOnline, setIsOnline] = useState(navigator.onLine);

  useEffect(() => {
    // Cuando volvemos a estar online, sincroniza.
    const handleOnline = async () => {
      setIsOnline(true);
      await syncOfflineReports();
    };

    const handleOffline = () => {
      setIsOnline(false);
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Sincronización inicial si ya estamos online.
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


      for (const report of pendingReports) {
        try {
          // Marca como syncing para evitar doble envío.
          await db.offlineReports.update(report.id!, { status: 'syncing' });

          const payload = { ...report.reportData };

          // Sube la foto si existe.
          if (report.photoFile) {
            const formData = new FormData();
            formData.append('file', report.photoFile);
            const uploadRes = await api.post('/media', formData, { 
              headers: { 'Content-Type': 'multipart/form-data' } 
            });
            payload.photoUrl = uploadRes.data.url;
          }

          // Envía los datos al backend.
          await api.post('/persons', payload);

          // Éxito: elimina de IndexedDB.
          await db.offlineReports.delete(report.id!);
        } catch (err) {
          console.error(`[Background Sync] Failed to sync report ID: ${report.id}`, err);
          // Reintentará en el próximo ciclo online.
          await db.offlineReports.update(report.id!, { status: 'draft_offline' });
        }
      }
    } catch (err) {
      console.error('[Background Sync] Error during sync process:', err);
    }
  };

  return { isOnline };
}
