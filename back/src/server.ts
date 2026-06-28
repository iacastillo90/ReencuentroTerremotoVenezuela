import mongoose from 'mongoose';
import app from './app';
import { setupDisasterSyncJobs } from './queues/disaster-sync.queue';
import { initializeStorage } from './services/storage.service';
import './workers/disaster-sync.worker';
import './workers/ia-processor.worker';

const PORT = process.env.PORT || 4000;
const MONGO_URI = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/ayudave';

async function bootstrap() {
  try {
    console.log(`[Server] Conectando a MongoDB en ${MONGO_URI}...`);
    await mongoose.connect(MONGO_URI);
    console.log('[Server] MongoDB Conectado exitosamente.');

    await initializeStorage();
    await setupDisasterSyncJobs();

    app.listen(PORT, () => {
      console.log(`[Server] Backend de AyudaVE corriendo en http://localhost:${PORT}`);
    });
  } catch (error) {
    console.error('[Server] Error crítico durante el inicio:', error);
    process.exit(1);
  }
}

bootstrap();
