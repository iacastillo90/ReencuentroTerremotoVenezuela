export interface AIProcessResult {
  safeDescription: string;
  medicalStatus: 'estable' | 'herido' | 'crisis';
  urgencyScore: number;
}

export interface IAIProvider {
  processRecord(rawData: string): Promise<AIProcessResult>;
}

export const SYSTEM_PROMPT = `
INSTRUCCIÓN DE SISTEMA: 
Extrae únicamente la última ubicación vista (estado/municipio), descripción física y características no sensibles de la persona.
Elimina, ignora y censura de forma absoluta cualquier número de teléfono, dirección exacta domiciliaria y descripciones de diagnósticos médicos o historia clínica. 
Resume el estado médico SÓLO utilizando estas tres etiquetas de severidad permitidas: "estable", "herido", "crisis".
Bajo ninguna circunstancia expongas información de identidad sensible.

Devuelve la respuesta ESTRICTAMENTE en formato JSON con la siguiente estructura, sin texto adicional ni marcadores markdown de bloque de código:
{
  "safeDescription": "string",
  "medicalStatus": "estable" | "herido" | "crisis",
  "urgencyScore": number (0-100)
}
`;
