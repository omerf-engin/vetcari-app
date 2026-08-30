import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ToastProvider } from '../../contexts/ToastContext';
import StatementExportModal from './StatementExportModal';
import { downloadTextFile } from '../../utils/download';

// Indirme DOM'a ve `URL.createObjectURL`e dokunan tek yer; jsdom'da yok, mock'lanir.
vi.mock('../../utils/download', () => ({ downloadTextFile: vi.fn() }));

let seq = 0;
const log = (over = {}) => ({
  id: `l${++seq}`,
  date: '2026-08-12',
  timestamp: seq * 1000,
  kind: 'entry',
  flow: 'debt',
  amount: 500,
  title: 'Borç Açıldı',
  message: 'test borcu',
  sourceLabel: 'Hizmet: Muayene',
  ...over
});

const openModal = ({ logs = [log()], ...rest } = {}) => {
  const onClose = vi.fn();
  render(
    <ToastProvider>
      <StatementExportModal
        customerName="Ali Veli"
        logs={logs}
        advanceBalance={0}
        onClose={onClose}
        {...rest}
      />
    </ToastProvider>
  );
  return { onClose };
};

const downloadButton = () => screen.getByRole('button', { name: /CSV İndir/ });

beforeEach(() => {
  vi.clearAllMocks();
});

describe('StatementExportModal', () => {
  it('varsayilan donem tum islemlerdir', () => {
    openModal();
    expect(screen.getByRole('button', { name: 'Tüm İşlemler' })).toHaveClass('bg-indigo-600');
  });

  it('disa aktarilacak hareket sayisini ve dosya adini onceden gosterir', () => {
    openModal({ logs: [log(), log({ date: '2026-08-15' })] });

    expect(screen.getByText('2')).toBeInTheDocument();
    expect(screen.getByText(/ali-veli-ekstre-/)).toBeInTheDocument();
  });

  it('indirmede dosya adi ve BOM ile baslayan icerik gecer', () => {
    const { onClose } = openModal();
    fireEvent.click(downloadButton());

    expect(downloadTextFile).toHaveBeenCalledTimes(1);
    const [filename, text] = downloadTextFile.mock.calls[0];
    expect(filename).toMatch(/^ali-veli-ekstre-\d{4}-\d{2}-\d{2}\.csv$/);
    expect(text.charCodeAt(0)).toBe(0xFEFF);
    expect(text).toContain('Ali Veli');
    expect(text).toContain('Borç Açıldı');
    expect(onClose).toHaveBeenCalled();
  });

  it('bos ekstrede indirme yapilmaz, uyari toast gosterilir', () => {
    const { onClose } = openModal({ logs: [] });
    fireEvent.click(downloadButton());

    expect(downloadTextFile).not.toHaveBeenCalled();
    expect(screen.getByText('Bu aralıkta dışa aktarılacak hareket yok.')).toBeInTheDocument();
    // Modal acik kalir ki kullanici baska bir donem secebilsin
    expect(onClose).not.toHaveBeenCalled();
  });

  it('secilen donem disindaki hareketler sayilmaz', () => {
    openModal({ logs: [log({ date: '2020-01-05' })] });

    fireEvent.click(screen.getByRole('button', { name: 'Bu Ay' }));
    fireEvent.click(downloadButton());

    expect(downloadTextFile).not.toHaveBeenCalled();
    expect(screen.getByText('Bu aralıkta dışa aktarılacak hareket yok.')).toBeInTheDocument();
  });

  it('ozel aralikta ters tarih indirmeyi engeller', () => {
    openModal();
    fireEvent.click(screen.getByRole('button', { name: 'Özel Aralık' }));
    fireEvent.change(screen.getByLabelText('Başlangıç Tarihi'), { target: { value: '2026-08-20' } });
    fireEvent.change(screen.getByLabelText('Bitiş Tarihi'), { target: { value: '2026-08-01' } });

    expect(screen.getByText(/sonra olamaz/)).toBeInTheDocument();
    expect(downloadButton()).toBeDisabled();

    fireEvent.click(downloadButton());
    expect(downloadTextFile).not.toHaveBeenCalled();
  });

  it('olculemeyen kayit varsa uyari gosterilir', () => {
    openModal({ logs: [log(), log({ flow: undefined, amount: undefined, title: 'Eski Kayıt' })] });

    expect(screen.getByText(/tutar bilgisi tutulmadan yazılmış/)).toBeInTheDocument();
  });

  it('olculemeyen kayit yoksa uyari gosterilmez', () => {
    openModal();
    expect(screen.queryByText(/tutar bilgisi tutulmadan yazılmış/)).not.toBeInTheDocument();
  });

  it('Escape modali kapatir', () => {
    const { onClose } = openModal();
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onClose).toHaveBeenCalled();
  });

  it('Vazgec indirmeden kapatir', () => {
    const { onClose } = openModal();
    fireEvent.click(screen.getByRole('button', { name: 'Vazgeç' }));

    expect(downloadTextFile).not.toHaveBeenCalled();
    expect(onClose).toHaveBeenCalled();
  });
});
