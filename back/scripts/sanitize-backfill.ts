/**
 * Sanitize Backfill Script
 *
 * Two-pass script to sanitize existing person records:
 *   - Default (dry-run): logs changes without persisting
 *   - --apply: persists changes via bulkWrite
 *
 * Usage:
 *   npx ts-node scripts/sanitize-backfill.ts          # dry-run
 *   npx ts-node scripts/sanitize-backfill.ts --apply   # persist
 */

import mongoose from 'mongoose';
import { PersonModel } from '../src/models/unified-person.model';
import { sanitize } from '../src/utils/sanitize.util';

const MONGO_URI = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/reencuentro';
const DRY_RUN = !process.argv.includes('--apply');

interface FieldChange {
  id: string;
  field: string;
  before: string;
  after: string;
}

async function run() {
  console.log(`Conectando a ${MONGO_URI}...`);
  await mongoose.connect(MONGO_URI);
  console.log('MongoDB Conectado.\n');

  if (DRY_RUN) {
    console.log('🔍 MODO: DRY-RUN (solo advertencia — use --apply para persistir)\n');
  } else {
    console.log('✍️  MODO: APLICAR (los cambios serán persistidos)\n');
  }

  const totalDocs = await PersonModel.countDocuments({});
  console.log(`Total documentos: ${totalDocs}\n`);

  const batchSize = 100;
  const allChanges: FieldChange[] = [];
  let processedCount = 0;
  let errorCount = 0;

  const cursor = PersonModel.find({}).cursor();

  for await (const doc of cursor) {
    processedCount++;
    const changes: { field: string; before: string; after: string }[] = [];

    try {
      // Check name
      if (doc.name && typeof doc.name === 'string') {
        const sanitizedName = sanitize(doc.name);
        if (sanitizedName !== doc.name) {
          changes.push({ field: 'name', before: doc.name, after: sanitizedName });
        }
      }

      // Check description
      if (doc.description && typeof doc.description === 'string') {
        const sanitizedDesc = sanitize(doc.description);
        if (sanitizedDesc !== doc.description) {
          changes.push({ field: 'description', before: doc.description, after: sanitizedDesc });
        }
      }

      // Check lastSeen.description
      if (doc.lastSeen?.description && typeof doc.lastSeen.description === 'string') {
        const sanitizedLastSeen = sanitize(doc.lastSeen.description);
        if (sanitizedLastSeen !== doc.lastSeen.description) {
          changes.push({ field: 'lastSeen.description', before: doc.lastSeen.description, after: sanitizedLastSeen });
        }
      }

      // Check aliases
      if (doc.aliases && Array.isArray(doc.aliases)) {
        for (let i = 0; i < doc.aliases.length; i++) {
          if (typeof doc.aliases[i] === 'string') {
            const sanitizedAlias = sanitize(doc.aliases[i]);
            if (sanitizedAlias !== doc.aliases[i]) {
              changes.push({ field: `aliases[${i}]`, before: doc.aliases[i], after: sanitizedAlias });
            }
          }
        }
      }

      if (changes.length > 0) {
        allChanges.push(...changes.map(c => ({ id: doc.idHash || doc._id.toString(), ...c })));

        if (DRY_RUN) {
          for (const c of changes) {
            console.log(`  [CHANGE] ${doc.idHash || doc._id} | ${c.field}`);
            console.log(`    BEFORE: "${c.before.slice(0, 200)}"`);
            console.log(`    AFTER:  "${c.after.slice(0, 200)}"\n`);
          }
        }
      }
    } catch (err: any) {
      console.error(`  [ERROR] ${doc._id}: ${err.message}`);
      errorCount++;
    }

    if (processedCount % batchSize === 0) {
      console.log(`  [Backfill] Procesados ${processedCount} / ${totalDocs} documentos...`);
    }
  }

  cursor.close();

  // Apply phase
  if (!DRY_RUN && allChanges.length > 0) {
    console.log('\nAplicando cambios...');

    // Group changes by document
    const docChanges = new Map<string, Record<string, string>>();
    for (const c of allChanges) {
      if (!docChanges.has(c.id)) docChanges.set(c.id, {});
      docChanges.get(c.id)![c.field] = c.after;
    }

    const ops: any[] = [];
    for (const [id, fields] of docChanges) {
      const updateFields: Record<string, any> = {};
      for (const [field, value] of Object.entries(fields)) {
        updateFields[field] = value;
      }
      ops.push({
        updateOne: {
          filter: { $or: [{ idHash: id }, { _id: id }] },
          update: { $set: updateFields },
        },
      });
    }

    if (ops.length > 0) {
      const result = await PersonModel.bulkWrite(ops);
      console.log(`  Modificados: ${result.modifiedCount} documentos`);
    }
  }

  // Summary
  console.log(`\n┌─ Backfill Summary ─────────────────────────────┐`);
  console.log(`│ Total documentos procesados: ${String(processedCount).padStart(8)} │`);
  console.log(`│ Documentos con cambios:    ${String(new Set(allChanges.map(c => c.id)).size).padStart(8)} │`);
  console.log(`│ Total campos cambiados:    ${String(allChanges.length).padStart(8)} │`);
  console.log(`│ Errores:                   ${String(errorCount).padStart(8)} │`);
  console.log(`└─────────────────────────────────────────────────┘`);

  if (DRY_RUN && allChanges.length > 0) {
    console.log('\n⚠️  Ejecute con --apply para persistir los cambios.');
  } else if (allChanges.length === 0) {
    console.log('\n✅ No se encontraron campos por sanitizar.');
  }

  await mongoose.disconnect();
  process.exit(errorCount > 0 && !DRY_RUN ? 1 : 0);
}

run().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
