import { useState, useEffect } from 'react';
import { api } from './services/api';
import { AppLayout } from './layouts/AppLayout';
import { FeedPage, FeedSidebar } from './pages/Feed/Feed';
import { MapPage } from './pages/Map/MapPage';
import { PersonDetailModal } from './components/modals/PersonDetailModal';
import { ReportModal } from './components/modals/ReportModal';
import { AdminDashboard } from './pages/Admin/AdminDashboard';
import type { Person, Disaster } from './types';

type View = 'feed' | 'map' | 'report' | 'admin';

function App() {
  const [persons, setPersons] = useState<Person[]>([]);
  const [disasters, setDisasters] = useState<Disaster[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeView, setActiveView] = useState<View>('feed');
  const [selectedPerson, setSelectedPerson] = useState<Person | null>(null);
  const [isReporting, setIsReporting] = useState(false);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        const [pRes, dRes] = await Promise.all([
          api.get<Person[]>('/persons'),
          api.get<Disaster[]>('/disasters/active')
        ]);
        setPersons(pRes.data);
        setDisasters(dRes.data);
      } catch (e) {
        console.error('Error fetching data:', e);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  // Admin view — full screen takeover
  if (activeView === 'admin') {
    return <AdminDashboard onBack={() => setActiveView('feed')} />;
  }

  return (
    <>
      <AppLayout
        activeView={activeView}
        onViewChange={v => setActiveView(v)}
        onReport={() => setIsReporting(true)}
        onAdmin={() => setActiveView('admin')}
        sidebar={
          activeView === 'feed'
            ? <FeedSidebar persons={persons} disasters={disasters} />
            : undefined
        }
      >
        {activeView === 'feed' && (
          <FeedPage
            persons={persons}
            disasters={disasters}
            loading={loading}
            onSelectPerson={setSelectedPerson}
          />
        )}

        {activeView === 'map' && (
          <MapPage
            persons={persons}
            disasters={disasters}
            onSelectPerson={setSelectedPerson}
          />
        )}
      </AppLayout>

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
    </>
  );
}

export default App;
