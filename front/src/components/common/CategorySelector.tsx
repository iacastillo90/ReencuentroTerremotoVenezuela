/**
 * CategorySelector.tsx — Grid de categorías persona/mascota
 *
 * PROPÓSITO:
 *   Grid 2×2 de tarjetas para seleccionar la categoría de la
 *   persona (Niño/a, Adulto, Adulto mayor, Mascota). Originalmente
 *   duplicado entre ReportModal (step 1) y SearchPage (step 1).
 *   Ahora unificado para mantener consistencia visual y lógica.
 *
 * CÓMO USAR:
 *   <CategorySelector
 *     categories={SEARCH_CATEGORIES}
 *     selected={ageCategory}
 *     onSelect={setAgeCategory}
 *   />
 *
 * DATOS COMPARTIDOS:
 *   - DEFAULT_CATEGORIES: usado en ReportModal (valores en español
 *     con tildes: 'niño/a o adolescente').
 *   - SEARCH_CATEGORIES: usado en SearchPage (valores sin espacios
 *     para URL: 'nino', 'adulto_mayor').
 *   Ambos se exportan para que los consumidores elijan el set
 *   adecuado según el contexto.
 */
import React from 'react';
import { Baby, User, Heart, Dog } from 'lucide-react';

type IconComponent = React.FC<{ size?: number; className?: string }>;

interface CategoryItem {
  val: string;
  icon: IconComponent;
  label: string;
}

interface CategorySelectorProps {
  categories: CategoryItem[];
  selected: string;
  onSelect: (val: string) => void;
}

export const CategorySelector: React.FC<CategorySelectorProps> = ({
  categories, selected, onSelect
}) => (
  <div className="category-grid-2x2">
    {categories.map((c) => {
      const Icon = c.icon;
      const active = selected === c.val;
      return (
        <button key={c.val} type="button" onClick={() => onSelect(c.val)}
          className={`category-microcard ${active ? 'selected' : ''}`}>
          {/* Ícono grande de la categoría */}
          <div className="card-icon"><Icon size={28} /></div>
          {/* Label con salto de línea (\n en label) */}
          <span className="card-label">{c.label}</span>
        </button>
      );
    })}
  </div>
);

export const DEFAULT_CATEGORIES = [
  { val: 'niño/a o adolescente', icon: Baby, label: 'Niño/a o\nadolescente' },
  { val: 'adulto', icon: User, label: 'Adulto' },
  { val: 'adulto mayor', icon: Heart, label: 'Adulto\nmayor' },
  { val: 'mascota', icon: Dog, label: 'Mascota' },
];

export const SEARCH_CATEGORIES = [
  { val: 'nino', icon: Baby, label: 'Niño/a o\nadolescente' },
  { val: 'adulto', icon: User, label: 'Adulto' },
  { val: 'adulto_mayor', icon: Heart, label: 'Adulto\nmayor' },
  { val: 'mascota', icon: Dog, label: 'Mascota' },
];
