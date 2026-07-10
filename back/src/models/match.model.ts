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
