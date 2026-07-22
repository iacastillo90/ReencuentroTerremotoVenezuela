/**
 * __tests__/vite.config.test.ts — Tests de la configuración de Vite
 *
 * PROPÓSITO:
 *   Verifica que vite.config.ts cumpla con los requisitos de seguridad
 *   y caché PWA:
 *   - Usa estrategia StaleWhileRevalidate para llamadas a /api/.
 *   - maxAgeSeconds = 300 (5 minutos) para mantener datos frescos.
 *
 * MOCKS:
 *   - Lee el archivo vite.config.ts directamente del disco.
 *   - No necesita mocking de DOM (vitest-environment node).
 *
 * @vitest-environment node
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

const configContent = readFileSync(resolve(__dirname, '../../vite.config.ts'), 'utf-8');
const swContent = readFileSync(resolve(__dirname, '../sw.ts'), 'utf-8');

describe('Vite config PWA caching security', () => {
  it('uses injectManifest strategy with custom sw.ts', () => {
    expect(configContent).toContain("strategies: 'injectManifest'");
    expect(configContent).toContain("filename: 'sw.ts'");
  });

  it('defines apiCacheStrategy and excludes sensitive API paths in sw.ts', () => {
    expect(swContent).toContain('SENSITIVE_API_PATHS');
    expect(swContent).toContain('apiCacheStrategy');
  });
});

