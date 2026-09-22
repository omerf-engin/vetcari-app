import { describe, it, expect } from 'vitest';
import { ledgerGate } from './ledgerGate';

const hazir = {
  authLoading: false, currentUser: { uid: 'u1' },
  clinicLoading: false, clinicError: null, clinicId: 'klinik-a', dataLoading: false,
};
const g = (over) => ledgerGate({ ...hazir, ...over });

describe('ledgerGate', () => {
  it('her sey tamamsa defter gosterilir', () => {
    expect(g({})).toBe('ready');
  });

  it('kimlik yuklenirken bekletir', () => {
    expect(g({ authLoading: true })).toBe('auth-loading');
  });

  it('oturum yoksa giris ekrani', () => {
    expect(g({ currentUser: null })).toBe('login');
  });

  // EN KRITIK SIRA: uyelik daha yuklenmemisken "klinik yok" DENMEZ. Aksi halde
  // kullanici defterini bos gorur ve verisinin silindigini sanar.
  it('uyelik yuklenirken "klinik yok" demez', () => {
    expect(g({ clinicLoading: true, clinicId: null })).toBe('clinic-loading');
  });

  it('uyelik yuklenirken veri yukleniyor da demez', () => {
    expect(g({ clinicLoading: true, clinicId: null, dataLoading: true })).toBe('clinic-loading');
  });

  it('uyelik hatasi bos defterden AYRI gosterilir', () => {
    expect(g({ clinicError: new Error('permission-denied'), clinicId: null })).toBe('clinic-error');
  });

  it('yukleme bittiginde ve uyelik gercekten yoksa acikca soylenir', () => {
    expect(g({ clinicId: null })).toBe('no-clinic');
  });

  it('klinik biliniyorsa veri yuklemesi beklenir', () => {
    expect(g({ dataLoading: true })).toBe('data-loading');
  });

  // Hicbir belirsiz durum "hazir" sayilmamali — defter yalnizca her sey bilindiginde acilir
  it('belirsiz hicbir durum hazir sayilmaz', () => {
    const belirsizler = [
      { authLoading: true }, { currentUser: null }, { clinicLoading: true },
      { clinicError: new Error('x') }, { clinicId: null }, { dataLoading: true },
    ];
    for (const b of belirsizler) expect(g(b)).not.toBe('ready');
  });
});
