import { useState, useEffect } from 'react';
import { api } from './services/api';
import { InteractiveMap } from './components/Map';
import { PersonDetailModal } from './components/PersonDetailModal';
import { ReportModal } from './components/ReportModal';
import type { Person, Disaster } from './types';
import { Search, AlertTriangle, Users, MapPin, Loader2, ArrowLeft } from 'lucide-react';
import './App.css';

function App() {
  const [persons, setPersons] = useState<Person[]>([]);
  const [disasters, setDisasters] = useState<Disaster[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [activeFilter, setActiveFilter] = useState<'all' | 'disasters' | 'persons' | 'animals'>('all');
  const [selectedPerson, setSelectedPerson] = useState<Person | null>(null);
  const [isReporting, setIsReporting] = useState(false);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [personsRes, disastersRes] = await Promise.all([
        api.get<Person[]>('/persons'),
        api.get<Disaster[]>('/disasters/active')
      ]);
      setPersons(personsRes.data);
      setDisasters(disastersRes.data);
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
    }
  };

  const filteredPersons = persons.filter(p => 
    p.name.toLowerCase().includes(search.toLowerCase()) || 
    p.lastSeen?.state?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="app-container">
      <nav className="navbar">
        <div className="nav-brand">
          <div className="logo-icon"><MapPin size={24} color="#fff" /></div>
          <h1>Reencuentro<span>VE</span></h1>
        </div>
        <div className="nav-actions">
          <button className="btn-primary" onClick={() => setIsReporting(true)}>
            Reportar Desaparecido
          </button>
        </div>
      </nav>

      <main className="main-layout">
        <aside className="sidebar">
          {activeFilter !== 'all' && (
            <button className="clear-filter-btn" onClick={() => setActiveFilter('all')}>
              <ArrowLeft size={16} /> Ver todo el tablero
            </button>
          )}

          <div className="stats-cards">
            <div 
              className={`stat-card alert ${activeFilter === 'disasters' ? 'active' : ''}`}
              onClick={() => setActiveFilter(activeFilter === 'disasters' ? 'all' : 'disasters')}
            >
              <AlertTriangle size={20} />
              <div>
                <h4>{disasters.length}</h4>
                <p>Alertas Activas</p>
              </div>
            </div>
            <div 
              className={`stat-card persons ${activeFilter === 'persons' ? 'active' : ''}`}
              onClick={() => setActiveFilter(activeFilter === 'persons' ? 'all' : 'persons')}
            >
              <Users size={20} />
              <div>
                <h4>{persons.filter(p => p.status === 'missing').length}</h4>
                <p>Personas Buscadas</p>
              </div>
            </div>
            <div 
              className={`stat-card animals ${activeFilter === 'animals' ? 'active' : ''}`}
              onClick={() => setActiveFilter(activeFilter === 'animals' ? 'all' : 'animals')}
              style={{ backgroundColor: activeFilter === 'animals' ? 'rgba(16, 185, 129, 0.1)' : 'var(--bg-hover)' }}
            >
              {/* Using AlertTriangle temporarily for animals if icon missing, but best if we have a PawPrint. We don't have PawPrint imported, so we just use an emoji or simple text */}
              <span style={{ fontSize: '1.2rem', filter: 'grayscale(1)' }}>🐾</span>
              <div>
                <h4>0</h4>
                <p>Mascotas Perdidas</p>
              </div>
            </div>
          </div>

          {(activeFilter === 'all' || activeFilter === 'persons') && (
            <>
              <div className="search-box">
                <Search size={18} className="search-icon" />
                <input 
                  type="text" 
                  placeholder="Buscar por nombre o estado..." 
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>

              <div className="persons-list">
                <h3>Personas Reportadas ({filteredPersons.length})</h3>
                {loading ? (
                  <div className="loading-state"><Loader2 className="spinner" size={24} /></div>
                ) : filteredPersons.length === 0 ? (
                  <p className="empty-state">No se encontraron registros.</p>
                ) : (
                  filteredPersons.map(person => (
                    <div 
                      key={person.idHash} 
                      className="person-card" 
                      onClick={() => setSelectedPerson(person)}
                      style={{ cursor: 'pointer' }}
                    >
                      <div className="person-card-inner">
                        <div className="person-photo-container">
                          {person.photoUrl ? (
                            <img src={person.photoUrl} alt={person.name} className="person-photo" />
                          ) : (
                            <div className="person-photo-placeholder"><Users size={20} /></div>
                          )}
                        </div>
                        <div className="person-info">
                          <div className="person-header">
                            <h4>{person.name}</h4>
                            <span className={`badge ${person.status}`}>
                              {person.status === 'missing' ? 'Desaparecido' : 'Encontrado'}
                            </span>
                          </div>
                          <p className="person-location">
                            <MapPin size={14} /> {person.lastSeen?.state || 'Desconocido'}
                          </p>
                          <p className="person-urgency">
                            Urgencia: <strong>{person.metadata?.urgencyScore || 0}/100</strong>
                          </p>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </>
          )}

          {activeFilter === 'animals' && (
            <div className="persons-list">
              <h3>Mascotas Reportadas (0)</h3>
              <p className="empty-state">No hay registros de mascotas perdidas en este momento. La plataforma está lista para recibir reportes de animales.</p>
            </div>
          )}

          {activeFilter === 'disasters' && (
            <div className="persons-list">
              <h3>Desastres Activos ({disasters.length})</h3>
              {disasters.map(d => (
                <div key={d._id} className="person-card disaster-list-card" style={{ borderLeft: `4px solid ${d.severity === 'critical' ? '#ef4444' : '#f97316'}`}}>
                  <h4>{d.title}</h4>
                  <p className="person-location"><MapPin size={14} /> Lat: {d.coordinates.coordinates[1].toFixed(2)}, Lng: {d.coordinates.coordinates[0].toFixed(2)}</p>
                </div>
              ))}
            </div>
          )}
        </aside>

        <section className="map-section">
          {loading ? (
            <div className="loading-map">
              <Loader2 className="spinner" size={40} />
              <p>Cargando datos geoespaciales...</p>
            </div>
          ) : (
            <InteractiveMap 
              persons={filteredPersons} 
              disasters={disasters} 
              activeFilter={activeFilter} 
              onSelectPerson={setSelectedPerson}
            />
          )}
        </section>
      </main>

      {selectedPerson && (
        <PersonDetailModal 
          person={selectedPerson} 
          onClose={() => setSelectedPerson(null)} 
        />
      )}

      {isReporting && (
        <ReportModal 
          onClose={() => setIsReporting(false)} 
        />
      )}
    </div>
  );
}

export default App;
