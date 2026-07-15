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
import * as Sentry from '@sentry/react';
import { AppLayout } from './layouts/AppLayout';
import { FeedSidebar } from './pages/Feed/Feed';
import { ReportModal } from './components/modals/ReportModal';
import { LogisticsPage } from './pages/Logistics/LogisticsPage';
import { HomePage } from './pages/Home/HomePage';
import { HomeGateway } from './pages/Home/HomeGateway';
import { PersonDetailModal } from './components/modals/PersonDetailModal';
import { AuthModal } from './components/modals/AuthModal';
import { useAuth } from './store/AuthContext';
import { useBackgroundSync } from './hooks/useBackgroundSync';
import { usePersons } from './hooks/usePersons';
import { LoadingScreen } from './components/common/LoadingScreen';
import { AUTH_VIEWS } from './constants/routes';
import type { Person } from './types';

const MapPage = lazy(() => import('./pages/Map/MapPage').then(m => ({ default: m.MapPage })));
const AdminDashboard = lazy(() => import('./pages/Admin/AdminDashboard').then(m => ({ default: m.AdminDashboard })));
const FeedPage = lazy(() => import('./pages/Feed/Feed').then(m => ({ default: m.FeedPage })));
const SearchPage = lazy(() => import('./pages/Search/SearchPage').then(m => ({ default: m.SearchPage })));
const ProfilePage = lazy(() => import('./pages/Profile/ProfilePage').then(m => ({ default: m.ProfilePage })));
const LibraryPage = lazy(() => import('./pages/Library/LibraryPage').then(m => ({ default: m.LibraryPage })));
const ManualPage = lazy(() => import('./pages/Manual/ManualPage').then(m => ({ default: m.ManualPage })));
const DirectoryPage = lazy(() => import('./pages/Directory/DirectoryPage').then(m => ({ default: m.DirectoryPage })));
const LoginPage = lazy(() => import('./pages/Auth/LoginPage').then(m => ({ default: m.LoginPage })));
const RegisterPage = lazy(() => import('./pages/Auth/RegisterPage').then(m => ({ default: m.RegisterPage })));

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

  const navigate = (v: View) => {
    if ((AUTH_VIEWS as readonly string[]).includes(v) && !user) {
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
    return (
      <Suspense fallback={<LoadingScreen text="Cargando panel de administración..." />}>
        <AdminDashboard onBack={() => setActiveView('home')} />
      </Suspense>
    );
  }

  return (
    <>
      {activeView === 'login' ? (
        <Suspense fallback={<LoadingScreen text="Cargando..." />}>
          <LoginPage
            onSuccess={() => setActiveView('home')}
            onGoRegister={() => setActiveView('register')}
            onGoogle={() => setIsAuthenticating(true)}
            onBack={() => setActiveView('home')}
          />
        </Suspense>
      ) : activeView === 'register' ? (
        <Suspense fallback={<LoadingScreen text="Cargando..." />}>
          <RegisterPage
            onSuccess={() => setActiveView('home')}
            onGoLogin={() => setActiveView('login')}
            onBack={() => setActiveView('login')}
          />
        </Suspense>
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
            <Suspense fallback={<LoadingScreen text="Cargando..." />}>
              <SearchPage onBack={() => setActiveView('home')} onNavigate={(v) => navigate(v as View)} />
            </Suspense>
          )}

          {activeView === 'profile' && (
            <Suspense fallback={<LoadingScreen text="Cargando..." />}>
              <ProfilePage onSelectPerson={setSelectedPerson} />
            </Suspense>
          )}

          {activeView === 'library' && (
            <Suspense fallback={<LoadingScreen text="Cargando..." />}>
              <LibraryPage />
            </Suspense>
          )}

          {activeView === 'feed' && (
            <Suspense fallback={<LoadingScreen text="Cargando..." />}>
              <FeedPage persons={persons} disasters={disasters}
                loading={loading} loadingMore={loadingMore}
                hasMore={hasMore} total={total} counts={counts}
                searchQuery={searchQuery}
                onSearchChange={setSearchQuery}
                onLoadMore={loadMore}
              />
            </Suspense>
          )}

          {activeView === 'map' && (
            <Sentry.ErrorBoundary fallback={<div className="sentry-fallback">El mapa no está disponible en este momento. Intenta de nuevo.</div>}>
              <Suspense fallback={<LoadingScreen text="Cargando mapa…" />}>
                <MapPage persons={persons} disasters={disasters}
                  onSelectPerson={setSelectedPerson}
                />
              </Suspense>
            </Sentry.ErrorBoundary>
          )}

          {activeView === 'logistics' && (
            <LogisticsPage disasters={disasters} />
          )}

          {activeView === 'manual' && (
            <Suspense fallback={<LoadingScreen text="Cargando..." />}>
              <ManualPage />
            </Suspense>
          )}

          {activeView === 'directorio' && (
            <Suspense fallback={<LoadingScreen text="Cargando..." />}>
              <DirectoryPage onNavigate={navigate} />
            </Suspense>
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
          onNavigate={(view) => {
            setIsReporting(false);
            navigate(view as View);
          }}
        />
      )}
    </>
  );
}

export default App;
