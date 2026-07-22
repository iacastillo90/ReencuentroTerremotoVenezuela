/**
 * services/ai/ai.interface — Interfaces y tipos para proveedores de IA
 *
 * PROPÓSITO:
 *   Define el contrato común (IAIProvider) que todos los proveedores de
 *   IA deben implementar, así como los tipos de datos compartidos:
 *   AIProcessResult, ImageDraftAnalysis y SYSTEM_PROMPT.
 *
 * CARACTERÍSTICAS:
 *   - IAIProvider: interfaz con processRecord, transcribeAudio, analyzeImageDraft, generateEmbedding
 *   - SYSTEM_PROMPT: instrucción de sistema para extracción de datos de reportes
 *   - Tipos estrictos para results de procesamiento
 *
 * @module ai.interface
 */

export interface AIProcessResult {
  name: string;
  estado: string;
  age?: number;
  safeDescription: string;
  medicalStatus: 'estable' | 'herido' | 'crisis';
  urgencyScore: number;
}

export interface ImageDraftAnalysis {
  permanentFeatures: string;
  clothingQuestion?: string;
}

export interface IAIProvider {
  processRecord(rawData: string): Promise<AIProcessResult>;
  transcribeAudio?(audioBuffer: Buffer, mimeType: string): Promise<string>;
  analyzeImageDraft?(imageBuffer: Buffer, mimeType: string): Promise<ImageDraftAnalysis>;
  generateEmbedding?(text: string): Promise<number[]>;
}

export const SYSTEM_PROMPT = `
INSTRUCCIÓN DE SISTEMA: 
Analiza el reporte de persona desaparecida.
Extrae el nombre completo de la persona buscada ("name") y la última ubicación/estado ("estado").
Si se menciona una edad aproximada, extráela ("age").
Extrae la descripción física, características de la persona y detalles de vestimenta o ropa ("safeDescription").
Elimina, ignora y censura de forma absoluta cualquier número de teléfono, dirección exacta domiciliaria y descripciones de diagnósticos médicos o historia clínica. 
Resume el estado médico SÓLO utilizando estas tres etiquetas permitidas: "estable", "herido", "crisis".
Bajo ninguna circunstancia expongas información de contacto.

Devuelve la respuesta ESTRICTAMENTE en formato JSON con la siguiente estructura (reemplaza con null si falta edad):
{
  "name": "string",
  "estado": "string",
  "age": number | null,
  "safeDescription": "string",
  "medicalStatus": "estable" | "herido" | "crisis",
  "urgencyScore": number (0-100)
}
`;
