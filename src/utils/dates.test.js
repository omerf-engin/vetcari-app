import { describe, it, expect, beforeAll, afterAll, afterEach, vi } from 'vitest';
import { toLocalDateStr, todayLocal } from './dates';

// Hata yalnizca UTC'den ileri saat dilimlerinde ortaya cikiyor; testler
// uygulamanin calistigi dilimi (UTC+3) sabitler.
const originalTZ = process.env.TZ;
beforeAll(() => { process.env.TZ = 'Europe/Istanbul'; });
afterAll(() => { process.env.TZ = originalTZ; });

describe('toLocalDateStr', () => {
  it('UTC bir onceki gune duserken yerel gunu korur', () => {
    // 12 Agustos 21:45 UTC = Turkiye saatiyle 13 Agustos 00:45
    const instant = new Date(Date.UTC(2026, 7, 12, 21, 45));
    expect(instant.toISOString().split('T')[0]).toBe('2026-08-12'); // eski (hatali) davranis
    expect(toLocalDateStr(instant)).toBe('2026-08-13');
  });

  it('gun sonunda ertesi gune kaymaz', () => {
    expect(toLocalDateStr(new Date(2026, 7, 13, 23, 59, 59))).toBe('2026-08-13');
  });

  it('ay ve gunu iki haneye tamamlar', () => {
    expect(toLocalDateStr(new Date(2026, 0, 5, 12, 0))).toBe('2026-01-05');
  });
});

describe('todayLocal', () => {
  afterEach(() => { vi.useRealTimers(); });

  it('gece yarisindan sonra (00:45) o gunun tarihini doner', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 7, 13, 0, 45));
    expect(todayLocal()).toBe('2026-08-13');
  });

  it('gun icinde ayni tarihi doner', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 7, 13, 14, 30));
    expect(todayLocal()).toBe('2026-08-13');
  });

  it('YYYY-MM-DD formatinda doner', () => {
    expect(todayLocal()).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});
