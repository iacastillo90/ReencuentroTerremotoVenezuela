/**
 * pages/Map/MapPage.tsx — Página del mapa interactivo
 *
 * PROPÓSITO:
 *   Contenedor que orquesta los componentes del mapa:
 *   MapFilters (chips de capas) + InteractiveMap (Leaflet).
 *   Mantiene el estado de las capas visibles.
 *
 * FLUJO:
 *   1. MapPage recibe persons[] y disasters[] del padre (App.tsx).
 *   2. Mantiene un estado local layers (MapLayers) con qué capas
 *      están activas. Por defecto, todas activas.
 *   3. toggleLayer cambia el estado de una capa (true ↔ false).
 *   4. Pasa layers + toggleLayer tanto a MapFilters como a InteractiveMap.
 *   5. InteractiveMap filtra disasters según layers y solo renderiza
 *      los que coinciden con capas activas.
 *
 * PERSONAS SIEMPRE VISIBLES:
 *   A diferencia de disasters, el filtro de persons se aplica a nivel
 *   de MarkerClusterGroup (dentro de InteractiveMap), no aquí.
 */
import React from 'react';
import { InteractiveMap } from '../../components/map/Map';
import { MapFilters } from '../../components/map/MapFilters';
import type { MapLayers } from '../../components/map/MapFilters';
import type { Person, Disaster } from '../../types';
import { useState } from 'react';
import './Map.css';

interface MapPageProps {
  persons: Person[];
  disasters: Disaster[];
  onSelectPerson: (p: Person) => void;
}

export const MapPage: React.FC<MapPageProps> = ({ persons, disasters, onSelectPerson }) => {
  const [layers, setLayers] = useState<MapLayers>({
    persons: true,
    earthquake: true,
    flood: true,
    fire: true,
    social: true
  });

  const toggleLayer = (layer: keyof MapLayers) => {
    setLayers(prev => ({ ...prev, [layer]: !prev[layer] }));
  };

  return (
    <div className="map-page">
      <div className="map-container">
        <MapFilters layers={layers} onToggleLayer={toggleLayer} />
        <InteractiveMap
          persons={persons}
          disasters={disasters}
          layers={layers}
          onToggleLayer={toggleLayer}
          onSelectPerson={onSelectPerson}
        />
      </div>
    </div>
  );
};
