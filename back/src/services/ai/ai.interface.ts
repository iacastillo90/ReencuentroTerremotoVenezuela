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
}

export const SYSTEM_PROMPT = `
INSTRUCCIÓN DE SISTEMA: 
Analiza el reporte de persona desaparecida.
Extrae el nombre completo de la persona buscada ("name") y la última ubicación/estado ("estado").
Si se menciona una edad aproximada, extráela ("age").
Extrae la descripción física y características de la persona ("safeDescription").
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
