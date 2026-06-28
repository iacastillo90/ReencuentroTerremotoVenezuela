import mongoose from 'mongoose';
import { fetchReencuentroPersons } from '../src/jobs/reencuentro.job';

const MONGO_URI = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/reencuentro';

async function run() {
  console.log(`Conectando a ${MONGO_URI}...`);
  await mongoose.connect(MONGO_URI);
  console.log('MongoDB Conectado. Ejecutando job Reencuentro...');

  await fetchReencuentroPersons();

  console.log('¡Sincronización manual completada!');
  process.exit(0);
}

run();
