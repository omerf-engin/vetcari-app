import { describe, it, expect } from 'vitest';
import {
  resolvePeriod,
  validatePeriod,
  periodBlockedMessage,
  summarizePeriod,
  classifyLog,
  buildExclusions,
  FLOW_RECEIVABLE_SIGN
} from './reporting';

const log = (over = {}) => ({
  id: 'l1',
  date: '2026-08-12',
  timestamp: 1000,
  kind: 'entry',
  ...over
});

const debt = (amount, over = {}) => log({ flow: 'debt', amount, ...over });
const collect = (amount, over = {}) => log({ kind: 'payment', flow: 'collect', amount, ...over });
const advance = (balanceDelta, over = {}) =>
  log({ kind: 'payment', flow: 'advance', balanceDelta, ...over });

/** Toplamlarin ilgilenilen alanlarini kiyaslamak icin — tum nesneyi yazmak gurultu yaratir. */
const pick = (summary, keys) =>
  Object.fromEntries(keys.map((k) => [k, summary[k]]));

describe('resolvePeriod', () => {
  it('bu ay: ayin ilk gunu ile bugun arasi', () => {
    expect(resolvePeriod('thisMonth', null, null, '2026-08-27'))
      .toEqual({ start: '2026-08-01', end: '2026-08-27' });
  });

  it('gecen ay: onceki ayin ilk ve son gunu', () => {
    expect(resolvePeriod('lastMonth', null, null, '2026-03-15'))
      .toEqual({ start: '2026-02-01', end: '2026-02-28' });
  });

  it('gecen ay yil sinirini gecer', () => {
    expect(resolvePeriod('lastMonth', null, null, '2026-01-10'))
      .toEqual({ start: '2025-12-01', end: '2025-12-31' });
  });

  it('son 30 gun bugunu de sayar (29 gun geri)', () => {
    expect(resolvePeriod('last30', null, null, '2026-08-30'))
      .toEqual({ start: '2026-08-01', end: '2026-08-30' });
  });

  it('son 30 gun ay sinirini gecer', () => {
    expect(resolvePeriod('last30', null, null, '2026-08-15'))
      .toEqual({ start: '2026-07-17', end: '2026-08-15' });
  });

  it('son 30 gun yil sinirini gecer', () => {
    expect(resolvePeriod('last30', null, null, '2026-01-10'))
      .toEqual({ start: '2025-12-12', end: '2026-01-10' });
  });

  it('gecen ay 31 gunluk aydan 30 gunluk aya dogru hesaplanir', () => {
    // Ay uzunlugu farkinin klasik tuzagi: 31 Mayis'tan geriye giderken Nisan 30 cekmeli
    expect(resolvePeriod('lastMonth', null, null, '2026-05-31'))
      .toEqual({ start: '2026-04-01', end: '2026-04-30' });
  });

  it('gecen ay artik yilda subatin 29 gununu bulur', () => {
    expect(resolvePeriod('lastMonth', null, null, '2028-03-10'))
      .toEqual({ start: '2028-02-01', end: '2028-02-29' });
  });

  it('bu ay ayin ilk gununde de dogru calisir', () => {
    expect(resolvePeriod('thisMonth', null, null, '2026-08-01'))
      .toEqual({ start: '2026-08-01', end: '2026-08-01' });
  });

  it('ozel aralik verilen tarihleri aynen dondurur', () => {
    expect(resolvePeriod('custom', '2026-01-05', '2026-02-09', '2026-08-27'))
      .toEqual({ start: '2026-01-05', end: '2026-02-09' });
  });

  it('bilinmeyen preset bu aya duser', () => {
    expect(resolvePeriod('zzz', null, null, '2026-08-27'))
      .toEqual({ start: '2026-08-01', end: '2026-08-27' });
  });
});

