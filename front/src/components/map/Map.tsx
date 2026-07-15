/**
 * components/map/Map.tsx — Mapa interactivo Leaflet
 *
 * PROPÓSITO:
 *   Renderiza un mapa de Venezuela con:
 *   - Marcadores agrupados (MarkerCluster) de personas.
 *   - Marcadores + círculos de desastres activos.
 *   - Popups con info al hacer click.
 *   - Leyenda con filtros de capas.
 *
 * ¿POR QUÉ LEAFLET?
 *   - Liviano, open-source, sin API key.
 *   - react-leaflet 5 lo integra nativamente con React 19.
 *   - react-leaflet-cluster da clustering sin config adicional.
 *
 * ¿POR QUÉ NO GOOGLE MAPS?
 *   - Google Maps requiere API key y tiene costos.
 *   - Leaflet con tiles de CartoDB es gratuito.
 *
 * ICONOS:
 *   - Usamos icons personalizados de color-markers (blue = personas,
 *     red = desastres).
 *   - Leaflet por defecto no encuentra sus iconos en webpack/vite,
 *     por eso sobrescribimos _getIconUrl con URLs absolutas de CDN.
 *
 * MAPA BASE:
 *   CartoDB Voyager: tiles claros con etiquetas en español.
 *   Zoom control en la esquina inferior derecha.
 *
 * NOTA PARA TESTS:
 *   Este componente se mockea completo en los tests porque
 *   Leaflet no funciona en JSDOM (necesita canvas/webgl real).
 */
import React, { useState } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Circle, ZoomControl } from 'react-leaflet';
import MarkerClusterGroup from 'react-leaflet-cluster';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import type { Person, Disaster } from '../../types';
import { MapLegend } from './MapLegend';
import { Button } from '../ui/Button';
import './Map.css';

// Fix para iconos de Leaflet en webpack/vite.
// Sin esto, los marcadores aparecen como cuadrados rotos.
delete (L.Icon.Default.prototype as unknown as Record<string, unknown>)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

const personIcon = new L.Icon({
  iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-blue.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
  iconSize: [25, 41], iconAnchor: [12, 41],
  popupAnchor: [1, -34], shadowSize: [41, 41]
});

const disasterIcon = new L.Icon({
  iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-red.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
  iconSize: [25, 41], iconAnchor: [12, 41],
  popupAnchor: [1, -34], shadowSize: [41, 41]
});

const getSeverityName = (sev: string) => {
  const map: Record<string, string> = { low: 'Baja', medium: 'Media', high: 'Alta', critical: 'Crítica' };
  return map[sev] || sev;
};

const getDisasterName = (type: string) => {
  const map: Record<string, string> = { earthquake: 'Sismo', fire: 'Incendio', flood: 'Inundación' };
  return map[type] || type;
};

import type { MapLayers } from './MapFilters';

interface MapProps {
  persons: Person[];
  disasters: Disaster[];
  layers: MapLayers;
  onToggleLayer: (layer: keyof MapLayers) => void;
  onSelectPerson?: (person: Person) => void;
}

export function InteractiveMap({ persons, disasters, layers, onToggleLayer, onSelectPerson }: MapProps) {
  const [center] = useState<[number, number]>([8.5, -66.0]); // Centro de Venezuela

  return (
    <div className="map-container">
      <MapContainer center={center} zoom={6} scrollWheelZoom={true} className="leaflet-map" zoomControl={false}>
        <ZoomControl position="bottomright" />
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png"
        />
        {layers.persons && (
          <MarkerClusterGroup chunkedLoading>
            {persons.map((person) => {
              if (!person.lastSeen?.coordinates) return null;
              const [lng, lat] = person.lastSeen.coordinates.coordinates;
              return (
                <Marker key={person.idHash} position={[lat, lng]} icon={personIcon}>
                  <Popup>
                    <div className="popup-card">
                      {person.photoUrl && <img src={person.photoUrl} alt={person.name} className="popup-photo" />}
                      <h3>{person.name}</h3>
                      <p className="status-badge" data-status={person.status}>
                        {person.status === 'missing' ? 'Desaparecido' : person.status === 'found' ? 'Encontrado' : person.status}
                      </p>
                      <p><strong>Última vez visto:</strong> {person.lastSeen.description}</p>
                      <p><strong>Urgencia:</strong> {person.metadata.urgencyScore}</p>
                      {onSelectPerson && (
                        <div className="popup-action">
                          <Button fullWidth size="sm" onClick={() => onSelectPerson(person)}>
                            Ver perfil completo
                          </Button>
                        </div>
                      )}
                    </div>
                  </Popup>
                </Marker>
              );
            })}
          </MarkerClusterGroup>
        )}
        {disasters.filter(d => {
          if (d.type === 'earthquake' && layers.earthquake) return true;
          if (d.type === 'flood' && layers.flood) return true;
          if (d.type === 'fire' && layers.fire) return true;
          if (d.type === 'social' && layers.social) return true;
          if (!['earthquake', 'flood', 'fire', 'social'].includes(d.type)) return true;
          return false;
        }).map((disaster) => {
          const [lng, lat] = disaster.coordinates.coordinates;
          const color = disaster.severity === 'critical' ? '#ef4444'
            : disaster.severity === 'high' ? '#f97316'
            : disaster.severity === 'medium' ? '#eab308' : 'var(--clr-primary)';
          return (
            <React.Fragment key={disaster._id}>
              <Marker position={[lat, lng]} icon={disasterIcon}>
                <Popup>
                  <div className="popup-card disaster-popup">
                    <h3 data-severity={disaster.severity}>{disaster.title}</h3>
                    <p><strong>Tipo:</strong> {getDisasterName(disaster.type)}</p>
                    <p><strong>Severidad:</strong> {getSeverityName(disaster.severity).toUpperCase()}</p>
                  </div>
                </Popup>
              </Marker>
              <Circle center={[lat, lng]}
                radius={disaster.type === 'earthquake' ? 30000 : 5000}
                pathOptions={{ color, fillColor: color, fillOpacity: 0.2, weight: 1 }} />
            </React.Fragment>
          );
        })}
      </MapContainer>
      <MapLegend layers={layers} onToggleLayer={onToggleLayer} />
    </div>
  );
}
