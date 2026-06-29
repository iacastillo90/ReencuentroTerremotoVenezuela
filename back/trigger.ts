import mongoose from 'mongoose';
import { runFunvisisJob } from './src/jobs/funvisis.job';
import { runInamehJob } from './src/jobs/inameh.job';
import { runCorpoelecJob } from './src/jobs/corpoelec.job';
import { runProteccionCivilJob } from './src/jobs/proteccion-civil.job';
import { runCruzRojaJob } from './src/jobs/cruz-roja.job';

async function main() {
  await mongoose.connect('mongodb://localhost:27017/reencuentro');
  console.log('Conectado a DB');
  
  await runFunvisisJob();
  await runInamehJob();
  await runCorpoelecJob();
  await runProteccionCivilJob();
  await runCruzRojaJob();
  
  console.log('Todos los jobs terminados');
  process.exit(0);
}

main().catch(console.error);
