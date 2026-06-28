import React from 'react';
import { InteractiveMap } from '../../components/map/Map';
import type { Person, Disaster } from '../../types';
import './Map.css';

interface MapPageProps {
  persons: Person[];
  disasters: Disaster[];
  onSelectPerson: (p: Person) => void;
}

export const MapPage: React.FC<MapPageProps> = ({ persons, disasters, onSelectPerson }) => (
  <div className="map-page">
    <div className="map-container">
      <InteractiveMap
        persons={persons}
        disasters={disasters}
        activeFilter="all"
        onSelectPerson={onSelectPerson}
      />
    </div>
  </div>
);
