/**
 * pages/Search/SearchPage.tsx — Búsqueda avanzada de personas
 *
 * PROPÓSITO:
 *   Formulario de búsqueda en dos pasos:
 *   1. Seleccionar categoría (adulto, adulto mayor, niño, mascota).
 *   2. Elegir modo: búsqueda normal (formulario con filtros) o IA (descripción libre).
 *
 * MODO NORMAL:
 *   - Input de nombre + filtros: estado, municipio, edad (o raza para mascotas), fecha.
 *   - Los resultados se simulan con MOCK_RESULTS (MVP). NO consultan la API real
 *     para evitar exponer datos sensibles a través de búsquedas no autenticadas.
 *
 * MODO IA (Búsqueda Vectorial):
 *   - Textarea donde el usuario describe físicamente a la persona.
 *   - Envía a POST /api/search/vector con { query }.
 *   - El backend busca coincidencias semánticas con embeddings.
 *   - Si el motor vectorial falla, isFallback=true y se muestra aviso.
 *
 * PROTECCIÓN DE MENORES (LOPNNA):
 *   - Si ageCategory === 'nino', los resultados muestran "Caso Protegido" como nombre.
 *   - Se muestra un aviso amarillo: "Por protección LOPNNA, los datos mostrados son limitados."
 *   - No se exponen fotos ni datos reales de menores.
 *
 * MOCK_RESULTS:
 *   Datos de ejemplo para el MVP. Simulan resultados de búsqueda con
 *   nombres ficticios pero realistas para cada categoría. En producción,
 *   estos vendrían de la API real.
 */
import React, { useState } from 'react';
import { Search, ArrowLeft, ShieldCheck, Info } from 'lucide-react';
import { Button } from '../../components/ui/Button';
import { CategorySelector, SEARCH_CATEGORIES } from '../../components/common';
import './Search.css';
import { FeedCard } from '../Feed/components/FeedCard';
import { api } from '../../services/api';
import type { Person } from '../../types';

type AgeCat = 'adulto' | 'adulto_mayor' | 'mascota' | 'nino';

interface SearchPageProps {
  onBack: () => void;
}

const ESTADOS_VE = [
  'Amazonas', 'Anzoátegui', 'Apure', 'Aragua', 'Barinas', 'Bolívar', 'Carabobo',
  'Cojedes', 'Delta Amacuro', 'Distrito Capital', 'Falcón', 'Guárico', 'La Guaira',
  'Lara', 'Mérida', 'Miranda', 'Monagas', 'Nueva Esparta', 'Portuguesa', 'Sucre',
  'Táchira', 'Trujillo', 'Yaracuy', 'Zulia',
];

