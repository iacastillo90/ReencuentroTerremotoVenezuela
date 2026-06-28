import { VenezuelaTeBuscaAdapter } from './venezuela-te-busca.adapter';
import { WebFormAdapter } from './web-form.adapter';

describe('Source Adapters', () => {
  describe('VenezuelaTeBuscaAdapter', () => {
    const adapter = new VenezuelaTeBuscaAdapter();

    it('should normalize valid VTB data correctly', () => {
      const input = {
        id_registro: 'vtb-101',
        nombres: 'Carlos',
        apellidos: 'Mendoza',
        estado_desaparicion: 'Aragua',
        fecha_reporte: '2026-06-25T10:00:00.000Z',
        edad_aprox: '34'
      };

      const result = adapter.normalize(input);
      
      expect(result.source).toBe('venezuela-te-busca');
      expect(result.externalId).toBe('vtb-101');
      expect(result.name).toBe('Carlos Mendoza');
      expect(result.estado).toBe('Aragua');
      expect(result.type).toBe('person');
      expect(result.data?.age).toBe(34);
    });

    it('should throw error if critical fields are missing', () => {
      const input = {
        nombres: 'Carlos'
      } as any;

      expect(() => adapter.normalize(input)).toThrow('VTBAdapter: Missing critical fields');
    });
  });

  describe('WebFormAdapter', () => {
    const adapter = new WebFormAdapter();

    it('should normalize valid WebForm data correctly for a person', () => {
      const input = {
        submission_id: 'form-999',
        nombre_completo: 'Ana Silva',
        lugar_visto_estado: 'Caracas',
        edad: 28,
        es_mascota: false,
        timestamp: '2026-06-25T14:00:00.000Z'
      };

      const result = adapter.normalize(input);

      expect(result.source).toBe('web-form');
      expect(result.externalId).toBe('form-999');
      expect(result.name).toBe('Ana Silva');
      expect(result.estado).toBe('Caracas');
      expect(result.type).toBe('person');
      expect(result.data?.age).toBe(28);
    });

    it('should normalize data correctly for a pet', () => {
      const input = {
        submission_id: 'form-pet-1',
        nombre_completo: 'Firulais',
        lugar_visto_estado: 'Miranda',
        es_mascota: true,
        timestamp: '2026-06-26T09:00:00.000Z'
      };

      const result = adapter.normalize(input);

      expect(result.type).toBe('animal');
      expect(result.name).toBe('Firulais');
    });
  });
});