describe('validatePeriod', () => {
  it('gecerli aralik', () => {
    expect(validatePeriod({ start: '2026-08-01', end: '2026-08-27' })).toEqual({ ok: true });
  });

  it('eksik tarih', () => {
    expect(validatePeriod({ start: '2026-08-01', end: '' }))
      .toEqual({ ok: false, reason: 'incomplete' });
  });

  it('ters sirali aralik', () => {
    expect(validatePeriod({ start: '2026-08-27', end: '2026-08-01' }))
      .toEqual({ ok: false, reason: 'order' });
  });

  it('ayni gun gecerlidir', () => {
    expect(validatePeriod({ start: '2026-08-12', end: '2026-08-12' })).toEqual({ ok: true });
  });

  it('engel sebepleri metne cevrilir', () => {
    expect(periodBlockedMessage('order')).toMatch(/sonra olamaz/);
    expect(periodBlockedMessage('incomplete')).toMatch(/ikisini de girin/);
    expect(periodBlockedMessage('bilinmeyen')).toMatch(/kullanılamıyor/);
  });
});

describe('summarizePeriod — donem siniri', () => {
  const period = { start: '2026-08-01', end: '2026-08-31' };

  it('sinir gunleri araliga dahildir', () => {
    const logs = [
      debt(100, { id: 'a', date: '2026-08-01' }),
      debt(200, { id: 'b', date: '2026-08-31' }),
      debt(400, { id: 'c', date: '2026-07-31' }),
      debt(800, { id: 'd', date: '2026-09-01' })
    ];
    expect(summarizePeriod(logs, period).debtOpened).toBe(300);
  });

  it('gecmis tarihli giris `date` alanina gore doneme duser, `timestamp` etkilemez', () => {
    // Temmuzda olmus bir borc bugun girilmis: timestamp agustos, date temmuz
    const logs = [debt(500, { date: '2026-07-20', timestamp: Date.parse('2026-08-27') })];
    expect(summarizePeriod(logs, period).debtOpened).toBe(0);
    expect(summarizePeriod(logs, { start: '2026-07-01', end: '2026-07-31' }).debtOpened).toBe(500);
  });

  it('gecersiz aralik bos ozet dondurur', () => {
    const logs = [debt(100)];
    expect(summarizePeriod(logs, { start: '2026-08-31', end: '2026-08-01' }).debtOpened).toBe(0);
    expect(summarizePeriod(logs, null).debtOpened).toBe(0);
  });

  it('tarihi olmayan log sayilmaz', () => {
    expect(summarizePeriod([debt(100, { date: undefined })], period).debtOpened).toBe(0);
  });
});

describe('summarizePeriod — olculemeyen kayitlar', () => {
  const period = { start: '2026-08-01', end: '2026-08-31' };

  it('`flow` tasimayan eski log toplama girmez, sayilir', () => {
    const logs = [
      log({ id: 'eski', title: 'Hizmet Borcu' }),        // TASK-020 oncesi
      log({ id: 'cokEski', kind: undefined }),            // `kind` bile yok
      debt(100)
    ];
    const s = summarizePeriod(logs, period);
    expect(pick(s, ['debtOpened', 'unmeasured', 'movementCount']))
      .toEqual({ debtOpened: 100, unmeasured: 2, movementCount: 1 });
  });

  it('kilit logu ne toplanir ne olculemez sayilir', () => {
    const logs = [log({ kind: 'lock' }), debt(100)];
    expect(pick(summarizePeriod(logs, period), ['unmeasured', 'debtOpened']))
      .toEqual({ unmeasured: 0, debtOpened: 100 });
  });

  it('taninmayan bir `flow` sessizce toplanmaz', () => {
    const logs = [log({ flow: 'zzz', amount: 999 }), debt(100)];
    const s = summarizePeriod(logs, period);
    expect(pick(s, ['debtOpened', 'unmeasured', 'movementCount', 'receivableChange']))
      .toEqual({ debtOpened: 100, unmeasured: 1, movementCount: 1, receivableChange: 100 });
  });
});

