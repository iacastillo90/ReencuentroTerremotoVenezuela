import mongoose from 'mongoose';
import { runGeospatialCrossover, runFuzzyMatching } from '../src/jobs/reconcile.job';

const MONGO_URI = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/reencuentro';

async function run() {
  console.log(`Conectando a ${MONGO_URI}...`);
  await mongoose.connect(MONGO_URI);
  console.log('MongoDB Conectado. Ejecutando motores de inteligencia...');

  await runGeospatialCrossover();
  await runFuzzyMatching();

  console.log('¡Motores de inteligencia ejecutados con éxito!');
  process.exit(0);
}

run();
