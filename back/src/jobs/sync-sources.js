'use strict';

const store = require('../store');
const normalize = require('../normalize');
// Mocks for scaffolding
const withBackoff = async (fn) => fn();
const computeConfidence = (record) => ({ score: 0.3, label: 'unverified' });

const { ingestDualWrite } = require('../bridge');
const Redis = require('ioredis');

// Reemplazo de memoria local: cliente Redis
const redisClient = new Redis(process.env.REDIS_URL || 'redis://127.0.0.1:6379');

// Array de fuentes a integrar (comentadas hasta su implementación real)
const SOURCES = [
  // require('../import-ayudave'),
  // require('../import-dtv'),
  // require('../import-ocr-hospitals'),
  // require('../import-whatsapp'),
  // require('../import-telegram'),
];

function buildCtx(log) {
  return {
    normalize,
    getSyncState: store.getSyncState,
    updateSyncState: store.updateSyncState,
    withBackoff,
    computeConfidence,
    log,
  };
}

async function runAll() {
  for (const source of SOURCES) {
    const log = (level, msg, data) =>
      console[level === 'error' ? 'error' : 'log'](`[sync-sources][${source.id}]`, msg, data || '');

    try {
      const records = await source.fetchAll(buildCtx(log));

      if (records && records.length > 0) {
        if (source.dest === 'db') {
          // Escritura Híbrida: SQL Legacy + Mongo/IA
          await ingestDualWrite(records);
        } else if (source.dest === 'memory') {
          // Destino en memoria resuelto mediante Caché Efímera en Redis
          const ttlSeconds = (source.intervalMs || 300000) / 1000;
          await redisClient.set(
            `cache:${source.id}`, 
            JSON.stringify(records), 
            'EX', 
            ttlSeconds
          );
          log('info', `Caché efímera guardada en Redis (TTL: ${ttlSeconds}s)`);
        }
      }
    } catch (err) {
      log('error', 'fetchAll falló — saltando esta fuente', err.message);
    }
  }
}

module.exports = { runAll };
