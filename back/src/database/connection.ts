/**
 * database/connection.ts — Conexión a MongoDB
 *
 * PROPÓSITO:
 *   Configura y maneja la conexión a MongoDB usando Mongoose.
 *   Soporta conexión desde el servidor principal (Server) y desde
 *   workers independientes. Provee fail fast si la conexión falla.
 *
 * CARACTERÍSTICAS:
 *   - connectDB(caller): Conecta a MongoDB, sync índices solo en Server
 *   - Sync de UserModel indexes (solo caller='Server'): Evita race conditions
 *   - MONGO_URI configurable via env var (default: localhost:27017)
 *   - disconnected handler: Log de advertencia si se pierde conexión
 *
 * FLUJO:
 *   1. Server bootstrap: connectDB('Server') al iniciar la app
 *   2. Worker inicialización: connectDB('Worker') al arrancar worker
 *   3. Si falla: log crítico + process.exit(1) (fail fast)
 *   4. Si se desconecta: log warning (Mongoose reconecta automáticamente)
 *
 * SEGURIDAD:
 *   - Exit on failure: No operar sin BD (datos inconsistentes)
 *   - Sync indexes solo en Server: Previene colisiones entre workers
 *   - log URI sin credentials: MONGO_URI debe tener creds inline (mongodb://user:pass@host)
 *
 * DECISIONES TÉCNICAS:
 *   - Server vs Worker caller: El servidor sincroniza índices, los workers no
 *   - process.exit(1): Fail fast es mejor que corrupción silenciosa
 *   - mongoose.connect sin opciones extra: Mongoose 9 maneja defaults modernos
 *   - disconnected listener: Mongoose 9 autoreconnect, solo log
 *
 * CÓMO USAR:
 *   await connectDB('Server');  // En server.ts
 *   await connectDB('Worker'); // En worker files
 */
import mongoose from 'mongoose';
import { UserModel } from '../models/user.model';
import { logger } from '../utils/logger.util';

const MONGO_URI = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/reencuentro';

/** Redacta credenciales de la URI para logging seguro */
function redactMongoUri(uri: string): string {
  try {
    return uri.replace(/\/\/[^:]+:[^@]+@/, '//__redacted__:__redacted__@');
  } catch {
    return uri;
  }
}

export const connectDB = async (caller: 'Server' | 'Worker' = 'Server') => {
  try {
    logger.info({ mongoUri: redactMongoUri(MONGO_URI), caller }, 'Connecting to MongoDB...');
    await mongoose.connect(MONGO_URI);
    logger.info({ caller }, 'MongoDB connected');

    if (caller === 'Server') {
      try {
        await UserModel.syncIndexes();
        logger.info({ caller }, 'User indexes synced');
      } catch (err) {
        logger.warn({ err: (err as Error).message, caller }, 'Could not sync User indexes');
      }
    }
  } catch (error) {
    logger.error({ err: error, caller }, 'Critical MongoDB connection error');
    process.exit(1);
  }
};

mongoose.connection.on('disconnected', () => {
  logger.warn('[MongoDB] Disconnected. Attempting reconnection...');
});
