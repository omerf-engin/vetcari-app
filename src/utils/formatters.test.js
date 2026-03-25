import { describe, it, expect } from 'vitest';
import { fmtTL, fmtQty, fmtDate } from './formatters';

describe('fmtTL', () => {
  it('tam sayiyi formatlar', () => {
    expect(fmtTL(1000)).toBe('1.000 ₺');
  });

  it('ondalikli sayiyi formatlar', () => {
    expect(fmtTL(99.5)).toBe('99,5 ₺');
  });

  it('sifiri formatlar', () => {
    expect(fmtTL(0)).toBe('0 ₺');
  });

  it('string girisi number olarak isler', () => {
    expect(fmtTL('250')).toBe('250 ₺');
  });
});

describe('fmtQty', () => {
  it('tam adet formatlar', () => {
    expect(fmtQty(5)).toBe('5');
  });

  it('ondalikli adedi formatlar', () => {
    expect(fmtQty(3.75)).toBe('3,75');
  });

  it('sifiri formatlar', () => {
    expect(fmtQty(0)).toBe('0');
  });
});

describe('fmtDate', () => {
  it('ISO tarih stringini TR formatina cevirir', () => {
    const result = fmtDate('2025-03-15');
    expect(result).toContain('2025');
    expect(result).toContain('15');
  });

  it('bos/null input icin tire doner', () => {
    expect(fmtDate(null)).toBe('-');
    expect(fmtDate(undefined)).toBe('-');
    expect(fmtDate('')).toBe('-');
  });
});
