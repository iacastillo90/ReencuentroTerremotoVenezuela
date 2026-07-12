/**
 * ═══════════════════════════════════════════════════════════
 * App.tsx — Componente raíz (orquestador de vistas)
 * 
 * PROPÓSITO:
 *   Orquesta qué vista se renderiza según activeView. El ruteo
 *   es por estado (no por URL), intencional para esta SPA tipo
 *   "tool" donde las rutas no aportan valor.
 * 
 * RESPONSABILIDADES:
 *   - Mantener activeView y los modales (selectedPerson, isReporting…)
 *   - Pasar datos y callbacks a cada página
 *   - Control de acceso (AUTH_VIEWS requiere sesión)
 * 
 * LO QUE YA NO ESTÁ AQUÍ:
 *   - fetchPersons, loading, offset, searchQuery → hook usePersons
 *   - Mapa → lazy loading con React.lazy (code-splitting de Leaflet)
 * ═══════════════════════════════════════════════════════════
 */
import { useState, lazy, Suspense } from 'react';
import { AppLayout } from './layouts/AppLayout';
import { FeedPage, FeedSidebar } from './pages/Feed/Feed';
import { ReportModal } from './components/modals/ReportModal';
import { AdminDashboard } from './pages/Admin/AdminDashboard';
import { LibraryPage } from './pages/Library/LibraryPage';
import { ProfilePage } from './pages/Profile/ProfilePage';
import { LogisticsPage } from './pages/Logistics/LogisticsPage';
import { HomePage } from './pages/Home/HomePage';
import { HomeGateway } from './pages/Home/HomeGateway';
import { SearchPage } from './pages/Search/SearchPage';
import { ManualPage } from './pages/Manual/ManualPage';
import { DirectoryPage } from './pages/Directory/DirectoryPage';
import { LoginPage } from './pages/Auth/LoginPage';
import { RegisterPage } from './pages/Auth/RegisterPage';
import { PersonDetailModal } from './components/modals/PersonDetailModal';
import { AuthModal } from './components/modals/AuthModal';
import { useAuth } from './store/AuthContext';
import { useBackgroundSync } from './hooks/useBackgroundSync';
import { usePersons } from './hooks/usePersons';
import { LoadingScreen } from './components/common/LoadingScreen';
import type { Person } from './types';

const MapPage = lazy(() => import('./pages/Map/MapPage').then(m => ({ default: m.MapPage })));

type View = 'home' | 'feed' | 'search' | 'map' | 'report'
  | 'admin' | 'library' | 'profile' | 'logistics'
  | 'login' | 'register' | 'manual' | 'directorio';

function App() {
  const [activeView, setActiveView] = useState<View>('home');
  const [selectedPerson, setSelectedPerson] = useState<Person | null>(null);
  const [isReporting, setIsReporting] = useState(false);
  const [isAuthenticating, setIsAuthenticating] = useState(false);

  const { user } = useAuth();
  useBackgroundSync();

  const {
    persons, disasters, counts, total,
    loading, loadingMore, hasMore,
    searchQuery, setSearchQuery, loadMore,
  } = usePersons();

  const AUTH_VIEWS: View[] = ['search', 'feed', 'map', 'profile'];

  const navigate = (v: View) => {
    if (AUTH_VIEWS.includes(v) && !user) {
      setActiveView('login');
      return;
    }
    setActiveView(v);
    setIsReporting(false);
  };

  const handleReport = () => {
    if (!user) { setActiveView('login'); return; }
    if (!user.isProfileComplete) { setIsAuthenticating(true); return; }
    setIsReporting(true);
  };

  if (activeView === 'admin') {
    return <AdminDashboard onBack={() => setActiveView('home')} />;
  }

  return (
    <>
      {activeView === 'login' ? (
        <LoginPage
          onSuccess={() => setActiveView('home')}
          onGoRegister={() => setActiveView('register')}
          onGoogle={() => setIsAuthenticating(true)}
          onBack={() => setActiveView('home')}
        />
      ) : activeView === 'register' ? (
        <RegisterPage
          onSuccess={() => setActiveView('home')}
          onGoLogin={() => setActiveView('login')}
          onBack={() => setActiveView('login')}
        />
      ) : (<>
        <AppLayout
          activeView={activeView}
          onViewChange={navigate}
          onReport={handleReport}
          onAdmin={() => setActiveView('admin')}
          sidebar={
            activeView === 'feed'
              ? <FeedSidebar persons={persons} disasters={disasters}
                  total={counts.total} counts={counts} />
              : undefined
          }
        >
          {activeView === 'home' && (
            user ? (
              <HomePage counts={counts} persons={persons}
                onBuscar={() => navigate('search')}
                onReportar={handleReport}
                onSelectPerson={setSelectedPerson}
                onNavigate={navigate}
              />
            ) : (
              <HomeGateway counts={counts}
                onBuscar={() => navigate('search')}
                onReportar={handleReport}
                onDirectorio={() => setActiveView('directorio')}
                onManual={() => setActiveView('manual')}
              />
            )
          )}

          {activeView === 'search' && (
            <SearchPage onBack={() => setActiveView('home')} />
          )}

          {activeView === 'profile' && (
            <ProfilePage onSelectPerson={setSelectedPerson} />
          )}

          {activeView === 'library' && <LibraryPage />}

          {activeView === 'feed' && (
            <FeedPage persons={persons} disasters={disasters}
              loading={loading} loadingMore={loadingMore}
              hasMore={hasMore} total={total} counts={counts}
              searchQuery={searchQuery}
              onSearchChange={setSearchQuery}
              onLoadMore={loadMore}
            />
          )}

          {activeView === 'map' && (
            <Suspense fallback={<LoadingScreen text="Cargando mapa…" />}>
              <MapPage persons={persons} disasters={disasters}
                onSelectPerson={setSelectedPerson}
              />
            </Suspense>
          )}

          {activeView === 'logistics' && (
            <LogisticsPage disasters={disasters} />
          )}

          {activeView === 'manual' && <ManualPage />}

          {activeView === 'directorio' && (
            <DirectoryPage onNavigate={navigate} />
          )}
        </AppLayout>
      </>)}

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
          onNavigate={navigate}
          onGoDirectory={() => {
            setIsReporting(false);
            setActiveView('directorio');
          }}
        />
      )}
    </>
  );
}

export default App;
