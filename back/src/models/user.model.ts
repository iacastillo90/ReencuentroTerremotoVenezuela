import { Schema, model, Document } from 'mongoose';

export interface IUser extends Document {
  googleId: string;
  email: string;
  name: string;
  picture?: string;
  role: 'user' | 'admin';
  sector?: string;
  contactNumber?: string;
  isProfileComplete: boolean;
  tokenVersion: number;
  createdAt: Date;
  updatedAt: Date;
}

const UserSchema = new Schema<IUser>({
  googleId: { type: String, required: true, unique: true },
  email: { type: String, required: true, unique: true },
  name: { type: String, required: true },
  picture: { type: String },
  role: { type: String, enum: ['user', 'admin'], default: 'user' },
  sector: { type: String },
  contactNumber: { type: String },
  isProfileComplete: { type: Boolean, default: false },
  tokenVersion: { type: Number, default: 1 },
}, { timestamps: true });

export const UserModel = model<IUser>('User', UserSchema);
