/**
 * pages/Library/LibraryPage.tsx — Directorio de recursos y enlaces útiles
 *
 * PROPÓSITO:
 *   Muestra un directorio curado de recursos (buscadores, refugios,
 *   plataformas de ayuda, etc.) organizado por categorías. Los datos
 *   vienen de un archivo JSON estático (library.json) que se actualiza
 *   manualmente.
 *
 * TABS:
 *   - "Buscadores": recursos para buscar personas.
 *   - "Afectados": recursos para personas afectadas (refugios, salud, etc.).
 *
 * BÚSQUEDA:
 *   Filtro local (client-side) que busca por nombre o descripción
 *   del recurso. Filtra sobre los datos del JSON cargado.
 *
 * CADA RECURSO MUESTRA:
 *   - Nombre del recurso/plataforma.
 *   - Descripción breve.
 *   - Notas adicionales (si existen).
 *   - Badge "Verificado" (si aplica).
 *   - Enlace externo para abrir en nueva pestaña.
 *
 * DATOS:
 *   - Archivo: src/data/library.json
 *   - Estructura: { meta, tabs, resources: { buscadores: [...], afectados: [...] } }
 */
import React, { useState } from 'react';
import libraryData from '../../data/library.json';
import { ExternalLink, CheckCircle, Search, Info } from 'lucide-react';
import type { LibraryItem } from '../../types';
import './Library.css';

export const LibraryPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'buscadores' | 'afectados'>('buscadores');
  const [search, setSearch] = useState('');

  const currentCategories = libraryData.resources[activeTab];

  const filteredCategories = currentCategories.map(cat => {
    return {
      ...cat,
      items: cat.items.filter(item =>
        item.name.toLowerCase().includes(search.toLowerCase()) ||
        item.description.toLowerCase().includes(search.toLowerCase())
      )
    };
  }).filter(cat => cat.items.length > 0);

  return (
    <div className="library-page">
      <div className="library-header">
        <h2>Directorio</h2>
        <p className="library-note"><Info size={14} />{libraryData.meta.note}</p>

        <div className="library-tabs">
          <button
            className={`tab-btn ${activeTab === 'buscadores' ? 'active' : ''}`}
            onClick={() => setActiveTab('buscadores')}
          >
            {libraryData.tabs.searchers.label}
          </button>
          <button
            className={`tab-btn ${activeTab === 'afectados' ? 'active' : ''}`}
            onClick={() => setActiveTab('afectados')}
          >
            {libraryData.tabs.affected.label}
          </button>
        </div>

        <div className="library-search">
          <Search size={18} color="var(--clr-text-muted)" />
          <input
            type="text"
            placeholder="Buscar recursos, refugios, plataformas..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>

      <div className="library-content">
        {filteredCategories.length === 0 ? (
          <div className="library-empty">
            <p>No se encontraron recursos con esos términos.</p>
          </div>
        ) : (
          filteredCategories.map(cat => (
            <div key={cat.category} className="library-category">
              <h3>{cat.categoryLabel}</h3>
              <div className="library-grid">
                {cat.items.map((item: LibraryItem) => (
                  <a key={item.id} href={item.url} target="_blank" rel="noopener noreferrer" className="library-card">
                    <div className="card-header">
                      <h4>{item.name}</h4>
                      <ExternalLink size={16} />
                    </div>
                    <p>{item.description}</p>
                    {item.notes && <div className="card-notes">{item.notes}</div>}
                    {item.verified && (
                      <div className="card-verified">
                        <CheckCircle size={12} /> Verificado
                      </div>
                    )}
                  </a>
                ))}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};
