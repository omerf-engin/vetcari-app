import { describe, it, expect } from 'vitest';
import { canCancelBatch, canCancelOrphanBatch, cancelBlockedMessage, cancelledBatchIds, cancelledDebtIds } from './batchCancel';

const drugItem = (over = {}) => ({
  id: 'dd1', type: 'drug', batchId: 'b1', qty: 2, maxPrice: 100, ...over
});
const serviceItem = (over = {}) => ({
  id: 'svc1', type: 'service', batchId: 'b1', amount: 500, ...over
});

const group = (items, over = {}) => ({
  batchId: 'b1', date: '2026-08-12', items, itemCount: items.length, ...over
});

const log = (over = {}) => ({
  id: 'log1', debtId: 'dd1', batchId: 'b1', kind: 'entry', title: 'Borç Açıldı', ...over
});

describe('canCancelBatch', () => {
  it('dokunulmamis islem iptal edilebilir', () => {
    const g = group([serviceItem(), drugItem()]);
    const logs = [log({ id: 'l1', debtId: 'svc1' }), log({ id: 'l2', debtId: 'dd1' })];

    expect(canCancelBatch(g, logs)).toEqual({ ok: true });
  });

  it('girisin kendi tahsilat ve supurucu loglari iptali engellemez', () => {
    // Gecmis borc + kismi tahsilat ayni gonderimde yazilir; bu loglar girisin parcasidir
    const g = group([drugItem()]);
    const logs = [
      log({ id: 'l1', title: 'Geçmiş İlaç Borcu' }),
      log({ id: 'l2', title: 'Geçmiş Tahsilat' }),
      log({ id: 'l3', title: 'Süpürücü (Silindi)' }),
      log({ id: 'l4', title: 'Enflasyon Güncellemesi' })
    ];

    expect(canCancelBatch(g, logs)).toEqual({ ok: true });
  });

  it('sonradan inen tahsilat iptali engeller', () => {
    const g = group([drugItem()]);
    const logs = [
      log({ id: 'l1' }),
      log({ id: 'l2', batchId: undefined, kind: 'payment', title: 'Tahsilat' })
    ];

    expect(canCancelBatch(g, logs)).toEqual({ ok: false, reason: 'activity' });
  });

  it('sonradan yapilan iade ve zam da engeller', () => {
    const g = group([drugItem()]);

    expect(canCancelBatch(g, [log({ id: 'l1' }), log({ id: 'l2', batchId: undefined, kind: 'return' })]))
      .toEqual({ ok: false, reason: 'activity' });

    expect(canCancelBatch(g, [log({ id: 'l1' }), log({ id: 'l2', batchId: undefined, kind: 'price' })]))
      .toEqual({ ok: false, reason: 'activity' });
  });

  it('geri alinmis tahsilat iptali engellemez', () => {
    // Tam geri alma sonrasi borc odeme oncesi haline dondugu icin girisin iptali yeniden acilir.
    // `revertOf` hangi grubun etkisiz kaldigini soyler.
    const g = group([drugItem()]);
    const logs = [
      log({ id: 'l1' }),
      log({ id: 'l2', batchId: 'pay1', kind: 'payment', title: 'Tahsilat' }),
      log({ id: 'l3', batchId: 'rev1', kind: 'payment', title: 'Tahsilat İptali', revertOf: 'pay1' })
    ];

    expect(canCancelBatch(g, logs)).toEqual({ ok: true });
  });

  it('geri alinmis zam da iptali engellemez', () => {
    const g = group([drugItem()]);
    const logs = [
      log({ id: 'l1' }),
      log({ id: 'l2', batchId: 'zam1', kind: 'price' }),
      log({ id: 'l3', batchId: 'rev1', kind: 'price', revertOf: 'zam1' })
    ];

    expect(canCancelBatch(g, logs)).toEqual({ ok: true });
  });

  it('geri alinmamis tahsilat hala engeller', () => {
    const g = group([drugItem()]);
    const logs = [
      log({ id: 'l1' }),
      log({ id: 'l2', batchId: 'pay1', kind: 'payment' }),
      log({ id: 'l3', batchId: 'pay2', kind: 'payment' }),
      log({ id: 'l4', batchId: 'rev1', kind: 'payment', revertOf: 'pay1' }) // yalnizca pay1 geri alindi
    ];

    expect(canCancelBatch(g, logs)).toEqual({ ok: false, reason: 'activity' });
  });

  it('kilit degisimi iptali engellemez', () => {
    const g = group([drugItem()]);
    const logs = [log({ id: 'l1' }), log({ id: 'l2', batchId: undefined, kind: 'lock' })];

    expect(canCancelBatch(g, logs)).toEqual({ ok: true });
  });

  it('kind tasimayan yabanci log fail-closed davranir', () => {
    // Tanimlanmamis bir log turu iptali engellemeli — guvenli yon budur
    const g = group([drugItem()]);
    const logs = [log({ id: 'l1' }), log({ id: 'l2', batchId: undefined, kind: undefined })];

    expect(canCancelBatch(g, logs)).toEqual({ ok: false, reason: 'activity' });
  });

  it('baska borca ait aktivite bu islemi engellemez', () => {
    const g = group([drugItem()]);
    const logs = [log({ id: 'l1' }), log({ id: 'l2', debtId: 'baskaBorc', batchId: undefined, kind: 'payment' })];

    expect(canCancelBatch(g, logs)).toEqual({ ok: true });
  });

  it('batchId tasimayan eski kayit legacy doner', () => {
    const g = group([drugItem({ batchId: undefined })], { batchId: 'legacy:2024-05-14' });

    expect(canCancelBatch(g, [])).toEqual({ ok: false, reason: 'legacy' });
  });

  it('borclari batchId tasisa da loglarinda batchId yoksa legacy doner', () => {
    // TASK-031 oncesi yazilmis islemler: borcta batchId var, loglarda yok
    const g = group([drugItem()]);
    const logs = [log({ id: 'l1', batchId: undefined, kind: undefined })];

    expect(canCancelBatch(g, logs)).toEqual({ ok: false, reason: 'legacy' });
  });

  it('bos grup veya tanimsiz girdi icin empty doner', () => {
    expect(canCancelBatch(group([]), [])).toEqual({ ok: false, reason: 'empty' });
    expect(canCancelBatch(undefined, undefined)).toEqual({ ok: false, reason: 'empty' });
  });
});

