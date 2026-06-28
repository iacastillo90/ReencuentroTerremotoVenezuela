import mongoose, { Schema, Document } from 'mongoose';

export interface IMatch extends Document {
  reportId: string; // The idHash or ObjectId of the PersonModel
  searchRequestId: mongoose.Types.ObjectId;
  score: number;
  status: 'posible' | 'probable' | 'revisar' | 'descartado' | 'confirmado';
  createdAt: Date;
  updatedAt: Date;
}

const MatchSchema = new Schema<IMatch>(
  {
    reportId: { type: String, required: true },
    searchRequestId: { type: Schema.Types.ObjectId, ref: 'SearchRequest', required: true },
    score: { type: Number, required: true },
    status: { 
      type: String, 
      enum: ['posible', 'probable', 'revisar', 'descartado', 'confirmado'],
      default: 'revisar' 
    }
  },
  { timestamps: true }
);

MatchSchema.index({ reportId: 1, searchRequestId: 1 }, { unique: true });
MatchSchema.index({ score: -1 });

export const MatchModel = mongoose.model<IMatch>('Match', MatchSchema);
