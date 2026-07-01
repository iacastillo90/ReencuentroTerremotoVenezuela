import React, { useState } from 'react';
import { Search, ArrowLeft, User, UserRound, Baby, ShieldCheck, ClipboardList, Mail, Dog } from 'lucide-react';
import { Button } from '../../components/ui/Button';
import './Search.css';

type AgeCat = 'adulto' | 'adulto_mayor' | 'mascota' | 'nino';

interface SearchPageProps {
  /** Ejecuta la búsqueda (nombre) y navega a los resultados. */
  onSearch: (query: string) => void;
  onBack: () => void;
}

const AGE_CATS: { key: AgeCat; icon: React.ReactNode; label: string }[] = [
  { key: 'adulto',       icon: <User size={24} />,      label: 'Adulto' },
  { key: 'adulto_mayor', icon: <UserRound size={24} />, label: 'Adulto Mayor' },
  { key: 'mascota',      icon: <Dog size={24} />,       label: 'Mascota' },
  { key: 'nino',         icon: <Baby size={24} />,      label: 'Niño/a' },
];

const ESTADOS_VE = [
  'Amazonas', 'Anzoátegui', 'Apure', 'Aragua', 'Barinas', 'Bolívar', 'Carabobo',
  'Cojedes', 'Delta Amacuro', 'Distrito Capital', 'Falcón', 'Guárico', 'La Guaira',
  'Lara', 'Mérida', 'Miranda', 'Monagas', 'Nueva Esparta', 'Portuguesa', 'Sucre',
  'Táchira', 'Trujillo', 'Yaracuy', 'Zulia',
];

export const SearchPage: React.FC<SearchPageProps> = ({ onSearch, onBack }) => {
  const [ageCategory, setAgeCategory] = useState<AgeCat>('adulto');
  const [name, setName] = useState('');
  const [estado, setEstado] = useState('');
  const [municipio, setMunicipio] = useState('');
  const [edad, setEdad] = useState('');
  const [raza, setRaza] = useState('');
  const [fecha, setFecha] = useState('');

  const isMinorCat = ageCategory === 'nino';

  const buscar = () => {
    // La búsqueda principal del equipo es por nombre/zona; pasamos el término más específico.
    onSearch(name || estado || municipio);
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

      <div className="srch__field">
        <Search size={17} />
        <input placeholder="Nombre de la persona…" value={name} onChange={e => setName(e.target.value)} />
      </div>

      <div className="srch__cats">
        <label style={{ textTransform: 'uppercase', fontSize: '0.85rem', letterSpacing: '0.05em', color: 'var(--clr-text-muted)', fontWeight: 700, marginBottom: '0.75rem', display: 'block' }}>
          ¿A quién buscas?
        </label>
        <div className="srch-category-grid">
          {AGE_CATS.map(c => {
            return (
              <button
                type="button"
                key={c.key}
                className={`srch-category-btn ${ageCategory === c.key ? 'active-blue' : ''}`}
                onClick={() => setAgeCategory(c.key)}
              >
                {c.icon} {c.label}
              </button>
            );
          })}
        </div>
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
                <label>Fecha de desaparición</label>
                <input 
                  type="date" 
                  value={fecha} 
                  onChange={e => setFecha(e.target.value)} 
                  title="Última vez que se le vio"
                />
              </div>
            </div>
          </div>
          <Button fullWidth size="lg" onClick={buscar} className="flex-center gap-2"><Search size={18} /> Buscar</Button>
        </>
      )}
    </div>
  );
};