describe('canCancelOrphanBatch', () => {
  it('yalnizca giris loglariyla kapanmis (supurulmus) islem iptal edilebilir', () => {
    // Kismi tahsilat kalani 10 TL altina dusurmus: borc dokumani hic yazilmamis
    const logs = [
      log({ id: 'l1', title: 'Geçmiş İlaç Borcu' }),
      log({ id: 'l2', title: 'Geçmiş Tahsilat' }),
      log({ id: 'l3', title: 'Süpürücü (Silindi)' })
    ];

    expect(canCancelOrphanBatch('b1', logs)).toEqual({ ok: true });
  });

  it('tahsilatla kapanmis islem iptal edilemez', () => {
    // Gercekten odenmis bir islem "hatali giris" degildir
    const logs = [
      log({ id: 'l1' }),
      log({ id: 'l2', batchId: undefined, kind: 'payment', title: 'Tahsilat' }),
      log({ id: 'l3', batchId: undefined, kind: 'payment', title: 'Süpürücü (Kapatıldı)' })
    ];

    expect(canCancelOrphanBatch('b1', logs)).toEqual({ ok: false, reason: 'activity' });
  });

  it('zaten iptal edilmis islem tekrar iptal edilemez', () => {
    const logs = [log({ id: 'l1' }), log({ id: 'l2', kind: 'cancel', title: 'İşlem İptali' })];

    expect(canCancelOrphanBatch('b1', logs)).toEqual({ ok: false, reason: 'cancelled' });
  });

  it('batchId li logu olmayan islem legacy doner', () => {
    expect(canCancelOrphanBatch('b1', [log({ id: 'l1', batchId: 'baska' })]))
      .toEqual({ ok: false, reason: 'legacy' });
    expect(canCancelOrphanBatch(undefined, [])).toEqual({ ok: false, reason: 'empty' });
  });
});

describe('cancelBlockedMessage', () => {
  it('her sebep icin kullaniciya donuk metin doner', () => {
    expect(cancelBlockedMessage('activity')).toMatch(/tahsilat/i);
    expect(cancelBlockedMessage('legacy')).toMatch(/Eski kayıt/);
    expect(cancelBlockedMessage('empty')).toMatch(/iptal edilemiyor/);
  });
});

describe('cancelledDebtIds', () => {
  it('yalnizca kalem iptallerini (batchId siz) toplar', () => {
    const logs = [
      log({ id: 'l1', kind: 'cancel', batchId: 'b1', debtId: 'islemIptali' }),
      log({ id: 'l2', kind: 'cancel', batchId: undefined, debtId: 'dd1' }),
      log({ id: 'l3', kind: 'entry', batchId: undefined, debtId: 'dd2' })
    ];

    expect([...cancelledDebtIds(logs)]).toEqual(['dd1']);
  });

  it('bos girdide bos kume doner', () => {
    expect(cancelledDebtIds(undefined).size).toBe(0);
  });
});

describe('cancelledBatchIds', () => {
  it('yalnizca iptal loglarinin batchId lerini toplar', () => {
    const logs = [
      log({ id: 'l1', kind: 'entry', batchId: 'b1' }),
      log({ id: 'l2', kind: 'cancel', batchId: 'b2' }),
      log({ id: 'l3', kind: 'cancel', batchId: 'b3' }),
      log({ id: 'l4', kind: 'cancel', batchId: undefined })
    ];

    expect([...cancelledBatchIds(logs)].sort()).toEqual(['b2', 'b3']);
  });

  it('bos girdide bos kume doner', () => {
    expect(cancelledBatchIds(undefined).size).toBe(0);
  });
});
