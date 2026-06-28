import { useEffect, useState } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Circle } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import type { Person, Disaster } from '../types';
import './Map.css';

// Fix para los iconos de leaflet en react
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

// Icono personalizado para personas
const personIcon = new L.Icon({
  iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-blue.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41]
});

// Icono para desastres
const disasterIcon = new L.Icon({
  iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-red.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41]
});

interface MapProps {
  persons: Person[];
  disasters: Disaster[];
}

export function InteractiveMap({ persons, disasters }: MapProps) {
  const [center, setCenter] = useState<[number, number]>([8.5, -66.0]); // Centro de Venezuela

  return (
    <div className="map-container">
      <MapContainer center={center} zoom={6} scrollWheelZoom={true} className="leaflet-map">
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
          url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png"
        />
        
        {/* Marcadores de Personas */}
        {persons.map((person) => {
          if (!person.lastSeen.coordinates) return null;
          const [lng, lat] = person.lastSeen.coordinates.coordinates;
          return (
            <Marker key={person.idHash} position={[lat, lng]} icon={personIcon}>
              <Popup>
                <div className="popup-card">
                  <h3>{person.name}</h3>
                  <p className="status-badge" data-status={person.status}>
                    {person.status === 'missing' ? 'Desaparecido' : person.status === 'found' ? 'Encontrado' : person.status}
                  </p>
                  <p><strong>Última vez visto:</strong> {person.lastSeen.description}</p>
                  <p><strong>Urgencia:</strong> {person.metadata.urgencyScore}</p>
                </div>
              </Popup>
            </Marker>
          );
        })}

        {/* Marcadores de Desastres */}
        {disasters.map((disaster) => {
          const [lng, lat] = disaster.coordinates.coordinates;
          const color = disaster.severity === 'critical' ? '#ef4444' :
                        disaster.severity === 'high' ? '#f97316' :
                        disaster.severity === 'medium' ? '#eab308' : '#3b82f6';
          
          return (
            <div key={disaster._id}>
              <Marker position={[lat, lng]} icon={disasterIcon}>
                <Popup>
                  <div className="popup-card disaster-popup">
                    <h3 style={{ color }}>{disaster.title}</h3>
                    <p><strong>Tipo:</strong> {disaster.type}</p>
                    <p><strong>Severidad:</strong> {disaster.severity.toUpperCase()}</p>
                  </div>
                </Popup>
              </Marker>
              <Circle 
                center={[lat, lng]} 
                radius={disaster.type === 'earthquake' ? 30000 : 5000} 
                pathOptions={{ color, fillColor: color, fillOpacity: 0.2, weight: 1 }}
              />
            </div>
          );
        })}
      </MapContainer>
    </div>
  );
}
