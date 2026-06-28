import mongoose from 'mongoose';
import { runDTVScraper } from '../src/jobs/dtv.job';

const MONGO_URI = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/ayudave';

async function run() {
  console.log(`Conectando a ${MONGO_URI}...`);
  await mongoose.connect(MONGO_URI);
  console.log('MongoDB Conectado. Ejecutando scraper de DTV (Página 1)...');

  // Solo hacemos scraping de la página 1 por defecto para la demostración
  await runDTVScraper(1);

  console.log('¡Scraping de demostración completado!');
  process.exit(0);
}

run();
