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

  // 4. Generar 1000 Personas Desaparecidas Simuladas para ver el clustering
  const names = ['Juan', 'Ana', 'Carlos', 'Maria', 'Pedro', 'Laura', 'Jose', 'Carmen', 'Luis', 'Sofia'];
  const lastNames = ['Perez', 'Lopez', 'Gomez', 'Rodriguez', 'Martinez', 'Garcia', 'Fernandez', 'Gonzalez'];
  const states = ['Distrito Capital', 'Miranda', 'Aragua', 'Carabobo', 'Lara', 'Zulia'];
  const baseLat = 10.48; // Caracas region
  const baseLng = -66.9; 
  
  const dummyPersons = [];
  for (let i = 0; i < 1000; i++) {
    const isMale = Math.random() > 0.5;
    const name = names[Math.floor(Math.random() * names.length)];
    const lastName = lastNames[Math.floor(Math.random() * lastNames.length)];
    
    // Spread markers around Venezuela
    const latOffset = (Math.random() - 0.5) * 5; // Spread vertically
    const lngOffset = (Math.random() - 0.5) * 8; // Spread horizontally

    dummyPersons.push({
      type: 'person',
      idHash: `hash-dummy-${i}`,
      normalizedName: `${name} ${lastName}`.toLowerCase(),
      name: `${name} ${lastName}`,
      status: Math.random() > 0.8 ? 'found' : 'missing',
      age: Math.floor(Math.random() * 60) + 10,
      gender: isMale ? 'M' : 'F',
      contactPerson: { name: 'Familiar', phone: '04141234567', relationship: 'Familia' },
      lastSeen: {
        date: new Date(),
        state: states[Math.floor(Math.random() * states.length)],
        municipality: 'Desconocido',
        description: 'Reportado durante las últimas horas.',
        coordinates: {
          type: 'Point',
          coordinates: [baseLng + lngOffset, baseLat + latOffset]
        }
      },
      photoUrl: `https://i.pravatar.cc/150?u=${i}`,
      sourceRecords: [],
      metadata: { urgencyScore: Math.floor(Math.random() * 100), createdAt: new Date(), updatedAt: new Date(), confidenceScore: 100 }
    });
  }

  // Dividir en chunks para no sobrecargar el bulk insert
  for (let i = 0; i < dummyPersons.length; i += 200) {
    await PersonModel.create(dummyPersons.slice(i, i + 200) as any[]);
  }

  console.log('¡Seeding completado con éxito!');
  process.exit(0);
}

seed();
