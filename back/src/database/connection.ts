import mongoose from 'mongoose';
import { UserModel } from '../models/user.model';
import { logger } from '../utils/logger.util';

const MONGO_URI = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/reencuentro';

export const connectDB = async (caller: 'Server' | 'Worker' = 'Server') => {
  try {
    logger.info({ mongoUri: MONGO_URI, caller }, 'Connecting to MongoDB...');
    await mongoose.connect(MONGO_URI);
    logger.info({ caller }, 'MongoDB connected');

    if (caller === 'Server') {
      try {
        await UserModel.syncIndexes();
        logger.info({ caller }, 'User indexes synced');
      } catch (err) {
        logger.warn({ err: (err as Error).message, caller }, 'Could not sync User indexes');
      }
    }
  } catch (error) {
    logger.error({ err: error, caller }, 'Critical MongoDB connection error');
    process.exit(1);
  }
};

mongoose.connection.on('disconnected', () => {
  logger.warn('[MongoDB] Disconnected. Attempting reconnection...');
});
