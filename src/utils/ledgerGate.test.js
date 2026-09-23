import { describe, it, expect } from 'vitest';
import { ledgerGate } from './ledgerGate';

const hazir = {
  authLoading: false, currentUser: { uid: 'u1' },
  clinicLoading: false, clinicError: null, clinicId: 'klinik-a',
  inviteLoading: false, hasInvite: false, dataLoading: false,
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


  // TASK-038b: davet sorgusu BITMEDEN "klinige bagli degil" demek, daveti olan
  // kullaniciya yanlis kapiyi gostermek olurdu.
  it('davet sorgusu surerken "klinik yok" demez', () => {
    expect(g({ clinicId: null, inviteLoading: true })).toBe('clinic-loading');
  });

  it('uyelik yok ama DAVET varsa katilma ekrani', () => {
    expect(g({ clinicId: null, hasInvite: true })).toBe('has-invite');
  });

  it('uyelik de davet de yoksa acikca soylenir', () => {
    expect(g({ clinicId: null, hasInvite: false })).toBe('no-clinic');
  });

  // Uyeligi OLAN kullanici icin davet alanlari hic dikkate alinmamali
  it('uyelik varsa davet durumu defteri engellemez', () => {
    expect(g({ hasInvite: true, inviteLoading: true })).toBe('ready');
  });
  // Hicbir belirsiz durum "hazir" sayilmamali — defter yalnizca her sey bilindiginde acilir
  it('belirsiz hicbir durum hazir sayilmaz', () => {
    const belirsizler = [
      { authLoading: true }, { currentUser: null }, { clinicLoading: true },
      { clinicError: new Error('x') }, { clinicId: null }, { dataLoading: true },
      { clinicId: null, inviteLoading: true }, { clinicId: null, hasInvite: true },
    ];
    for (const b of belirsizler) expect(g(b)).not.toBe('ready');
  });
});
