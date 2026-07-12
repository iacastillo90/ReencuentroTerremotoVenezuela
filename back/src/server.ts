import './sentry'; // INICIALIZAR SENTRY PRIMERO (monitoreo de errores)
import 'dotenv/config'; // Carga back/.env ANTES que cualquier módulo lea process.env (JWT_SECRET, etc.)
import mongoose from 'mongoose';
import http from 'http';
import app from './app';
import { setupDisasterSyncJobs } from './queues/disaster-sync.queue';
import { initializeStorage } from './services/storage.service';
import { UserModel } from './models/user.model';
import { initializeSocketServer } from './services/socket.service';

const PORT = process.env.PORT || 4000;
const MONGO_URI = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/reencuentro';

async function bootstrap() {
  try {
    // Fail-fast in production if JWT_SECRET is missing
    if (!process.env.JWT_SECRET && process.env.NODE_ENV === 'production') {
      console.error('[FATAL] JWT_SECRET is required in production');
      process.exit(1);
    }

    console.log(`[Server] Conectando a MongoDB en ${MONGO_URI}...`);
    await mongoose.connect(MONGO_URI);
    console.log('[Server] MongoDB Conectado exitosamente.');

    // En desarrollo local (npm run dev) corremos todo en un solo proceso.
    // En producción (Docker), el API y el Worker se ejecutan en contenedores separados,
    // así que el contenedor API no debe iniciar los workers (evita duplicación de jobs y uso de CPU).
    if (process.env.NODE_ENV !== 'production' || process.env.RUN_WORKERS_IN_API === 'true') {
      console.log('[Server] Iniciando workers internos (modo monolito)...');
      require('./workers/disaster-sync.worker');
      require('./workers/ia-processor.worker');
      require('./workers/matching.worker');
    } else {
      console.log('[Server] Workers internos deshabilitados (se asume contenedor dedicado).');
    }

    // Alinea los índices del modelo User con el esquema
    try {
      await UserModel.syncIndexes();
      console.log('[Server] Índices de User sincronizados.');
    } catch (err) {
      console.warn('[Server] No se pudieron sincronizar los índices de User:', (err as Error).message);
    }

    // Crear el servidor HTTP sobre Express
    const server = http.createServer(app);

    // Inicializar Socket.IO con las mismas políticas CORS
    const corsOrigins = (process.env.CORS_ORIGINS || 'http://localhost:5173,http://localhost:4000')
      .split(',')
      .map(s => s.trim().replace(/\/$/, ''));
    
    initializeSocketServer(server, corsOrigins);
    console.log('[Server] Servidor Socket.IO inicializado.');

    // El servidor abre el puerto de inmediato
    server.listen(PORT, () => {
      console.log(`[Server] Backend de Reencuentro Terremoto Venezuela corriendo en http://localhost:${PORT}`);

      initializeStorage()
        .then(() => console.log('[Server] Almacenamiento inicializado.'))
        .catch((err) => console.error('[Server] Error inicializando almacenamiento:', err));

      setupDisasterSyncJobs()
        .then(() => console.log('[Server] Jobs de sincronización registrados (segundo plano).'))
        .catch((err) => console.error('[Server] Error registrando jobs de sync:', err));
    });
  } catch (error) {
    console.error('[Server] Error crítico durante el inicio:', error);
    process.exit(1);
  }
}

bootstrap();
