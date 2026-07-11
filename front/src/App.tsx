/**
 * ═══════════════════════════════════════════════════════════
 * App.tsx — Componente raíz (ruteo por estado)
 * 
 * PROPÓSITO:
 *   Maneja la navegación de toda la aplicación SIN react-router.
 *   En lugar de URLs, usa un useState<View> que determina qué
 *   página se renderiza. Esto es intencional: la app es una
 *   SPA tipo "tool" donde el concepto de "ruta" no aporta
 *   valor (no hay deep linking, no hay SEO por página).
 * 
 * CÓMO FUNCIONA:
 *   - activeView: 'home' | 'feed' | 'search' | 'map' | ...
 *   - navigate(v): cambia activeView, con control de acceso
 *     (algunas vistas requieren sesión).
 *   - El render condicional dentro de <AppLayout> muestra
 *     la página correspondiente.
 * 
 * ESTADO GLOBAL (elevado aquí):
 *   - persons[]: lista principal de personas (desaparecidos +
 *     localizados combinados).
 *   - counts: resumen missing/found/total para las cards.
 *   - disasters[]: desastres activos para el mapa y el feed.
 *   - searchQuery: input de búsqueda (con debounce 500ms).
 *   - selectedPerson: para abrir PersonDetailModal.
 *   - isReporting / isAuthenticating: modales.
 * 
 * PATRÓN:
 *   Los modales (PersonDetailModal, AuthModal, ReportModal) se
 *   renderizan al final, fuera de <AppLayout>, para que floten
 *   sobre cualquier vista sin importar el layout.
 * ═══════════════════════════════════════════════════════════
 */

// ─── React 19 Hooks ───────────────────────────────────────
// useState: estado del componente (vistas, datos, modales).
// useEffect: llamar a la API al montar y al cambiar búsqueda.
// useCallback: evitar re-crear loadMore en cada render.
// useRef: bandera isFetchingRef para evitar doble fetch.
import { useState, useEffect, useCallback, useRef } from 'react';

// api: instancia de Axios con interceptor CSRF automático
// (ver services/api.ts). Todas las llamadas HTTP pasan por aquí.
import { api } from './services/api';

// AppLayout: estructura común (sidebar, header, bottom nav).
// Las páginas se renderizan como children de este layout.
import { AppLayout } from './layouts/AppLayout';

// ─── Páginas principales ─────────────────────────────────
import { FeedPage, FeedSidebar } from './pages/Feed/Feed';
import { MapPage } from './pages/Map/MapPage';
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

// ─── Modales ──────────────────────────────────────────────
// Renderizados al final de App, fuera de AppLayout,
// para que aparezcan sobre cualquier vista.
import { PersonDetailModal } from './components/modals/PersonDetailModal';
import { AuthModal } from './components/modals/AuthModal';

// AuthContext: user, login, logout, isLoading.
// Se usa para control de acceso y para el botón de reportar.
import { useAuth } from './store/AuthContext';

// Hook personalizado que registra un service worker para
// sincronizar datos en segundo plano (PWA + IndexedDB).
import { useBackgroundSync } from './hooks/useBackgroundSync';

// Tipos compartidos (ver types/index.ts).
import type { Person, Disaster } from './types';

// ─── Tipos locales ──────────────────────────────────────
// View: todas las pantallas disponibles. El ruteo por
// estado significa que solo una se renderiza a la vez
// (excepto los modales que coexisten).
type View = 'home' | 'feed' | 'search' | 'map' | 'report'
  | 'admin' | 'library' | 'profile' | 'logistics'
  | 'login' | 'register' | 'manual' | 'directorio';

// Counts: resumen numérico de la situación.
interface Counts {
  missing: number;
  found: number;
  total: number;
  animals?: number;
}

// ─── Constantes ──────────────────────────────────────────
// PAGE_SIZE: cuántas personas se cargan por lote en el
// infinite scroll del feed.
const PAGE_SIZE = 50;

/**
 * Componente raíz de la aplicación.
 * Mantiene TODO el estado global y decide qué vista renderizar.
 */
