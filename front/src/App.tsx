import { useState, useEffect, useCallback, useRef } from 'react';
import { api } from './services/api';
import { AppLayout } from './layouts/AppLayout';
import { FeedPage, FeedSidebar } from './pages/Feed/Feed';
import { MapPage } from './pages/Map/MapPage';
import { PersonDetailModal } from './components/modals/PersonDetailModal';
import { ReportModal } from './components/modals/ReportModal';
import { AuthModal } from './components/modals/AuthModal';
import { AdminDashboard } from './pages/Admin/AdminDashboard';
import { useAuth } from './store/AuthContext';
import type { Person, Disaster } from './types';

import { LibraryPage } from './pages/Library/LibraryPage';
import { ProfilePage } from './pages/Profile/ProfilePage';

type View = 'feed' | 'map' | 'report' | 'admin' | 'library' | 'profile';

interface Counts { missing: number; found: number; total: number; }

const PAGE_SIZE = 50;

function App() {
  const [persons, setPersons]         = useState<Person[]>([]);
  const [disasters, setDisasters]     = useState<Disaster[]>([]);
  const [counts, setCounts]           = useState<Counts>({ missing: 0, found: 0, total: 0 });
  const [total, setTotal]             = useState(0);
  const [offset, setOffset]           = useState(0);
  const [loading, setLoading]         = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore]         = useState(true);
  const [activeView, setActiveView]   = useState<View>('feed');
  const [selectedPerson, setSelectedPerson] = useState<Person | null>(null);
  const [isReporting, setIsReporting] = useState(false);
  const [isAuthenticating, setIsAuthenticating] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const isFetchingRef = useRef(false);
  const { user } = useAuth();

  // Función base para obtener datos
  const fetchPersons = async (query: string, newOffset: number, append: boolean = false) => {
    try {
      const endpoint = `/persons?limit=${PAGE_SIZE}&offset=${newOffset}${query ? `&q=${query}` : ''}`;
      const [pRes, dRes, cRes, locRes] = await Promise.all([
        api.get<{ total: number; persons: Person[] }>(endpoint),
        // Only fetch these if it's initial load to save requests, but doing it parallel is fine
        api.get<Disaster[]>('/disasters/active').catch(() => ({ data: [] })),
        api.get<Counts>('/persons/counts').catch(() => ({ data: { missing: 0, found: 0, total: 0 } })),
        api.get<{ data: any[], total: number }>(`/localizados?limit=${PAGE_SIZE}&offset=${newOffset}${query ? `&q=${query}` : ''}`).catch(() => ({ data: { data: [], total: 0 } }))
      ]);
      const { total: t, persons: p } = pRes.data;
      
      // Map localizados to Person interface
      const localizadosAsPersons: Person[] = (locRes.data?.data || []).map((loc: any) => ({
        idHash: `loc-${loc._id}`,
        name: loc.name,
        status: 'found',
        lastSeen: {
          state: loc.origin || 'Desconocido',
          description: `Visto en: ${loc.location}`
        },
        metadata: {
          urgencyScore: 1,
          createdAt: loc.createdAt
        },
        data: {
          cedula: loc.cedula,
          origen: 'Reporte Hospital/Refugio',
          ficha_url: loc.sourceUrl,
          verificado_por: loc.isVerified ? 'Personal de Salud' : undefined
        }
      }));

      // Combine both sources
      const combined = [...p, ...localizadosAsPersons];
      
      setTotal(t + (locRes.data?.total || 0));
      setHasMore(newOffset + p.length < t || newOffset + localizadosAsPersons.length < (locRes.data?.total || 0));
      setDisasters(dRes.data);
      setCounts({
        missing: cRes.data.missing,
        found: cRes.data.found + (locRes.data?.total || 0),
        total: cRes.data.total + (locRes.data?.total || 0)
      });

      if (append) {
        setPersons(prev => [...prev, ...combined]);
      } else {
        // If no query and it's offset 0, shuffle a bit
        const data = (!query && newOffset === 0) ? combined.sort(() => Math.random() - 0.5) : combined;
        setPersons(data);
      }
    } catch (e) {
      console.error('Error fetching data:', e);
    }
  };

  // Carga inicial o cuando cambia la búsqueda
  useEffect(() => {
    const handler = setTimeout(async () => {
      setLoading(true);
      setOffset(0);
      await fetchPersons(searchQuery, 0, false);
      setLoading(false);
    }, searchQuery ? 500 : 0); // 500ms debounce
    
    return () => clearTimeout(handler);
  }, [searchQuery]);

  // Cargar más (scroll infinito)
  const loadMore = useCallback(async () => {
    if (isFetchingRef.current || !hasMore || loadingMore) return;
    isFetchingRef.current = true;
    setLoadingMore(true);
    try {
      const newOffset = offset + (searchQuery ? PAGE_SIZE : PAGE_SIZE); // Keep it simple
      await fetchPersons(searchQuery, newOffset, true);
      setOffset(newOffset);
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
        onViewChange={v => {
          if (v === 'profile' && !user) {
            setIsAuthenticating(true);
            return;
          }
          setActiveView(v);
        }}
        onReport={() => {
          if (!user || !user.isProfileComplete) {
            setIsAuthenticating(true);
          } else {
            setIsReporting(true);
          }
        }}
        onAdmin={() => setActiveView('admin')}
        sidebar={
          activeView === 'feed'
            ? <FeedSidebar persons={persons} disasters={disasters} total={counts.total} counts={counts} />
            : undefined
        }
      >
        {activeView === 'profile' && <ProfilePage onSelectPerson={setSelectedPerson} />}
        {activeView === 'library' && <LibraryPage />}
        {activeView === 'feed' && (
          <FeedPage
            persons={persons}
            disasters={disasters}
            loading={loading}
            loadingMore={loadingMore}
            hasMore={hasMore}
            total={total}
            counts={counts}
            searchQuery={searchQuery}
            onSearchChange={setSearchQuery}
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
          onReport={() => {
            setSelectedPerson(null);
            if (!user || !user.isProfileComplete) {
              setIsAuthenticating(true);
            } else {
              setIsReporting(true);
            }
          }}
        />
      )}

      {isAuthenticating && (
        <AuthModal
          onClose={() => setIsAuthenticating(false)}
          onSuccess={() => {
            setIsAuthenticating(false);
            setIsReporting(true);
          }}
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
// Forzar rebuild en Vercel
