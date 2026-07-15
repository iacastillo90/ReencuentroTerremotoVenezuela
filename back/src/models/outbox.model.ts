/**
 * models/outbox.model.ts — Patrón Outbox para eventos
 *
 * PROPÓSITO:
 *   Persiste eventos de dominio para procesamiento asíncrono confiable.
 *   Garantiza que los eventos se entreguen incluso si el servicio falla
 *   después de la transacción principal (patrón Transactional Outbox).
 *
 * CARACTERÍSTICAS:
 *   - type: 4 tipos de eventos (matching, audit, ia, geo-enrich)
 *   - payload: Mixed (validar con Zod antes de persistir)
 *   - status: pending → processing → completed/failed
 *   - attempts: Contador de reintentos (max 5)
 *   - lastError: Mensaje de error del último intento fallido
 *
 * ÍNDICES:
 *   - { status: 1, createdAt: 1 }: Query eficiente para processOutbox (ORDEN POR FECHA)
 *   - { type: 1, status: 1 }: Búsqueda por tipo de evento + estado
 *   - { processedAt: 1 } con TTL 7d: Limpieza automática de eventos procesados
 *
 * CICLO DE VIDA DEL EVENTO:
 *   1. CREATE: addToOutbox() → status='pending', attempts=0
 *   2. PROCESS: processOutbox() lee pending, set status='processing', attempts++
 *   3. SUCCESS: set status='completed', processedAt=now
 *   4. FAIL: set status='failed' o 'pending' (si attempts < 5), lastError=...
 *   5. EXPIRE: TTL index elimina automáticamente después de 7d
 *
 * SEGURIDAD:
 *   - payload: Mixed type — DEBE validarse con Zod antes de crear el evento
 *   - attempts limit: Previene loops infinitos en eventos problemáticos
 *   - TTL cleanup: Previene crecimiento infinito de la colección
 *
 * DECISIONES TÉCNICAS:
 *   - TTL de 7d: Balance entre audit trail y espacio en BD
 *   - status enum explícito: Permite queries precisas (ej: pending only)
 *   - attempts tracking: Permite debugging de eventos fallidos
 *   - processedAt opcional: Solo se setea al completar, usado para TTL
 *
 * PATRONES RELACIONADOS:
 *   - Saga pattern: Outbox publica eventos para siguientes pasos de la saga
 *   - Event sourcing: Outbox es el "event store" simplificado
 *   - CQRS: Separa write side (crea evento) de read side (procesa evento)
 *
 * CÓMO USAR:
 *   await addToOutbox('person-matching', { idHash: 'abc123' });
 *   // processOutbox() corre en background cada 5s
 */
import mongoose, { Schema, Document } from 'mongoose';

export interface OutboxEvent extends Document {
  type: 'person-matching' | 'manual-audit' | 'ia-processing' | 'geo-enrich';
  payload: Record<string, unknown>;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  attempts: number;
  maxAttempts: number;
  lastError?: string;
  createdAt: Date;
  processedAt?: Date;
}

const outboxSchema = new Schema<OutboxEvent>({
  type: { type: String, enum: ['person-matching', 'manual-audit', 'ia-processing', 'geo-enrich'], required: true },
  payload: { type: Schema.Types.Mixed, required: true },
  status: { type: String, enum: ['pending', 'processing', 'completed', 'failed'], default: 'pending' },
  attempts: { type: Number, default: 0 },
  maxAttempts: { type: Number, default: 5 },
  lastError: { type: String },
  createdAt: { type: Date, default: Date.now },
  processedAt: { type: Date },
});

outboxSchema.index({ status: 1, createdAt: 1 });
outboxSchema.index({ type: 1, status: 1 });
outboxSchema.index({ processedAt: 1 }, { expireAfterSeconds: 604800 });

export const OutboxModel = mongoose.model<OutboxEvent>('Outbox', outboxSchema);