describe('summarizePeriod — eleme kurallari', () => {
  const period = { start: '2026-08-01', end: '2026-08-31' };

  it('geri alinmis tahsilat ne toplanir ne olculemez sayilir', () => {
    const logs = [
      collect(300, { id: 'p1', batchId: 'pb1' }),
      advance(0 + 50, { id: 'p2', batchId: 'pb1' }),
      // Geri alma logu: `flow` tasimaz, `revertOf` ile grubu etkisiz kilar
      log({ id: 'r1', kind: 'payment', batchId: 'rb1', revertOf: 'pb1' })
    ];
    expect(pick(summarizePeriod(logs, period), ['collected', 'unmeasured', 'movementCount']))
      .toEqual({ collected: 0, unmeasured: 0, movementCount: 0 });
  });

  it('iptal edilmis islemin tum loglari elenir — borc hem acilmamis hem silinmis sayilmaz', () => {
    const logs = [
      debt(500, { id: 'e1', batchId: 'b1' }),
      log({ id: 'e2', flow: 'collect', amount: 100, batchId: 'b1' }),   // gomulu gecmis tahsilat
      log({ id: 'c1', kind: 'cancel', flow: 'cancel', amount: 400, batchId: 'b1' })
    ];
    const s = summarizePeriod(logs, period);
    expect(pick(s, ['debtOpened', 'collected', 'cancelled', 'receivableChange', 'unmeasured']))
      .toEqual({ debtOpened: 0, collected: 0, cancelled: 0, receivableChange: 0, unmeasured: 0 });
  });

  it('kalem iptali elenmez, azalis olarak sayilir', () => {
    // `batchId` yok — kismen odenmis gercek bir borcun kalanini silmek de bu yolu kullanir
    const logs = [
      debt(500, { id: 'e1', batchId: 'b1' }),
      log({ id: 'c1', kind: 'cancel', flow: 'cancel', amount: 500, debtId: 'd1' })
    ];
    const s = summarizePeriod(logs, period);
    expect(pick(s, ['debtOpened', 'cancelled', 'receivableChange']))
      .toEqual({ debtOpened: 500, cancelled: 500, receivableChange: 0 });
  });

  it('iptal baska bir donemde olsa da girisi kendi doneminden siler', () => {
    const logs = [
      debt(500, { id: 'e1', batchId: 'b1', date: '2026-08-10' }),
      log({ id: 'c1', kind: 'cancel', flow: 'cancel', amount: 500, batchId: 'b1', date: '2026-09-03' })
    ];
    expect(summarizePeriod(logs, period).debtOpened).toBe(0);
  });
});

describe('summarizePeriod — nakit ve avans', () => {
  const period = { start: '2026-08-01', end: '2026-08-31' };

  it('tahsilat + avansa yazilan = musteriden alinan nakit', () => {
    // 180 alindi, 150'si borclara dagitildi, 30'u avansa yazildi
    const logs = [
      collect(100, { id: 'p1', batchId: 'pb1' }),
      collect(50, { id: 'p2', batchId: 'pb1' }),
      advance(30, { id: 'p3', batchId: 'pb1' })
    ];
    const s = summarizePeriod(logs, period);
    expect(pick(s, ['collected', 'advanceIn', 'advanceUsed', 'receivableChange']))
      .toEqual({ collected: 180, advanceIn: 30, advanceUsed: 0, receivableChange: -150 });
  });

  it('avanstan odenen kisim nakde sayilmaz', () => {
    // 100 borctan dusuldu ama 40'i mevcut avanstan geldi: kasaya 60 girdi
    const logs = [
      collect(100, { id: 'p1', batchId: 'pb1' }),
      advance(-40, { id: 'p2', batchId: 'pb1' })
    ];
    const s = summarizePeriod(logs, period);
    expect(pick(s, ['collected', 'advanceIn', 'advanceUsed', 'receivableChange']))
      .toEqual({ collected: 60, advanceIn: 0, advanceUsed: 40, receivableChange: -100 });
  });

  it('yalnizca avans birakildiginda borc degismez', () => {
    const logs = [advance(250, { id: 'p1', batchId: 'pb1' })];
    const s = summarizePeriod(logs, period);
    expect(pick(s, ['collected', 'advanceIn', 'receivableChange']))
      .toEqual({ collected: 250, advanceIn: 250, receivableChange: 0 });
  });

  it('`balanceDelta` yalnizca avans logundan okunur, grup ici tekrarindan degil', () => {
    // `balanceDelta` odeme grubundaki HER loga kopyalanir; tahsilat loglarindan da
    // toplansaydi 30 yerine 90 sayilirdi
    const logs = [
      collect(100, { id: 'p1', batchId: 'pb1', balanceDelta: 30 }),
      collect(50, { id: 'p2', batchId: 'pb1', balanceDelta: 30 }),
      advance(30, { id: 'p3', batchId: 'pb1' })
    ];
    expect(summarizePeriod(logs, period).collected).toBe(180);
  });

  it('fazla iadenin avansa yazilan kismi nakit sayilmaz', () => {
    const logs = [log({ kind: 'return', flow: 'return', amount: 200, refund: 75 })];
    const s = summarizePeriod(logs, period);
    expect(pick(s, ['collected', 'returned', 'advanceIn', 'receivableChange']))
      .toEqual({ collected: 0, returned: 200, advanceIn: 75, receivableChange: -200 });
  });
});

