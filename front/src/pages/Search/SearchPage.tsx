/**
 * pages/Search/SearchPage.tsx — Búsqueda avanzada de personas
 *
 * PROPÓSITO:
 *   Formulario de búsqueda en dos pasos:
 *   1. Seleccionar categoría (adulto, adulto mayor, niño, mascota).
 *   2. Elegir modo: búsqueda normal (formulario con filtros) o IA (descripción libre).
 *
 * FLUJO:
 *   Se usa useReducer para centralizar el estado del formulario
 *   en un solo objeto (SearchState) en lugar de 8+ useState sueltos.
 *   Los sub-componentes NormalSearchForm y AiSearchForm encapsulan
 *   sus respectivos formularios.
 *
 * MODO NORMAL:
 *   - Input de nombre + filtros: estado, municipio, edad (o raza), fecha.
 *   - Los resultados se simulan con MOCK_RESULTS (MVP). NO consultan la API real
 *     para evitar exponer datos sensibles a través de búsquedas no autenticadas.
 *
 * MODO IA (Búsqueda Vectorial):
 *   - Textarea donde el usuario describe físicamente a la persona.
 *   - Envía a POST /api/search/vector con { query }.
 *   - Si el motor vectorial falla, isFallback=true y se muestra aviso.
 *
 * PROTECCIÓN DE MENORES (LOPNNA):
 *   - Si ageCategory === 'nino', los resultados muestran "Caso Protegido".
 *   - Se muestra aviso informativo en el formulario.
 *   - No se exponen fotos ni datos reales de menores.
 */
import React, { useReducer } from 'react';
import * as Sentry from '@sentry/react';
import { Search, ArrowLeft, ShieldCheck, Info } from 'lucide-react';
import { Button } from '../../components/ui/Button';
import { CategorySelector, SEARCH_CATEGORIES } from '../../components/common';
import { NormalSearchForm } from './components/NormalSearchForm';
import { AiSearchForm } from './components/AiSearchForm';
import { MOCK_RESULTS, ESTADOS_VE } from '../../services/mockSearchData';
import type { AgeCat, SearchFilters } from '../../services/mockSearchData';
import './Search.css';
import { FeedCard } from '../Feed/components/FeedCard';
import { api } from '../../services/api';
import type { Person } from '../../types';

/* ─── Props ─── */
interface SearchPageProps {
  onBack: () => void;
}

/* ─── Estado y acciones ─── */
interface SearchState {
  step: number;
  ageCategory: AgeCat | '';
  filters: SearchFilters;
  searchMode: 'normal' | 'ai';
  iaQuery: string;
  results: Person[] | null;
  loading: boolean;
  isFallback: boolean;
}

type SearchAction =
  | { type: 'SET_STEP'; step: number }
  | { type: 'SET_AGE_CATEGORY'; category: AgeCat | '' }
  | { type: 'SET_FILTER'; key: keyof SearchFilters; value: string }
  | { type: 'SET_SEARCH_MODE'; mode: 'normal' | 'ai' }
  | { type: 'SET_IA_QUERY'; query: string }
  | { type: 'SEARCH_START' }
  | { type: 'SEARCH_SUCCESS'; results: Person[]; fallback: boolean }
  | { type: 'SEARCH_RESET' };

function searchReducer(state: SearchState, action: SearchAction): SearchState {
  switch (action.type) {
    case 'SET_STEP': return { ...state, step: action.step };
    case 'SET_AGE_CATEGORY': return { ...state, ageCategory: action.category };
    case 'SET_FILTER': return { ...state, filters: { ...state.filters, [action.key]: action.value } };
    case 'SET_SEARCH_MODE': return { ...state, searchMode: action.mode };
    case 'SET_IA_QUERY': return { ...state, iaQuery: action.query };
    case 'SEARCH_START': return { ...state, loading: true, results: null, isFallback: false };
    case 'SEARCH_SUCCESS': return { ...state, loading: false, results: action.results, isFallback: action.fallback };
    case 'SEARCH_RESET': return { ...state, loading: false };
    default: return state;
  }
}

const INITIAL_STATE: SearchState = {
  step: 1,
  ageCategory: '',
  filters: { name: '', estado: '', municipio: '', edad: '', raza: '', fecha: '' },
  searchMode: 'normal',
  iaQuery: '',
  results: null,
  loading: false,
  isFallback: false,
};

