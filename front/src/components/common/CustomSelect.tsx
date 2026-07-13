/**
 * CustomSelect.tsx — Selector visual personalizado
 *
 * PROPÓSITO:
 *   Reemplaza el <select> nativo del navegador con un dropdown
 *   visual que incluye swatch de color (círculo de color al lado
 *   de cada opción). Usado en StepCaracterísticas del reporte
 *   (color de piel, tipo de cabello, etc.).
 *
 * POR QUÉ NO UN <select> NATIVO:
 *   Los selects nativos no permiten:
 *   - Agregar un swatch de color por opción.
 *   - Control total sobre el estilo del dropdown (cada SO lo
 *     renderiza diferente).
 *   - Animaciones de apertura/cierre.
 *
 * CÓMO USAR:
 *   <CustomSelect
 *     label="Color de piel"
 *     options={[
 *       { val: 'blanca', label: 'Blanca', hex: '#F5E6D3' },
 *       { val: 'morena', label: 'Morena', hex: '#A0724A' },
 *     ]}
 *     value={skinColor}
 *     onChange={setSkinColor}
 *     placeholder="Selecciona..."
 *   />
 *
 * COMPORTAMIENTO:
 *   - Abre/cierra al hacer click en el trigger.
 *   - Cierra al seleccionar una opción o al hacer click fuera.
 *   - Navegación por teclado: Enter para abrir/cerrar.
 *   - Backdrop semi-transparente que captura clicks fuera.
 */
import React, { useState } from 'react';
import { ChevronDown } from 'lucide-react';

interface SelectOption {
  val: string;
  label: string;
  hex?: string;
}

interface CustomSelectProps {
  label: string;
  options: SelectOption[];
  value: string;
  onChange: (val: string) => void;
  placeholder?: string;
}

export const CustomSelect: React.FC<CustomSelectProps> = ({
  label, options, value, onChange, placeholder
}) => {
  const [open, setOpen] = useState(false);
  const selected = options.find((o) => o.val === value);

  return (
    <div className="figma-select-field">
      {/* Label del campo */}
      <label>{label}</label>

      {/* Trigger: muestra la opción actual o el placeholder */}
      <div className="figma-select-trigger"
        onClick={() => setOpen(!open)}
        tabIndex={0}
        role="combobox"
        aria-expanded={open}
        onKeyDown={e => e.key === 'Enter' && setOpen(!open)}>
        {selected ? (
          <>
            {selected.hex && <div className="swatch" style={{ backgroundColor: selected.hex }} />}
            <span className="select-label">{selected.label}</span>
          </>
        ) : (
          <span className="select-placeholder">{placeholder}</span>
        )}
        {/* Chevron que rota 180° cuando el dropdown está abierto */}
        <ChevronDown size={16} className={`chevron ${open ? 'open' : ''}`} />
      </div>

      {/* Dropdown desplegable */}
      {open && (
        <>
          {/* Backdrop invisible para detectar click fuera */}
          <div className="figma-select-backdrop" onClick={() => setOpen(false)} />
          <div className="figma-select-dropdown">
            {options.map((o) => (
              <div key={o.val}
                onClick={() => { onChange(o.val); setOpen(false); }}
                className={`figma-select-option ${value === o.val ? 'selected' : ''}`}>
                {o.hex && <div className="option-swatch" style={{ backgroundColor: o.hex }} />}
                <span>{o.label}</span>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
};
