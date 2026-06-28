module.exports = {
  upsertMediaBatch: async (records) => {
    // Stub para simular la persistencia en las tablas legacy relacionales de AyudaVE
    console.log(`[store.js:Stub] Simulando inserción de ${records.length} registros en PostgreSQL (Legacy)`);
    return true;
  },
  getSyncState: async (key) => null, // Siempre simular registro nuevo para testing inicial
  updateSyncState: async (key, checksum) => {
    // Stub
  }
};
