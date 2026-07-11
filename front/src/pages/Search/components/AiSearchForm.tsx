/**
 * pages/Search/components/AiSearchForm.tsx — Búsqueda por descripción con IA
 *
 * PROPÓSITO:
 *   Renderiza un textarea donde el usuario describe físicamente a la
 *   persona buscada. La descripción se envía a POST /api/search/vector
 *   para búsqueda semántica con embeddings.
 *
 * ESTADO:
 *   No maneja estado propio — recibe value + onChange del padre (SearchPage)
 *   que usa useReducer para centralizar todo el estado del formulario.
 *
 * UX:
 *   El placeholder incluye un ejemplo detallado para guiar al usuario
 *   a escribir descripciones ricas en características físicas.
 */
import React from 'react';

interface AiSearchFormProps {
  value: string;
  onChange: (value: string) => void;
}

export const AiSearchForm: React.FC<AiSearchFormProps> = ({ value, onChange }) => (
  <div className="srch__ai-box">
    <label className="srch__ai-label">Describe a la persona con el mayor detalle posible:</label>
    <textarea
      className="srch__ai-textarea"
      placeholder="Ej: Busco a un hombre mayor de contextura delgada, andaba de camisa azul, jean oscuro, usa lentes y tiene una cicatriz en el brazo derecho…"
      value={value}
      onChange={e => onChange(e.target.value)}
    />
    <p className="srch__ai-hint">
      Nuestra IA analizará la descripción física y buscará en la base de datos reportes
      anónimos o identificados que coincidan semánticamente.
    </p>
  </div>
);
