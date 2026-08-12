import { describe, it, expect } from 'vitest';
import { groupDrugDebtsByBatch } from './debtGrouping';

const debt = (over = {}) => ({
  id: 'debt1',
  drugId: 'drug1',
  qty: 2,
  maxPrice: 100,
  isFixed: false,
  date: '2026-08-12',
  createdAt: 1000,
  ...over
});

describe('groupDrugDebtsByBatch', () => {
  it('ayni batchId tasiyan kayitlari tek grupta toplar', () => {
    const groups = groupDrugDebtsByBatch([
      debt({ id: 'a', batchId: 'b1' }),
      debt({ id: 'b', batchId: 'b1' }),
      debt({ id: 'c', batchId: 'b1' })
    ]);

    expect(groups).toHaveLength(1);
    expect(groups[0].batchId).toBe('b1');
    expect(groups[0].itemCount).toBe(3);
    expect(groups[0].items.map(i => i.id)).toEqual(['a', 'b', 'c']);
  });

  it('batchId tasimayan eski kayitlari tek kalemlik gruplara ayirir', () => {
    const groups = groupDrugDebtsByBatch([
      debt({ id: 'eski1', batchId: undefined, createdAt: undefined }),
      debt({ id: 'eski2', batchId: undefined, createdAt: undefined })
    ]);

    expect(groups).toHaveLength(2);
    expect(groups.every(g => g.itemCount === 1)).toBe(true);
    expect(groups.map(g => g.batchId).sort()).toEqual(['eski1', 'eski2']);
  });

  it('eski ve yeni kayitlari birlikte dogru gruplar', () => {
    const groups = groupDrugDebtsByBatch([
      debt({ id: 'a', batchId: 'b1' }),
      debt({ id: 'eski', batchId: undefined }),
      debt({ id: 'b', batchId: 'b1' })
    ]);

    expect(groups).toHaveLength(2);
    expect(groups.find(g => g.batchId === 'b1').itemCount).toBe(2);
    expect(groups.find(g => g.batchId === 'eski').itemCount).toBe(1);
  });

  it('gruplari tarihe gore yeniden eskiye siralar', () => {
    const groups = groupDrugDebtsByBatch([
      debt({ id: 'a', batchId: 'b1', date: '2026-07-15' }),
      debt({ id: 'b', batchId: 'b2', date: '2026-08-12' }),
      debt({ id: 'c', batchId: 'b3', date: '2026-07-28' })
    ]);

    expect(groups.map(g => g.batchId)).toEqual(['b2', 'b3', 'b1']);
  });

  it('ayni tarihte createdAt yeniden eskiye siralanir', () => {
    const groups = groupDrugDebtsByBatch([
      debt({ id: 'a', batchId: 'b1', date: '2026-08-12', createdAt: 100 }),
      debt({ id: 'b', batchId: 'b2', date: '2026-08-12', createdAt: 300 }),
      debt({ id: 'c', batchId: 'b3', date: '2026-08-12', createdAt: 200 })
    ]);

    expect(groups.map(g => g.batchId)).toEqual(['b2', 'b3', 'b1']);
  });

  it('createdAt alani olmayan kayitlarda hata vermez ve en sona duser', () => {
    const groups = groupDrugDebtsByBatch([
      debt({ id: 'eski', batchId: 'b1', date: '2026-08-12', createdAt: undefined }),
      debt({ id: 'yeni', batchId: 'b2', date: '2026-08-12', createdAt: 500 })
    ]);

    expect(groups.map(g => g.batchId)).toEqual(['b2', 'b1']);
    expect(groups[1].createdAt).toBe(0);
  });

  it('grup toplamini 0.01 TL hassasiyetinde hesaplar', () => {
    const groups = groupDrugDebtsByBatch([
      debt({ id: 'a', batchId: 'b1', qty: 3, maxPrice: 0.1 }),
      debt({ id: 'b', batchId: 'b1', qty: 3, maxPrice: 0.2 })
    ]);

    // 0.30000000000000004 + 0.6000000000000001 → 0.9
    expect(groups[0].total).toBe(0.9);
  });

  it('zenginlestirilmis satirda tlValue degerini kullanir', () => {
    const groups = groupDrugDebtsByBatch([
      debt({ id: 'a', batchId: 'b1', tlValue: 250, drugName: 'Amoksisilin' }),
      debt({ id: 'b', batchId: 'b1', tlValue: 150, drugName: 'Vitamin B12' })
    ]);

    expect(groups[0].total).toBe(400);
    expect(groups[0].items[0].drugName).toBe('Amoksisilin');
  });

  it('hasFixed ve allFixed bayraklarini karisik grupta dogru hesaplar', () => {
    const [mixed] = groupDrugDebtsByBatch([
      debt({ id: 'a', batchId: 'b1', isFixed: true }),
      debt({ id: 'b', batchId: 'b1', isFixed: false })
    ]);
    expect(mixed.hasFixed).toBe(true);
    expect(mixed.allFixed).toBe(false);

    const [allLocked] = groupDrugDebtsByBatch([
      debt({ id: 'a', batchId: 'b2', isFixed: true }),
      debt({ id: 'b', batchId: 'b2', isFixed: true })
    ]);
    expect(allLocked.hasFixed).toBe(true);
    expect(allLocked.allFixed).toBe(true);

    const [allFree] = groupDrugDebtsByBatch([
      debt({ id: 'a', batchId: 'b3', isFixed: false }),
      debt({ id: 'b', batchId: 'b3', isFixed: false })
    ]);
    expect(allFree.hasFixed).toBe(false);
    expect(allFree.allFixed).toBe(false);
  });

  it('bos veya tanimsiz girdi icin bos dizi doner', () => {
    expect(groupDrugDebtsByBatch([])).toEqual([]);
    expect(groupDrugDebtsByBatch(undefined)).toEqual([]);
  });
});
