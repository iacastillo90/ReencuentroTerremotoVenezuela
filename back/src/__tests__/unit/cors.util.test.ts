import { buildAllowedOrigins, isOriginAllowed, normalizeOrigin } from '../../utils/cors.util';

describe('cors.util', () => {
  const allowed = buildAllowedOrigins('http://localhost:5173,https://app.example.com');

  describe('normalizeOrigin', () => {
    it('recorta espacios, pasa a minúsculas y quita barras finales', () => {
      expect(normalizeOrigin('  HTTPS://App.Example.com//  ')).toBe('https://app.example.com');
    });
  });

  describe('buildAllowedOrigins', () => {
    it('descarta entradas vacías (comas colgantes)', () => {
      const set = buildAllowedOrigins('http://a.com,, http://b.com ,');
      expect(set.size).toBe(2);
      expect(set.has('http://a.com')).toBe(true);
      expect(set.has('http://b.com')).toBe(true);
    });
  });

  describe('isOriginAllowed', () => {
    it('acepta coincidencia exacta', () => {
      expect(isOriginAllowed('http://localhost:5173', allowed)).toBe(true);
      expect(isOriginAllowed('https://app.example.com', allowed)).toBe(true);
    });

    it('tolera mayúsculas y barra final en el origin entrante', () => {
      expect(isOriginAllowed('HTTP://LOCALHOST:5173/', allowed)).toBe(true);
    });

    it('rechaza el ataque por sufijo/substring', () => {
      expect(isOriginAllowed('https://localhost:5173.evil.com', allowed)).toBe(false);
      expect(isOriginAllowed('https://evil.com/?x=app.example.com', allowed)).toBe(false);
      expect(isOriginAllowed('https://app.example.com.evil.com', allowed)).toBe(false);
    });

    it('rechaza el downgrade de esquema (http contra allowlist https)', () => {
      expect(isOriginAllowed('http://app.example.com', allowed)).toBe(false);
    });

    it('rechaza subdominios no listados', () => {
      expect(isOriginAllowed('https://www.app.example.com', allowed)).toBe(false);
    });

    it('rechaza puertos no listados', () => {
      expect(isOriginAllowed('http://localhost:5174', allowed)).toBe(false);
    });
  });
});
