/**
 * models/user.model.ts — Modelo de usuarios
 *
 * PROPÓSITO:
 *   Define el schema de usuarios del sistema, soportando autenticación
 *   dual: Google OAuth O email/password. Gestiona roles, estados de cuenta,
 *   y tokenVersion para invalidación de sesiones JWT.
 *
 * CARACTERÍSTICAS:
 *   - googleId: Opcional (solo usuarios Google OAuth)
 *   - passwordHash: Select: false (nunca expuesto por defecto)
 *   - role: user, verifier (periodista/ONG), admin
 *   - status: pending (espera aprobación), approved, rejected
 *   - isProfileComplete: Bloquea creación de reportes si es false
 *   - tokenVersion: Incrementa para invalidar JWTs anteriores
 *
 * ÍNDICES:
 *   - { googleId: 1 } con partialFilterExpression: Solo unicidad para googleId no-nulo
 *     (evita E11000 dup key error para usuarios email/password sin googleId)
 *   - email: unique, lowercase, trim (unicidad global de emails)
 *
 * SEGURIDAD:
 *   - passwordHash: { select: false } — nunca incluido en queries por defecto
 *   - toJSON transform: Elimina passwordHash y __v de responses JSON
 *   - tokenVersion: Permite logout global sin cambiar contraseña
 *   - status pending/approved: Requiere aprobación manual para verifiers
 *
 * DECISIONES TÉCNICAS:
 *   - googleId opcional: Soporta ambos métodos de auth en mismo schema
 *   - partial index: Evita colisiones de nulls (múltiples usuarios sin googleId)
 *   - role enum cerrado: Previene roles arbitrarios (security by design)
 *   - status enum: Flujo de aprobación explícito (pending → approved/rejected)
 *
 * FLUJO DE AUTH:
 *   1. Registro Google: googleId + email + picture, role='user', status='pending'
 *   2. Registro email: passwordHash + email, role='user', status='pending'
 *   3. Admin detection: Si email === ADMIN_EMAIL env var → role='admin', status='approved'
 *   4. Login: Verifica passwordHash/googleId, genera JWT con tokenVersion actual
 *   5. Update profile: $inc tokenVersion para invalidar JWTs anteriores
 *
 * CÓMO USAR:
 *   const user = await UserModel.findOne({ email }).select('+passwordHash');
 *   user.tokenVersion += 1; await user.save(); // Invalida JWTs anteriores
 */
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
