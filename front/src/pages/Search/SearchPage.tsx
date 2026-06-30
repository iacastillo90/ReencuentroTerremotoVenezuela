import React, { useState } from 'react';
import { Search, ArrowLeft, User, UserRound, Baby, ShieldCheck, ClipboardList, Mail } from 'lucide-react';
import './Search.css';

type AgeCat = 'adulto' | 'adulto_mayor' | 'adolescente' | 'menor';

interface SearchPageProps {
  /** Ejecuta la búsqueda (nombre) y navega a los resultados. */
  onSearch: (query: string) => void;
  onBack: () => void;
}

const AGE_CATS: { key: AgeCat; icon: React.ReactNode; label: string }[] = [
  { key: 'adulto',       icon: <User size={18} />,      label: 'Adulto' },
  { key: 'adulto_mayor', icon: <UserRound size={18} />, label: 'Adulto mayor' },
  { key: 'adolescente',  icon: <User size={18} />,      label: 'Adolescente' },
  { key: 'menor',        icon: <Baby size={18} />,      label: 'Niño/a' },
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
  const [rango, setRango] = useState('');
  const [fecha, setFecha] = useState('');

  const isMinorCat = ageCategory === 'menor' || ageCategory === 'adolescente';

  const buscar = () => {
    // La búsqueda principal del equipo es por nombre/zona; pasamos el término más específico.
    onSearch(name || estado || municipio);
  };

  return (
    <div className="srch">
      <div className="srch__head">
        <button className="srch__back" onClick={onBack} aria-label="Volver"><ArrowLeft size={20} /></button>
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
        <span className="srch__label">¿A quién buscas?</span>
        <div className="agecat-row">
          {AGE_CATS.map(c => {
            const minor = c.key === 'menor' || c.key === 'adolescente';
            return (
              <button
                key={c.key}
                className={`agecat ${minor ? 'minor' : ''} ${ageCategory === c.key ? 'active' : ''}`}
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
          <button className="srch__btn dark" onClick={() => alert('Solicitud registrada. Nuestro equipo revisará la información de forma protegida y te contactará por correo si hay un caso relacionado.')}>
            Solicitar búsqueda
          </button>
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
              <div className="srch__field-group">
                <label>Rango de edad</label>
                <select value={rango} onChange={e => setRango(e.target.value)}>
                  <option value="">Cualquiera</option>
                  <option value="18-29">18 a 29</option>
                  <option value="30-44">30 a 44</option>
                  <option value="45-59">45 a 59</option>
                  <option value="60-200">60 o más</option>
                </select>
              </div>
              <div className="srch__field-group">
                <label>Fecha aproximada</label>
                <input type="date" value={fecha} onChange={e => setFecha(e.target.value)} />
              </div>
            </div>
          </div>
          <button className="srch__btn" onClick={buscar}><Search size={18} /> Buscar</button>
        </>
      )}
    </div>
  );
};
