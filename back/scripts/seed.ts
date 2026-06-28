import mongoose from 'mongoose';
import { PersonModel } from '../src/models/unified-person.model';
import { DisasterEventModel } from '../src/models/disaster-event.model';
import { fetchUSGSEarthquakes } from '../src/jobs/usgs.job';

const MONGO_URI = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/ayudave';

async function seed() {
  console.log(`Conectando a ${MONGO_URI}...`);
  await mongoose.connect(MONGO_URI);
  console.log('MongoDB Conectado. Ejecutando seeders...');

  // 1. Limpiar base de datos
  await PersonModel.deleteMany({});
  await DisasterEventModel.deleteMany({});

  // 2. Ejecutar sync real de USGS para traer sismos reales si los hay
  await fetchUSGSEarthquakes().catch(() => console.log('Error fetch USGS'));

  // 3. Insertar un Sismo Simulado en Caracas (para garantizar que se vea)
  await DisasterEventModel.create({
    externalId: 'simulated-earthquake-ccs',
    type: 'earthquake',
    title: 'Sismo Simulado - Falla de San Sebastián',
    description: 'Sismo simulado para demostración del mapa',
    severity: 'critical',
    source: 'usgs',
    coordinates: {
      type: 'Point',
      coordinates: [-66.9036, 10.4806] // Longitud, Latitud (Caracas)
    },
    radius_km: 30,
    occurredAt: new Date(),
    metadata: {
      magnitude: 7.2,
      depth_km: 15
    }
  } as any);

  // 4. Insertar Personas Desaparecidas Simuladas
  await PersonModel.create([
    {
      type: 'person',
      idHash: 'hash-juan-perez',
      normalizedName: 'juan perez',
      name: 'Juan Pérez',
      status: 'missing',
      age: 35,
      gender: 'M',
      contactPerson: { name: 'Maria', phone: '04141234567', relationship: 'Esposa' },
      lastSeen: {
        date: new Date(),
        state: 'Distrito Capital',
        municipality: 'Libertador',
        description: 'Visto por última vez cerca del centro de Caracas, llevaba franela roja.',
        coordinates: {
          type: 'Point',
          coordinates: [-66.9050, 10.4900]
        }
      },
      sourceRecords: [],
      metadata: { urgencyScore: 85, createdAt: new Date(), updatedAt: new Date(), confidenceScore: 100 }
    } as any,
    {
      type: 'person',
      idHash: 'hash-ana-lopez',
      normalizedName: 'ana lopez',
      name: 'Ana López',
      status: 'missing',
      age: 28,
      gender: 'F',
      contactPerson: { name: 'Carlos', phone: '04121234567', relationship: 'Hermano' },
      lastSeen: {
        date: new Date(),
        state: 'Miranda',
        municipality: 'Chacao',
        description: 'No se ha podido comunicar desde el sismo.',
        coordinates: {
          type: 'Point',
          coordinates: [-66.8500, 10.4950]
        }
      },
      sourceRecords: [],
      metadata: { urgencyScore: 92, createdAt: new Date(), updatedAt: new Date(), confidenceScore: 100 }
    } as any,
    {
      type: 'person',
      idHash: 'hash-carlos-gomez',
      normalizedName: 'carlos gomez',
      name: 'Carlos Gómez',
      status: 'found',
      age: 42,
      gender: 'M',
      contactPerson: { name: 'Pedro', phone: '04161234567', relationship: 'Amigo' },
      lastSeen: {
        date: new Date(),
        state: 'Aragua',
        municipality: 'Maracay',
        description: 'Se reportó a salvo en un refugio.',
        coordinates: {
          type: 'Point',
          coordinates: [-67.5951, 10.2469]
        }
      },
      sourceRecords: [],
      metadata: { urgencyScore: 10, createdAt: new Date(), updatedAt: new Date(), confidenceScore: 100 }
    } as any
  ]);

  console.log('¡Seeding completado con éxito!');
  process.exit(0);
}

seed();
