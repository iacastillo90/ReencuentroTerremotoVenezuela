import React, { useState } from 'react';
import { Search, ArrowLeft, User, UserRound, Baby, ShieldCheck, ClipboardList, Mail, Dog } from 'lucide-react';
import { Button } from '../../components/ui/Button';
import './Search.css';
import { api } from '../../services/api';
import { FeedCard } from '../Feed/components/FeedCard';
import type { Person } from '../../types';

type AgeCat = 'adulto' | 'adulto_mayor' | 'mascota' | 'nino';

interface SearchPageProps {
  onBack: () => void;
  onSelectPerson: (person: Person) => void;
}



const ESTADOS_VE = [
  'Amazonas', 'Anzoátegui', 'Apure', 'Aragua', 'Barinas', 'Bolívar', 'Carabobo',
  'Cojedes', 'Delta Amacuro', 'Distrito Capital', 'Falcón', 'Guárico', 'La Guaira',
  'Lara', 'Mérida', 'Miranda', 'Monagas', 'Nueva Esparta', 'Portuguesa', 'Sucre',
  'Táchira', 'Trujillo', 'Yaracuy', 'Zulia',
];

const MOCK_RESULTS: Record<AgeCat, Person[]> = {
  adulto: [
    { idHash: 'm-1', type: 'person', name: 'Juan Pérez', status: 'missing', age: 35, gender: 'M', lastSeen: { date: new Date().toISOString(), state: 'Miranda', municipality: 'Chacao', description: 'Visto cerca de la plaza' }, metadata: { urgencyScore: 3, createdAt: new Date().toISOString() }, data: { origen: 'Familiar' } },
    { idHash: 'm-2', type: 'person', name: 'María Gonzalez', status: 'missing', age: 42, gender: 'F', lastSeen: { date: new Date().toISOString(), state: 'Distrito Capital', municipality: 'Libertador', description: 'Vestía chaqueta azul' }, metadata: { urgencyScore: 4, createdAt: new Date().toISOString() }, data: { origen: 'Rescatistas' } },
    { idHash: 'm-3', type: 'person', name: 'Carlos Mendoza', status: 'found', age: 28, gender: 'M', lastSeen: { date: new Date().toISOString(), state: 'Aragua', municipality: 'Girardot', description: 'En refugio temporal' }, metadata: { urgencyScore: 1, createdAt: new Date().toISOString() }, data: { origen: 'Hospital' } },
    { idHash: 'm-4', type: 'person', name: 'Ana Silva', status: 'missing', age: 50, gender: 'F', lastSeen: { date: new Date().toISOString(), state: 'Carabobo', municipality: 'Valencia', description: 'Cerca del mercado' }, metadata: { urgencyScore: 2, createdAt: new Date().toISOString() }, data: { origen: 'Vecinos' } }
  ] as Person[],
  adulto_mayor: [
    { idHash: 'am-1', type: 'person', name: 'Pedro Suárez', status: 'missing', age: 72, gender: 'M', lastSeen: { date: new Date().toISOString(), state: 'Lara', municipality: 'Iribarren', description: 'Desorientado cerca del parque' }, metadata: { urgencyScore: 5, createdAt: new Date().toISOString() }, data: { origen: 'Familiar' } },
    { idHash: 'am-2', type: 'person', name: 'Carmen Rojas', status: 'found', age: 68, gender: 'F', lastSeen: { date: new Date().toISOString(), state: 'Zulia', municipality: 'Maracaibo', description: 'En buen estado de salud' }, metadata: { urgencyScore: 1, createdAt: new Date().toISOString() }, data: { origen: 'Cruz Roja' } },
    { idHash: 'am-3', type: 'person', name: 'José Martínez', status: 'missing', age: 80, gender: 'M', lastSeen: { date: new Date().toISOString(), state: 'Mérida', municipality: 'Libertador', description: 'Con bastón' }, metadata: { urgencyScore: 5, createdAt: new Date().toISOString() }, data: { origen: 'Familiar' } },
    { idHash: 'am-4', type: 'person', name: 'Teresa Blanco', status: 'missing', age: 75, gender: 'F', lastSeen: { date: new Date().toISOString(), state: 'Táchira', municipality: 'San Cristóbal', description: 'Llevaba un suéter gris' }, metadata: { urgencyScore: 4, createdAt: new Date().toISOString() }, data: { origen: 'Protección Civil' } }
  ] as Person[],
  mascota: [
    { idHash: 'p-1', type: 'animal', name: 'Luna', status: 'missing', description: 'Poodle blanco, collar rojo', lastSeen: { date: new Date().toISOString(), state: 'Miranda', municipality: 'Sucre', description: 'Corrió hacia la avenida' }, metadata: { urgencyScore: 2, createdAt: new Date().toISOString() }, data: { origen: 'Familiar' } },
    { idHash: 'p-2', type: 'animal', name: 'Max', status: 'found', description: 'Golden Retriever', lastSeen: { date: new Date().toISOString(), state: 'Distrito Capital', municipality: 'Chacao', description: 'Resguardado por vecinos' }, metadata: { urgencyScore: 1, createdAt: new Date().toISOString() }, data: { origen: 'Bienestar Animal' } },
    { idHash: 'p-3', type: 'animal', name: 'Milo', status: 'missing', description: 'Gato siamés', lastSeen: { date: new Date().toISOString(), state: 'Aragua', municipality: 'Mario Briceño', description: 'Asustado en el techo' }, metadata: { urgencyScore: 3, createdAt: new Date().toISOString() }, data: { origen: 'Dueño' } },
    { idHash: 'p-4', type: 'animal', name: 'Bella', status: 'missing', description: 'Mestiza pequeña, mancha en el ojo', lastSeen: { date: new Date().toISOString(), state: 'Carabobo', municipality: 'San Diego', description: 'Sin collar' }, metadata: { urgencyScore: 2, createdAt: new Date().toISOString() }, data: { origen: 'Rescatistas' } }
  ] as Person[],
  nino: [
    { idHash: 'n-1', type: 'person', name: 'Caso Protegido', status: 'missing', age: 10, gender: 'M', lastSeen: { date: new Date().toISOString(), state: 'Distrito Capital', municipality: 'Libertador', description: 'Información reservada (LOPNNA)' }, metadata: { urgencyScore: 5, createdAt: new Date().toISOString() }, data: { origen: 'Protección Civil' } },
    { idHash: 'n-2', type: 'person', name: 'Caso Protegido', status: 'found', age: 6, gender: 'F', lastSeen: { date: new Date().toISOString(), state: 'Miranda', municipality: 'Baruta', description: 'Bajo resguardo de autoridades' }, metadata: { urgencyScore: 1, createdAt: new Date().toISOString() }, data: { origen: 'Cruz Roja' } },
    { idHash: 'n-3', type: 'person', name: 'Caso Protegido', status: 'missing', age: 15, gender: 'F', lastSeen: { date: new Date().toISOString(), state: 'Vargas', municipality: 'La Guaira', description: 'Información reservada (LOPNNA)' }, metadata: { urgencyScore: 4, createdAt: new Date().toISOString() }, data: { origen: 'Familiar' } },
    { idHash: 'n-4', type: 'person', name: 'Caso Protegido', status: 'missing', age: 12, gender: 'M', lastSeen: { date: new Date().toISOString(), state: 'Aragua', municipality: 'Girardot', description: 'Información reservada (LOPNNA)' }, metadata: { urgencyScore: 5, createdAt: new Date().toISOString() }, data: { origen: 'Familiar' } }
  ] as Person[]
};

