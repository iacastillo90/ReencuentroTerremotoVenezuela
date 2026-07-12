import crypto from 'crypto';
import { ApiKeyModel, ApiKeyDocument } from '../models/api-key.model';
import { logger } from '../utils/logger.util';

const KEY_PREFIX_LENGTH = 8;

function hashApiKey(key: string): string {
  return crypto.createHash('sha256').update(key).digest('hex');
}

function generateApiKey(): { key: string; keyPrefix: string } {
  const raw = crypto.randomBytes(32).toString('hex');
  const keyPrefix = raw.slice(0, KEY_PREFIX_LENGTH);
  return { key: `rtv_${raw}`, keyPrefix };
}

export async function createApiKey(
  name: string,
  type: 'admin' | 'webhook' | 'partner',
  expiresAt?: Date
): Promise<{ key: string; keyPrefix: string; id: string }> {
  const { key, keyPrefix } = generateApiKey();
  const keyHash = hashApiKey(key);
  const doc = await ApiKeyModel.create({ key: keyHash, keyPrefix, name, type, expiresAt });
  return { key, keyPrefix, id: doc._id.toString() };
}

export async function validateApiKey(
  rawKey: string,
  type: 'admin' | 'webhook' | 'partner'
): Promise<boolean> {
  const hashedKey = hashApiKey(rawKey);
  let doc = await ApiKeyModel.findOne({
    key: hashedKey,
    type,
    active: true,
    $or: [
      { expiresAt: { $exists: false } },
      { expiresAt: null },
      { expiresAt: { $gt: new Date() } },
    ],
  });

  // Fallback: check raw key for legacy unhashed keys
  if (!doc) {
    doc = await ApiKeyModel.findOne({
      key: rawKey,
      type,
      active: true,
      $or: [
        { expiresAt: { $exists: false } },
        { expiresAt: null },
        { expiresAt: { $gt: new Date() } },
      ],
    });
    if (doc) {
      logger.warn({ keyPrefix: doc.keyPrefix }, '[ApiKey] Legacy unhashed key used — migrate by recreating the key');
    }
  }

  if (!doc) return false;

  await ApiKeyModel.updateOne({ _id: doc._id }, { lastUsedAt: new Date() });
  return true;
}

export async function listApiKeys(type?: string): Promise<ApiKeyDocument[]> {
  const filter: any = {};
  if (type) filter.type = type;
  return ApiKeyModel.find(filter).select('-key').sort({ createdAt: -1 });
}

export async function revokeApiKey(id: string): Promise<boolean> {
  const result = await ApiKeyModel.findByIdAndUpdate(id, { active: false });
  return result !== null;
}

