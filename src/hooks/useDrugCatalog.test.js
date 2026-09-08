import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';

// Firestore mock'lanir: birim testi gercek baglanti acmaz. `onSnapshot`'in geri
// cagrilari yakalanir ki anlik goruntuler ELLE tetiklenebilsin.
const { onSnapshotMock } = vi.hoisted(() => ({ onSnapshotMock: vi.fn() }));
vi.mock('firebase/firestore', () => ({
  collection: (_db, name) => ({ __collection: name }),
  onSnapshot: (...args) => onSnapshotMock(...args),
}));
vi.mock('../services/firebase', () => ({ db: {} }));

import { useDrugCatalog, __resetDrugCatalog } from './useDrugCatalog';

/** Gercek `QuerySnapshot`'in kancanin okudugu iki alanini taklit eder. */
const snapshot = (docs, fromCache) => ({
  docs: docs.map(d => ({ id: d.catalogId, data: () => d })),
  metadata: { fromCache },
});

const DOC = { catalogId: 'r-arma-biyokan#100 ML', name: 'Biyokan LA - 100 ml' };

/** Yakalanan basari geri cagrisi. */
const emit = (snap) => act(() => { onSnapshotMock.mock.calls[0][1](snap); });
/** Yakalanan hata geri cagrisi. */
const fail = (err) => act(() => { onSnapshotMock.mock.calls[0][2](err); });

beforeEach(() => {
  __resetDrugCatalog();
  onSnapshotMock.mockClear();
});

describe('useDrugCatalog', () => {
  it('ilk durumda yukleniyor', () => {
    const { result } = renderHook(() => useDrugCatalog());
    expect(result.current).toMatchObject({ catalog: [], loading: true, error: null });
  });

  it('sunucudan gelen anlik goruntu fromCache=false yayinlar', () => {
    const { result } = renderHook(() => useDrugCatalog());
    emit(snapshot([DOC], false));

    expect(result.current.loading).toBe(false);
    expect(result.current.fromCache).toBe(false);
    expect(result.current.catalog).toHaveLength(1);
    expect(result.current.catalog[0].name).toBe('Biyokan LA - 100 ml');
  });

  // Kancanin varlik sebebi: cevrimdisi + soguk onbellekte Firestore HATA VERMEZ,
  // onbellekten BOS liste verir. `fromCache` olmadan bu "katalog gercekten bos"tan
  // ayirt edilemez. (Tarayicida olculdu — bkz. useDrugCatalog.js basligi.)
  it('cevrimdisi bos anlik goruntu HATA DEGIL, fromCache=true olarak gelir', () => {
    const { result } = renderHook(() => useDrugCatalog());
    emit(snapshot([], true));

    expect(result.current.error).toBeNull();     // hata dali CALISMAZ
    expect(result.current.loading).toBe(false);  // sonsuz spinner da olmaz
    expect(result.current.catalog).toEqual([]);
    expect(result.current.fromCache).toBe(true); // ayrimi mumkun kilan tek alan
  });

  it('cevrimdisi SICAK onbellekte katalog dolu gelir ve fromCache=true kalir', () => {
    const { result } = renderHook(() => useDrugCatalog());
    emit(snapshot([DOC], true));

    expect(result.current.catalog).toHaveLength(1);
    expect(result.current.fromCache).toBe(true);
  });

  it('sunucu yanitlayinca fromCache true -> false gunceller', () => {
    const { result } = renderHook(() => useDrugCatalog());

    emit(snapshot([], true));
    expect(result.current.fromCache).toBe(true);

    emit(snapshot([DOC], false));
    expect(result.current.fromCache).toBe(false);
    expect(result.current.catalog).toHaveLength(1);
  });

  it('hata durumunda yukleme biter ve hata yayinlanir', () => {
    const { result } = renderHook(() => useDrugCatalog());
    const err = new Error('permission-denied');
    fail(err);

    expect(result.current.loading).toBe(false);
    expect(result.current.error).toBe(err);
  });

  // Tembel + TEK abonelik: katalogu hic acmayan okuma odemez, iki tuketici iki kez odemez
  it('abonelik yalnizca bir kez kurulur', () => {
    renderHook(() => useDrugCatalog());
    renderHook(() => useDrugCatalog());

    expect(onSnapshotMock).toHaveBeenCalledTimes(1);
    expect(onSnapshotMock.mock.calls[0][0]).toEqual({ __collection: 'drugCatalog' });
  });

  it('hic tuketici yoksa abonelik kurulmaz', () => {
    expect(onSnapshotMock).not.toHaveBeenCalled();
  });

  it('iki tuketici ayni anlik goruntuyu gorur', () => {
    const a = renderHook(() => useDrugCatalog());
    const b = renderHook(() => useDrugCatalog());
    emit(snapshot([DOC], false));

    expect(a.result.current.catalog).toHaveLength(1);
    expect(b.result.current.catalog).toHaveLength(1);
    expect(a.result.current).toBe(b.result.current); // ayni referans — gereksiz render yok
  });
});
