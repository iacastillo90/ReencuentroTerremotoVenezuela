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
  status: 'pending' | 'approved' | 'rejected';
  tokenVersion: number;
  createdAt: Date;
  updatedAt: Date;
}

const UserSchema = new Schema<IUser>({
  // googleId es opcional: los usuarios de correo/contraseña no lo tienen.
  // La unicidad se aplica con un índice PARCIAL más abajo (solo cuando googleId
  // es un string), así múltiples usuarios sin googleId no colisionan.
  googleId: { type: String },
  passwordHash: { type: String, select: false },
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
  status: { type: String, enum: ['pending', 'approved', 'rejected'], default: 'pending' },
  tokenVersion: { type: Number, default: 1 },
}, { timestamps: true });

// Unicidad de googleId SOLO para usuarios de Google (googleId string). Los usuarios
// de correo/contraseña no tienen googleId y por eso no colisionan entre sí (evita el
// error E11000 dup key { googleId: null }).
UserSchema.index(
  { googleId: 1 },
  { unique: true, partialFilterExpression: { googleId: { $type: 'string' } } }
);

UserSchema.set('toJSON', {
  transform(_doc: any, ret: any) {
    delete ret.passwordHash;
    delete ret.__v;
    return ret;
  },
});

export const UserModel = model<IUser>('User', UserSchema);
