import { useState, useEffect, useCallback, useRef } from 'react';
import { api } from './services/api';
import { AppLayout } from './layouts/AppLayout';
import { FeedPage, FeedSidebar } from './pages/Feed/Feed';
import { MapPage } from './pages/Map/MapPage';
import { PersonDetailModal } from './components/modals/PersonDetailModal';
import { ReportModal } from './components/modals/ReportModal';
import { AdminDashboard } from './pages/Admin/AdminDashboard';
import type { Person, Disaster } from './types';

type View = 'feed' | 'map' | 'report' | 'admin';

const PAGE_SIZE = 50;

function App() {
  const [persons, setPersons]         = useState<Person[]>([]);
  const [disasters, setDisasters]     = useState<Disaster[]>([]);
  const [total, setTotal]             = useState(0);
  const [offset, setOffset]           = useState(0);
  const [loading, setLoading]         = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore]         = useState(true);
  const [activeView, setActiveView]   = useState<View>('feed');
  const [selectedPerson, setSelectedPerson] = useState<Person | null>(null);
  const [isReporting, setIsReporting] = useState(false);
  const isFetchingRef = useRef(false);

  // Carga inicial
  useEffect(() => {
    const fetchInitial = async () => {
      setLoading(true);
      try {
        const [pRes, dRes] = await Promise.all([
          api.get<{ total: number; persons: Person[] }>(`/persons?limit=${PAGE_SIZE}&offset=0`),
          api.get<Disaster[]>('/disasters/active')
        ]);
        const { total: t, persons: p } = pRes.data;
        setPersons(p);
        setTotal(t);
        setOffset(PAGE_SIZE);
        setHasMore(PAGE_SIZE < t);
        setDisasters(dRes.data);
      } catch (e) {
        console.error('Error fetching data:', e);
      } finally {
        setLoading(false);
      }
    };
    fetchInitial();
  }, []);

  // Cargar más (scroll infinito)
  const loadMore = useCallback(async () => {
    if (isFetchingRef.current || !hasMore || loadingMore) return;
    isFetchingRef.current = true;
    setLoadingMore(true);
    try {
      const res = await api.get<{ total: number; persons: Person[] }>(
        `/persons?limit=${PAGE_SIZE}&offset=${offset}`
      );
      const { total: t, persons: newPersons } = res.data;
      setPersons(prev => [...prev, ...newPersons]);
      setTotal(t);
      const newOffset = offset + newPersons.length;
      setOffset(newOffset);
      setHasMore(newOffset < t);
    } catch (e) {
      console.error('Error cargando más:', e);
    } finally {
      setLoadingMore(false);
      isFetchingRef.current = false;
    }
  }, [offset, hasMore, loadingMore]);

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
            ? <FeedSidebar persons={persons} disasters={disasters} total={total} />
            : undefined
        }
      >
        {activeView === 'feed' && (
          <FeedPage
            persons={persons}
            disasters={disasters}
            loading={loading}
            loadingMore={loadingMore}
            hasMore={hasMore}
            total={total}
            onSelectPerson={setSelectedPerson}
            onLoadMore={loadMore}
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
