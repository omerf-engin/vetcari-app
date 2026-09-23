import { describe, it, expect } from 'vitest';
import { canCancelBatch, cancelBlockedMessage } from './batchCancel';

/**
 * ROL KISITI (TASK-038b): personel yalnızca KENDİ girdiği işlemi iptal edebilir.
 *
 * Ayrı dosyada, çünkü `batchCancel.test.js` guard'ın aktivite mantığını sınıyor; burası
 * yetkiyi. İkisi farklı sebeplerle kırılır ve ayrı okunabilmeli.
 *
 * Bu kısıt **yalnızca istemcide** duruyor: güvenlik kuralı "bu girişi kim yaptı" sorusunu
 * cevaplayamıyor (iptal, borç dokümanlarını silip log yazan bileşik bir işlem). Gerçek
 * kontrol burada önleme, kayıtlarda ise atfetme — her log aktörü taşıyor.
 */

const item = (over = {}) => ({ id: 'dd1', type: 'drug', batchId: 'b1', qty: 2, maxPrice: 100, ...over });
const group = (items = [item()]) => ({ batchId: 'b1', date: '2026-08-12', items, itemCount: items.length });
const entryLog = (over = {}) => ({
  id: 'log1', debtId: 'dd1', batchId: 'b1', kind: 'entry', title: 'Borç Açıldı', userId: 'sahip', ...over
});

const SAHIP = { uid: 'sahip', role: 'owner' };
const PERSONEL = { uid: 'personel', role: 'staff' };

describe('canCancelBatch — rol kisiti', () => {
  it('personel KENDI girdigi islemi iptal edebilir', () => {
    const logs = [entryLog({ userId: 'personel' })];
    expect(canCancelBatch(group(), logs, PERSONEL)).toEqual({ ok: true });
  });

  it('personel BASKASININ girdigi islemi iptal EDEMEZ', () => {
    const logs = [entryLog({ userId: 'sahip' })];
    expect(canCancelBatch(group(), logs, PERSONEL)).toEqual({ ok: false, reason: 'otherActor' });
  });

  it('sahip BASKASININ girdigi islemi de iptal edebilir', () => {
    const logs = [entryLog({ userId: 'personel' })];
    expect(canCancelBatch(group(), logs, SAHIP)).toEqual({ ok: true });
  });

  // FAIL-CLOSED: aktoru belirlenemeyen eski kayitta personel iptal edemez.
  // "Bilinmiyor"u yetki gerekcesi yapmak, yetkiyi geri vermek olurdu.
  it('aktoru bilinmeyen ESKI kayitta personel iptal edemez', () => {
    const logs = [entryLog({ userId: undefined })];
    expect(canCancelBatch(group(), logs, PERSONEL)).toEqual({ ok: false, reason: 'otherActor' });
  });

  it('ayni kayitta sahip iptal edebilir', () => {
    const logs = [entryLog({ userId: undefined })];
    expect(canCancelBatch(group(), logs, SAHIP)).toEqual({ ok: true });
  });

  // Bir islemde birden cok giris logu olabilir (hizmet + ilac ayni batch'te).
  // HEPSI kendisinin olmadikca personel iptal edememeli.
  it('giris loglarindan BIRI baskasinaysa personel iptal edemez', () => {
    const logs = [
      entryLog({ id: 'log1', userId: 'personel' }),
      entryLog({ id: 'log2', debtId: 'svc1', userId: 'sahip' }),
    ];
    expect(canCancelBatch(group(), logs, PERSONEL)).toEqual({ ok: false, reason: 'otherActor' });
  });

  // `viewer` verilmeyen cagrilar davranis DEGISTIRMEMELI: rolun anlamsiz oldugu yollar
  // (testler, tek kullanicili eski akislar) eskisi gibi calissin.
  it('viewer verilmezse rol kontrolu yapilmaz', () => {
    const logs = [entryLog({ userId: 'baskasi' })];
    expect(canCancelBatch(group(), logs)).toEqual({ ok: true });
  });

  it('gerekce kullaniciya anlasilir bir metne cevriliyor', () => {
    const mesaj = cancelBlockedMessage('otherActor');
    expect(mesaj).toMatch(/kendi girdi/i);
    expect(mesaj).not.toBe('Bu işlem iptal edilemiyor.'); // varsayilana dusmemeli
  });

  // Rol kisiti, var olan korumalari GOLGELEMEMELI
  it('aktivite kisiti rol kisitindan once gelir — kendi islemi olsa bile', () => {
    const logs = [
      entryLog({ userId: 'personel' }),
      { id: 'log9', debtId: 'dd1', batchId: 'sonraki', kind: 'payment', title: 'Tahsilat' },
    ];
    expect(canCancelBatch(group(), logs, PERSONEL)).toEqual({ ok: false, reason: 'activity' });
  });
});
