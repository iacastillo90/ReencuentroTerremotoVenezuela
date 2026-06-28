import mongoose, { Schema, Document } from 'mongoose';

export interface ISearchRequest extends Document {
  user: mongoose.Types.ObjectId;
  searchName: string;
  description?: string;
  category?: 'menor' | 'adulto' | 'adulto_mayor' | 'mascota';
  status: 'activa' | 'resuelta' | 'cancelada';
  isMinor: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const SearchRequestSchema = new Schema<ISearchRequest>(
  {
    user: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    searchName: { type: String, required: true },
    description: { type: String },
    category: { type: String, enum: ['menor', 'adulto', 'adulto_mayor', 'mascota'] },
    status: { type: String, enum: ['activa', 'resuelta', 'cancelada'], default: 'activa' },
    isMinor: { type: Boolean, default: false }
  },
  { timestamps: true }
);

export const SearchRequestModel = mongoose.model<ISearchRequest>('SearchRequest', SearchRequestSchema);
