import mongoose from 'mongoose';
import app from './app';

const PORT = process.env.PORT || 3000;
const MONGO_URI = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/ayudave';

async function bootstrap() {
  try {
    // 1. Conectar a la Base de Datos
    console.log(`[Server] Conectando a MongoDB en ${MONGO_URI}...`);
    await mongoose.connect(MONGO_URI);
    console.log('[Server] MongoDB Conectado exitosamente.');

    // 2. Levantar el servidor Express
    app.listen(PORT, () => {
      console.log(`[Server] Backend de AyudaVE corriendo en http://localhost:${PORT}`);
    });
  } catch (error) {
    console.error('[Server] Error crítico durante el inicio:', error);
    process.exit(1);
  }
}

bootstrap();
