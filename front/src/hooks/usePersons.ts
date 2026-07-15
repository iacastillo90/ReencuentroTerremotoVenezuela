/**
 * hooks/usePersons.ts — Hook personalizado de data fetching
 *
 * PROPÓSITO:
 *   Extrae toda la lógica de carga de personas, desastres, conteos y
 *   localizados que estaba en App.tsx. Esto reduce App.tsx de ~470 a ~250
 *   líneas y hace que la lógica de datos sea testeable de forma aislada.
 *
 * QUÉ EXPONE:
 *   - persons, disasters, counts: datos.
 *   - loading, loadingMore, hasMore: estados de carga.
 *   - searchQuery, setSearchQuery: control de búsqueda con debounce.
 *   - loadMore: callback para infinite scroll.
 *
 * FLUJO:
 *   1. Al montar y al cambiar searchQuery, hace fetch con debounce (500ms).
 *   2. fetchPersons combina 4 endpoints en paralelo (Promise.all).
 *   3. loadMore incrementa offset y concatena resultados.
 */
import { useState, useEffect, useCallback, useRef } from 'react';
import { api } from '../services/api';
import type { Person, Disaster } from '../types';

const PAGE_SIZE = 50;

interface Localizado {
  _id: string;
  name: string;
  origin?: string;
  location?: string;
  createdAt?: string;
  cedula?: string;
  sourceUrl?: string;
  isVerified?: boolean;
}

interface Counts {
  missing: number;
  found: number;
  total: number;
  animals?: number;
}

interface UsePersonsReturn {
  persons: Person[];
  disasters: Disaster[];
  counts: Counts;
  total: number;
  loading: boolean;
  loadingMore: boolean;
  hasMore: boolean;
  searchQuery: string;
  setSearchQuery: (q: string) => void;
  loadMore: () => Promise<void>;
}

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export function usePersons(): UsePersonsReturn {
  const [persons, setPersons]         = useState<Person[]>([]);
  const [disasters, setDisasters]     = useState<Disaster[]>([]);
  const [counts, setCounts]           = useState<Counts>({ missing: 0, found: 0, total: 0, animals: 0 });
  const [total, setTotal]             = useState(0);
  const [offset, setOffset]           = useState(0);
  const [loading, setLoading]         = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore]         = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  const isFetchingRef = useRef(false);

  const fetchPersons = async (query: string, newOffset: number, append: boolean = false) => {
    try {
      const endpoint = `/persons?limit=${PAGE_SIZE}&offset=${newOffset}${query ? `&q=${query}` : ''}`;

      const [pRes, dRes, cRes, locRes] = await Promise.all([
        api.get<{ total: number; persons: Person[] }>(endpoint),
        api.get<Disaster[]>('/disasters/active').catch(() => ({ data: [] })),
        api.get<Counts>('/persons/counts').catch(() => ({ data: { missing: 0, found: 0, total: 0, animals: 0 } })),
        api.get<{ data: Localizado[]; total: number }>(
          `/localizados?limit=${PAGE_SIZE}&offset=${newOffset}${query ? `&q=${query}` : ''}`
        ).catch(() => ({ data: { data: [], total: 0 } })),
      ]);

      const { total: t, persons: p } = pRes.data;

      const localizadosAsPersons: Person[] = (locRes.data?.data || []).map((loc: Localizado) => ({
        idHash: `loc-${loc._id}`,
        name: loc.name,
        status: 'found' as const,
        lastSeen: {
          state: loc.origin || 'Desconocido',
          description: `Visto en: ${loc.location}`,
        },
        metadata: {
          urgencyScore: 1,
          createdAt: loc.createdAt,
        },
        data: {
          cedula: loc.cedula,
          origen: 'Reporte Hospital/Refugio',
          ficha_url: loc.sourceUrl,
          verificado_por: loc.isVerified ? 'Personal de Salud' : undefined,
        },
      }));

      const combined = [...p, ...localizadosAsPersons];
      setTotal(t + (locRes.data?.total || 0));
      setHasMore(
        newOffset + p.length < t ||
        newOffset + localizadosAsPersons.length < (locRes.data?.total || 0)
      );
      setDisasters(dRes.data);
      setCounts({
        missing: cRes.data.missing,
        found: cRes.data.found + (locRes.data?.total || 0),
        total: cRes.data.total + (locRes.data?.total || 0),
        animals: cRes.data.animals || 0,
      });

      if (append) {
        setPersons(prev => [...prev, ...combined]);
      } else {
        setPersons(!query && newOffset === 0 ? shuffle(combined) : combined);
      }
    } catch (e) {
    }
  };

  useEffect(() => {
    const handler = setTimeout(async () => {
      setLoading(true);
      setOffset(0);
      await fetchPersons(searchQuery, 0, false);
      setLoading(false);
    }, searchQuery ? 500 : 0);
    return () => clearTimeout(handler);
  }, [searchQuery]);

  const loadMore = useCallback(async () => {
    if (isFetchingRef.current || !hasMore || loadingMore) return;
    isFetchingRef.current = true;
    setLoadingMore(true);
    try {
      const newOffset = offset + PAGE_SIZE;
      await fetchPersons(searchQuery, newOffset, true);
      setOffset(newOffset);
    } catch (e) {
    } finally {
      setLoadingMore(false);
      isFetchingRef.current = false;
    }
  }, [offset, hasMore, loadingMore, searchQuery]);

  return {
    persons, disasters, counts, total,
    loading, loadingMore, hasMore,
    searchQuery, setSearchQuery, loadMore,
  };
}
