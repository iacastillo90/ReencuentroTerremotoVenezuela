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
      const qParams = new URLSearchParams();
      if (name) qParams.append('q', name);
      if (estado) qParams.append('state', estado);
      if (municipio) qParams.append('municipality', municipio);
      if (ageCategory) qParams.append('category', ageCategory);
      
      // Limitamos los resultados y consultamos al backend
      qParams.append('limit', '20');
      
      const res = await api.get<{ total: number; persons: Person[] }>(`/persons?${qParams.toString()}`);
      setResults(res.data.persons);
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

      {isMinorCat ? (
        <div className="minor-notice">
          <div className="minor-notice__shield"><ShieldCheck size={40} /></div>
          <h2>Búsqueda de niños y adolescentes</h2>
          <div className="minor-notice__alert">
            Por protección legal y ética (LOPNNA), la información de niños, niñas y adolescentes no se muestra
            directamente en los resultados de búsqueda.
          </div>
          <p className="minor-notice__lead">
            Si estás buscando a un menor de edad, podemos ayudarte a verificar si existe un reporte relacionado.
          </p>
          <h4>¿Cómo funciona?</h4>
          <div className="minor-steps">
            <div className="minor-step"><div className="minor-step__icon"><ClipboardList size={16} /></div><span>1. Completa el formulario de solicitud con el nombre del menor.</span></div>
            <div className="minor-step"><div className="minor-step__icon"><ShieldCheck size={16} /></div><span>2. Nuestro equipo revisará la información de forma protegida.</span></div>
            <div className="minor-step"><div className="minor-step__icon"><Mail size={16} /></div><span>3. Si existe un posible caso, te contactaremos por correo electrónico.</span></div>
          </div>
          <Button fullWidth size="lg" variant="danger" onClick={() => alert('Solicitud registrada. Nuestro equipo revisará la información de forma protegida y te contactará por correo si hay un caso relacionado.')}>
            Solicitar búsqueda
          </Button>
          <a className="minor-notice__link" href="#" onClick={e => e.preventDefault()}>Conoce más sobre nuestra política de protección infantil</a>
        </div>
      ) : (
        <>
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
        </>
      )}
    </div>
  );
};
