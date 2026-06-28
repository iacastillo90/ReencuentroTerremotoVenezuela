const crypto = require('crypto');

/**
 * Convierte un objeto raw desde cualquier adaptador al formato normalizado unificado.
 * Actúa como Censor PII para eliminar datos sensibles.
 */
function normalize(raw) {
  const normalized = {
    source: raw.source,
    externalId: raw.externalId || null,
    type: raw.type === 'animal' ? 'animal' : 'person',
    name: raw.name ? String(raw.name).toUpperCase() : null,
    estado: raw.estado || null,
    municipio: raw.municipio || null,
    mediaUrl: raw.mediaUrl || null,
    mediaType: raw.mediaType || null,
    data: raw.data ? { ...raw.data } : {}
  };

  // Censura estricta y Hash de Cédula (Seguridad Crítica)
  if (raw.cedula || normalized.data.cedula) {
    const cedula = raw.cedula || normalized.data.cedula;
    normalized.data.cedula_hash = crypto.createHash('sha256')
      .update(String(cedula).replace(/\D/g, '').trim())
      .digest('hex');
    delete normalized.data.cedula;
    delete raw.cedula;
  }

  // Filtrado de PII Médico y de Identidad Privada
  const sensitiveKeys = ['diagnostico', 'historia_clinica', 'telefono', 'telefono_privado', 'direccion_exacta'];
  sensitiveKeys.forEach(key => {
    delete raw[key];
    delete normalized.data[key];
  });

  // Generación de Checksum MD5 (Para sync_state y control de Idempotencia por origen)
  const checksumPayload = JSON.stringify({
    name: normalized.name,
    estado: normalized.estado,
    mediaUrl: normalized.mediaUrl,
    data: normalized.data
  });
  normalized.checksum = crypto.createHash('md5').update(checksumPayload).digest('hex');

  return normalized;
}

module.exports = normalize;
