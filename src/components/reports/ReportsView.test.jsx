import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import ReportsView from './ReportsView';

// Donem preset'leri "bugun"e gore hesaplandigi icin saat sabitlenir; aksi halde testler
// ay basinda/sonunda kendiliginden kirilirdi.
const TODAY = '2026-08-27';

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date(2026, 7, 27, 12, 0, 0)); // yerel 27 Agustos 2026
});

afterEach(() => {
  vi.useRealTimers();
});

const log = (over = {}) => ({ id: 'l1', date: TODAY, timestamp: 1000, kind: 'entry', ...over });

const openReports = (transactions = []) => render(<ReportsView transactions={transactions} />);

describe('ReportsView — dönem seçici', () => {
  it('varsayilan olarak bu ay secilidir', () => {
    openReports();
    expect(screen.getByRole('button', { name: 'Bu Ay' })).toHaveClass('bg-indigo-600');
  });

  it('ozel aralik secilene kadar tarih girisleri gorunmez', () => {
    openReports();
    expect(screen.queryByLabelText(/Başlangıç Tarihi/)).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Özel Aralık' }));
    expect(screen.getByLabelText(/Başlangıç Tarihi/)).toBeInTheDocument();
    expect(screen.getByLabelText(/Bitiş Tarihi/)).toBeInTheDocument();
  });

  it('baslangic bitisten sonraysa uyari gosterilir ve toplamlar gizlenir', () => {
    openReports([log({ flow: 'debt', amount: 500 })]);

    fireEvent.click(screen.getByRole('button', { name: 'Özel Aralık' }));
    fireEvent.change(screen.getByLabelText(/Başlangıç Tarihi/), { target: { value: '2026-08-20' } });
    fireEvent.change(screen.getByLabelText(/Bitiş Tarihi/), { target: { value: '2026-08-10' } });

    expect(screen.getByText(/Başlangıç tarihi bitiş tarihinden sonra olamaz/)).toBeInTheDocument();
    expect(screen.queryByText('Dönem Tahsilatı')).not.toBeInTheDocument();
  });

  it('donem degisince toplamlar yeniden hesaplanir', () => {
    // Temmuzda 500, agustosta 200 borc acilmis
    openReports([
      log({ id: 'a', flow: 'debt', amount: 500, date: '2026-07-15' }),
      log({ id: 'b', flow: 'debt', amount: 200, date: '2026-08-15' })
    ]);

    expect(screen.getByText('200 ₺')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Geçen Ay' }));
    expect(screen.getByText('500 ₺')).toBeInTheDocument();
  });
});

describe('ReportsView — toplamlar', () => {
  it('tahsilat, acilan borc ve alacak degisimi gosterilir', () => {
    openReports([
      log({ id: 'a', flow: 'debt', amount: 1000 }),
      log({ id: 'b', kind: 'payment', flow: 'collect', amount: 400, batchId: 'pb1' })
    ]);

    expect(screen.getByText('Dönem Tahsilatı')).toBeInTheDocument();
    expect(screen.getByText('400 ₺')).toBeInTheDocument();
    expect(screen.getByText('1.000 ₺')).toBeInTheDocument();
    expect(screen.getByText('+600 ₺')).toBeInTheDocument();
    expect(screen.getByText(/Toplam alacak bu dönemde arttı/)).toBeInTheDocument();
  });

  it('alacak azaldiginda isaret ve metin degisir', () => {
    openReports([log({ kind: 'payment', flow: 'collect', amount: 400, batchId: 'pb1' })]);

    expect(screen.getByText('-400 ₺')).toBeInTheDocument();
    expect(screen.getByText(/Toplam alacak bu dönemde azaldı/)).toBeInTheDocument();
  });

  it('hareket dokumu satirlari gosterilir', () => {
    openReports([log({ flow: 'inflation', amount: 75 })]);

    expect(screen.getByText('Enflasyon ile artan borç')).toBeInTheDocument();
    expect(screen.getByText('75 ₺')).toBeInTheDocument();
    expect(screen.getByText('Avansa yazılan')).toBeInTheDocument();
  });
});

describe('ReportsView — ölçülemeyen kayıtlar ve boş durum', () => {
  it('tutar tasimayan eski kayitlar icin uyari seridi cikar', () => {
    openReports([
      log({ id: 'eski', title: 'Hizmet Borcu' }),
      log({ id: 'eski2', title: 'Borç Açıldı' }),
      log({ id: 'yeni', flow: 'debt', amount: 100 })
    ]);

    expect(screen.getByText(/Bu dönemin bir kısmı ölçülemiyor/)).toBeInTheDocument();
    expect(screen.getByText(/2 kayıt tutar bilgisi tutulmadan yazılmış/)).toBeInTheDocument();
  });

  it('olculebilir kayit varsa uyari cikmaz', () => {
    openReports([log({ flow: 'debt', amount: 100 })]);
    expect(screen.queryByText(/ölçülemiyor/)).not.toBeInTheDocument();
  });

  it('hareket yoksa bos durum gosterilir', () => {
    openReports([]);
    expect(screen.getByText('Bu dönemde para hareketi yok')).toBeInTheDocument();
    expect(screen.queryByText('Dönem Tahsilatı')).not.toBeInTheDocument();
  });

  it('yalnizca olculemeyen kayit varsa bos durum degil uyari gosterilir', () => {
    openReports([log({ title: 'Hizmet Borcu' })]);
    expect(screen.queryByText('Bu dönemde para hareketi yok')).not.toBeInTheDocument();
    expect(screen.getByText(/Bu dönemin bir kısmı ölçülemiyor/)).toBeInTheDocument();
  });
});