export const SearchPage: React.FC<SearchPageProps> = ({ onBack, onSelectPerson }) => {
  const [ageCategory, setAgeCategory] = useState<AgeCat>('adulto');
  const [name, setName] = useState('');
  const [estado, setEstado] = useState('');
  const [municipio, setMunicipio] = useState('');
  const [edad, setEdad] = useState('');
  const [raza, setRaza] = useState('');
  const [fecha, setFecha] = useState('');
  
  const [results, setResults] = useState<Person[] | null>(null);
  const [loading, setLoading] = useState(false);

  const isMinorCat = ageCategory === 'nino';

  const buscar = async () => {
    setLoading(true);
    setResults(null);
    try {
      // MVP: Simulamos retardo y usamos los MOCK_RESULTS para no exponer info de la DB real.
      await new Promise(resolve => setTimeout(resolve, 600));
      setResults(MOCK_RESULTS[ageCategory] || []);
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
        <Button variant="outline" className="srch__back" onClick={onBack} aria-label="Volver"><ArrowLeft size={20} /></Button>
        <h1>Buscar personas</h1>
      </div>

      <div className="srch__note">
        <ShieldCheck size={16} />
        Para ver información de contacto detallada es necesario realizar una solicitud. Así protegemos la
        privacidad de las personas y evitamos el mal uso de los datos.
      </div>

      <div className="srch__cats">
        <label style={{ textTransform: 'uppercase', fontSize: '0.85rem', letterSpacing: '0.05em', color: 'var(--clr-text-muted)', fontWeight: 700, marginBottom: '0.75rem', display: 'block' }}>
          ¿A quién buscas?
        </label>
        <div className="srch-category-grid">
          <button type="button" className={`srch-category-btn ${ageCategory === 'nino' ? 'active-red' : ''}`} onClick={() => setAgeCategory('nino')} style={{ display: 'flex', flexDirection: 'column', gap: '2px', padding: '1rem 0.5rem' }}>
            <span>Niño | Niña</span>
            <span style={{ fontSize: '0.7em', fontWeight: 500, opacity: 0.85 }}>o Adolescente</span>
          </button>
          <button type="button" className={`srch-category-btn ${ageCategory === 'adulto' ? 'active-blue' : ''}`} onClick={() => setAgeCategory('adulto')} style={{ padding: '1rem 0.5rem' }}>
            Adulto
          </button>
          <button type="button" className={`srch-category-btn ${ageCategory === 'adulto_mayor' ? 'active-blue' : ''}`} onClick={() => setAgeCategory('adulto_mayor')} style={{ padding: '1rem 0.5rem' }}>
            Adulto Mayor
          </button>
          <button type="button" className={`srch-category-btn ${ageCategory === 'mascota' ? 'active-blue' : ''}`} onClick={() => setAgeCategory('mascota')} style={{ padding: '1rem 0.5rem' }}>
            Mascota
          </button>
        </div>
      </div>

      <div className="srch__field">
        <Search size={17} />
        <input placeholder="Nombre de la persona…" value={name} onChange={e => setName(e.target.value)} />
      </div>

      {isMinorCat && (
        <div className="minor-notice__alert" style={{ marginBottom: '1rem', padding: '0.8rem', borderRadius: '8px', fontSize: '0.85rem' }}>
          Por protección LOPNNA, los datos mostrados son limitados en el MVP.
        </div>
      )}

      <div className="srch__filters">
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
                  title="Última vez que se le vio"
                />
              </div>
            </div>
          </div>
          <Button fullWidth size="lg" onClick={buscar} disabled={loading} className="flex-center gap-2">
            {loading ? <div className="spinner" style={{ width: 18, height: 18, border: '2px solid rgba(255,255,255,0.3)', borderTopColor: '#fff', borderRadius: '50%', animation: 'spin 1s linear infinite' }} /> : <Search size={18} />} 
            {loading ? 'Buscando...' : 'Buscar'}
          </Button>
          
          {results !== null && (
            <div className="srch__results" style={{ marginTop: '1.5rem' }}>
              <h3 style={{ fontSize: '1.1rem', marginBottom: '1rem', color: 'var(--clr-text)' }}>
                Resultados ({results.length})
              </h3>
              {results.length > 0 ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                  {results.map(p => (
                    <FeedCard key={p.idHash} person={p} onClick={() => onSelectPerson(p)} />
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
  );
};
