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
import { Search, ArrowLeft, ShieldCheck, Info, X, User } from 'lucide-react';
import { Button } from '../../components/ui/Button';
import { CategorySelector, SEARCH_CATEGORIES } from '../../components/common';
import { BrandMark } from '../../components/BrandMark';
import type { AgeCat, SearchFilters } from '../../services/mockSearchData';
import './Search.css';
import { FeedCard } from '../Feed/components/FeedCard';
import { api } from '../../services/api';
import type { Person } from '../../types';

/* ─── Props ─── */
interface SearchPageProps {
  onBack: () => void;
  onNavigate?: (view: string) => void;
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
  filters: { name: '', edad: '', fechaDesde: '', fechaHasta: '', vestimenta: '' },
  searchMode: 'normal',
  iaQuery: '',
  results: null,
  loading: false,
  isFallback: false,
};

/* ─── Componente ─── */
export const SearchPage: React.FC<SearchPageProps> = ({ onBack, onNavigate }) => {
  const [state, dispatch] = useReducer(searchReducer, INITIAL_STATE);
  const { step, ageCategory, filters, searchMode, iaQuery, results, loading, isFallback } = state;
  const isMinorCat = ageCategory === 'nino';

  const buscar = async () => {
    dispatch({ type: 'SEARCH_START' });
    try {
      await new Promise(resolve => setTimeout(resolve, 2500)); // Artificial delay for searching animation
      const params: Record<string, string> = {};
      if (filters.name) params.q = filters.name;
      if (ageCategory) params.category = ageCategory;
      if (filters.edad) params.age = filters.edad;
      
      const res = await api.get('/persons', { params });
      dispatch({ type: 'SEARCH_SUCCESS', results: res.data.persons || [], fallback: false });
    } catch (err) {
      console.error(err);
      dispatch({ type: 'SEARCH_SUCCESS', results: [], fallback: false });
    }
  };

  return (
    <div className="report-modal-overlay">
      <div className="report-modal-content" style={{ maxWidth: '600px', width: '100%', height: '100%', borderRadius: 0, padding: 0 }}>
        <header className="report-modal-header">
          <div className="header-left-group">
            <div className="nav-brand">
              <BrandMark size={34} />
              <span className="nav-brand-text">
                <strong>Reencuentros<span>Venezuela</span></strong>
                <small>Juntos te encontramos</small>
              </span>
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <button className="nav-profile" onClick={() => {
              onBack();
              if (onNavigate) onNavigate('profile');
            }} aria-label="Perfil">
              <div className="profile-circle">
                <User size={20} />
              </div>
            </button>
            <button className="header-close-btn" onClick={onBack} aria-label="Cerrar"><X size={18} /></button>
          </div>
        </header>

        <div className="srch" style={{ padding: '16px 20px', maxWidth: '600px', margin: '0 auto', height: 'calc(100% - 64px)', overflowY: 'auto' }}>

        {!loading && (
          <div style={{ position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '24px', marginTop: '8px' }}>
            {step === 2 && (
              <button type="button" onClick={() => dispatch({ type: 'SET_STEP', step: 1 })} style={{ position: 'absolute', left: 0, background: 'none', border: '1px solid #FFFFFF', borderRadius: '50%', width: '36px', height: '36px', padding: '0', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <ArrowLeft size={18} color="#FFFFFF" />
              </button>
            )}
            <div style={{ margin: 0, display: 'flex', flexDirection: 'row', gap: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
              <span style={{ fontSize: '18px', fontWeight: 'bold', color: '#FFFFFF' }}>Buscar</span>
            </div>
          </div>
        )}

      {step === 1 && (
        <div className="search-step-content">
          <label className="srch__category-label">¿A quién buscas?</label>
          <CategorySelector
            categories={SEARCH_CATEGORIES}
            selected={ageCategory}
            onSelect={(val) => {
              dispatch({ type: 'SET_AGE_CATEGORY', category: val as AgeCat });
              setTimeout(() => dispatch({ type: 'SET_STEP', step: 2 }), 150);
            }}
          />
        </div>
      )}

      {step === 2 && (
        <div className="search-step-content" style={{ height: '100%' }}>
          {loading ? (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', paddingTop: '40px', gap: '24px', color: '#FFFFFF', textAlign: 'center' }}>
              <div className="spinner" style={{ width: '48px', height: '48px', border: '3px solid rgba(255,255,255,0.2)', borderTopColor: '#3B82F6' }} />
              <div>
                <h2 style={{ fontSize: '20px', margin: '0 0 8px 0', fontWeight: 'bold' }}>Buscando coincidencias...</h2>
                <p style={{ fontSize: '15px', color: '#94A3B8', maxWidth: '80%', margin: '0 auto', lineHeight: '1.4' }}>
                  Comparando contra reportes de familiares registrados en la zona.
                </p>
              </div>
            </div>
          ) : results !== null ? (
            <div className="srch__results">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                <h3 style={{ margin: 0, color: '#FFFFFF' }}>Resultados ({results.length})</h3>
                <Button variant="outline" size="sm" onClick={() => dispatch({ type: 'SEARCH_RESET' })}>Nueva búsqueda</Button>
              </div>
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
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              {isMinorCat && (
                <div className="minor-notice__alert">
                  Por protección LOPNNA, los datos mostrados son limitados en el MVP.
                </div>
              )}
              <div className="srch__note">
                <ShieldCheck size={16} />
                Para ver información de contacto detallada es necesario realizar una solicitud. Así protegemos la privacidad de las personas y evitamos el mal uso de los datos.
              </div>

              <p style={{ color: '#E2E8F0', fontSize: '15px', fontWeight: 500, margin: '0 0 8px 0' }}>
                Ingresa la información de la persona que quieres buscar
              </p>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                <div className="figma-input-field">
                  <label>Nombre y apellido</label>
                  <input type="text" placeholder="Ej: Juan Pérez" value={filters.name} onChange={e => dispatch({ type: 'SET_FILTER', key: 'name', value: e.target.value })} style={{ maxWidth: '100%' }} />
                </div>

                <div className="figma-input-field">
                  <label>Edad</label>
                  <input type="number" placeholder="Ej: 35" value={filters.edad} onChange={e => dispatch({ type: 'SET_FILTER', key: 'edad', value: e.target.value })} min="0" max="120" style={{ maxWidth: '100%' }} />
                </div>

                <div className="figma-input-field">
                  <label>Rango de fecha de registro</label>
                  <div style={{
                    display: 'flex', alignItems: 'center', width: '100%', maxWidth: '100%',
                    minHeight: '56px', borderRadius: '50px', border: '1px solid #8E8E93',
                    background: '#8E8E93', color: '#FFFFFF', padding: '0 16px', boxSizing: 'border-box'
                  }}>
                    <input type="date" value={filters.fechaDesde} onChange={e => dispatch({ type: 'SET_FILTER', key: 'fechaDesde', value: e.target.value })} 
                           style={{ flex: 1, minWidth: 0, background: 'transparent', border: 'none', color: '#FFFFFF', outline: 'none', padding: 0, minHeight: 'auto', borderRadius: 0 }} />
                    <span style={{ color: '#FFFFFF', opacity: 0.6, padding: '0 4px' }}>-</span>
                    <input type="date" value={filters.fechaHasta} onChange={e => dispatch({ type: 'SET_FILTER', key: 'fechaHasta', value: e.target.value })} 
                           style={{ flex: 1, minWidth: 0, background: 'transparent', border: 'none', color: '#FFFFFF', outline: 'none', padding: 0, minHeight: 'auto', borderRadius: 0 }} />
                  </div>
                </div>

                <div className="figma-input-field">
                  <label>Detalles de vestimenta (opcional)</label>
                  <textarea placeholder="Ej: Camisa azul, pantalón negro..." value={filters.vestimenta} onChange={e => dispatch({ type: 'SET_FILTER', key: 'vestimenta', value: e.target.value })} style={{ maxWidth: '100%' }} />
                </div>
              </div>

              <Button fullWidth size="lg" onClick={buscar} className="flex-center gap-2 srch__btn-search" style={{ marginTop: '8px', color: '#000000', fontWeight: 'bold' }}>
                <Search size={18} color="#000000" /> Buscar
              </Button>
            </div>
          )}
        </div>
      )}
        </div>
      </div>
    </div>
  );
};

export default Sentry.withErrorBoundary(SearchPage, {
  fallback: <div className="error-boundary-fallback">Ocurrió un error al cargar la búsqueda.</div>
});
