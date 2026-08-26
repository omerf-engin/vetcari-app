import { describe, it, expect } from 'vitest';
import { latestPaymentBatch, canRevertPayment, revertPaymentBlockedMessage } from './paymentRevert';

const payLog = (over = {}) => ({
  id: 'l1', kind: 'payment', customerId: 'c1', debtId: 'd1', batchId: 'p1',
  timestamp: 1000, deduct: 100, balanceDelta: 0,
  before: { customerId: 'c1', drugId: 'drug1', qty: 5, maxPrice: 100, isFixed: false },
  ...over
});

describe('latestPaymentBatch', () => {
  it('en yeni tahsilat grubunu loglariyla birlikte doner', () => {
    const logs = [
      payLog({ id: 'l1', batchId: 'p1', timestamp: 1000 }),
      payLog({ id: 'l2', batchId: 'p2', timestamp: 5000, debtId: 'd2' }),
      payLog({ id: 'l3', batchId: 'p2', timestamp: 5001, debtId: 'd3' })
    ];

    const batch = latestPaymentBatch('c1', logs);
    expect(batch.batchId).toBe('p2');
    expect(batch.logs).toHaveLength(2);
    expect(batch.timestamp).toBe(5001);
  });

  it('toplam dusum ve bakiye deltasini hesaplar', () => {
    const logs = [
      payLog({ id: 'l1', deduct: 100, balanceDelta: 50 }),
      payLog({ id: 'l2', debtId: 'd2', deduct: 250, balanceDelta: 50 })
    ];

    const batch = latestPaymentBatch('c1', logs);
    expect(batch.totalDeducted).toBe(350);
    expect(batch.balanceDelta).toBe(50);
  });

  it('borca dokunmayan avans logunu debtLogs disinda tutar', () => {
    const logs = [
      payLog({ id: 'l1', deduct: 100 }),
      payLog({ id: 'l2', debtId: 'p1', before: undefined, deduct: undefined, balanceDelta: 400 })
    ];

    const batch = latestPaymentBatch('c1', logs);
    expect(batch.logs).toHaveLength(2);
    expect(batch.debtLogs.map(l => l.id)).toEqual(['l1']);
  });

  it('yalnizca avanstan olusan tahsilat da grup olusturur', () => {
    const logs = [payLog({ debtId: 'p1', before: undefined, deduct: undefined, balanceDelta: 500 })];

    const batch = latestPaymentBatch('c1', logs);
    expect(batch.balanceDelta).toBe(500);
    expect(batch.debtLogs).toHaveLength(0);
  });

  it('yapisal veri tasimayan eski tahsilatlari yok sayar', () => {
    expect(latestPaymentBatch('c1', [payLog({ balanceDelta: undefined })])).toBeNull();
    expect(latestPaymentBatch('c1', [payLog({ batchId: undefined })])).toBeNull();
  });

  it('baska musterinin tahsilatini almaz', () => {
    expect(latestPaymentBatch('c1', [payLog({ customerId: 'baska' })])).toBeNull();
  });
});

describe('canRevertPayment', () => {
  it('dokunulmamis son tahsilat geri alinabilir', () => {
    const result = canRevertPayment('c1', [payLog()]);
    expect(result.ok).toBe(true);
    expect(result.batch.batchId).toBe('p1');
  });

  it('yapisal verisi olmayan eski tahsilat legacy doner', () => {
    expect(canRevertPayment('c1', [payLog({ balanceDelta: undefined })]))
      .toEqual({ ok: false, reason: 'legacy' });
  });

  it('daha yeni bir tahsilat varsa eskisi geri alinamaz', () => {
    const logs = [
      payLog({ id: 'l1', batchId: 'p1', timestamp: 1000 }),
      payLog({ id: 'l2', batchId: 'p2', timestamp: 2000, debtId: 'd2' })
    ];

    // En yenisi p2 secilir ve o geri alinabilir
    expect(canRevertPayment('c1', logs).batch.batchId).toBe('p2');
  });

  it('geri alinmis tahsilat ikinci kez geri alinamaz', () => {
    // Geri alma logu `balanceDelta` tasimaz: aday olmaz ama not-latest sinyali verir
    const logs = [
      payLog({ batchId: 'p1', timestamp: 1000 }),
      { id: 'l2', kind: 'payment', customerId: 'c1', debtId: 'd1', batchId: 'rev1', timestamp: 2000 }
    ];

    expect(canRevertPayment('c1', logs)).toEqual({ ok: false, reason: 'not-latest' });
  });

  it('tahsilattan sonra iade veya zam inmisse activity doner', () => {
    expect(canRevertPayment('c1', [
      payLog({ timestamp: 1000 }),
      { id: 'l2', debtId: 'd1', kind: 'return', timestamp: 2000 }
    ])).toEqual({ ok: false, reason: 'activity' });

    expect(canRevertPayment('c1', [
      payLog({ timestamp: 1000 }),
      { id: 'l2', debtId: 'd1', kind: 'price', timestamp: 2000 }
    ])).toEqual({ ok: false, reason: 'activity' });
  });

  it('borcun girisi iptal edilmisse activity doner', () => {
    const logs = [
      payLog({ timestamp: 1000 }),
      { id: 'l2', debtId: 'd1', kind: 'cancel', timestamp: 2000 }
    ];
    expect(canRevertPayment('c1', logs)).toEqual({ ok: false, reason: 'activity' });
  });

  it('tahsilattan onceki aktivite engellemez', () => {
    const logs = [
      payLog({ timestamp: 5000 }),
      { id: 'l2', debtId: 'd1', kind: 'price', timestamp: 1000 }
    ];
    expect(canRevertPayment('c1', logs).ok).toBe(true);
  });

  it('kilit degisimi engellemez', () => {
    const logs = [payLog({ timestamp: 1000 }), { id: 'l2', debtId: 'd1', kind: 'lock', timestamp: 2000 }];
    expect(canRevertPayment('c1', logs).ok).toBe(true);
  });

  it('kind tasimayan yabanci log fail-closed engeller', () => {
    const logs = [payLog({ timestamp: 1000 }), { id: 'l2', debtId: 'd1', timestamp: 2000 }];
    expect(canRevertPayment('c1', logs).reason).toBe('activity');
  });

  it('bos girdide legacy doner', () => {
    expect(canRevertPayment('c1', [])).toEqual({ ok: false, reason: 'legacy' });
    expect(canRevertPayment(undefined, undefined)).toEqual({ ok: false, reason: 'legacy' });
  });
});

describe('revertPaymentBlockedMessage', () => {
  it('her sebep icin kullaniciya donuk metin doner', () => {
    expect(revertPaymentBlockedMessage('not-latest')).toMatch(/son tahsilat/i);
    expect(revertPaymentBlockedMessage('activity')).toMatch(/başka bir işlem/i);
    expect(revertPaymentBlockedMessage('legacy')).toMatch(/eski kayıt/i);
  });
});
