import axios from 'axios';

/**
 * Servicio para consultar y validar números de Cédula de Identidad de Venezuela.
 * Utiliza APIs de terceros o métodos de scraping para acceder al padrón electoral (CNE/SAIME).
 */
export class CNEValidatorService {
  /**
   * Valida una cédula y retorna el nombre completo si existe.
   * @param nationality 'V' (Venezolano) o 'E' (Extranjero)
   * @param cedula Número de cédula sin puntos
   */
  static async validateIdentity(nationality: 'V' | 'E', cedula: string): Promise<{ valid: boolean, fullName?: string, error?: string }> {
    try {
      if (!cedula || cedula.length < 6 || cedula.length > 9) {
        return { valid: false, error: 'Formato de cédula inválido' };
      }

      // Endpoint público tradicional del CNE para consulta de registro electoral
      const url = `http://www.cne.gob.ve/web/registro_electoral/ce.php?nacionalidad=${nationality}&cedula=${cedula}`;
      
      // Hacemos la petición real. Configuramos un timeout razonable por si el CNE está caído.
      const response = await axios.get(url, { 
        timeout: 10000,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
        }
      });
      
      const html = response.data;

      // Si la cédula no está registrada, el CNE muestra este mensaje textualmente:
      if (html.includes('no se encuentra inscrita') || html.includes('no se encuentra inscrito')) {
        return { valid: false, error: 'Cédula no encontrada en el padrón electoral' };
      }

      // El CNE normalmente devuelve el nombre dentro de un <td> con <b> 
      // Estructura usual: <td align="left"><b>APELLIDO NOMBRE</b></td>
      const nameRegex = /<td align="left"><b>(.*?)<\/b><\/td>/i;
      const match = html.match(nameRegex);

      if (match && match[1]) {
        // Encontramos el nombre en el HTML
        return {
          valid: true,
          fullName: match[1].trim()
        };
      }

      // Si la página cargó pero la estructura cambió o es un resultado inesperado
      return { valid: false, error: 'No se pudo extraer el nombre del registro electoral' };

    } catch (error: any) {
      console.error('[CNEValidator] Error de conexión con el CNE:', error.message);
      return { valid: false, error: 'Servicio CNE inaccesible momentáneamente' };
    }
  }
}
