import { Router, Request, Response } from 'express';
import { OAuth2Client } from 'google-auth-library';
import jwt from 'jsonwebtoken';
import { UserModel } from '../models/user.model';
import { requireUser } from '../middlewares/auth.middleware';

const router = Router();
// Provide a default for local dev, but in prod should be env variable
const GOOGLE_CLIENT_ID = process.env.VITE_GOOGLE_CLIENT_ID || 'dummy-client-id';
const JWT_SECRET = process.env.JWT_SECRET || 'super-secret-key-reencuentro-2024';

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
      // Fallback for local development if Google Client ID is not real
      if (GOOGLE_CLIENT_ID === 'dummy-client-id') {
        const decoded = jwt.decode(token) as any;
        payload = decoded;
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

export const authRouter = router;
