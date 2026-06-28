import { useState, useEffect } from 'react';
import { api } from './services/api';
import { InteractiveMap } from './components/Map';
import { Person, Disaster } from './types';
import { Search, AlertTriangle, Users, MapPin, Loader2 } from 'lucide-react';
import './App.css';

function App() {
  const [persons, setPersons] = useState<Person[]>([]);
  const [disasters, setDisasters] = useState<Disaster[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);

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
    p.lastSeen.state.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="app-container">
      <nav className="navbar">
        <div className="nav-brand">
          <div className="logo-icon"><MapPin size={24} color="#fff" /></div>
          <h1>Reencuentro<span>VE</span></h1>
        </div>
        <div className="nav-actions">
          <button className="btn-primary">Reportar Desaparecido</button>
        </div>
      </nav>

      <main className="main-layout">
        <aside className="sidebar">
          <div className="search-box">
            <Search size={18} className="search-icon" />
            <input 
              type="text" 
              placeholder="Buscar por nombre o estado..." 
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          <div className="stats-cards">
            <div className="stat-card alert">
              <AlertTriangle size={20} />
              <div>
                <h4>{disasters.length}</h4>
                <p>Alertas Activas</p>
              </div>
            </div>
            <div className="stat-card persons">
              <Users size={20} />
              <div>
                <h4>{persons.filter(p => p.status === 'missing').length}</h4>
                <p>Desaparecidos</p>
              </div>
            </div>
          </div>

          <div className="persons-list">
            <h3>Resultados ({filteredPersons.length})</h3>
            {loading ? (
              <div className="loading-state"><Loader2 className="spinner" size={24} /></div>
            ) : filteredPersons.length === 0 ? (
              <p className="empty-state">No se encontraron registros.</p>
            ) : (
              filteredPersons.map(person => (
                <div key={person.idHash} className="person-card">
                  <div className="person-header">
                    <h4>{person.name}</h4>
                    <span className={`badge ${person.status}`}>{person.status}</span>
                  </div>
                  <p className="person-location">
                    <MapPin size={14} /> {person.lastSeen.state}
                  </p>
                  <p className="person-urgency">
                    Urgencia: <strong>{person.metadata.urgencyScore}/100</strong>
                  </p>
                </div>
              ))
            )}
          </div>
        </aside>

        <section className="map-section">
          {loading ? (
            <div className="loading-map">
              <Loader2 className="spinner" size={40} />
              <p>Cargando datos geoespaciales...</p>
            </div>
          ) : (
            <InteractiveMap persons={filteredPersons} disasters={disasters} />
          )}
        </section>
      </main>
    </div>
  );
}

export default App;
