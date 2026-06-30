/**
 * Fuente de verdad de SERIALIZACIÓN segura de personas.
 * Decide qué campos se envían al cliente según el rol del solicitante.
 *
 * Reglas (acordadas):
 *  - PÚBLICO (anónimo o user básico): datos para reconocer/ayudar, SIN PII peligroso.
 *  - AMPLIADO (verifier/admin): incluye coordenadas exactas, datos de menores, contacto, ficha, reportante.
 *  - MENORES (age<18): enmascarados en vista pública (LOPNNA); completos solo en ampliada.
 *  - La cédula (cruda o hash) NUNCA se envía al cliente desde personas.
 */

export function isExpandedRole(role?: string): boolean {
  return role === 'admin' || role === 'verifier';
}

export function isMinor(doc: any): boolean {
  const age = doc?.age != null ? Number(doc.age) : NaN;
  return !Number.isNaN(age) && age > 0 && age < 18;
}

export function ageBand(doc: any): 'menor' | 'adulto' | null {
  const age = doc?.age != null ? Number(doc.age) : NaN;
  if (Number.isNaN(age) || age <= 0) return null;
  return age < 18 ? 'menor' : 'adulto';
}

/** Redondea coordenadas a ~1 km para el mapa público (no expone ubicación exacta). */
export function approxLocation(coordsObj?: any): [number, number] | null {
  const c = coordsObj?.coordinates;
  if (!Array.isArray(c) || c.length < 2) return null;
  const round = (n: number) => Math.round(Number(n) * 100) / 100;
  const lng = round(c[0]);
  const lat = round(c[1]);
  if (Number.isNaN(lng) || Number.isNaN(lat)) return null;
  return [lng, lat];
}

/**
 * Convierte un documento UnifiedPerson (lean) en el DTO que verá el cliente.
 * @param viewerRole rol del solicitante ('admin' | 'verifier' | 'user' | undefined)
 */
export function toPublicPerson(doc: any, viewerRole?: string) {
  const expanded = isExpandedRole(viewerRole);
  const minor = isMinor(doc);

  const base: any = {
    idHash: doc.idHash,                       // código público del caso
    status: doc.status,
    ageBand: ageBand(doc),
    approxLocation: approxLocation(doc.lastSeen?.coordinates), // ubicación aproximada (mapa)
    lastSeen: {
      state: doc.lastSeen?.state,
      municipality: doc.lastSeen?.municipality,
    },
    metadata: {
      urgencyScore: doc.metadata?.urgencyScore,
      createdAt: doc.metadata?.createdAt,
    },
  };

  // MENOR sin rol → enmascarado (LOPNNA): solo existencia + zona general
  if (minor && !expanded) {
    return {
      ...base,
      name: 'Caso protegido',
      protected: true,
    };
  }

  // Vista pública (adulto) o ampliada (verifier/admin)
  const out: any = {
    ...base,
    name: doc.name,
    age: doc.age,
    gender: doc.gender,
    description: doc.description,
    photoUrl: doc.photoUrl,
    protected: false,
    lastSeen: {
      state: doc.lastSeen?.state,
      municipality: doc.lastSeen?.municipality,
      description: doc.lastSeen?.description,
      date: doc.lastSeen?.date,
    },
    data: {
      origen: doc.data?.origen,
      verificado_por: doc.data?.verificado_por,
    },
  };

  // Campos sensibles SOLO para rol verifier/admin
  if (expanded) {
    out.lastSeen.coordinates = doc.lastSeen?.coordinates; // ubicación EXACTA
    out.data.ficha_url = doc.data?.ficha_url;
    out.metadata.reportedBy = doc.metadata?.reportedBy;   // identidad del reportante
  }

  return out;
}

/**
 * Localizados (hospitales/refugios): la cédula NUNCA se devuelve en claro al público;
 * sí se puede BUSCAR por cédula (filtro en la query), pero no se serializa.
 */
export function toPublicLocalizado(doc: any, viewerRole?: string) {
  const expanded = isExpandedRole(viewerRole);
  const out: any = {
    _id: doc._id,
    name: doc.name,
    age: doc.age,
    gender: doc.gender,
    origin: doc.origin,
    location: doc.location,
    isVerified: doc.isVerified,
    sourceUrl: doc.sourceUrl,
    createdAt: doc.createdAt,
    hasCedula: !!doc.cedula,
  };
  if (expanded) out.cedula = doc.cedula;
  return out;
}
