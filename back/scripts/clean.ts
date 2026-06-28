import mongoose from 'mongoose';
import { PersonModel } from '../src/models/unified-person.model';
import { DisasterEventModel } from '../src/models/disaster-event.model';

const MONGO_URI = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/ayudave';

async function clean() {
  console.log(`Conectando a ${MONGO_URI}...`);
  await mongoose.connect(MONGO_URI);
  console.log('MongoDB Conectado. Limpiando datos simulados...');

  await PersonModel.deleteMany({ idHash: { $regex: '^hash-dummy' } });
  await PersonModel.deleteMany({ idHash: { $in: ['hash-juan-perez', 'hash-ana-lopez', 'hash-carlos-gomez'] } });
  await DisasterEventModel.deleteMany({ externalId: 'simulated-earthquake-ccs' });

  console.log('¡Datos simulados eliminados con éxito!');
  process.exit(0);
}

clean();
