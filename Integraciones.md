# Guía de Integraciones (Data Ingestion)
**Proyecto:** Reencuentro Terremoto Venezuela 🇻🇪
**Ubicación de los scripts:** `back/src/jobs/` y `back/src/workers/`

---

## 1. Introducción

El valor principal de la plataforma **Reencuentro** es su capacidad para consolidar información de múltiples fuentes caóticas en una única base de datos centralizada.

Esta guía explica a los desarrolladores cómo construir una nueva integración (Scraper, CRON Job, o Webhook) para inyectar datos de terceros en nuestro modelo `UnifiedPerson`, asegurando que no se creen duplicados y que el sistema mantenga su alto rendimiento.

---

## 2. El Patrón de Ingesta (Cómo integrar una fuente)

Todas las integraciones en este proyecto siguen un patrón estricto de **Idempotencia**. Esto significa que el script de integración puede correr 1 vez o 1,000 veces y el resultado en la base de datos debe ser el mismo (sin duplicar personas).

### Pasos obligatorios para un integrador:
1. **Extracción (Fetch):** Obtener los datos de la fuente externa (API, CSV, Web Scraping), respetando siempre los *rate limits* del servidor ajeno.
2. **Mapeo (Transform):** Convertir los campos externos al esquema estricto `UnifiedPerson`.
3. **Firma Criptográfica (`idHash`):** Generar una firma única usando el ID de la fuente original. Esto es vital para que MongoDB sepa si actualizar o crear.
4. **Carga Masiva (Bulk Upsert):** Utilizar `PersonModel.bulkWrite()` para insertar miles de registros de golpe sin asfixiar la base de datos.

---

## 3. Ejemplo Práctico (Scraper de API)

Si deseas agregar una nueva fuente (ej. `CruzRojaAPI`), debes crear un archivo en `back/src/jobs/cruzroja.job.ts`:

```typescript
import { PersonModel } from '../models/unified-person.model';
import crypto from 'crypto';

const SOURCE_ID = 'cruzroja'; // Identificador único de tu fuente

export async function fetchCruzRoja() {
  console.log(`[CruzRoja] Iniciando sincronización...`);
  
  try {
    // 1. Obtener datos externos
    const response = await fetch('https://api.cruzroja.org/desaparecidos');
    const items = await response.json();

    // 2. Mapear y preparar operaciones masivas (Bulk Upsert)
    const operations = items.map((item: any) => {
      
      // 3. GENERACIÓN DEL HASH (¡CRÍTICO PARA DEDUPLICACIÓN!)
      // Si la Cruz Roja nos manda el ID "994", el hash siempre será el mismo.
      const idHash = crypto.createHash('sha256').update(`${SOURCE_ID}-${item.id}`).digest('hex');

      return {
        updateOne: {
          filter: { idHash },
          update: {
            $set: {
              name: item.nombre_completo,
              normalizedName: item.nombre_completo.toLowerCase().trim(),
              status: item.encontrado ? 'found' : 'missing',
              age: item.edad,
              gender: item.genero,
              'lastSeen.date': new Date(item.fecha_reporte),
              'lastSeen.state': item.estado || 'Desconocido',
              'lastSeen.description': item.detalles,
              sourceRecords: [{ source: SOURCE_ID, externalId: item.id }],
              'metadata.updatedAt': new Date()
            }
          },
          upsert: true // Si el idHash no existe, lo crea. Si existe, lo actualiza.
        }
      };
    });

    // 4. Escribir en base de datos en lotes de 100
    if (operations.length > 0) {
      const chunkSize = 100;
      for (let i = 0; i < operations.length; i += chunkSize) {
        await PersonModel.bulkWrite(operations.slice(i, i + chunkSize));
      }
    }

    console.log(`[CruzRoja] Completado: ${items.length} personas procesadas.`);
  } catch (error) {
    console.error(`[CruzRoja] Error:`, error);
  }
}
```

---

## 4. Orquestación (Cron Jobs)

Una vez que tu función está lista, debes programarla para que se ejecute automáticamente en el archivo central de inicio (`back/src/server.ts` o el worker dedicado).

Usamos **node-cron** o herramientas similares para tareas repetitivas:

```typescript
import cron from 'node-cron';
import { fetchCruzRoja } from './jobs/cruzroja.job';

// Ejecutar cada hora
cron.schedule('0 * * * *', async () => {
  await fetchCruzRoja();
});
```

---

## 5. Integración con Inteligencia Artificial (Reportes no estructurados)

Si la fuente que estás integrando **no tiene un formato estructurado** (por ejemplo, estás conectando un bot de WhatsApp o un buzón de correos donde la gente escribe texto libre), **NO** intentes mapear los datos manualmente. 

Para estos casos, inyecta los datos crudos a nuestra cola de procesamiento con Inteligencia Artificial usando **BullMQ**:

```typescript
import { addJobToIAQueue } from '../queues/ia-process.queue';

// ... al recibir un mensaje de WhatsApp:
const mensaje = "Hola, busco a mi mamá Carmen Lopez, tiene 65 años y se perdió en Mérida";

await addJobToIAQueue({
  source: 'whatsapp-bot',
  externalId: 'msg-99238', // ID del mensaje
  rawText: mensaje,
  date: new Date()
});
```

El **Worker de IA** tomará este mensaje de la cola de Redis, se comunicará con la API de Anthropic/OpenAI, estructurará automáticamente a "Carmen Lopez" (65 años, Mérida), y la insertará en la base de datos siguiendo las mismas reglas de deduplicación.

---

## 6. Reglas de Oro de las Integraciones

1. **Nunca rompas la aplicación:** Envuelve todo en `try/catch`. Si una fuente externa se cae (Error 500), el script debe loguear el error y detenerse grácilmente.
2. **Respeta los Rate Limits:** Si vas a consultar un API paginada miles de veces, agrega un `await new Promise(r => setTimeout(r, 500))` entre cada página para no saturar los servidores ajenos.
3. **No guardes datos ultra-sensibles:** Si la fuente externa te da números de teléfono personales, direcciones exactas de casas o historiales médicos crudos, **NO** los guardes en `UnifiedPerson`. Extrae solo lo necesario para el reencuentro (Estado, Ciudad, Condición General).
