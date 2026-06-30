import { Schema, model, Document } from 'mongoose';

export interface IUser extends Document {
  googleId?: string;
  passwordHash?: string;
  email: string;
  name: string;
  lastName?: string;
  picture?: string;
  role: 'user' | 'verifier' | 'admin';
  sector?: string;
  contactNumber?: string;
  country?: string;
  state?: string;
  municipality?: string;
  isProfileComplete: boolean;
  tokenVersion: number;
  createdAt: Date;
  updatedAt: Date;
}

const UserSchema = new Schema<IUser>({
  // googleId es opcional: los usuarios de correo/contraseña no lo tienen (sparse evita
  // colisiones de unicidad entre múltiples documentos sin googleId).
  googleId: { type: String, unique: true, sparse: true },
  passwordHash: { type: String },
  email: { type: String, required: true, unique: true, lowercase: true, trim: true },
  name: { type: String, required: true },
  lastName: { type: String },
  picture: { type: String },
  role: { type: String, enum: ['user', 'verifier', 'admin'], default: 'user' },
  sector: { type: String },
  contactNumber: { type: String },
  country: { type: String },
  state: { type: String },
  municipality: { type: String },
  isProfileComplete: { type: Boolean, default: false },
  tokenVersion: { type: Number, default: 1 },
}, { timestamps: true });

export const UserModel = model<IUser>('User', UserSchema);