function App() {
  // ─── Estado de datos ───────────────────────────────────
  // persons: mezcla de desaparecidos (API /persons) y
  // localizados (API /localizados), combinados en fetchPersons().
  const [persons, setPersons]         = useState<Person[]>([]);

  // disasters: lista de desastres activos para el mapa y el feed.
  const [disasters, setDisasters]     = useState<Disaster[]>([]);

  // counts: missing, found, total para las cards de resumen
  // en HomePage y FeedSidebar.
  const [counts, setCounts]           = useState<Counts>({
    missing: 0, found: 0, total: 0, animals: 0
  });

  // total: cantidad total de registros (para el "de X resultados").
  const [total, setTotal]             = useState(0);

  // offset: paginación por scroll infinito (cada carga suma PAGE_SIZE).
  const [offset, setOffset]           = useState(0);

  // Estados de carga: loading = inicial, loadingMore = siguiente página.
  const [loading, setLoading]         = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);

  // hasMore: false cuando ya no hay más páginas que cargar.
  const [hasMore, setHasMore]         = useState(true);

  // ─── Estado de navegación ──────────────────────────────
  // activeView: la pantalla actual. Por defecto 'home'.
  // El render condicional en el JSX muestra la vista activa.
  const [activeView, setActiveView]   = useState<View>('home');

  // ─── Estado de modales ─────────────────────────────────
  // selectedPerson: persona seleccionada → abre PersonDetailModal.
  const [selectedPerson, setSelectedPerson] = useState<Person | null>(null);

  // isReporting: controla la apertura de ReportModal.
  const [isReporting, setIsReporting] = useState(false);

  // isAuthenticating: controla AuthModal (perfil incompleto).
  const [isAuthenticating, setIsAuthenticating] = useState(false);

  // searchQuery: texto de búsqueda en el feed.
  // Cambiarlo dispara un useEffect con debounce de 500ms.
  const [searchQuery, setSearchQuery] = useState('');

  // Ref para evitar fetch duplicado en loadMore.
  // useContext(useRef) porque no queremos re-render al cambiarlo.
  const isFetchingRef = useRef(false);

  // user: el usuario logueado (null si no hay sesión).
  const { user } = useAuth();

  // ─── Efecto secundario: PWA sync ───────────────────────
  // Activa la sincronización en segundo plano del service worker.
  // Escucha eventos 'sync' de IndexedDB cuando hay conexión.
  useBackgroundSync();

  // ─── fetchPersons() — corazón de datos ─────────────────
  // Propósito: Obtener personas, desastres, counts y localizados
  // de la API en PARALELO (Promise.all).
  //
  // query: filtro de búsqueda.
  // newOffset: desde dónde paginar.
  // append: true = concatenar al final (scroll infinito),
  //         false = reemplazar (nueva búsqueda).
  //
  // NOTA: Combina dos fuentes de datos:
  //   1. /persons (desaparecidos reportados por usuarios)
  //   2. /localizados (reportes de hospitales/refugios)
  // Ambos se unifican bajo la interfaz Person.
  const fetchPersons = async (query: string, newOffset: number, append: boolean = false) => {
    try {
      // endpoint principal con paginación y filtro.
      const endpoint = `/persons?limit=${PAGE_SIZE}&offset=${newOffset}${query ? `&q=${query}` : ''}`;

      // Promise.all: 4 llamadas simultáneas.
      // Los .catch() evitan que una falla rompa las demás.
      const [pRes, dRes, cRes, locRes] = await Promise.all([
        api.get<{ total: number; persons: Person[] }>(endpoint),
        api.get<Disaster[]>('/disasters/active').catch(() => ({ data: [] })),
        api.get<Counts>('/persons/counts')
          .catch(() => ({ data: { missing: 0, found: 0, total: 0, animals: 0 } })),
        api.get<{ data: any[], total: number }>(
          `/localizados?limit=${PAGE_SIZE}&offset=${newOffset}${query ? `&q=${query}` : ''}`
        ).catch(() => ({ data: { data: [], total: 0 } }))
      ]);

      const { total: t, persons: p } = pRes.data;

      // Mapea los localizados (formato hospital/refugio) a Person.
      // idHash lleva prefijo 'loc-' para evitar colisiones con
      // los IDs de /persons.
      const localizadosAsPersons: Person[] = (locRes.data?.data || []).map((loc: any) => ({
        idHash: `loc-${loc._id}`,           // prefijo único
        name: loc.name,
        status: 'found',                     // siempre "encontrado"
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

      // Combina ambas fuentes en un solo array.
      const combined = [...p, ...localizadosAsPersons];

      // Actualiza total (suma de ambas fuentes).
      setTotal(t + (locRes.data?.total || 0));

      // Determina si hay más páginas por cargar.
      setHasMore(
        newOffset + p.length < t ||
        newOffset + localizadosAsPersons.length < (locRes.data?.total || 0)
      );

      // Actualiza desastres y conteos.
      setDisasters(dRes.data);
      setCounts({
        missing: cRes.data.missing,
        found: cRes.data.found + (locRes.data?.total || 0),
        total: cRes.data.total + (locRes.data?.total || 0),
        animals: cRes.data.animals || 0
      });

      if (append) {
        // Scroll infinito: agrega al final.
        setPersons(prev => [...prev, ...combined]);
      } else {
        // Carga inicial o nueva búsqueda: reemplaza.
        // Si no hay query y es la primera página, baraja
        // aleatoriamente para dar variedad visual.
        const data = (!query && newOffset === 0)
          ? combined.sort(() => Math.random() - 0.5)
          : combined;
        setPersons(data);
      }
    } catch (e) {
      // Error genérico de red o servidor.
      console.error('Error fetching data:', e);
    }
  };

  // ─── useEffect: búsqueda con debounce ──────────────────
  // Cada vez que searchQuery cambia:
  //   1. Resetea offset a 0.
  //   2. Si hay query, espera 500ms (debounce) antes de llamar
  //      a la API. Si no, ejecuta inmediatamente.
  //   3. Limpia el timeout al desmontar o al cambiar de query.
  useEffect(() => {
    const handler = setTimeout(async () => {
      setLoading(true);
      setOffset(0);
      await fetchPersons(searchQuery, 0, false);
      setLoading(false);
    }, searchQuery ? 500 : 0); // 500ms debounce solo si hay query

    return () => clearTimeout(handler);
  }, [searchQuery]);

  // ─── loadMore: scroll infinito ─────────────────────────
  // useCallback para mantener la misma referencia mientras
  // las dependencias no cambien (evita re-suscribir el
  // IntersectionObserver en el feed).
  //
  // Usa isFetchingRef para evitar llamadas concurrentes
  // (el usuario podría scrollear muy rápido).
  const loadMore = useCallback(async () => {
    if (isFetchingRef.current || !hasMore || loadingMore) return;
    isFetchingRef.current = true;
    setLoadingMore(true);
    try {
      const newOffset = offset + PAGE_SIZE;
      await fetchPersons(searchQuery, newOffset, true);
      setOffset(newOffset);
    } catch (e) {
      console.error('Error cargando más:', e);
    } finally {
      setLoadingMore(false);
      isFetchingRef.current = false;
    }
  }, [offset, hasMore, loadingMore, searchQuery]);

  // ─── handleReport: disparar el modal de reporte ───────
  // 1. Si no hay sesión → redirige a login.
  // 2. Si el perfil está incompleto → abre AuthModal para
  //    completar datos (teléfono, sector).
  // 3. Si todo ok → abre ReportModal.
  const handleReport = () => {
    if (!user) { setActiveView('login'); return; }
    if (!user.isProfileComplete) { setIsAuthenticating(true); return; }
    setIsReporting(true);
  };

  // ─── Control de acceso ─────────────────────────────────
  // Algunas vistas requieren sesión. Si el usuario no está
  // logueado, redirect a login.
  const AUTH_VIEWS: View[] = ['search', 'feed', 'map', 'profile'];

  const navigate = (v: View) => {
    if (AUTH_VIEWS.includes(v) && !user) {
      setActiveView('login');
      return;
    }
    setActiveView(v);
    setIsReporting(false);
  };

  // ═════════════════════════════════════════════════════════
  // RENDER
  // ═════════════════════════════════════════════════════════

  // Admin es full-screen: no usa AppLayout.
  if (activeView === 'admin') {
    return <AdminDashboard onBack={() => setActiveView('home')} />;
  }

  return (
    <>
      {/* ─── Login y Register sin AppLayout ───────────── */}
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
          {/* Vista condicional según activeView */}
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
            <MapPage persons={persons} disasters={disasters}
              onSelectPerson={setSelectedPerson}
            />
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

      {/* ─── Modales globales (flotan sobre todo) ────── */}

      {/* Modal de detalle de persona.
          Se abre cuando selectedPerson no es null. */}
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

      {/* Modal de autenticación (perfil incompleto).
          Se usa también para Google OAuth cuando el usuario
          aún no ha completado su perfil. */}
      {isAuthenticating && (
        <AuthModal
          onClose={() => setIsAuthenticating(false)}
          onSuccess={() => {
            setIsAuthenticating(false);
            setIsReporting(true);
          }}
        />
      )}

      {/* Modal de reporte.
          onNavigate permite navegar al directorio después
          de reportar, como acción post-reporte. */}
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
