// @vitest-environment node
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

const configContent = readFileSync(resolve(__dirname, '../../vite.config.ts'), 'utf-8');

describe('Vite config PWA caching security', () => {
  it('uses StaleWhileRevalidate caching strategy for API calls', () => {
    expect(configContent).toContain("'StaleWhileRevalidate'");
  });

  it('sets maxAgeSeconds to 300 (5 minutes)', () => {
    expect(configContent).toContain('60 * 5');
  });
});
