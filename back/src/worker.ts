import './sentry'; // INICIALIZAR SENTRY PRIMERO (monitoreo de errores)
import 'dotenv/config'; // Carga variables de entorno
import mongoose from 'mongoose';

const MONGO_URI = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/reencuentro';

async function bootstrapWorker() {
  try {
    console.log(`[Worker] Conectando a MongoDB en ${MONGO_URI}...`);
    await mongoose.connect(MONGO_URI);
    console.log('[Worker] MongoDB Conectado exitosamente.');

    // Iniciar todos los procesos en segundo plano
    console.log('[Worker] Iniciando colas de procesamiento (BullMQ)...');
    require('./workers/disaster-sync.worker');
    require('./workers/ia-processor.worker');
    require('./workers/matching.worker');
    
    console.log('[Worker] Todos los workers están escuchando tareas.');
  } catch (error) {
    console.error('[Worker] Error crítico durante el inicio:', error);
    process.exit(1);
  }
}

bootstrapWorker();
