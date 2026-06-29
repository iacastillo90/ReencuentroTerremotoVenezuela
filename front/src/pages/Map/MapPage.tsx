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
          onSelectPerson={onSelectPerson}
        />
      </div>
    </div>
  );
};