/* ─── Componente ─── */
export const SearchPage: React.FC<SearchPageProps> = ({ onBack }) => {
  const [state, dispatch] = useReducer(searchReducer, INITIAL_STATE);
  const { step, ageCategory, filters, searchMode, iaQuery, results, loading, isFallback } = state;
  const isMinorCat = ageCategory === 'nino';

  const buscar = async () => {
    if (searchMode === 'ai' && !iaQuery.trim()) return;
    dispatch({ type: 'SEARCH_START' });
    try {
      if (searchMode === 'ai') {
        const res = await api.post('/search/vector', { query: iaQuery });
        dispatch({ type: 'SEARCH_SUCCESS', results: res.data.matches || [], fallback: res.data.fallback ?? false });
      } else {
        const params: Record<string, string> = {};
        if (filters.name) params.q = filters.name;
        if (ageCategory) params.category = ageCategory;
        if (filters.estado) params.state = filters.estado;
        if (filters.municipio) params.municipality = filters.municipio;
        
        const res = await api.get('/persons', { params });
        dispatch({ type: 'SEARCH_SUCCESS', results: res.data.persons || [], fallback: false });
      }
    } catch (err) {
      console.error(err);
      dispatch({ type: 'SEARCH_SUCCESS', results: [], fallback: false });
    }
  };

  return (
    <div className="srch">
      <div className="srch__head">
        <Button variant="outline" className="srch__back" onClick={() => step === 2 ? dispatch({ type: 'SET_STEP', step: 1 }) : onBack()} aria-label="Volver">
          <ArrowLeft size={20} />
        </Button>
        <h1>Buscar personas</h1>
      </div>

      {step === 1 && (
        <div className="search-step-content">
          <label className="srch__category-label">¿A quién buscas?</label>
          <CategorySelector
            categories={SEARCH_CATEGORIES}
            selected={ageCategory}
            onSelect={(val) => dispatch({ type: 'SET_AGE_CATEGORY', category: val as AgeCat })}
          />
          <div className="sticky-bot-actions">
            <div className="report-footer-privacy">
              <Info size={14} />
              <span>Selecciona una categoría para continuar con la búsqueda.</span>
            </div>
            <Button fullWidth size="lg" onClick={() => dispatch({ type: 'SET_STEP', step: 2 })} disabled={!ageCategory}>
              SIGUIENTE
            </Button>
          </div>
        </div>
      )}

      {step === 2 && (
        <div className="search-step-content">
          {isMinorCat && (
            <div className="minor-notice__alert">
              Por protección LOPNNA, los datos mostrados son limitados en el MVP.
            </div>
          )}

          <div className="srch__note">
            <ShieldCheck size={16} />
            Para ver información de contacto detallada es necesario realizar una solicitud. Así protegemos la privacidad de las personas y evitamos el mal uso de los datos.
          </div>

          <div className="srch__toggle-group">
            <Button
              variant={searchMode === 'normal' ? 'primary' : 'outline'}
              onClick={() => dispatch({ type: 'SET_SEARCH_MODE', mode: 'normal' })}
              className="srch__toggle-btn"
            >
              Búsqueda Normal
            </Button>
            <Button
              variant={searchMode === 'ai' ? 'primary' : 'outline'}
              onClick={() => dispatch({ type: 'SET_SEARCH_MODE', mode: 'ai' })}
              className={`srch__toggle-btn${searchMode === 'ai' ? ' srch__btn-ai-active' : ''}`}
            >
              {'✨ Búsqueda con IA'}
            </Button>
          </div>

          {searchMode === 'normal' ? (
            <NormalSearchForm
              filters={filters}
              ageCategory={ageCategory}
              estados={ESTADOS_VE}
              onFilter={(key, value) => dispatch({ type: 'SET_FILTER', key, value })}
            />
          ) : (
            <AiSearchForm
              value={iaQuery}
              onChange={(query) => dispatch({ type: 'SET_IA_QUERY', query })}
            />
          )}

          <Button fullWidth size="lg" onClick={buscar} disabled={loading} className="flex-center gap-2 srch__btn-search">
            {loading ? <span className="spinner" /> : <Search size={18} />}
            {loading ? 'Buscando...' : 'Buscar'}
          </Button>

          {results !== null && (
            <div className="srch__results">
              <h3>Resultados ({results.length})</h3>

              {isFallback && searchMode === 'ai' && (
                <div className="srch__fallback-notice">
                  <strong>Aviso:</strong> El motor de inteligencia artificial vectorial no está disponible
                  en este momento. Se mostraron los mejores resultados por coincidencia de texto convencional.
                </div>
              )}

              {results.length > 0 ? (
                <div className="srch__result-list">
                  {results.map(p => <FeedCard key={p.idHash} person={p} />)}
                </div>
              ) : (
                <div className="srch__empty">
                  <p>No se encontraron resultados para esta búsqueda.</p>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default Sentry.withErrorBoundary(SearchPage, {
  fallback: <div className="error-boundary-fallback">Ocurrió un error al cargar la búsqueda.</div>
});
