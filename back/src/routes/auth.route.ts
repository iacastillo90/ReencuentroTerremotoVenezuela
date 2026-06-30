import { Router, Request, Response } from 'express';
import { OAuth2Client } from 'google-auth-library';
import jwt from 'jsonwebtoken';
import { UserModel } from '../models/user.model';
import { VerificationRequestModel } from '../models/verification-request.model';
import { requireUser, JWT_SECRET } from '../middlewares/auth.middleware';
import { hashPassword, verifyPassword } from '../utils/password.util';

const router = Router();

function signToken(user: any): string {
  return jwt.sign(
    { userId: user._id, email: user.email, isProfileComplete: user.isProfileComplete, role: user.role },
    JWT_SECRET,
    { expiresIn: '7d' }
  );
}

function publicUser(user: any) {
  const obj = typeof user.toObject === 'function' ? user.toObject() : { ...user };
  delete obj.passwordHash;
  return obj;
}
// Provide a default for local dev, but in prod should be env variable
const GOOGLE_CLIENT_ID = process.env.VITE_GOOGLE_CLIENT_ID || 'dummy-client-id';

const client = new OAuth2Client(GOOGLE_CLIENT_ID);

router.post('/google', async (req: Request, res: Response) => {
  try {
    const { token } = req.body;
    if (!token) return res.status(400).json({ error: 'Token is required' });

    let payload;
    try {
      // Very basic validation, in a real app verify the token properly with Google
      const ticket = await client.verifyIdToken({
        idToken: token,
        audience: GOOGLE_CLIENT_ID,
      });
      payload = ticket.getPayload();
    } catch (e) {
      // Login de DESARROLLO sin verificación de firma: SOLO fuera de producción y de
      // forma explícita (ALLOW_DEV_LOGIN=true). En producción nunca se acepta.
      const devLoginAllowed =
        process.env.NODE_ENV !== 'production' &&
        process.env.ALLOW_DEV_LOGIN === 'true' &&
        GOOGLE_CLIENT_ID === 'dummy-client-id';
      if (devLoginAllowed) {
        console.warn('[AuthRoute] ⚠️ Login de DESARROLLO sin verificación de firma (ALLOW_DEV_LOGIN=true). No usar en producción.');
        payload = jwt.decode(token) as any;
      } else {
        throw e;
      }
    }

    if (!payload) return res.status(401).json({ error: 'Invalid Google Token' });

    const { sub: googleId, email, name, picture } = payload;

    let user = await UserModel.findOne({ googleId });
    if (!user) {
      user = await UserModel.create({
        googleId,
        email,
        name,
        picture,
        isProfileComplete: false
      });
    }

    const authToken = jwt.sign(
      { userId: user._id, email: user.email, isProfileComplete: user.isProfileComplete, role: user.role },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    return res.status(200).json({ token: authToken, user });
  } catch (error: any) {
    console.error('[AuthRoute] Google Auth Error:', error);
    return res.status(500).json({ error: 'Internal Server Error' });
  }
});

// ── Registro con correo/contraseña ──────────────────────────────────────────
router.post('/register', async (req: Request, res: Response) => {
  try {
    const { name, lastName, email, password, contactNumber, country, state, municipality } = req.body;
    if (!name || !email || !password) {
      return res.status(400).json({ error: 'Nombre, correo y contraseña son obligatorios' });
    }
    if (String(password).length < 8) {
      return res.status(400).json({ error: 'La contraseña debe tener al menos 8 caracteres' });
    }
    const normEmail = String(email).toLowerCase().trim();
    const existing = await UserModel.findOne({ email: normEmail });
    if (existing) {
      return res.status(409).json({ error: 'Ya existe una cuenta con ese correo' });
    }
    const user = await UserModel.create({
      email: normEmail,
      name,
      lastName,
      passwordHash: hashPassword(password),
      contactNumber,
      country,
      state,
      municipality,
      isProfileComplete: Boolean(contactNumber),
    });
    return res.status(201).json({ token: signToken(user), user: publicUser(user) });
  } catch (error) {
    console.error('[AuthRoute] POST /register Error:', error);
    return res.status(500).json({ error: 'Internal Server Error' });
  }
});

// ── Login con correo/contraseña ─────────────────────────────────────────────
router.post('/login', async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: 'Correo y contraseña son obligatorios' });
    }
    const user = await UserModel.findOne({ email: String(email).toLowerCase().trim() });
    if (!user || !verifyPassword(password, user.passwordHash)) {
      return res.status(401).json({ error: 'Correo o contraseña incorrectos' });
    }
    return res.status(200).json({ token: signToken(user), user: publicUser(user) });
  } catch (error) {
    console.error('[AuthRoute] POST /login Error:', error);
    return res.status(500).json({ error: 'Internal Server Error' });
  }
});

router.get('/me', requireUser, async (req: Request, res: Response) => {
  try {
    const user = await UserModel.findById((req as any).user.userId);
    if (!user) return res.status(404).json({ error: 'User not found' });
    return res.status(200).json({ user });
  } catch (error) {
    return res.status(500).json({ error: 'Internal Server Error' });
  }
});

router.post('/profile', requireUser, async (req: Request, res: Response) => {
  try {
    const { sector, contactNumber } = req.body;
    if (!sector || !contactNumber) {
      return res.status(400).json({ error: 'Sector and contactNumber are required' });
    }

    const user = await UserModel.findByIdAndUpdate(
      (req as any).user.userId,
      { sector, contactNumber, isProfileComplete: true },
      { new: true }
    );

    if (!user) return res.status(404).json({ error: 'User not found' });

    const authToken = jwt.sign(
      { userId: user._id, email: user.email, isProfileComplete: user.isProfileComplete, role: user.role },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    return res.status(200).json({ token: authToken, user });
  } catch (error) {
    return res.status(500).json({ error: 'Internal Server Error' });
  }
});

router.post('/verification-request', requireUser, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.userId;
    const { notes, evidenceUrl } = req.body;

    const existing = await VerificationRequestModel.findOne({ user: userId, status: 'pending' });
    if (existing) {
      return res.status(400).json({ error: 'Ya tienes una solicitud pendiente' });
    }

    const request = await VerificationRequestModel.create({
      user: userId,
      notes,
      evidenceUrl
    });

    return res.status(201).json(request);
  } catch (error) {
    console.error('[AuthRoute] POST /verification-request Error:', error);
    return res.status(500).json({ error: 'Internal Server Error' });
  }
});

export const authRouter = router;
