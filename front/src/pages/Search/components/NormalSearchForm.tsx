/**
 * pages/Search/components/NormalSearchForm.tsx — Formulario de búsqueda con filtros
 *
 * PROPÓSITO:
 *   Renderiza los campos de filtro para el modo de búsqueda normal dentro
 *   de SearchPage: nombre, estado, municipio, edad (o raza para mascotas),
 *   y fecha. Extraído a componente separado para reducir la carga cognitiva
 *   de SearchPage.tsx y permitir Fast Refresh sin recargar la página.
 *
 * LÓGICA CONDICIONAL:
 *   - Si ageCategory === 'mascota', muestra "Raza o color" en lugar de "Edad".
 *   - Si ageCategory === 'nino', muestra aviso LOPNNA de protección de datos.
 *
 * ESTADO:
 *   No maneja estado propio — recibe filters + onFilter del padre (SearchPage)
 *   que usa useReducer para centralizar todo el estado del formulario.
 */
import React from 'react';
import { Search } from 'lucide-react';
import type { AgeCat, SearchFilters } from '../../../services/mockSearchData';

interface NormalSearchFormProps {
  filters: SearchFilters;
  ageCategory: AgeCat | '';
  estados: readonly string[];
  onFilter: (key: keyof SearchFilters, value: string) => void;
}

export const NormalSearchForm: React.FC<NormalSearchFormProps> = ({ filters, ageCategory, estados, onFilter }) => {
  const isMinorCat = ageCategory === 'nino';
  return (
    <>
      <div className="srch__field">
        <Search size={17} />
        <input
          placeholder="Nombre de la persona…"
          value={filters.name}
          onChange={e => onFilter('name', e.target.value)}
        />
      </div>

      {isMinorCat && (
        <div className="minor-notice__alert">
          Por protección LOPNNA, los datos mostrados son limitados en el MVP.
        </div>
      )}

      <div className="srch__filters">
        <span className="srch__label">Filtros de búsqueda (opcionales)</span>

        <div className="srch__field-group">
          <label>Estado / Provincia</label>
          <select value={filters.estado} onChange={e => onFilter('estado', e.target.value)}>
            <option value="">Selecciona</option>
            {estados.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>

        <div className="srch__field-group">
          <label>Municipio</label>
          <input
            placeholder="Escribe el municipio"
            value={filters.municipio}
            onChange={e => onFilter('municipio', e.target.value)}
          />
        </div>

        <div className="srch__grid2">
          {ageCategory !== 'mascota' ? (
            <div className="srch__field-group">
              <label>Edad aproximada</label>
              <input
                type="number" placeholder="Ej: 45"
                value={filters.edad}
                onChange={e => onFilter('edad', e.target.value)}
                min="0" max="120"
              />
            </div>
          ) : (
            <div className="srch__field-group">
              <label>Raza o color</label>
              <input
                type="text" placeholder="Ej: Poodle negro"
                value={filters.raza}
                onChange={e => onFilter('raza', e.target.value)}
              />
            </div>
          )}
          <div className="srch__field-group">
            <label>Fecha de registro</label>
            <input
              type="date"
              value={filters.fecha}
              onChange={e => onFilter('fecha', e.target.value)}
            />
          </div>
        </div>
      </div>
    </>
  );
};
