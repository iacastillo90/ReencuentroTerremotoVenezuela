import mongoose, { Schema, Document } from 'mongoose';

export interface IStateHistory extends Document {
  reportId: string; // idHash de Person
  changedBy?: mongoose.Types.ObjectId; // User que hizo el cambio
  previousState: string;
  newState: string;
  notes?: string;
  createdAt: Date;
}

const StateHistorySchema = new Schema<IStateHistory>(
  {
    reportId: { type: String, required: true, index: true },
    changedBy: { type: Schema.Types.ObjectId, ref: 'User' },
    previousState: { type: String, required: true },
    newState: { type: String, required: true },
    notes: { type: String }
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

export const StateHistoryModel = mongoose.model<IStateHistory>('StateHistory', StateHistorySchema);
