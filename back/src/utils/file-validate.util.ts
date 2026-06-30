import crypto from 'crypto';

export const ALLOWED_MIME_TYPES = [
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
  'video/mp4',
] as const;

export const IMAGE_MAX_SIZE = 5 * 1024 * 1024; // 5MB
export const VIDEO_MAX_SIZE = 20 * 1024 * 1024; // 20MB

// Magic byte signatures for file type validation
export const MAGIC_BYTE_SIGNATURES: Record<string, Buffer[]> = {
  'image/jpeg': [
    Buffer.from([0xFF, 0xD8, 0xFF]),
  ],
  'image/png': [
    Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]),
  ],
  'image/gif': [
    Buffer.from([0x47, 0x49, 0x46, 0x38, 0x37, 0x61]), // GIF87a
    Buffer.from([0x47, 0x49, 0x46, 0x38, 0x39, 0x61]), // GIF89a
  ],
  'image/webp': [
    Buffer.from([0x52, 0x49, 0x46, 0x46]), // RIFF header
  ],
  'video/mp4': [
    Buffer.from([0x00, 0x00, 0x00, 0x18, 0x66, 0x74, 0x79, 0x70]), // ftyp
    Buffer.from([0x33, 0x00, 0x00, 0x00, 0x66, 0x74, 0x79, 0x70, 0x33, 0x67]), // 3gp
  ],
};

/**
 * Validate that the file's magic bytes match the declared MIME type.
 */
export function validateMagicBytes(buffer: Buffer, mimeType: string): boolean {
  const signatures = MAGIC_BYTE_SIGNATURES[mimeType];
  if (!signatures) return false;

  return signatures.some((sig) => {
    if (buffer.length < sig.length) return false;
    return sig.equals(buffer.subarray(0, sig.length));
  });
}

/**
 * Sanitize a filename — remove path traversal, replace unsafe chars.
 * Returns a safe, timestamped filename.
 */
export function sanitizeFilename(originalName: string): string {
  // Strip path traversal sequences
  let clean = originalName.replace(/\.\.\//g, '').replace(/\.\.\\/g, '').replace(/~/g, '');

  // Extract extension
  const lastDot = clean.lastIndexOf('.');
  const ext = lastDot >= 0 ? clean.slice(lastDot) : '';
  const base = lastDot >= 0 ? clean.slice(0, lastDot) : clean;

  // Replace non-ASCII and non-allowed chars with _
  const safeBase = base.replace(/[^a-zA-Z0-9._-]/g, '_').replace(/_+/g, '_').replace(/^_|_$/g, '');

  // If result is empty or too short, generate random safe name
  const finalBase = safeBase.length >= 3 ? safeBase : `file_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
  const safeExt = ext.replace(/[^a-zA-Z0-9.]/g, '').toLowerCase().slice(0, 6);

  return `${Date.now()}_${finalBase}${safeExt}`;
}
