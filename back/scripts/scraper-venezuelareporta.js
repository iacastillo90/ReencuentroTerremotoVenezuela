#!/usr/bin/env node
/**
 * scraper-venezuelareporta.js
 * ─────────────────────────────────────────────────────────────
 * Descarga TODOS los registros de venezuelareporta.org/api/v1/personas
 * y los inserta/actualiza en MongoDB respetando el límite de 119 req/min.
 *
 * Uso:
 *   node back/scripts/scraper-venezuelareporta.js
 *   node back/scripts/scraper-venezuelareporta.js --dry-run   (solo cuenta, no escribe)
 *   node back/scripts/scraper-venezuelareporta.js --status=buscando
 *   node back/scripts/scraper-venezuelareporta.js --since=2026-06-01T00:00:00Z
 *
 * Variables de entorno (opcional):
 *   MONGO_URI=mongodb://127.0.0.1:27017/reencuentro
 */

'use strict';

const { MongoClient } = require('mongodb');
const crypto = require('crypto');

// ─── Config ───────────────────────────────────────────────────
const MONGO_URI   = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/reencuentro';
const COLLECTION  = 'persons';
const SOURCE_ID   = 'venezuelareporta';
const API_BASE    = 'https://venezuelareporta.org/api/v1/personas';
const PAGE_LIMIT  = 100;           // máx permitido por la API
const REQ_PER_MIN = 119;           // respetamos el límite de 120/min
const DELAY_MS    = Math.ceil((60 / REQ_PER_MIN) * 1000); // ≈ 505 ms

// ─── Args ─────────────────────────────────────────────────────
const args     = process.argv.slice(2);
const DRY_RUN  = args.includes('--dry-run');
const STATUS   = (args.find(a => a.startsWith('--status='))  || '').split('=')[1] || '';
const SINCE    = (args.find(a => a.startsWith('--since='))   || '').split('=')[1] || '';
const FORCE    = args.includes('--force'); // Re-inserta aunque no haya cambios

// ─── Helpers ──────────────────────────────────────────────────
const sleep  = (ms) => new Promise(r => setTimeout(r, ms));
const hash   = (str) => crypto.createHash('sha256').update(str).digest('hex');

function mapStatus(vrStatus) {
  if (vrStatus === 'a_salvo' || vrStatus === 'encontrado') return 'found';
  return 'missing';
}

function mapGender(genero) {
  if (genero === 'masculino') return 'M';
  if (genero === 'femenino')  return 'F';
  return 'unknown';
}

function mapPerson(item) {
  const idHash      = hash(`${SOURCE_ID}-${item.id}`);
  const status      = mapStatus(item.status);
  const urgency     = status === 'missing' ? 85 : 10;
  const confidence  = item.verificado ? 95 : 65;

  return {
    updateOne: {
      filter: { idHash },
      update: {
        $set: {
          idHash,
          type:           'person',
          normalizedName: (item.nombre || '').toLowerCase().trim(),
          name:           (item.nombre  || '').trim(),
          status,
          age:            item.edad   || null,
          gender:         mapGender(item.genero),
          description:    item.descripcion || null,
          photoUrl:       item.foto_url    || null,
          lastSeen: {
            date:        item.created_at ? new Date(item.created_at) : new Date(),
            state:       item.ciudad || 'Desconocido',
            municipality:item.zona   || null,
            description: [item.ultima_vez, item.descripcion].filter(Boolean).join(' – ') || null,
            coordinates: {
              type:        'Point',
              coordinates: [-66.9, 10.48] // Centro de Venezuela (fallback)
            }
          },
          data: {
            cedula:       item.cedula     || null,
            ficha_url:    item.ficha_url  || null,
            origen:       item.origen     || SOURCE_ID,
            verificado_por: item.verificado_por || null,
          },
          sourceRecords: [{
            source:     SOURCE_ID,
            externalId: String(item.id),
          }],
          metadata: {
            urgencyScore:   urgency,
            confidenceScore:confidence,
            auditStatus:    'clean',
            source:         SOURCE_ID,
            createdAt:      new Date(),
            updatedAt:      new Date(),
          }
        }
      },
      upsert: true
    }
  };
}

// ─── Progress Bar ─────────────────────────────────────────────
function renderProgress(done, total, inserted, updated, errors, elapsed) {
  const pct     = total > 0 ? Math.floor((done / total) * 100) : 0;
  const filled  = Math.floor(pct / 4);
  const bar     = '█'.repeat(filled) + '░'.repeat(25 - filled);
  const rps     = done > 0 ? (done / (elapsed / 1000)).toFixed(1) : '0.0';
  const eta     = done < total && rps > 0
    ? `ETA: ${Math.ceil((total - done) / rps / 60)}m${Math.ceil((total - done) / rps % 60)}s`
    : 'Completado';

  process.stdout.write(
    `\r  [${bar}] ${pct}% | ${done}/${total} registros | ` +
    `✅ ${inserted} nuevos | 🔄 ${updated} actualizados | ` +
    `❌ ${errors} errores | ${rps} pág/s | ${eta}   `
  );
}

