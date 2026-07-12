import { PersonModel } from '../models/unified-person.model';
import puppeteer from 'puppeteer';
import crypto from 'crypto';
import { redactPhoneNumbers } from '../utils/sanitize.util';
import { logger } from '../utils/logger.util';

const SOURCE_ID = 'dtv-scraper';
const BASE_URL = 'https://desaparecidosterremotovenezuela.com/';

export async function runDTVScraper(pagesToScrape = 1) {
  logger.info({ pagesToScrape }, '[DTV Scraper] Iniciando scraping...');
  const browser = await puppeteer.launch({ 
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  try {
    const page = await browser.newPage();
    let processed = 0;
    
    for (let p = 1; p <= pagesToScrape; p++) {
      logger.info({ page: p }, '[DTV Scraper] Scrapeando página...');
      await page.goto(`${BASE_URL}?page=${p}`, { waitUntil: 'networkidle2' });

      // Extraer datos de la tarjeta usando evaluación en el navegador
      const reports = await page.evaluate(() => {
        const results: any[] = [];
        // Seleccionamos las tarjetas. Adaptamos los selectores basados en el texto (ej. "Años", "Última ubicación")
        // Como no tenemos las clases exactas, buscaremos estructuras genéricas
        const cards = document.querySelectorAll('div'); 
        
        // Forma robusta de encontrar las tarjetas: buscar contenedores que tengan texto como "Última ubicación"
        const possibleCards = Array.from(cards).filter(c => c.textContent?.includes('Última ubicación') && c.textContent?.includes('Descripción'));

        // Necesitamos limpiar duplicados porque un div padre contiene divs hijos
        const uniqueCards = possibleCards.filter(c => {
          for(let child of c.children) {
            if(child.textContent?.includes('Última ubicación')) return false; // si un hijo lo tiene, nos quedamos con el hijo
          }
          return true;
        });

        uniqueCards.forEach((card, index) => {
          try {
            // Intentamos extraer información mediante expresiones regulares y estructuras de texto
            const text = card.innerText;
            const img = card.querySelector('img');
            const photoUrl = img ? img.src : null;
            
            // Para nombre, usualmente está en la primera línea o etiqueta H
            const header = card.querySelector('h2, h3, h4');
            const name = header ? header.textContent : text.split('\n')[0];
            
            // Estado y municipio desde el texto (ej: "La Guaira, Vargas")
            let estado = 'Desconocido';
            let municipio = 'Desconocido';
            const locMatch = text.match(/Última ubicación\s+([^\n]+)/i);
            if (locMatch) {
               const locParts = locMatch[1].split(',');
               estado = locParts.length > 1 ? locParts[1].trim() : locParts[0].trim();
               municipio = locParts[0].trim();
            }

            const isFound = text.toLowerCase().includes('localizada') || text.toLowerCase().includes('localizado');

            results.push({
              externalId: `dtv-p${p}-i${index}`, // Un ID pseudo-único
              name: name?.trim() || 'Desconocido',
              photoUrl: photoUrl,
              status: isFound ? 'found' : 'missing',
              estado,
              municipio,
              rawText: text
            });
          } catch(e) {}
        });
        
        return results;
      });

      let pageUsedFallback = false;
      if (reports.length === 0) {
        if (process.env.ALLOW_MOCK_DATA === 'true') {
          if (process.env.NODE_ENV === 'production') {
            logger.error('[DTV Scraper] ALLOW_MOCK_DATA=true en PRODUCCIÓN — abortando.');
            continue;
          }
          logger.warn({ page: p }, '[DTV Scraper] Sin tarjetas, usando datos SIMULADOS.');
          reports.push(...generateDTVFallback());
          pageUsedFallback = true;
        } else {
          logger.warn({ page: p }, '[DTV Scraper] Sin tarjetas, datos simulados deshabilitados.');
          continue;
        }
      }

      logger.info({ page: p, count: reports.length }, '[DTV Scraper] Reportes extraídos.');

      const operations = reports.map(item => {
        const idHash = crypto.createHash('sha256').update(`${SOURCE_ID}-${item.externalId}-${item.name}`).digest('hex');
        return {
          updateOne: {
            filter: { idHash },
            update: {
              $set: {
                type: 'person',
                normalizedName: item.name.toLowerCase(),
                name: item.name,
                status: item.status,
                gender: 'U',
                lastSeen: {
                  date: new Date(),
                  state: item.estado,
                  municipality: item.municipio,
                  description: redactPhoneNumbers(item.rawText.substring(0, 500)),
                  coordinates: {
                    type: 'Point',
                    coordinates: [-66.9, 10.48]
                  }
                },
                photoUrl: item.photoUrl,
                sourceRecords: [{ source: SOURCE_ID, externalId: item.externalId, rawData: item }],
                metadata: {
                  urgencyScore: item.status === 'found' ? 0 : 90,
                  confidenceScore: 80,
                  source: pageUsedFallback ? `${SOURCE_ID}-mock` : SOURCE_ID,
                  isSimulated: pageUsedFallback,
                  createdAt: new Date(),
                  updatedAt: new Date()
                }
              }
            },
            upsert: true
          }
        };
      });

      if (operations.length > 0) {
        await PersonModel.bulkWrite(operations as any[]);
        processed += operations.length;
      }
      
      // Delay entre páginas para no ser bloqueados
      await new Promise(r => setTimeout(r, 2000));
    }
    
    logger.info({ processed }, '[DTV Scraper] Finalizado con éxito.');
    return processed;
    
  } catch (error) {
    logger.error({ err: error }, '[DTV Scraper] Error:');
  } finally {
    await browser.close();
  }
}

function generateDTVFallback() {
  const mockData = [];
  // Agregamos el ejemplo exacto proporcionado por el usuario
  mockData.push({
    externalId: 'dtv-mock-1',
    name: 'Mariela Ramos Acuña y Juan Carlos Soteldo Apazparren',
    photoUrl: 'https://i.pravatar.cc/150?u=dtv-1',
    status: 'found',
    estado: 'Vargas',
    municipio: 'La Guaira',
    rawText: 'Si brazos está tatuados y está con un niño de 14 años de ojos verdes. Reporta Mariela Valera 04147594185. Nota: Mariela esta en el hospital vargas'
  });

  // Generamos un par más simulados
  for (let i = 2; i <= 20; i++) {
    mockData.push({
      externalId: `dtv-mock-${i}`,
      name: `Reporte DTV ${i}`,
      photoUrl: `https://i.pravatar.cc/150?u=dtv-${i}`,
      status: 'missing',
      estado: 'Miranda',
      municipio: 'Sucre',
      rawText: 'Visto por última vez en la zona de rescate.'
    });
  }
  return mockData;
}
