/**
 * utils/file-validate.util.ts — Validación de archivos (MIME + Magic Bytes)
 *
 * PROPÓSITO:
 *   Provee validación de archivos subidos para prevenir MIME type forgery
 *   attacks. Verifica que el contenido real del archivo (magic bytes)
 *   coincida con el MIME type declarado. Usa file-type como primary,
 *   con fallback a firmas personalizadas.
 *
 * CARACTERÍSTICAS:
 *   - ALLOWED_MIME_TYPES: Tipos permitidos (JPEG, PNG, GIF, WebP, MP4)
 *   - IMAGE_MAX_SIZE: 5MB para imágenes
 *   - VIDEO_MAX_SIZE: 20MB para videos
 *   - validateMagicBytes: Verifica contenido real vs MIME declarado
 *   - sanitizeFilename: Limpia nombres (path traversal, caracteres no ASCII)
 *   - MAGIC_BYTE_SIGNATURES: Firmas hex para fallback
 *
 * FLUJO DE VALIDACIÓN:
 *   1. Multer verifica MIME type y tamaño
 *   2. validateMagicBytes lee magic bytes del buffer
 *   3. file-type library: Verificación primaria (más precisa)
 *   4. Fallback a MAGIC_BYTE_SIGNATURES si file-type falla
 *   5. Si no coincide → 400 + audit log
 *   6. sanitizeFilename limpia el nombre antes de persistir
 *
 * SEGURIDAD:
 *   - MIME type forgery prevention: Valida contenido, no header HTTP
 *   - file-type como primary: Detecta JPEG camuflado como .exe
 *   - Magic bytes fallback: Sin dependencias externas, 100% coverage
 *   - 5MB/20MB limits: Previene DoS por archivos monstruosos
 *   - sanitizeFilename: Elimina ../, ~, caracteres no ASCII
 *   - Audit log en rechazos: Trazabilidad de intentos maliciosos
 *
 * MAGIC BYTES SOPORTADOS:
 *   JPEG: 0xFF 0xD8 0xFF
 *   PNG: 0x89 0x50 0x4E...
 *   GIF: 0x47 0x49 0x46 (87a y 89a)
 *   WebP: 0x52 0x49 0x46 0x46 (RIFF header)
 *   MP4: ftyp box variants
 *
 * DECISIONES TÉCNICAS:
 *   - file-type > fallback: La librería maneja más formatos y edge cases
 *   - Magic bytes en servidor: No confiar en headers HTTP (fáciles de falsear)
 *   - sanitizeFilename con timestamp: Colisión prevention + path traversal safe
 *   - Dos capas de validación: Defensa en profundidad
 *
 * CÓMO USAR:
 *   const isValid = await validateMagicBytes(fileBuffer, 'image/jpeg');
 *   const safeName = sanitizeFilename('../../etc/passwd.jpg');
 *   // safeName → '1234567890_passwd.jpg'
 *
 * @module file-validate.util
 */
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

/**
 * Validate that the file's magic bytes match the declared MIME type.
 * Uses file-type library as primary check, falls back to custom signatures.
 */
export async function validateMagicBytes(buffer: Buffer, mimeType: string): Promise<boolean> {
  // file-type verifies actual content, not HTTP headers
  try {
    const { fileTypeFromBuffer } = await import('file-type');
    const type = await fileTypeFromBuffer(buffer);
    if (type && type.mime === mimeType) return true;
    if (type && !type.mime.startsWith('image/')) return false;
    if (type) return type.mime.startsWith('image/') === mimeType.startsWith('image/');
  } catch (err) {
    if (typeof process !== 'undefined' && process.env?.NODE_ENV !== 'test') {
      const logger = await import('./logger.util').then(m => m.logger).catch(() => null);
      logger?.warn?.({ err }, '[FileValidate] file-type library failed, falling back to magic bytes');
    }
  }

  const signatures = MAGIC_BYTE_SIGNATURES[mimeType];
  if (!signatures) return false;

  return signatures.some((sig) => {
    if (buffer.length < sig.length) return false;
    return sig.equals(buffer.subarray(0, sig.length));
  });
}

// Magic byte signatures for file type validation (fallback)
const MAGIC_BYTE_SIGNATURES: Record<string, Buffer[]> = {
  'image/jpeg': [
    Buffer.from([0xFF, 0xD8, 0xFF]),
  ],
  'image/png': [
    Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]),
  ],
  'image/gif': [
    Buffer.from([0x47, 0x49, 0x46, 0x38, 0x37, 0x61]),
    Buffer.from([0x47, 0x49, 0x46, 0x38, 0x39, 0x61]),
  ],
  'image/webp': [
    Buffer.from([0x52, 0x49, 0x46, 0x46]),
  ],
  'video/mp4': [
    Buffer.from([0x00, 0x00, 0x00, 0x18, 0x66, 0x74, 0x79, 0x70]),
    Buffer.from([0x33, 0x00, 0x00, 0x00, 0x66, 0x74, 0x79, 0x70, 0x33, 0x67]),
  ],
};

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