// ─── Main ─────────────────────────────────────────────────────
async function main() {
  console.log('\n╔══════════════════════════════════════════════════════════╗');
  console.log('║   🇻🇪  Scraper Venezuela Reporta → AyudaVE MongoDB       ║');
  console.log('╚══════════════════════════════════════════════════════════╝');
  console.log(`  📡  API:        ${API_BASE}`);
  console.log(`  🗄️   MongoDB:    ${MONGO_URI}`);
  console.log(`  ⏱️   Ritmo:      ${REQ_PER_MIN} req/min (${DELAY_MS}ms entre páginas)`);
  console.log(`  📦  Página:     ${PAGE_LIMIT} registros/req`);
  if (DRY_RUN)  console.log('  🧪  MODO DRY-RUN: no se escribirá nada en BD');
  if (STATUS)   console.log(`  🔎  Filtro status: ${STATUS}`);
  if (SINCE)    console.log(`  📅  Filtro since:  ${SINCE}`);
  console.log('');

  // 1. Sondeo inicial — obtener total
  const probeParams = new URLSearchParams({ limit: '1', ...(STATUS && { status: STATUS }), ...(SINCE && { since: SINCE }) });
  const probeRes    = await fetch(`${API_BASE}?${probeParams}`, {
    headers: { 'User-Agent': 'AyudaVE-Scraper/1.0 (ayudave.org)' }
  });

  if (!probeRes.ok) {
    throw new Error(`Error en sondeo inicial: HTTP ${probeRes.status}`);
  }

  const probeData = await probeRes.json();
  const TOTAL     = probeData.total || 0;
  const PAGES     = Math.ceil(TOTAL / PAGE_LIMIT);

  console.log(`  📊  Total en API: ${TOTAL.toLocaleString()} personas (${PAGES} páginas)`);
  console.log(`  ⏳  Tiempo est.:  ~${Math.ceil(PAGES * DELAY_MS / 60000)} minutos\n`);

  if (TOTAL === 0) {
    console.log('⚠️  No hay registros para sincronizar.');
    return;
  }

  // 2. Conectar a MongoDB
  let client, collection;
  if (!DRY_RUN) {
    console.log('  🔌  Conectando a MongoDB...');
    client     = new MongoClient(MONGO_URI);
    await client.connect();
    collection = client.db().collection(COLLECTION);
    console.log('  ✅  Conexión establecida.\n');
  }

  // 3. Scraping paginado
  let offset      = 0;
  let totalFetched = 0;
  let totalInserted = 0;
  let totalUpdated  = 0;
  let totalErrors   = 0;
  const startTime   = Date.now();

  console.log('  Iniciando descarga...\n');

  for (let page = 0; page < PAGES; page++) {
    const params = new URLSearchParams({
      limit:  String(PAGE_LIMIT),
      offset: String(offset),
      ...(STATUS && { status: STATUS }),
      ...(SINCE  && { since:  SINCE  }),
    });

    try {
      const res = await fetch(`${API_BASE}?${params}`, {
        headers: { 'User-Agent': 'AyudaVE-Scraper/1.0 (ayudave.org)' }
      });

      if (!res.ok) {
        console.error(`\n  ❌  Página ${page + 1}: HTTP ${res.status} — reintentando en 5s...`);
        await sleep(5000);
        page--; // Reintentar esta página
        continue;
      }

      const data  = await res.json();
      const items = data.personas || [];

      if (items.length === 0) break; // Fin de datos

      totalFetched += items.length;

      if (!DRY_RUN && items.length > 0) {
        try {
          const ops    = items.map(mapPerson);
          const result = await collection.bulkWrite(ops, { ordered: false });
          totalInserted += result.upsertedCount  || 0;
          totalUpdated  += result.modifiedCount  || 0;
        } catch (dbErr) {
          totalErrors++;
          // Continuar aunque falle un batch
        }
      }

      offset += items.length;
      renderProgress(page + 1, PAGES, totalInserted, totalUpdated, totalErrors, Date.now() - startTime);

      // Respetar rate limit (excepto en la última página)
      if (page < PAGES - 1) {
        await sleep(DELAY_MS);
      }

    } catch (fetchErr) {
      totalErrors++;
      console.error(`\n  ⚠️   Error red página ${page + 1}: ${fetchErr.message}. Reintentando...`);
      await sleep(2000);
      page--; // Reintentar
    }
  }

  // 4. Resumen final
  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
  console.log('\n\n╔══════════════════════════════════════════════════════════╗');
  console.log('║                   ✅  SINCRONIZACIÓN COMPLETA            ║');
  console.log('╚══════════════════════════════════════════════════════════╝');
  console.log(`  📥  Registros descargados:  ${totalFetched.toLocaleString()}`);
  if (!DRY_RUN) {
    console.log(`  🆕  Nuevos insertados:       ${totalInserted.toLocaleString()}`);
    console.log(`  🔄  Actualizados:            ${totalUpdated.toLocaleString()}`);
    console.log(`  ❌  Errores de escritura:    ${totalErrors}`);
  }
  console.log(`  ⏱️   Tiempo total:            ${elapsed}s`);
  console.log(`  🔍  Verifica en:             http://localhost:4000/api/persons\n`);

  if (client) await client.close();
}

main().catch(err => {
  console.error('\n\n❌ Error crítico:', err.message);
  process.exit(1);
});
