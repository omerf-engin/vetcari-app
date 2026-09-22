import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';

// Firestore mock'lanir; sorgu ARGUMANLARI yakalanir ki hangi alanla suzuldugu
// dogrulanabilsin — bu kancanin isi "kullanici hangi defteri gorur" sorusudur.
const { onSnapshotMock, whereMock, orderByMock } = vi.hoisted(() => ({
  onSnapshotMock: vi.fn(() => () => {}),
  whereMock: vi.fn((field, op, value) => ({ __where: { field, op, value } })),
  orderByMock: vi.fn((field, dir) => ({ __orderBy: { field, dir } })),
}));

vi.mock('firebase/firestore', () => ({
  collection: (_db, name) => ({ __collection: name }),
  query: (...parts) => ({ __query: parts }),
  where: (...a) => whereMock(...a),
  orderBy: (...a) => orderByMock(...a),
  onSnapshot: (...args) => onSnapshotMock(...args),
}));
vi.mock('../services/firebase', () => ({ db: {} }));

import { useFirestore } from './useFirestore';

const snapshot = (docs) => ({ docs: docs.map(d => ({ id: d.id, data: () => d })) });
/** n. aboneligin basari geri cagrisi */
const emit = (n, docs) => act(() => { onSnapshotMock.mock.calls[n][1](snapshot(docs)); });
const fail = (n, err) => act(() => { onSnapshotMock.mock.calls[n][2](err); });

/** Kurulan aboneliklerin suzgeclerini toplar */
const filters = () => onSnapshotMock.mock.calls.map(c => {
  const parts = c[0].__query ?? [];
  const w = parts.find(p => p?.__where);
  const col = parts.find(p => p?.__collection);
  return { koleksiyon: col?.__collection, alan: w?.__where.field, deger: w?.__where.value };
});

beforeEach(() => { onSnapshotMock.mockClear(); whereMock.mockClear(); orderByMock.mockClear(); });

describe('useFirestore', () => {
  it('clinicId yoksa HIC abonelik kurulmaz ve yukleme biter', () => {
    const { result } = renderHook(() => useFirestore(null));

    expect(onSnapshotMock).not.toHaveBeenCalled();
    expect(result.current.dataLoading).toBe(false);
    expect(result.current.customers).toEqual([]);
  });

  // TASK-038a 5. asama: defteri artik KULLANICI degil KLINIK belirler.
  // Suzgec `userId`'ye geri donerse ayni klinigin ikinci kullanicisi defteri goremez.
  it('bes koleksiyonu da clinicId ile suzer', () => {
    renderHook(() => useFirestore('klinik-a'));

    const f = filters();
    expect(f).toHaveLength(5);
    expect(f.map(x => x.koleksiyon).sort()).toEqual(
      ['customers', 'drugDebts', 'drugs', 'serviceDebts', 'transactions']
    );
    for (const x of f) {
      expect(x.alan, `${x.koleksiyon} yanlis alanla suzuluyor`).toBe('clinicId');
      expect(x.deger).toBe('klinik-a');
    }
  });

  it('transactions timestamp azalan siralanir (bilesik indeks bunu gerektiriyor)', () => {
    renderHook(() => useFirestore('klinik-a'));
    expect(orderByMock).toHaveBeenCalledWith('timestamp', 'desc');
  });

  it('gelen veriyi id ile birlikte yayinlar', () => {
    const { result } = renderHook(() => useFirestore('klinik-a'));
    emit(0, [{ id: 'c1', name: 'Musteri' }]);

    expect(result.current.customers).toEqual([{ id: 'c1', name: 'Musteri' }]);
  });

  it('bes koleksiyon da gelince yukleme biter', () => {
    const { result } = renderHook(() => useFirestore('klinik-a'));
    expect(result.current.dataLoading).toBe(true);

    for (let i = 0; i < 4; i++) emit(i, []);
    expect(result.current.dataLoading).toBe(true);   // hala eksik

    emit(4, []);
    expect(result.current.dataLoading).toBe(false);
  });

  // Baglanti koparsa sonsuz spinner GOSTERILMEZ
  it('dinleme hatasi yuklemeyi bitirir', () => {
    const { result } = renderHook(() => useFirestore('klinik-a'));
    fail(0, new Error('permission-denied'));

    expect(result.current.dataLoading).toBe(false);
  });

  it('klinik degisince yeniden abone olunur', () => {
    const { rerender } = renderHook(({ c }) => useFirestore(c), { initialProps: { c: 'klinik-a' } });
    expect(onSnapshotMock).toHaveBeenCalledTimes(5);

    rerender({ c: 'klinik-b' });
    expect(onSnapshotMock).toHaveBeenCalledTimes(10);
    expect(filters().slice(5).every(x => x.deger === 'klinik-b')).toBe(true);
  });
});
