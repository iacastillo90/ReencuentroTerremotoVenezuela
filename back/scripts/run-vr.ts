import mongoose from 'mongoose';
import { fetchVenezuelaReporta } from '../src/jobs/venezuelareporta.job';

const MONGO_URI = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/ayudave';

async function run() {
  console.log(`Conectando a ${MONGO_URI}...`);
  await mongoose.connect(MONGO_URI);
  console.log('MongoDB Conectado. Ejecutando integracion de Venezuela Reporta...');

  await fetchVenezuelaReporta();

  console.log('¡Extraccion de Venezuela Reporta completada!');
  process.exit(0);
}

run();