describe('summarizePeriod — alacak degisimi', () => {
  const period = { start: '2026-08-01', end: '2026-08-31' };

  it('artislar ve azalislar netlenir', () => {
    const logs = [
      debt(1000, { id: 'e1' }),
      log({ id: 'i1', flow: 'inflation', amount: 50 }),
      log({ id: 'z1', kind: 'price', flow: 'priceUp', amount: 120, batchId: 'zb1' }),
      collect(400, { id: 'p1', batchId: 'pb1' }),
      log({ id: 'w1', kind: 'payment', flow: 'writeoff', amount: 8, batchId: 'pb1' }),
      log({ id: 'r1', kind: 'return', flow: 'return', amount: 60 })
    ];
    const s = summarizePeriod(logs, period);
    expect(pick(s, ['debtOpened', 'inflation', 'priceUp', 'writeoff', 'returned', 'collected']))
      .toEqual({ debtOpened: 1000, inflation: 50, priceUp: 120, writeoff: 8, returned: 60, collected: 400 });
    // 1000 + 50 + 120 - 400 - 8 - 60
    expect(s.receivableChange).toBe(702);
  });

  it('kurus artiklari 0,01 hassasiyetine yuvarlanir', () => {
    const logs = [debt(0.1), debt(0.2), collect(0.15, { batchId: 'pb1' })];
    const s = summarizePeriod(logs, period);
    expect(s.debtOpened).toBe(0.3);
    expect(s.receivableChange).toBe(0.15);
  });

  it('bos girdi bos ozet dondurur', () => {
    const s = summarizePeriod([], period);
    expect(pick(s, ['collected', 'debtOpened', 'receivableChange', 'unmeasured', 'movementCount']))
      .toEqual({ collected: 0, debtOpened: 0, receivableChange: 0, unmeasured: 0, movementCount: 0 });
    expect(summarizePeriod(null, period).collected).toBe(0);
  });
});

