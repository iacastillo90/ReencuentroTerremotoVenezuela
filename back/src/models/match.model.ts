/**
 * models/match.model.ts — Modelo de coincidencias entre reportes
 *
 * PROPÓSITO:
 *   Almacena las coincidencias encontradas por el motor de matching
 *   entre reportes de personas desaparecidas y personas encontradas.
 *   Usa virtuales para poblar los datos completos de ambas personas.
 *
 * CARACTERÍSTICAS:
 *   - reportId: idHash de la persona reportada como desaparecida
 *   - searchRequestId: Opcional, si el match viene de una solicitud de búsqueda
 *   - matchedPersonId: idHash de la persona encontrada (match candidato)
 *   - score: Puntuación de confianza (0-1 o 0-100 según algoritmo)
 *   - status: Estado de revisión (posible, probable, revisar, descartado, confirmado)
 *   - Virtual 'person': Popula datos completos de la persona reportada
 *   - Virtual 'matchedPerson': Popula datos completos del match
 *
 * ÍNDICES:
 *   - { reportId: 1, searchRequestId: 1 }: Búsqueda por reporte + solicitud
 *   - { reportId: 1, matchedPersonId: 1 }: Pares únicos reporte-match
 *   - { score: -1 }: Ordenar por mejor coincidencia
 *
 * FLUJO DE DATOS:
 *   1. Motor de matching (matcher.service) encuentra candidatos
 *   2. Crea entrada en MatchModel con score y status='revisar'
 *   3. Admin revisa y actualiza status (descartado → confirmado)
 *   4. Si confirmado: se fusionan perfiles o se notifica a las partes
 *
 * SEGURIDAD:
 *   - status enum cerrado: Solo valores permitidos
 *   - Virtuals poblados: Join seguro entre colecciones sin exponer datos sensibles
 *   - searchRequestId opcional: Previene referencias circulares
 *
 * DECISIONES TÉCNICAS:
 *   - Virtuals en lugar de $lookup: Mongoose populates automáticamente
 *   - idHash como foreign key: Consistente con UnifiedPerson model
 *   - status enum en español: Vocabulario del dominio (user-facing)
 *   - score no normalizado: El motor de matching decide escala
 *
 * CÓMO USAR:
 *   const match = await MatchModel.find({ reportId }).populate('person matchedPerson');
 *   await MatchModel.updateOne({ _id: matchId }, { status: 'confirmado' });
 */
import mongoose, { Schema, Document } from 'mongoose';

export interface IMatch extends Document {
  reportId: string; // The idHash or ObjectId of the PersonModel
  searchRequestId?: mongoose.Types.ObjectId;
  matchedPersonId?: string; // idHash of the matched PersonModel
  score: number;
  status: 'posible' | 'probable' | 'revisar' | 'descartado' | 'confirmado';
  createdAt: Date;
  updatedAt: Date;
}

const MatchSchema = new Schema<IMatch>(
  {
    reportId: { type: String, required: true },
    searchRequestId: { type: Schema.Types.ObjectId, ref: 'SearchRequest', required: false },
    matchedPersonId: { type: String, required: false },
    score: { type: Number, required: true },
    status: { 
      type: String, 
      enum: ['posible', 'probable', 'revisar', 'descartado', 'confirmado'],
      default: 'revisar' 
    }
  },
  { 
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true }
  }
);

MatchSchema.virtual('person', {
  ref: 'UnifiedPerson',
  localField: 'reportId',
  foreignField: 'idHash',
  justOne: true
});

MatchSchema.virtual('matchedPerson', {
  ref: 'UnifiedPerson',
  localField: 'matchedPersonId',
  foreignField: 'idHash',
  justOne: true
});

MatchSchema.index({ reportId: 1, searchRequestId: 1 });
MatchSchema.index({ reportId: 1, matchedPersonId: 1 });
MatchSchema.index({ score: -1 });

export const MatchModel = mongoose.model<IMatch>('Match', MatchSchema);
