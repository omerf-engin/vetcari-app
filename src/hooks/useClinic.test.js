import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';

// Firestore mock'lanir: birim testi gercek baglanti acmaz. `onSnapshot`'in geri cagrilari
// yakalanir ki anlik goruntuler ELLE tetiklenebilsin.
const { onSnapshotMock } = vi.hoisted(() => ({ onSnapshotMock: vi.fn(() => () => {}) }));
vi.mock('firebase/firestore', () => ({
  doc: (_db, col, id) => ({ __path: `${col}/${id}` }),
  onSnapshot: (...args) => onSnapshotMock(...args),
}));
vi.mock('../services/firebase', () => ({ db: {} }));

import { useClinic } from './useClinic';

const user = (uid) => ({ uid });

/** Yakalanan basari geri cagrisi — `n`. abonelige ait. */
const emit = (data, n = 0) => act(() => {
  onSnapshotMock.mock.calls[n][1]({ exists: () => data != null, data: () => data });
});
const fail = (err, n = 0) => act(() => { onSnapshotMock.mock.calls[n][2](err); });

beforeEach(() => { onSnapshotMock.mockClear(); });

describe('useClinic', () => {
  it('oturum yoksa yukleme BITMIS sayilir, abonelik kurulmaz', () => {
    const { result } = renderHook(() => useClinic(null));

    expect(result.current).toEqual({ clinicId: null, role: null, loading: false, error: null });
    expect(onSnapshotMock).not.toHaveBeenCalled();
  });

  it('uyelik gelene kadar yukleniyor', () => {
    const { result } = renderHook(() => useClinic(user('ali')));
    expect(result.current.loading).toBe(true);
  });

  it('uyelik dokumaninu uid ile arar', () => {
    renderHook(() => useClinic(user('ali')));
    expect(onSnapshotMock.mock.calls[0][0]).toEqual({ __path: 'memberships/ali' });
  });

  it('uyelik varsa clinicId ve rol doner', () => {
    const { result } = renderHook(() => useClinic(user('ali')));
    emit({ clinicId: 'klinik-a', role: 'owner' });

    expect(result.current).toEqual({
      clinicId: 'klinik-a', role: 'owner', loading: false, error: null,
    });
  });

  // "Uyelik yok" ile "henuz yuklenmedi" AYRI seyler: ikincisinde bos defter gosterilirse
  // kullanici verisinin silindigini sanir.
  it('uyelik YOKSA yukleme biter ama clinicId null kalir', () => {
    const { result } = renderHook(() => useClinic(user('ali')));
    emit(null);

    expect(result.current).toEqual({ clinicId: null, role: null, loading: false, error: null });
  });

  it('izin hatasi uyeligin yoklugundan ayrilir', () => {
    const { result } = renderHook(() => useClinic(user('ali')));
    const err = new Error('permission-denied');
    fail(err);

    expect(result.current.loading).toBe(false);
    expect(result.current.clinicId).toBeNull();
    expect(result.current.error).toBe(err); // sessiz "uyelik yok" DEGIL
  });

  // Durumun `uid` ile birlikte saklanmasinin sebebi: aksi halde hesap degistiginde
  // onceki kullanicinin defteri bir render boyunca gorunurdu.
  it('hesap degisince onceki kullanicinin clinicId si SIZMAZ', () => {
    const { result, rerender } = renderHook(({ u }) => useClinic(u), {
      initialProps: { u: user('ali') },
    });
    emit({ clinicId: 'klinik-a', role: 'owner' });
    expect(result.current.clinicId).toBe('klinik-a');

    rerender({ u: user('veli') });
    expect(result.current).toEqual({ clinicId: null, role: null, loading: true, error: null });

    emit({ clinicId: 'klinik-b', role: 'staff' }, 1);
    expect(result.current.clinicId).toBe('klinik-b');
    expect(result.current.role).toBe('staff');
  });

  it('cikis yapinca defter kimligi birakilir', () => {
    const { result, rerender } = renderHook(({ u }) => useClinic(u), {
      initialProps: { u: user('ali') },
    });
    emit({ clinicId: 'klinik-a', role: 'owner' });

    rerender({ u: null });
    expect(result.current).toEqual({ clinicId: null, role: null, loading: false, error: null });
  });
});