describe('classifyLog', () => {
  const none = { cancelledBatches: new Set(), neutralized: new Set() };

  it('normal para hareketi sayilir ve yonunu haritadan alir', () => {
    expect(classifyLog(log({ flow: 'debt', amount: 100 }), none))
      .toEqual({ status: 'counted', flow: 'debt', sign: 1, amount: 100 });
  });

  it('geri alma logu (revertOf) olmamis sayilir', () => {
    expect(classifyLog(log({ revertOf: 'b1' }), none).status).toBe('reverted');
  });

  it('etkisiz kilinmis grubun uyesi olmamis sayilir', () => {
    const ex = { ...none, neutralized: new Set(['b1']) };
    expect(classifyLog(log({ flow: 'collect', amount: 50, batchId: 'b1' }), ex).status)
      .toBe('reverted');
  });

  it('iptal edilmis islemin uyesi hic acilmamis sayilir', () => {
    const ex = { ...none, cancelledBatches: new Set(['b1']) };
    expect(classifyLog(log({ flow: 'debt', amount: 50, batchId: 'b1' }), ex).status)
      .toBe('cancelled');
  });

  it('fiyat kilidi bilgi satiridir', () => {
    expect(classifyLog(log({ kind: 'lock' }), none).status).toBe('info');
  });

  it('flow tasimayan eski kayit olculemez', () => {
    expect(classifyLog(log({ amount: 100 }), none).status).toBe('unmeasured');
  });

  it('taninmayan flow sessizce sayilmaz — fail-closed', () => {
    const r = classifyLog(log({ flow: 'yeniAkis', amount: 100 }), none);
    expect(r).toMatchObject({ status: 'unmeasured', flow: 'yeniAkis', sign: 0 });
  });

  it('avans alacagi etkilemez ama yine de sayilan bir harekettir', () => {
    expect(classifyLog(log({ flow: 'advance', balanceDelta: 100, amount: 100 }), none))
      .toMatchObject({ status: 'counted', sign: 0 });
  });

  // `statementExport` bakiyeyi yururken yalnizca `counted` satirlari topluyor. Bu invariant
  // olmasa "sayilmayan ama yonu olan" bir durum bakiyeyi sessizce kaydirirdi.
  it.each(['reverted', 'cancelled', 'info', 'unmeasured'])(
    '%s durumundaki satirin yonu her zaman sifir',
    (status) => {
      const samples = {
        reverted: log({ flow: 'debt', amount: 100, revertOf: 'x' }),
        cancelled: log({ flow: 'debt', amount: 100, batchId: 'b1' }),
        info: log({ flow: 'debt', amount: 100, kind: 'lock' }),
        unmeasured: log({ amount: 100 })
      };
      const ex = { ...none, cancelledBatches: new Set(['b1']) };
      const r = classifyLog(samples[status], ex);
      expect(r.status).toBe(status);
      expect(r.sign).toBe(0);
    }
  );

  it('bos girdide patlamaz', () => {
    expect(classifyLog(null, none).status).toBe('unmeasured');
    expect(classifyLog(log({ flow: 'debt', amount: 1 }), undefined).status).toBe('counted');
  });
});

describe('buildExclusions', () => {
  it('iptal ve geri alma kumelerini birlikte cikarir', () => {
    const ex = buildExclusions([
      log({ kind: 'cancel', batchId: 'c1' }),
      log({ revertOf: 'p1' })
    ]);
    expect([...ex.cancelledBatches]).toEqual(['c1']);
    expect([...ex.neutralized]).toEqual(['p1']);
  });
});

describe('FLOW_RECEIVABLE_SIGN — switch ile dikis', () => {
  const period = { start: '2026-08-01', end: '2026-08-31' };

  // Haritadaki her akisin `summarizePeriod` icinde gercekten bir kovasi olmali. Yeni bir
  // akis eklenip switch unutulursa `default` dali onu `unmeasured` yapar ve bu test isirir.
  it.each(Object.entries(FLOW_RECEIVABLE_SIGN))(
    'flow %s: alacak degisimi isaret x tutar',
    (flow, sign) => {
      const s = summarizePeriod([log({ flow, amount: 200, balanceDelta: 200 })], period);
      expect(s.receivableChange).toBe(200 * sign);
      expect(s.unmeasured).toBe(0);
      expect(s.movementCount).toBe(1);
    }
  );

  it('haritada olmayan akis toplamlara sizmaz', () => {
    const s = summarizePeriod([log({ flow: 'bilinmeyen', amount: 200 })], period);
    expect(s).toMatchObject({ receivableChange: 0, unmeasured: 1, movementCount: 0 });
  });
});