const MOCK_RESULTS: Record<AgeCat, Person[]> = {
  adulto: [
    { idHash: 'm-1', type: 'person', name: 'Juan Pérez', status: 'missing', age: 35, gender: 'M', lastSeen: { date: new Date().toISOString(), state: 'Distrito Capital', municipality: 'Chacao', description: 'Punto de Control PC, Chacao' }, metadata: { urgencyScore: 3, createdAt: new Date().toISOString() }, data: { origen: 'Protección Civil' } },
    { idHash: 'm-2', type: 'person', name: 'María Gonzalez', status: 'missing', age: 42, gender: 'F', lastSeen: { date: new Date().toISOString(), state: 'La Guaira', municipality: 'Macuto', description: 'Centro de Acopio Macuto' }, metadata: { urgencyScore: 4, createdAt: new Date().toISOString() }, data: { origen: 'Cruz Roja Venezolana' } },
    { idHash: 'm-3', type: 'person', name: 'Carlos Mendoza', status: 'found', age: 28, gender: 'M', lastSeen: { date: new Date().toISOString(), state: 'Distrito Capital', municipality: 'Catia', description: 'Hospital Pérez Carreño, Caracas' }, metadata: { urgencyScore: 1, createdAt: new Date().toISOString() }, data: { origen: 'Hospital Pérez Carreño' } },
    { idHash: 'm-4', type: 'person', name: 'Ana Silva', status: 'missing', age: 50, gender: 'F', lastSeen: { date: new Date().toISOString(), state: 'La Guaira', municipality: 'Maiquetía', description: 'Refugio Temporal de Maiquetía' }, metadata: { urgencyScore: 2, createdAt: new Date().toISOString() }, data: { origen: 'Protección Civil' } }
  ] as Person[],
  adulto_mayor: [
    { idHash: 'am-1', type: 'person', name: 'Pedro Suárez', status: 'missing', age: 72, gender: 'M', lastSeen: { date: new Date().toISOString(), state: 'Distrito Capital', municipality: 'Los Palos Grandes', description: 'Albergue Los Palos Grandes' }, metadata: { urgencyScore: 5, createdAt: new Date().toISOString() }, data: { origen: 'Cruz Roja Venezolana' } },
    { idHash: 'am-2', type: 'person', name: 'Carmen Rojas', status: 'found', age: 68, gender: 'F', lastSeen: { date: new Date().toISOString(), state: 'La Guaira', municipality: 'Caraballeda', description: 'Sede Cruz Roja, Caraballeda' }, metadata: { urgencyScore: 1, createdAt: new Date().toISOString() }, data: { origen: 'Cruz Roja Venezolana' } },
    { idHash: 'am-3', type: 'person', name: 'José Martínez', status: 'missing', age: 80, gender: 'M', lastSeen: { date: new Date().toISOString(), state: 'Distrito Capital', municipality: 'Petare', description: 'Refugio Petare, Caracas' }, metadata: { urgencyScore: 5, createdAt: new Date().toISOString() }, data: { origen: 'Protección Civil' } },
    { idHash: 'am-4', type: 'person', name: 'Teresa Blanco', status: 'missing', age: 75, gender: 'F', lastSeen: { date: new Date().toISOString(), state: 'La Guaira', municipality: 'Catia La Mar', description: 'Comando Bomberos Catia La Mar' }, metadata: { urgencyScore: 4, createdAt: new Date().toISOString() }, data: { origen: 'Bomberos del Distrito Capital' } }
  ] as Person[],
  mascota: [
    { idHash: 'p-1', type: 'animal', name: 'Luna', status: 'missing', description: 'Poodle blanco, collar rojo', lastSeen: { date: new Date().toISOString(), state: 'Distrito Capital', municipality: 'Altamira', description: 'Plaza Altamira - Punto de Rescate' }, metadata: { urgencyScore: 2, createdAt: new Date().toISOString() }, data: { origen: 'Bienestar Animal' } },
    { idHash: 'p-2', type: 'animal', name: 'Max', status: 'found', description: 'Golden Retriever', lastSeen: { date: new Date().toISOString(), state: 'La Guaira', municipality: 'Macuto', description: 'Centro Veterinario Macuto' }, metadata: { urgencyScore: 1, createdAt: new Date().toISOString() }, data: { origen: 'Bienestar Animal' } },
    { idHash: 'p-3', type: 'animal', name: 'Milo', status: 'missing', description: 'Gato siamés', lastSeen: { date: new Date().toISOString(), state: 'Distrito Capital', municipality: 'El Hatillo', description: 'Refugio de Mascotas, El Hatillo' }, metadata: { urgencyScore: 3, createdAt: new Date().toISOString() }, data: { origen: 'Protección Civil' } },
    { idHash: 'p-4', type: 'animal', name: 'Bella', status: 'missing', description: 'Mestiza pequeña, mancha en el ojo', lastSeen: { date: new Date().toISOString(), state: 'La Guaira', municipality: 'Caraballeda', description: 'Punto de Control Animal, Caraballeda' }, metadata: { urgencyScore: 2, createdAt: new Date().toISOString() }, data: { origen: 'Bienestar Animal' } }
  ] as Person[],
  nino: [
    { idHash: 'n-1', type: 'person', name: 'Caso Protegido', status: 'missing', age: 10, gender: 'M', lastSeen: { date: new Date().toISOString(), state: 'Distrito Capital', municipality: 'Libertador', description: 'Información reservada (LOPNNA)' }, metadata: { urgencyScore: 5, createdAt: new Date().toISOString() }, data: { origen: 'Protección Civil' } },
    { idHash: 'n-2', type: 'person', name: 'Caso Protegido', status: 'found', age: 6, gender: 'F', lastSeen: { date: new Date().toISOString(), state: 'La Guaira', municipality: 'Macuto', description: 'Información reservada (LOPNNA)' }, metadata: { urgencyScore: 1, createdAt: new Date().toISOString() }, data: { origen: 'Cruz Roja Venezolana' } },
    { idHash: 'n-3', type: 'person', name: 'Caso Protegido', status: 'missing', age: 15, gender: 'F', lastSeen: { date: new Date().toISOString(), state: 'Distrito Capital', municipality: 'Chacao', description: 'Información reservada (LOPNNA)' }, metadata: { urgencyScore: 4, createdAt: new Date().toISOString() }, data: { origen: 'Protección Civil' } },
    { idHash: 'n-4', type: 'person', name: 'Caso Protegido', status: 'missing', age: 12, gender: 'M', lastSeen: { date: new Date().toISOString(), state: 'La Guaira', municipality: 'Maiquetía', description: 'Información reservada (LOPNNA)' }, metadata: { urgencyScore: 5, createdAt: new Date().toISOString() }, data: { origen: 'Bomberos del Distrito Capital' } }
  ] as Person[]
};

