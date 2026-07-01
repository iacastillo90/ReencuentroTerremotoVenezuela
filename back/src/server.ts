import mongoose from 'mongoose';
import app from './app';
import { setupDisasterSyncJobs } from './queues/disaster-sync.queue';
import { initializeStorage } from './services/storage.service';
import { UserModel } from './models/user.model';
import './workers/disaster-sync.worker';
import './workers/ia-processor.worker';

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

    // Alinea los índices del modelo User con el esquema: reemplaza un índice viejo
    // de googleId (único no-parcial) por el parcial actual y evita el error
    // E11000 { googleId: null } al registrar por correo. No bloquea el arranque.
    try {
      await UserModel.syncIndexes();
      console.log('[Server] Índices de User sincronizados.');
    } catch (err) {
      console.warn('[Server] No se pudieron sincronizar los índices de User:', (err as Error).message);
    }

    // El servidor abre el puerto de inmediato; las tareas pesadas (storage e
    // ingesta/sincronización) corren en segundo plano para NO bloquear el arranque.
    app.listen(PORT, () => {
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
