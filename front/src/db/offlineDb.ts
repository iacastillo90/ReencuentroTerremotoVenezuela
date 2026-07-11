/**
 * db/offlineDb.ts — Base de datos local (IndexedDB vía Dexie)
 *
 * PROPÓSITO:
 *   Almacena reportes creados cuando el usuario está offline
 *   para sincronizarlos automáticamente cuando vuelva la conexión.
 *
 * ¿POR QUÉ DEXIE?
 *   IndexedDB nativo tiene una API verbosa y propensa a errores.
 *   Dexie la envuelve en una API tipo Promise con tablas, índices
 *   y queries simples.
 *
 * ESQUEMA:
 *   offlineReports:
 *     id:         auto-increment (primary key)
 *     reportData: objeto JSON con los datos del reporte
 *     photoFile:  blob de la foto (opcional)
 *     status:     'draft_offline' | 'syncing' | 'failed'
 *     createdAt:  timestamp UNIX
 *
 * FLUJO:
 *   1. El usuario crea un reporte sin conexión → guardamos en
 *      offlineReports con status 'draft_offline'.
 *   2. useBackgroundSync detecta que volvimos online y envía
 *      los reportes pendientes al backend.
 *   3. Al sincronizar, cambia status a 'syncing'.
 *   4. Si éxito → elimina el registro. Si falla → status 'draft_offline'.
 *
 * USO:
 *   import { db } from '../db/offlineDb';
 *   await db.offlineReports.add({ reportData: {...}, photoFile, status: 'draft_offline', createdAt: Date.now() });
 */
import Dexie, { type Table } from 'dexie';

export interface OfflineReport {
  id?: number;
  reportData: any;
  photoFile?: File;
  status: 'draft_offline' | 'syncing' | 'failed';
  createdAt: number;
}

export class ReencuentroDatabase extends Dexie {
  offlineReports!: Table<OfflineReport>;

  constructor() {
    super('ReencuentroDB');
    this.version(1).stores({
      offlineReports: '++id, status, createdAt'
    });
  }
}

export const db = new ReencuentroDatabase();