export const SearchPage: React.FC<SearchPageProps> = ({ onBack }) => {
  const [step, setStep] = useState(1);
  const [ageCategory, setAgeCategory] = useState<AgeCat | ''>('');
  const [name, setName] = useState('');
  const [estado, setEstado] = useState('');
  const [municipio, setMunicipio] = useState('');
  const [edad, setEdad] = useState('');
  const [raza, setRaza] = useState('');
  const [fecha, setFecha] = useState('');

  const [results, setResults] = useState<Person[] | null>(null);
  const [loading, setLoading] = useState(false);

  // IA Search State
  const [searchMode, setSearchMode] = useState<'normal' | 'ai'>('normal');
  const [iaQuery, setIaQuery] = useState('');
  const [isFallback, setIsFallback] = useState(false);

  const isMinorCat = ageCategory === 'nino';

  const buscar = async () => {
    setLoading(true);
    setResults(null);
    setIsFallback(false);
    try {
      if (searchMode === 'ai') {
        if (!iaQuery.trim()) return;
        const res = await api.post('/api/search/vector', { query: iaQuery });
        setResults(res.data.matches || []);
        setIsFallback(res.data.fallback);
      } else {
        // MVP usa MOCK_RESULTS — no expone datos reales de la DB
        await new Promise(resolve => setTimeout(resolve, 600));
        setResults(ageCategory ? MOCK_RESULTS[ageCategory as AgeCat] || [] : []);
      }
    } catch (err) {
      console.error(err);
      setResults([]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="srch">
      <div className="srch__head">
        <Button variant="outline" className="srch__back" onClick={() => step === 2 ? setStep(1) : onBack()} aria-label="Volver"><ArrowLeft size={20} /></Button>
        <h1>Buscar personas</h1>
      </div>

      {step === 1 && (
        <div className="search-step-content" style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginTop: '1rem' }}>
          <label style={{ textTransform: 'uppercase', fontSize: '0.85rem', letterSpacing: '0.05em', color: 'var(--clr-text-muted)', fontWeight: 700, marginBottom: '0.25rem', display: 'block' }}>
            ¿A quién buscas?
          </label>
          <CategorySelector
            categories={SEARCH_CATEGORIES}
            selected={ageCategory}
            onSelect={(val) => setAgeCategory(val as AgeCat)}
          />

          <div className="sticky-bottom-action" style={{ marginTop: '1rem' }}>
            <div className="report-footer-privacy" style={{ display: 'flex', gap: '8px', fontSize: '0.85rem', color: 'var(--clr-text-muted)', marginBottom: '1rem', alignItems: 'center' }}>
              <Info size={14} />
              <span>Selecciona una categoría para continuar con la búsqueda.</span>
            </div>
            <div className="step-submit-row">
              <Button fullWidth size="lg" onClick={() => setStep(2)} disabled={!ageCategory} style={{ color: '#ffffff' }}>SIGUIENTE</Button>
            </div>
          </div>
        </div>
      )}

      {step === 2 && (
        <div className="search-step-content" style={{ marginTop: '1rem' }}>
          <div className="srch__note" style={{ marginBottom: '1.5rem' }}>
            <ShieldCheck size={16} />
            Para ver información de contacto detallada es necesario realizar una solicitud. Así protegemos la
            privacidad de las personas y evitamos el mal uso de los datos.
          </div>

          <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.5rem' }}>
            <Button
              variant={searchMode === 'normal' ? 'primary' : 'outline'}
              onClick={() => setSearchMode('normal')}
              style={{ flex: 1 }}
            >
              Búsqueda Normal
            </Button>
            <Button
              variant={searchMode === 'ai' ? 'primary' : 'outline'}
              onClick={() => setSearchMode('ai')}
              style={{ flex: 1, background: searchMode === 'ai' ? 'linear-gradient(135deg, var(--clr-primary), #8B5CF6)' : '', color: searchMode === 'ai' ? '#fff' : '' }}
            >
              ✨ Búsqueda con IA
            </Button>
          </div>

          {searchMode === 'normal' ? (
            <>
              <div className="srch__field" style={{ marginBottom: '1.5rem' }}>
                <Search size={17} />
                <input placeholder="Nombre de la persona…" value={name} onChange={e => setName(e.target.value)} />
              </div>

              {isMinorCat && (
                <div className="minor-notice__alert" style={{ marginBottom: '1rem', padding: '0.8rem', borderRadius: '8px', fontSize: '0.85rem' }}>
                  Por protección LOPNNA, los datos mostrados son limitados en el MVP.
                </div>
              )}

              <div className="srch__filters" style={{ marginBottom: '1.5rem' }}>
                <span className="srch__label">Filtros de búsqueda (opcionales)</span>
                <div className="srch__field-group">
                  <label>Estado / Provincia</label>
                  <select value={estado} onChange={e => setEstado(e.target.value)}>
                    <option value="">Selecciona</option>
                    {ESTADOS_VE.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
                <div className="srch__field-group">
                  <label>Municipio</label>
                  <input placeholder="Escribe el municipio" value={municipio} onChange={e => setMunicipio(e.target.value)} />
                </div>
                <div className="srch__grid2">
                  {ageCategory !== 'mascota' ? (
                    <div className="srch__field-group">
                      <label>Edad aproximada</label>
                      <input
                        type="number"
                        placeholder="Ej: 45"
                        value={edad}
                        onChange={e => setEdad(e.target.value)}
                        min="0"
                        max="120"
                      />
                    </div>
                  ) : (
                    <div className="srch__field-group">
                      <label>Raza o color</label>
                      <input
                        type="text"
                        placeholder="Ej: Poodle negro"
                        value={raza}
                        onChange={e => setRaza(e.target.value)}
                      />
                    </div>
                  )}
                  <div className="srch__field-group">
                    <label>Fecha de registro</label>
                    <input
                      type="date"
                      value={fecha}
                      onChange={e => setFecha(e.target.value)}
                    />
                  </div>
                </div>
              </div>
            </>
          ) : (
            <div className="srch__ai-box" style={{ marginBottom: '1.5rem' }}>
              <label style={{ display: 'block', fontWeight: 600, marginBottom: '0.5rem' }}>Describe a la persona con el mayor detalle posible:</label>
              <textarea
                placeholder="Ej: Busco a un hombre mayor de contextura delgada, andaba de camisa azul, jean oscuro, usa lentes y tiene una cicatriz en el brazo derecho..."
                value={iaQuery}
                onChange={e => setIaQuery(e.target.value)}
                style={{ width: '100%', minHeight: '120px', padding: '1rem', borderRadius: '8px', border: '1px solid var(--clr-border)', backgroundColor: 'var(--clr-surface)', color: 'var(--clr-text)', resize: 'vertical' }}
              />
              <p style={{ fontSize: '0.8rem', color: 'var(--clr-text-muted)', margin: '0.5rem 0' }}>Nuestra IA analizará la descripción física y buscará en la base de datos reportes "Anónimos" o identificados que coincidan semánticamente.</p>
            </div>
          )}
          <Button fullWidth size="lg" onClick={buscar} disabled={loading} className="flex-center gap-2" style={{ color: '#ffffff' }}>
            {loading ? <div className="spinner" style={{ width: 18, height: 18, border: '2px solid rgba(255,255,255,0.3)', borderTopColor: '#fff', borderRadius: '50%', animation: 'spin 1s linear infinite' }} /> : <Search size={18} color="#ffffff" />}
            {loading ? 'Buscando...' : 'Buscar'}
          </Button>

          {results !== null && (
            <div className="srch__results" style={{ marginTop: '1.5rem' }}>
              <h3 style={{ fontSize: '1.1rem', marginBottom: '1rem', color: 'var(--clr-text)' }}>
                Resultados ({results.length})
              </h3>

              {isFallback && searchMode === 'ai' && (
                <div style={{ backgroundColor: 'rgba(234, 179, 8, 0.1)', border: '1px solid #eab308', color: '#eab308', padding: '0.75rem', borderRadius: '8px', marginBottom: '1rem', fontSize: '0.85rem' }}>
                  <strong>Aviso:</strong> El motor de inteligencia artificial vectorial no está disponible en este momento. Se mostraron los mejores resultados por coincidencia de texto convencional.
                </div>
              )}
              {results.length > 0 ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                  {results.map(p => (
                    <FeedCard key={p.idHash} person={p} />
                  ))}
                </div>
              ) : (
                <div style={{ padding: '2rem', textAlign: 'center', backgroundColor: 'var(--clr-surface)', borderRadius: '12px', border: '1px solid var(--clr-border)' }}>
                  <p style={{ color: 'var(--clr-text-muted)', margin: 0 }}>No se encontraron resultados para esta búsqueda.</p>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
